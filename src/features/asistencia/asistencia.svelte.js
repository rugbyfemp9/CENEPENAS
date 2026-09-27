/* ================= ASISTENCIA (lista y detalle) ================= */
// Lista de eventos (próximos / pasados, agrupados por mes, filtro por tipo) y el
// detalle de un evento (cabecera, pestañas Asistirán / No asistirán / Sin contestar).
//
// Los eventos (events.js) y el roster no son reactivos: igual que antes, la lista y el
// detalle solo cambian al llamar a renderEventList() / renderEventDetail(), que
// guardan aquí una "foto" de lo que toca mostrar en ese momento (con los textos ya
// traducidos, como el innerHTML de antes). Lo que en el marcado antiguo llevaba
// data-i18n (títulos fijos, pestañas, botones) se traduce en la plantilla con t().
import { setSection } from '../../shell/navigation.svelte.js';
import { currentUserId, roster } from '../../lib/roster.js';
import { displayName, initials } from '../../lib/names.js';
import { canUseWellness, canViewWellnessStaff, effectiveRoleForPermissions } from '../../lib/permissions.js';
import { translate } from '../../lib/i18n.svelte.js';
import {
  monthAbbrLabel, monthFullLabel, todayLocalIso, attEventIso, attEventType,
  trainingIntensityEmoji, eventWeekdayDateLabel, eventWhenDisplay, hasEventEnded,
} from '../../lib/dates.js';
import { attEvents, attSelection, canManageEvents, loadSharedEventsFromStorage } from './events.js';
import { loadEventAttendanceFromStorage, loadMyAttendanceFromStorage } from './attendance.svelte.js';
import { renderCalendarGrid } from './calendar.svelte.js';
import { renderPartidosList, renderNextMatchBanner } from '../partidos/partidos.svelte.js';
import { renderWellnessReminderBanner } from '../wellness/wellness.svelte.js';

const t = (key) => translate(key);

// ---- Lista ----
export const attList = $state({
  // 'upcoming' = próximos eventos (por defecto); 'history' = eventos ya pasados
  mode: 'upcoming',
  // Filtro de tipos visibles en la lista de Asistencia (botón de embudo, arriba de la lista)
  filters: { training: true, match: true, meeting: true },
  filterModalOpen: false,
  // Botón "Añadir evento": solo roles con permiso de gestión (ver toggleAttAddButtonVisibility)
  canAdd: false,
});

// null = todavía no se ha pintado nunca (la lista se queda vacía).
let listView = $state.raw(null);
export const getListView = () => listView;

function attEventCardView(ev) {
  const type = attEventType(ev);
  const base = { id: ev.id, type, date: ev.date, month: monthAbbrLabel(ev.month), label: ev.label, when: eventWhenDisplay(ev) };
  if (type === 'meeting') {
    // Las reuniones no tienen pantalla de detalle a la que entrar (no llevan roster de
    // asistencia), así que aquí sí se mantiene el lápiz en la propia tarjeta: es la
    // única forma de editarlas.
    return { ...base, editLabel: canManageEvents() ? t('att.editEvent') : null };
  }
  const my = ev.attendance.me;
  return {
    ...base,
    my,
    rsvpLabel: my === 'yes' ? t('att.confirmedState') : my === 'no' ? t('att.declinedState') : '',
    intensity: type === 'training' ? trainingIntensityEmoji(ev.intensity) : '',
    // Botón 📊 de acceso directo al Panel de Análisis Wellness/RPE de este evento
    // concreto: solo Cos Tècnic, y solo si el evento ya existe en ese panel (mismo
    // criterio que el desplegable del panel, src/features/wellness/: ya ha terminado).
    staffLabel: (canViewWellnessStaff() && hasEventEnded(ev)) ? t('wstaff.quickAccessButton') : null,
    declineLabel: t('att.decline'),
    confirmLabel: t('att.confirm'),
  };
}

