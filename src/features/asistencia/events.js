/* ================= EVENTOS (datos) ================= */
// Entrenos, partidos y reuniones de Asistencia (antes el array attEvents de
// js/core/state.js), con la respuesta de cada jugadora en ev.attendance
// ('yes' | 'no' | 'pending') y su comentario en ev.comments.
//
// Lo leen también Partidos, Tercer tiempo, Wellness, Fantasy, Mi perfil, Tullidas...
// No es reactivo a propósito: igual que antes, cada vista solo cambia cuando alguien
// la vuelve a pintar (renderEventList(), renderEventDetail(), renderNextMatchBanner()...).
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { myProfile, roster } from '../../lib/roster.js';
import { weekdayFullLabel, formatShortDate, autoMonthAbbr } from '../../lib/dates.js';
import { forgetTullidesForEvent } from '../tullidas/tullidas.svelte.js';
import { SEASON, autoTrainingDates, autoTrainingId } from '../../../supabase/functions/_shared/season.js';

export const attEvents = [];

// Evento abierto ahora mismo en el detalle de Asistencia, o null. Lo cambia también
// "Tullidas" desde el banner de Inicio (src/features/tullidas). No es reactivo: el
// detalle solo cambia al volver a pintarlo.
export const attSelection = { currentEventId: null };

// ---- Permisos: "Añadir evento" en Asistencia ----
// Entrenador/a, delegado/a, junta directiva y Capitana pueden crear/editar/borrar
// eventos (a Capitana se le da aparte, porque jugadora normal no tiene este permiso:
// ver el comentario sobre effectiveRoleForPermissions en src/lib/permissions.js).
export const rolesWithEventManagement = ['entrenador/a', 'delegado/a', 'directiva', 'Capitana'];
export function canManageEvents() {
  // Ojo: aquí NO se pasa por effectiveRoleForPermissions, porque este es justo un
  // permiso donde Capitana y jugadora se diferencian (jugadora normal no lo tiene).
  return auth.isAdmin || rolesWithEventManagement.includes(myProfile.rol);
}

// Sede fija para la opción rápida "🏠 Casa": siempre enlaza con el CEM Mar Bella,
// independientemente de lo que se haya escrito antes en el campo Lugar.
export const HOME_VENUE = {
  display: 'CEM Mar Bella',
  mapsQuery: 'CEM Mar Bella, Av. del Litoral, Barcelona',
};

// El campo Lugar funciona como un buscador enlazado con Google Maps: lo que se escribe
// se usa como término de búsqueda (p.ej. "campo de rugby vallecas") y se genera un enlace
// directo a esa ubicación en Maps, sin necesidad de elegir de una lista.
export function buildMapsSearchUrl(query) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

// Genera un id único de verdad (no un simple contador local), para que dos personas
// creando un evento en dispositivos distintos casi a la vez nunca puedan chocar.
export function generateCustomEventId() {
  return 'ce' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const pendingForEveryone = () => Object.fromEntries(roster.map((p) => [p.id, 'pending']));

// ---- Generación automática de entrenos — temporada 2026-2027 ----
// El calendario (días, horas y festivos) vive en supabase/functions/_shared/season.js,
// porque la función de Supabase de los recordatorios de asistencia necesita la misma lista.
function generateAutoTrainings() {
  return autoTrainingDates().map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return {
      id: autoTrainingId(iso),
      label: 'Entreno',
      type: 'training',
      date: d,
      month: autoMonthAbbr[m - 1],
      iso,
      when: `${weekdayFullLabel(dow)} ${formatShortDate(iso)} · ${SEASON.place} · ${SEASON.startTime.replace('h', '')} - ${SEASON.endTime}`,
      place: SEASON.place,
      placeMapsUrl: buildMapsSearchUrl(SEASON.mapsQuery),
      isHome: true,
      meetTime: SEASON.meetTime,
      startTime: SEASON.startTime,
      endTime: SEASON.endTime,
      attendance: pendingForEveryone(),
      comments: {},
    };
  });
}

// Al arrancar (src/main.js): los entrenos de la temporada y el partido fijo.
export function initEvents() {
  attEvents.push(...generateAutoTrainings());

  // Partido añadido manualmente: CNPN (casa) vs Santboi, sábado 26/09/2026.
  attEvents.push({
    id: 'ce1',
    type: 'match',
    label: 'Partido vs Santboi',
    date: 26,
    month: 'Sep',
    iso: '2026-09-26',
    when: `${weekdayFullLabel(6)} ${formatShortDate('2026-09-26')} · ${HOME_VENUE.display} · 17:30h`,
    place: HOME_VENUE.display,
    placeMapsUrl: buildMapsSearchUrl(HOME_VENUE.mapsQuery),
    isHome: true,
    meetTime: '',
    startTime: '17:30h',
    endTime: '',
    attendance: pendingForEveryone(),
    comments: {},
  });
}

