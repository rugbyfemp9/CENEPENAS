// ==================================================================
// WELLNESS / RPE — COS TÈCNIC — PESTAÑA 2: HISTÓRICO Y TENDENCIAS. Carga acumulada
// semanal (para detectar picos de sobrecarga) y evolución de los últimos 30 días
// (equipo o jugadora concreta), a partir de las mismas filas de "attendance_wellness"
// cruzadas con "att_events" (fecha y duración) y "profiles"/roster (nombres). Todo
// este bloque comparte permiso con la Pestaña 1: ver canViewWellnessStaff().
// ==================================================================
import { legacy } from '../../lib/legacy.js';
import { supabase } from '../../lib/supabase.js';
import { roster, rosterById } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { canViewWellnessStaff, effectiveRoleForPermissions } from '../../lib/permissions.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso, attEventType, hasEventEnded, todayLocalIso } from '../../lib/dates.js';
import { wellnessStaffEventMinutes } from './minutes.js';

// ---- Utilidades de fechas en local (evitan los desfases de zona horaria de
// trabajar directamente con ISO strings y Date.parse) ----
function wellnessIsoToLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function wellnessLocalDateToIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function wellnessAddDaysIso(iso, delta) {
  const d = wellnessIsoToLocalDate(iso);
  d.setDate(d.getDate() + delta);
  return wellnessLocalDateToIso(d);
}
function wellnessMondayIso(iso) {
  const d = wellnessIsoToLocalDate(iso);
  const dow = d.getDay(); // 0=domingo..6=sábado
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return wellnessLocalDateToIso(d);
}
export function wellnessShortDateLabel(iso) {
  const d = wellnessIsoToLocalDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const WSTAFF_WEEKS_BACK = 6; // ventana de la tabla de carga semanal
const WSTAFF_EVO_DAYS = 30; // ventana del gráfico de evolución

// Últimas WSTAFF_WEEKS_BACK semanas (lunes a domingo), de la más antigua a "esta
// semana", para que la tabla se lea de izquierda (pasado) a derecha (ahora).
function wellnessBuildWeekBuckets() {
  const currentMonday = wellnessMondayIso(todayLocalIso());
  const buckets = [];
  for (let i = WSTAFF_WEEKS_BACK - 1; i >= 0; i--) {
    const startIso = wellnessAddDaysIso(currentMonday, -7 * i);
    const endIso = wellnessAddDaysIso(startIso, 6);
    buckets.push({ startIso, endIso, label: `${wellnessShortDateLabel(startIso)}–${wellnessShortDateLabel(endIso)}` });
  }
  return buckets;
}

export const history = $state({
  // Tabla de carga semanal: null = todavía sin pintar (cabecera vacía).
  weekLabels: null,
  weekRows: [],
  weekEmptyShown: false,
  // Desplegable de evolución: null = todavía sin rellenar; si no, las jugadoras.
  evoPlayers: null,
  evoSelected: 'team',
  // Puntos del gráfico: null = todavía sin pintar.
  evoPoints: null,
  summary: { sessions: 0, avgRpe: '—', load: 0, sleep: 0, discomfort: 0 },
  // Modal de historial completo de una jugadora. rows: null = cargando (lista vacía).
  playerModal: { open: false, name: '—', rows: null },
});

// Filas ya procesadas (una por jugadora y entreno/partido) que alimentan tanto la
// tabla de carga semanal como el gráfico de evolución, para no repetir la consulta.
let wellnessHistoryRawRows = [];

const sortedPlayers = () => roster
  .filter((p) => effectiveRoleForPermissions(p.rol) === 'jugadora')
  .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));