export function renderEventList() {
  // Un evento deja de contar como "próximo" en cuanto pasa su día (a partir de las
  // 23:59 de ese mismo día, hora local), comparando sólo la fecha (yyyy-mm-dd) sin
  // tener en cuenta la hora del evento.
  const todayIso = todayLocalIso();
  const mode = attList.mode;
  const relevantEvents = attEvents
    .filter((ev) => mode === 'upcoming' ? attEventIso(ev) >= todayIso : attEventIso(ev) < todayIso)
    .filter((ev) => attList.filters[attEventType(ev)])
    .sort((a, b) => mode === 'upcoming'
      ? attEventIso(a).localeCompare(attEventIso(b))   // próximos: del más cercano al más lejano
      : attEventIso(b).localeCompare(attEventIso(a))   // pasados: del más reciente al más antiguo
    );

  const groups = [];
  let currentKey = null;
  relevantEvents.forEach((ev) => {
    const iso = attEventIso(ev);
    const [y, m] = iso.split('-');
    const key = `${y}-${m}`;
    if (key !== currentKey) {
      const monthName = monthFullLabel(parseInt(m, 10) - 1);
      groups.push({ key, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + y, events: [] });
      currentKey = key;
    }
    groups[groups.length - 1].events.push(attEventCardView(ev));
  });

  // Alterna entre "próximos" y "pasados"; se coloca a la altura de la primera fecha
  // del listado, alineado a la derecha.
  listView = {
    groups,
    toggleAria: mode === 'upcoming' ? t('att.viewPastAria') : t('att.viewUpcomingAria'),
    toggleLabel: mode === 'upcoming' ? t('att.viewPast') : t('att.viewUpcoming'),
    emptyText: mode === 'upcoming' ? t('att.noUpcoming') : t('att.noPast'),
  };

  // Vestuario → Partidos usa los mismos datos, así que se mantiene sincronizado
  // cada vez que se repinta Asistencia (alta/edición/borrado de evento, RSVP, o
  // sincronización en tiempo real).
  renderPartidosList();
}

export function toggleAttHistoryView() {
  attList.mode = attList.mode === 'upcoming' ? 'history' : 'upcoming';
  renderEventList();
}
export function toggleAttListFilter(type, checked) {
  attList.filters[type] = checked;
  renderEventList();
}
export function toggleAttAddButtonVisibility() {
  attList.canAdd = canManageEvents();
}

// Refresca los eventos compartidos y todo lo que depende de attEvents; se usa al
// entrar en Asistencia y al iniciar sesión.
export async function refreshSharedEventsAndUI() {
  await loadSharedEventsFromStorage();
  await loadMyAttendanceFromStorage();
  renderEventList();
  renderCalendarGrid();
  renderNextMatchBanner();
  renderWellnessReminderBanner();
}

// ---- Detalle de un evento ----
let currentAttTab = 'yes';
export const attDetail = $state({
  // Pestaña marcada en pantalla (null hasta el primer pintado, como antes)
  tab: null,
  // Insignia de intensidad "asentada" (clase .show)
  badgeShow: false,
  // Posición (style.right) de los botones de la cabecera, ver layoutAttDetailHeaderButtons()
  rights: { edit: null, tullides: '44px', wellness: '44px', staff: '44px' },
});

// null = todavía no se ha pintado nunca.
let detailView = $state.raw(null);
export const getDetailView = () => detailView;

export function setAttTab(tab) {
  currentAttTab = tab;
  attDetail.tab = tab;
}

// Recoloca los botones superiores (editar / tullidas / wellness / wellness de Cos
// Tècnic) uno junto a otro, en función de cuáles estén realmente visibles para evitar
// huecos o solapes (los ocultos conservan su posición anterior).
function layoutAttDetailHeaderButtons(visible) {
  const rights = { ...attDetail.rights };
  let offset = 10;
  ['edit', 'tullides', 'wellness', 'staff'].forEach((key) => {
    if (!visible[key]) return;
    rights[key] = offset + 'px';
    offset += 34;
  });
  attDetail.rights = rights;
}

// "Floating Reaction" a pantalla completa al entrar en un entreno con intensidad
// marcada (ver spawnIntensityBurst).
let pendingIntensityReveal = false;