// ---- Eventos compartidos (Supabase, tabla att_events) ----
// Los entrenos automáticos de la temporada NO necesitan guardarse: su id es la fecha y
// se generan igual en cualquier sesión. Pero los que crea o edita a mano el delegado/a
// (entrenos sueltos, partidos, reuniones) se guardan aquí para que aparezcan igual en
// el dispositivo de cualquier persona.
function eventMetaForStorage(ev) {
  return {
    id: ev.id, type: ev.type, label: ev.label, date: ev.date, month: ev.month, iso: ev.iso,
    when_text: ev.when, place: ev.place, place_maps_url: ev.placeMapsUrl, is_home: ev.isHome,
    meet_time: ev.meetTime, start_time: ev.startTime, end_time: ev.endTime, intensity: ev.intensity || null,
  };
}
// Vuelve a montar un evento en el formato que usa la app a partir de una fila de la tabla
function eventFromStorageRow(row) {
  return {
    id: row.id, type: row.type, label: row.label, date: row.date, month: row.month, iso: row.iso,
    when: row.when_text, place: row.place, placeMapsUrl: row.place_maps_url, isHome: row.is_home,
    meetTime: row.meet_time, startTime: row.start_time, endTime: row.end_time, intensity: row.intensity || null,
  };
}

// Nuevo evento con la asistencia de toda la plantilla "pendiente". Entrenos y partidos
// llevan control de asistencia del equipo; las reuniones no.
export function withEmptyAttendance(ev) {
  ev.attendance = (ev.type === 'training' || ev.type === 'match') ? pendingForEveryone() : {};
  return ev;
}

export async function saveEventToStorage(ev) {
  const { error } = await supabase.from('att_events').upsert(eventMetaForStorage(ev));
  if (error) console.error('No se ha podido guardar el evento', error);
}

export async function deleteEventFromStorage(eventId) {
  const { error: e1 } = await supabase.from('att_events').delete().eq('id', eventId);
  if (e1) console.error('No se ha podido borrar el evento', e1);
  // Limpiamos también las respuestas de asistencia guardadas para ese evento, para no
  // dejar filas huérfanas en la tabla.
  const { error: e2 } = await supabase.from('att_attendance').delete().eq('event_id', eventId);
  if (e2) console.error('No se han podido borrar las respuestas del evento', e2);

  // Si el partido tenía un acta subida, hay que borrarla también. Si no lo hiciéramos,
  // esas filas de match_report_players se quedarían "huérfanas": no aparecerían en
  // ningún acta visible (el partido ya no existe), pero "Jugadoras → Estadísticas" las
  // seguiría sumando igualmente, dando minutos/tarjetas de más sin explicación aparente.
  const { data: orphanPlayers, error: ePlayersSelect } = await supabase
    .from('match_report_players')
    .select('id')
    .eq('match_id', eventId);
  if (ePlayersSelect) console.error('No se ha podido comprobar el acta del evento borrado', ePlayersSelect);

  const orphanPlayerIds = (orphanPlayers || []).map((p) => p.id);
  if (orphanPlayerIds.length) {
    const { error: eCards } = await supabase
      .from('match_report_cards')
      .delete()
      .in('match_report_player_id', orphanPlayerIds);
    if (eCards) console.error('No se han podido borrar las tarjetas del acta del evento borrado', eCards);
  }

  const { error: ePlayers } = await supabase
    .from('match_report_players')
    .delete()
    .eq('match_id', eventId);
  if (ePlayers) console.error('No se ha podido borrar las jugadoras del acta del evento borrado', ePlayers);

  const { error: eReport } = await supabase
    .from('match_reports')
    .delete()
    .eq('id', eventId);
  if (eReport) console.error('No se ha podido borrar la cabecera del acta del evento borrado', eReport);

  // Y la lista de "Tullidas" de ese evento, para no dejar tampoco filas huérfanas ahí.
  const { error: eTullides } = await supabase
    .from('match_injuries')
    .delete()
    .eq('event_id', eventId);
  if (eTullides) console.error('No se ha podido borrar la lista de tullidas del evento borrado', eTullides);
  forgetTullidesForEvent(eventId);
}

// Trae todos los eventos creados/editados a mano por cualquier persona y los añade
// (o actualiza, si ya existían) en attEvents. Se llama al iniciar sesión y cada vez
// que se entra en Asistencia, para no depender de que el creador siga conectado.
export async function loadSharedEventsFromStorage() {
  const { data, error } = await supabase.from('att_events').select('*');
  if (error || !data) return;

  data.forEach((row) => {
    const meta = eventFromStorageRow(row);
    const existing = attEvents.find((e) => e.id === meta.id);
    if (existing) {
      // Ya lo teníamos (p.ej. lo creamos nosotras mismas): solo refrescamos sus
      // datos de calendario, sin tocar la asistencia/comentarios ya cargados.
      Object.assign(existing, meta);
    } else {
      attEvents.push(withEmptyAttendance({ ...meta, comments: {} }));
    }
  });
}