// Trae de Supabase todas las valoraciones de los últimos WSTAFF_WEEKS_BACK semanas
// (cruzadas con la fecha y duración de cada entreno/partido, ya en memoria en
// attEvents) y repinta la tabla de carga semanal + el gráfico de evolución.
export async function loadWellnessHistoryData() {
  if (!canViewWellnessStaff()) return;

  const buckets = wellnessBuildWeekBuckets();
  const rangeStartIso = buckets[0].startIso;
  const now = new Date();
  const relevantEvents = attEvents.filter((ev) =>
    attEventType(ev) !== 'meeting' && hasEventEnded(ev, now) && attEventIso(ev) >= rangeStartIso
  );

  const renderAll = () => {
    renderWellnessWeeklyTable(buckets, wellnessHistoryRawRows);
    populateWellnessEvoPlayerSelect();
    renderWellnessEvolutionForSelection();
  };

  if (!relevantEvents.length) {
    wellnessHistoryRawRows = [];
    renderAll();
    return;
  }

  const eventIds = relevantEvents.map((ev) => ev.id);
  const { data, error } = await supabase.from('attendance_wellness')
    .select('user_id, event_id, rpe, sleep_hours, has_discomfort')
    .in('event_id', eventIds);

  if (error) {
    console.error('No se han podido cargar los datos históricos de Wellness', error);
    wellnessHistoryRawRows = [];
    renderAll();
    return;
  }

  wellnessHistoryRawRows = (data || []).map((row) => {
    const ev = relevantEvents.find((e) => e.id === row.event_id);
    if (!ev) return null;
    const minutes = wellnessStaffEventMinutes(ev);
    return {
      userId: row.user_id,
      iso: attEventIso(ev),
      rpe: row.rpe != null ? Number(row.rpe) : null,
      sleepHours: row.sleep_hours || null,
      hasDiscomfort: !!row.has_discomfort,
      load: row.rpe != null ? Number(row.rpe) * minutes : null,
    };
  }).filter(Boolean);

  renderAll();
}

// CARGA ACUMULADA SEMANAL: una fila por jugadora con el sumatorio de sRPE de las 3
// últimas semanas (de la más reciente a la más antigua) + el total acumulado de toda
// la ventana cargada. El detalle semana a semana completo (más allá de estas 3) se
// consulta aparte, por jugadora, con el botón de historial (ver
// openWellnessPlayerHistoryModal()).
const WSTAFF_WEEK_COLS_SHOWN = 3;

function renderWellnessWeeklyTable(buckets, rows) {
  // Solo las últimas WSTAFF_WEEK_COLS_SHOWN semanas, mostradas de la más reciente
  // (junto al Total) a la más antigua.
  const shownBuckets = buckets.slice(-WSTAFF_WEEK_COLS_SHOWN).reverse();
  history.weekLabels = shownBuckets.map((b) => b.label);

  const bodyRows = sortedPlayers().map((p) => {
    const sumForBucket = (b) => Math.round(
      rows.filter((r) => r.userId === p.id && r.load != null && r.iso >= b.startIso && r.iso <= b.endIso)
        .reduce((acc, r) => acc + r.load, 0)
    );
    const allSums = buckets.map(sumForBucket);
    const grandTotal = allSums.reduce((a, b) => a + b, 0);
    if (!grandTotal) return null; // sin ninguna valoración en toda la ventana: no aporta nada a la tabla

    const shownSums = shownBuckets.map(sumForBucket);
    const cells = shownSums.map((val, i) => {
      // el "anterior" de cada celda, para el resaltado de picos, es la semana previa en
      // el tiempo (siguiente en este array, porque va de más reciente a más antigua)
      const prev = i < shownSums.length - 1 ? shownSums[i + 1] : null;
      let cls = '';
      if (prev && val) {
        const ratio = val / prev;
        if (ratio >= 1.3) cls = 'spike';
        else if (ratio >= 1.1) cls = 'rising';
      }
      return { val, cls };
    });

    return { id: p.id, name: displayName(p), grandTotal, cells };
  }).filter(Boolean);

  history.weekRows = bodyRows;
  history.weekEmptyShown = !bodyRows.length;
}