export function renderEventDetail() {
  const ev = attEvents.find((e) => e.id === attSelection.currentEventId);
  if (!ev) return;
  const type = attEventType(ev);
  const prev = detailView;

  const visible = {
    edit: canManageEvents(),
    // El botón de "Tullidas" solo tiene sentido en partidos, y lo puede usar cualquier
    // jugadora (no hace falta permiso de gestión: cada una se apunta a sí misma).
    tullides: type === 'match',
    // Wellness / RPE: solo visible para el rol jugadora (ver canUseWellness).
    wellness: canUseWellness(),
    // Botón 📊 de Cos Tècnic (entrenador/a, delegado/a, directiva, fisio, admin) para ir
    // directos al análisis Wellness/RPE de este evento concreto, si ya ha terminado.
    staff: canViewWellnessStaff() && hasEventEnded(ev),
  };
  // Antes se recolocaban dos veces: tras mostrar/ocultar el de Wellness (con el de Cos
  // Tècnic todavía como estaba) y otra vez tras el de Cos Tècnic.
  layoutAttDetailHeaderButtons({ ...visible, staff: prev ? prev.visible.staff : false });
  layoutAttDetailHeaderButtons(visible);

  // En los entrenos no mostramos "Convocatoria" ni el título "Inicio": solo la hora, a secas.
  const isTraining = type === 'training';
  const intensity = isTraining ? trainingIntensityEmoji(ev.intensity) : '';
  // La insignia solo se revela "asentada" tras la animación de entrada (ver
  // openEventDetail); si no hay animación en marcha (p. ej. al volver de editar
  // el evento) se muestra directamente.
  if (!intensity) attDetail.badgeShow = false;
  else if (!pendingIntensityReveal) attDetail.badgeShow = true;

  // Se recorre siempre el roster completo (todas las jugadoras registradas ahora
  // mismo en la app), no solo las claves que ya hubiera en ev.attendance: así,
  // cualquiera que no haya contestado "confirmar" ni "declinar" cae automáticamente
  // en "Sin contestar", aunque se haya dado de alta después de crearse el evento.
  const buckets = { yes: [], no: [], pending: [] };
  roster.forEach((player) => {
    const status = ev.attendance[player.id];
    if (status === 'yes' || status === 'no') buckets[status].push(player);
    else buckets.pending.push(player);
  });

  detailView = {
    visible,
    title: ev.label,
    daynum: ev.date,
    monthabbr: monthAbbrLabel(ev.month),
    when: eventWeekdayDateLabel(ev) || '',
    place: ev.place || '',
    placeMapsUrl: ev.placeMapsUrl,
    // Solo en los partidos a domicilio se añade el icono ✈️; en casa no lleva ningún emoji.
    locationIcon: type === 'match' && !ev.isHome ? '✈️ ' : '',
    meet: ev.meetTime || '—',
    start: ev.startTime || '—',
    isTraining,
    intensity,
    my: ev.attendance.me,
    counts: { yes: buckets.yes.length, no: buckets.no.length, pending: buckets.pending.length },
    yes: attRosterYesGrouped(ev, buckets.yes),
    no: buckets.no.map((p) => attRosterRowView(ev, p)),
    pending: buckets.pending.map((p) => attRosterRowView(ev, p)),
    nobodyYet: t('att.nobodyYet'),
  };

  setAttTab(currentAttTab);
}

// El comentario/justificación de asistencia es de cada una sobre sí misma: nadie
// puede crear ni editar el comentario de una compañera, aunque sea entrenador/a o
// delegado/a (esto es distinto del botón "Editar evento", que sí es de gestión).
function attRosterRowView(ev, p) {
  const comment = ev.comments[p.id];
  const name = displayName(p);
  return {
    eventId: ev.id,
    id: p.id,
    name,
    avatarUrl: p.avatarUrl,
    initials: initials(name),
    injured: p.injured,
    injuryIcon: p.injuryIcon,
    comment,
    commentBtn: p.id === currentUserId ? (comment ? t('att.edit') : t('att.addComment')) : null,
  };
}

// La lista de "Asistirán" se organiza así:
//   Jugadoras (total) → Delanteras (total) y 3/4 (total) [incluye a Capitana, igual
//   que el resto de la app: effectiveRoleForPermissions la trata como jugadora]
//   Un grupo aparte por cada rol que no sea jugadora (Entrenador/a, Delegado/a...),
//   con el nombre de ese rol tal cual y su propio contador.
// Cada categoría (posición o rol) solo aparece en cuanto hay alguien de esa categoría
// que ha confirmado asistencia — no se muestran categorías vacías de antemano.
function attRosterYesGrouped(ev, players) {
  if (!players.length) return null;
  const group = (label, list) => ({ label, rows: list.map((p) => attRosterRowView(ev, p)) });

  const jugadoras = players.filter((p) => effectiveRoleForPermissions(p.rol) === 'jugadora');
  const delanteras = jugadoras.filter((p) => p.posicion === 'delantera');
  const tresCuartos = jugadoras.filter((p) => p.posicion === '3/4');
  const sinPosicion = jugadoras.filter((p) => p.posicion !== 'delantera' && p.posicion !== '3/4');

  const subgroups = [];
  if (delanteras.length) subgroups.push(group(t('att.forwards'), delanteras));
  if (tresCuartos.length) subgroups.push(group('3/4', tresCuartos));
  if (sinPosicion.length) subgroups.push(group(t('att.noPositionAssigned'), sinPosicion));

  // El resto: un grupo por cada rol distinto que haya votado que sí, en el orden en
  // que va apareciendo (Entrenador/a, Delegado/a, Directiva, o cualquier otro).
  const otros = players.filter((p) => effectiveRoleForPermissions(p.rol) !== 'jugadora');
  const rolesVistos = [];
  otros.forEach((p) => {
    const rolLabel = p.rol || t('att.noRoleAssigned');
    if (!rolesVistos.includes(rolLabel)) rolesVistos.push(rolLabel);
  });

  return {
    jugadoras: jugadoras.length ? { label: t('nav.plantilla'), count: jugadoras.length, subgroups } : null,
    roles: rolesVistos.map((rolLabel) => group(rolLabel, otros.filter((p) => (p.rol || t('att.noRoleAssigned')) === rolLabel))),
  };
}

