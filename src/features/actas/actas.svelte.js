// ---- Partido: acta del partido (PDF procesado por la función Edge con Gemini) ----
// Se guarda en Supabase (tabla "match_reports", id = id del evento) para que quede
// visible para todo el equipo, no solo en la sesión de quien la sube. Se cachea aquí
// (actas.reports) para no ir a Supabase cada vez que se reabre la pantalla dentro de
// la misma sesión.
//
// El roster y los permisos siguen en el código antiguo y no son reactivos: como
// antes, la tabla solo se vuelve a "pintar" con renderMatchReport(), que incrementa
// actas.view (0 = todavía no se ha pintado nunca, y la caja se queda vacía como el
// marcado original).
import { legacy } from '../../lib/legacy.js';
import { rolesWithEventManagement } from '../asistencia/events.js';
import { partidoDetalle } from '../partidos/partidos.svelte.js';
import { plantilla, loadPlantillaStats } from '../jugadoras/jugadoras.svelte.js';
import { loadProfileMatchesPlayedStat } from '../perfil/perfil.svelte.js';

export const actas = $state({
  // { [eventId]: null | { ...cabecera, players: [...] } }
  reports: {},
  view: 0,
  // Partido de la última vez que se pintó la caja, y si se podía editar entonces.
  shownId: null,
  canEdit: false,
});

let matchReportRealtimeSubscribed = false;

// El acta la puede subir el mismo cuerpo técnico/directiva que gestiona los eventos
// (incluida Capitana: mismo permiso, no pasa por effectiveRoleForPermissions).
function canEditMatchReport() {
  return legacy.isAdmin || rolesWithEventManagement.includes(legacy.myProfile.rol);
}

export function renderMatchReport(eventId) {
  actas.shownId = eventId;
  actas.canEdit = canEditMatchReport();
  actas.view++;
}

export async function loadMatchReport(eventId) {
  const supabase = legacy.supabase;
  const { data: header, error: headerError } = await supabase
    .from('match_reports')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (headerError) {
    console.error('No se ha podido cargar el acta del partido', headerError);
    return;
  }
  if (!header) {
    actas.reports[eventId] = null;
    if (partidoDetalle.currentId === eventId) renderMatchReport(eventId);
    return;
  }

  const { data: players, error: playersError } = await supabase
    .from('match_report_players')
    .select('*, match_report_cards(*)')
    .eq('match_id', eventId)
    .order('jersey_number', { ascending: true });

  if (playersError) {
    console.error('No se han podido cargar las jugadoras del acta', playersError);
    return;
  }

  actas.reports[eventId] = {
    ...header,
    players: (players || []).map((p) => ({
      ...p,
      cards: (p.match_report_cards || []).map((c) => ({ type: c.card_type, minute: c.minute })),
    })),
  };
  if (partidoDetalle.currentId === eventId) renderMatchReport(eventId);
}

export function subscribeToMatchReportRealtime() {
  if (matchReportRealtimeSubscribed) return;
  matchReportRealtimeSubscribed = true;
  legacy.supabase
    .channel('match-report-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_report_players' }, (payload) => {
      const eventId = (payload.new && payload.new.match_id) || (payload.old && payload.old.match_id);
      if (eventId) loadMatchReport(eventId);
      // Si tienes abierta la pestaña "Estadísticas" de Jugadoras, se refresca con el
      // nuevo acta sin necesidad de recargar la página.
      if (document.getElementById('sec-plantilla')?.classList.contains('active') && plantilla.activeTab === 'estadisticas') {
        loadPlantillaStats();
      }
      // Lo mismo con "Partidos jugados" en tu Perfil, si lo tienes abierto.
      if (document.getElementById('sec-perfil')?.classList.contains('active')) {
        loadProfileMatchesPlayedStat();
      }
    })
    .subscribe();
}

// ---- Guardado del acta ----
// El cruce jugadora-perfil, el cálculo de puntos (ensayos/transformaciones/cops de
// càstig) y el guardado en "match_report_players" + "match_report_cards" los hace
// la función Edge "process-match-report-pdf" (server-side, con Gemini). Aquí solo
// se lee lo que ella ya ha persistido — ver loadMatchReport().

export function cardBadge(card, t) {
  const cls = card.type === 'roja' ? 'bad' : (card.type === 'amarilla' ? 'warn' : 'info');
  const label = card.type === 'roja' ? t('partido.cardRed') : (card.type === 'amarilla' ? t('partido.cardYellow') : (card.type || t('partido.cardGeneric')));
  return { cls, text: label + (card.minute != null ? ' · ' + card.minute + "'" : '') };
}

// Normaliza un nombre para poder compararlo (sin acentos, minúsculas, espacios
// simples), igual que hace la función Edge en el servidor.
export function normalizeRosterName(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Cruza cada jugadora del acta (ya filtrado a solo CNPN por la función Edge) con un
// perfil de la app registrado en `roster`. Orden de prioridad:
//   1) profile_id ya asignado por el servidor al procesar el PDF
//   2) coincidencia por número de licencia
//   3) coincidencia por nombre completo
// Si no se encuentra ninguna, la jugadora no tiene (todavía) cuenta en la app.
export function findRosterMatchForReportPlayer(p) {
  const rosterById = legacy.rosterById;
  const roster = legacy.roster;
  if (p.profile_id && rosterById[p.profile_id]) return rosterById[p.profile_id];

  if (p.license_number) {
    const targetLicense = String(p.license_number).trim();
    const byLicense = roster.find((r) => r.licencia && String(r.licencia).trim() === targetLicense);
    if (byLicense) return byLicense;
  }

  const targetName = normalizeRosterName(p.player_name);
  if (targetName) {
    const byName = roster.find((r) => normalizeRosterName(r.name) === targetName);
    if (byName) return byName;
  }

  return null;
}

// Lo que pinta la caja del acta: null = "todavía no hay acta"; si no, las jugadoras
// ordenadas (titulares primero, después suplentes; dentro de cada grupo, por dorsal).
export function matchReportView() {
  actas.view; // dependencia: se recalcula en cada renderMatchReport()
  const report = actas.reports[actas.shownId];
  const hasData = !!(report && report.players && report.players.length);
  if (!hasData) return null;
  const players = [...report.players].sort((a, b) => {
    if (!!a.is_starter !== !!b.is_starter) return a.is_starter ? -1 : 1;
    return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
  });
  return {
    estimated: !!report.match_duration_estimated,
    players: players.map((p) => ({ p, matched: findRosterMatchForReportPlayer(p) })),
  };
}