// HISTORIAL COMPLETO DE UNA JUGADORA: a diferencia de la tabla de arriba (limitada a
// la ventana de WSTAFF_WEEKS_BACK semanas), esto consulta TODAS sus valoraciones en
// Supabase sin restricción de fecha, las cruza con attEvents (que guarda toda la
// temporada en memoria, no solo esa ventana) y las agrupa por semana.
export async function openWellnessPlayerHistoryModal(playerId) {
  const player = rosterById[playerId];
  history.playerModal = { open: true, name: player ? displayName(player) : '—', rows: null };

  const { data, error } = await supabase.from('attendance_wellness')
    .select('event_id, rpe').eq('user_id', playerId);

  if (error) {
    console.error('No se ha podido cargar el historial completo de la jugadora', error);
    history.playerModal.rows = [];
    return;
  }

  const byWeekStart = {};
  (data || []).forEach((row) => {
    if (row.rpe == null) return;
    const ev = attEvents.find((e) => e.id === row.event_id);
    if (!ev) return;
    const iso = attEventIso(ev);
    const load = Number(row.rpe) * wellnessStaffEventMinutes(ev);
    const weekStart = wellnessMondayIso(iso);
    byWeekStart[weekStart] = (byWeekStart[weekStart] || 0) + load;
  });

  const weekStarts = Object.keys(byWeekStart).sort().reverse(); // más reciente primero
  history.playerModal.rows = weekStarts.map((startIso) => {
    const endIso = wellnessAddDaysIso(startIso, 6);
    return {
      label: `${wellnessShortDateLabel(startIso)}–${wellnessShortDateLabel(endIso)}`,
      load: Math.round(byWeekStart[startIso]),
    };
  });
}
export function closeWellnessPlayerHistoryModal() {
  history.playerModal.open = false;
}

// EVOLUCIÓN INDIVIDUAL / EQUIPO: rellena el desplegable con "Equipo (media)" +
// todas las jugadoras del roster, conservando la selección anterior si sigue existiendo.
function populateWellnessEvoPlayerSelect() {
  const players = sortedPlayers();
  history.evoPlayers = players.map((p) => ({ id: p.id, name: displayName(p) }));

  const previous = history.evoSelected;
  history.evoSelected = (previous === 'team' || players.some((p) => p.id === previous)) ? previous : 'team';
}

export function onWellnessEvoPlayerChange(playerId) {
  history.evoSelected = playerId || 'team';
  renderWellnessEvolutionForSelection();
}

// Recalcula los puntos del gráfico (uno por día valorado en los últimos 30 días) a
// partir de wellnessHistoryRawRows: o bien la propia jugadora elegida, o la media del
// equipo entre quienes hayan valorado cada día.
function renderWellnessEvolutionForSelection() {
  const cutoffIso = wellnessAddDaysIso(todayLocalIso(), -(WSTAFF_EVO_DAYS - 1));
  const recentRows = wellnessHistoryRawRows.filter((r) => r.iso >= cutoffIso && r.rpe != null);

  let points;
  if (history.evoSelected === 'team') {
    const byDate = {};
    recentRows.forEach((r) => {
      if (!byDate[r.iso]) byDate[r.iso] = { sumRpe: 0, count: 0, load: 0, discomfort: 0, sleepBad: 0 };
      const b = byDate[r.iso];
      b.sumRpe += r.rpe;
      b.count++;
      b.load += r.load || 0;
      if (r.hasDiscomfort) b.discomfort++;
      if (r.sleepHours === 'lt6') b.sleepBad++;
    });
    points = Object.keys(byDate).sort().map((iso) => {
      const b = byDate[iso];
      return { iso, rpe: b.sumRpe / b.count, load: b.load, hasDiscomfort: b.discomfort > 0, sleepBad: b.sleepBad > 0 };
    });
  } else {
    points = recentRows
      .filter((r) => r.userId === history.evoSelected)
      .sort((a, b) => a.iso.localeCompare(b.iso))
      .map((r) => ({ iso: r.iso, rpe: r.rpe, load: r.load, hasDiscomfort: r.hasDiscomfort, sleepBad: r.sleepHours === 'lt6' }));
  }

  history.evoPoints = points;
  renderWellnessEvoSummary(points);
}

// Insignias-resumen encima del gráfico: sesiones valoradas, RPE medio, carga total,
// y recuentos de mal descanso / molestias en la ventana de 30 días.
function renderWellnessEvoSummary(points) {
  const totalLoad = points.reduce((acc, p) => acc + (p.load || 0), 0);
  const avgRpe = points.length ? points.reduce((acc, p) => acc + p.rpe, 0) / points.length : null;
  history.summary = {
    sessions: points.length,
    avgRpe: avgRpe != null ? avgRpe.toFixed(1) : '—',
    load: Math.round(totalLoad),
    sleep: points.filter((p) => p.sleepBad).length,
    discomfort: points.filter((p) => p.hasDiscomfort).length,
  };
}