export async function openEventDetail(eventId) {
  attSelection.currentEventId = eventId;
  currentAttTab = 'yes';

  // Si es un entreno con intensidad marcada, se oculta la insignia antes del primer
  // pintado para que la lluvia de emojis "aterrice" en ella al terminar, en vez de
  // aparecer ya fija desde el primer instante.
  const openedEv = attEvents.find((e) => e.id === eventId);
  const openedEmoji = openedEv && attEventType(openedEv) === 'training' ? trainingIntensityEmoji(openedEv.intensity) : '';
  pendingIntensityReveal = !!openedEmoji;

  renderEventDetail();
  setSection('asistencia-detalle');

  if (openedEmoji) spawnIntensityBurst(openedEmoji);

  // Carga las respuestas de todas las jugadoras guardadas de forma compartida y
  // vuelve a pintar (si seguimos en el mismo evento cuando termina de llegar).
  const ev = attEvents.find((e) => e.id === eventId);
  if (ev) {
    await loadEventAttendanceFromStorage(ev);
    if (attSelection.currentEventId === eventId) renderEventDetail();
  }
}

// "Floating Reaction" a pantalla completa al entrar en un entreno con intensidad
// marcada (suben de abajo hacia arriba, cada uno con su propia velocidad, balanceo
// lateral, rotación y pulso de tamaño, y se desdibujan al llegar arriba), y a
// continuación deja el emoji fijo en la insignia de la cabecera (ver renderEventDetail).
function spawnIntensityBurst(emoji) {
  pendingIntensityReveal = true;
  const count = 46;
  let maxDelay = 0;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'intensity-burst-emoji';
    el.textContent = emoji;
    const fontSize = 20 + Math.random() * 22;
    // Duración variada a propósito: unos suben mucho más rápido que otros, para que
    // no parezca una sola oleada uniforme sino reacciones sueltas (nunca tan corta
    // que se note a saltos por pocos fotogramas).
    const duration = 0.65 + Math.random() * 0.85;
    const delay = Math.round(Math.random() * 280);
    maxDelay = Math.max(maxDelay, delay + duration * 1000);
    // Rotación y pico de escala propios de cada emoji, para que la trayectoria de
    // cada uno se note distinta (el desplazamiento en sí es siempre recto, vertical).
    const scalePeak = (1.05 + Math.random() * 0.35).toFixed(2);
    el.style.left = Math.random() * 96 + 'vw';
    el.style.fontSize = fontSize + 'px';
    el.style.setProperty('--fall', (window.innerHeight + 80) + 'px');
    el.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 320) + 'deg');
    el.style.setProperty('--scale-peak', scalePeak);
    el.style.setProperty('--dur', duration + 's');
    el.style.animationDelay = delay + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), delay + duration * 1000 + 200);
  }
  // Cuando termina la lluvia, el emoji se "asienta" fijo en la insignia de la cabecera
  setTimeout(() => {
    pendingIntensityReveal = false;
    if (detailView && detailView.intensity) attDetail.badgeShow = true;
  }, maxDelay + 100);
}

// Al cambiar de idioma (antes setLang(), js/core/i18n.js): applyI18n() devolvía el
// título del detalle a su texto por defecto ("Evento") y luego se volvía a pintar la
// lista y, si había un evento abierto, su detalle.
export function onLangChange() {
  if (detailView) detailView = { ...detailView, title: null };
  renderEventList();
  if (attSelection.currentEventId) renderEventDetail();
}
