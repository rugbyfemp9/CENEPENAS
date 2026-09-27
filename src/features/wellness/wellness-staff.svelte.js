// ==================================================================
// WELLNESS / RPE — COS TÈCNIC: vista de análisis agregado de todo el equipo para un
// entrenamiento concreto (tabla "attendance_wellness" cruzada con el roster y con la
// duración del entrenamiento en "attEvents"). Solo para roles de gestión: ver
// STAFF_WELLNESS_ROLES y canViewWellnessStaff() (js/core/permissions.js). El módulo de
// valoración individual de cada jugadora está en wellness.svelte.js.
//
// attEvents (src/features/asistencia/events.js) y el roster no son reactivos: igual
// que antes, lo que se ve solo cambia al entrar en la sección, al cambiar de entreno o
// de jugadora en los desplegables, o al abrir un modal.
// ==================================================================
import { legacy } from '../../lib/legacy.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso, attEventType, eventWhenDisplay, hasEventEnded } from '../../lib/dates.js';
import { wellnessRpeLevel } from './wellness.svelte.js';
import { wellnessStaffEventMinutes } from './minutes.js';
import { loadWellnessHistoryData } from './wellness-history.svelte.js';

export const staff = $state({
  // Subpestañas: solo cambia qué panel se ve, no vuelve a consultar Supabase (los datos
  // de las dos pestañas se cargan juntos al entrar en la sección, ver onEnterStaffPanel()).
  subtab: 'session',
  // Opciones del desplegable de entrenos: null = todavía sin rellenar (vacío),
  // [] = no hay ninguno ("Todavía no hay..."), o [{ id, label }].
  eventOptions: null,
  selectValue: '',
  selectedEventId: null,
  // Filas de la tabla de la sesión elegida; emptyShown = se ve el mensaje de "sin datos".
  rows: [],
  emptyShown: false,
  // Alertas rápidas: filas de cada tarjeta (el modal pinta la lista completa).
  alerts: { discomfort: [], sleep: [], load: [] },
  alertModal: { open: false, kind: 'discomfort', everOpened: false },
});

// Marcado por goToWellnessStaffAnalysis() para que, al entrar en la página (ver
// onEnterStaffPanel()), se abra ese entreno concreto en vez del más reciente por defecto.
let wellnessStaffPendingEventId = null;

export function setWellnessStaffSubtab(tab) {
  staff.subtab = tab;
}

// Al entrar en la página (setSection('wellness-staff'), js/core/navigation.js, que ya
// ha comprobado el permiso): se muestra siempre por defecto la sesión más reciente
// (salvo que se venga de un acceso directo a un entreno concreto, ver
// goToWellnessStaffAnalysis(), que deja marcado wellnessStaffPendingEventId).
export function onEnterStaffPanel() {
  setWellnessStaffSubtab('session');
  if (wellnessStaffPendingEventId) {
    staff.selectedEventId = wellnessStaffPendingEventId;
    wellnessStaffPendingEventId = null;
  } else {
    staff.selectedEventId = null;
  }
  populateWellnessStaffEventSelect();
  loadWellnessHistoryData();
}

// Rellena el desplegable con los entrenamientos y partidos ya sucedidos (los eventos
// futuros no entran: todavía no pueden tener valoraciones, y las reuniones tampoco,
// porque no llevan Wellness/RPE), del más reciente al más antiguo, y carga
// automáticamente el que estuviera seleccionado (p.ej. desde el botón 📊 de una
// tarjeta, ver goToWellnessStaffAnalysis()) o, si no había ninguno, el más reciente.
function populateWellnessStaffEventSelect() {
  const now = new Date();
  const pastEvents = attEvents
    .filter((ev) => attEventType(ev) !== 'meeting' && hasEventEnded(ev, now))
    .sort((a, b) => attEventIso(b).localeCompare(attEventIso(a)) || (b.startTime || '').localeCompare(a.startTime || ''));

  if (!pastEvents.length) {
    staff.eventOptions = [];
    staff.selectValue = '';
    staff.selectedEventId = null;
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }

  const previousSelection = staff.selectedEventId;
  staff.eventOptions = pastEvents.map((ev) => ({ id: ev.id, label: `${ev.label} · ${eventWhenDisplay(ev)}` }));

  const stillExists = previousSelection && pastEvents.some((ev) => ev.id === previousSelection);
  const eventId = stillExists ? previousSelection : pastEvents[0].id;
  staff.selectValue = eventId;
  onWellnessStaffEventChange(eventId);
}

// Acceso directo desde la tarjeta de un entreno/partido (botón 📊, solo Staff): deja
// marcado ese evento como el que hay que seleccionar y navega al panel, que lo
// recogerá en onEnterStaffPanel() (llamada desde setSection()).
export function goToWellnessStaffAnalysis(eventId) {
  if (!legacy.canViewWellnessStaff()) return;
  wellnessStaffPendingEventId = eventId;
  legacy.setSection('wellness-staff');
}

export function onWellnessStaffEventChange(eventId) {
  staff.selectValue = eventId;
  staff.selectedEventId = eventId || null;
  if (!eventId) {
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }
  loadWellnessStaffData(eventId);
}

// Trae de Supabase todas las filas de "attendance_wellness" del entrenamiento elegido
// (una por jugadora que ya lo haya valorado), las cruza con su nombre (roster, ya
// cargado en memoria) y con la duración del entrenamiento (attEvents) para calcular
// su carga (sRPE = RPE × minutos de sesión), y repinta alertas + tabla.
async function loadWellnessStaffData(eventId) {
  staff.rows = [];
  staff.emptyShown = false;

  const { data, error } = await legacy.supabase.from('attendance_wellness')
    .select('user_id, rpe, sleep_hours, mood, has_discomfort, discomfort_detail')
    .eq('event_id', eventId);

  // Si mientras cargaba se cambió de entreno en el desplegable, esta respuesta ya no
  // corresponde a lo que se está mirando: se descarta para no pisar nada.
  if (staff.selectedEventId !== eventId) return;

  if (error) {
    console.error('No se han podido cargar los datos de Wellness del entrenamiento', error);
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }

  const ev = attEvents.find((e) => e.id === eventId);
  const minutes = wellnessStaffEventMinutes(ev);

  const rows = (data || []).map((row) => {
    const player = legacy.rosterById[row.user_id];
    return {
      userId: row.user_id,
      name: player ? legacy.displayName(player) : (row.user_id || '—'),
      rpe: row.rpe != null ? Number(row.rpe) : null,
      sleepHours: row.sleep_hours || null,
      mood: row.mood != null ? Number(row.mood) : null,
      hasDiscomfort: !!row.has_discomfort,
      discomfortDetail: row.discomfort_detail || '',
      load: row.rpe != null ? Number(row.rpe) * minutes : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  renderWellnessStaffAlerts(rows);
  renderWellnessStaffTable(rows);
}

// Bloque de alertas rápidas: tres tarjetas que se recalculan sobre las filas ya
// cargadas del entreno seleccionado (no hacen ninguna consulta propia). Las tarjetas
// solo muestran el número de jugadoras; la lista con los nombres se guarda aquí y se
// pinta en un modal aparte al hacer clic (ver openWellnessAlertModal). Si el modal
// ya está abierto (p.ej. cambiando de entreno con el modal a la vista), se refresca
// solo con los datos nuevos.
function renderWellnessStaffAlerts(rows) {
  staff.alerts = {
    discomfort: rows.filter((r) => r.hasDiscomfort),
    sleep: rows.filter((r) => r.sleepHours === 'lt6'),
    load: rows.filter((r) => r.rpe != null && r.rpe >= 8),
  };
}

export const WSTAFF_ALERT_META = {
  discomfort: { icon: '🔴', titleKey: 'wstaff.alertDiscomfortTitle' },
  sleep: { icon: '🟡', titleKey: 'wstaff.alertSleepTitle' },
  load: { icon: '🔥', titleKey: 'wstaff.alertLoadTitle' },
};

// Abre el modal con la lista completa de jugadoras de una alerta concreta
// ('discomfort' | 'sleep' | 'load'), tal como se pintaba antes directamente
// en la tarjeta.
export function openWellnessAlertModal(kind) {
  if (!WSTAFF_ALERT_META[kind]) return;
  staff.alertModal = { open: true, kind, everOpened: true };
}
export function closeWellnessAlertModal() {
  staff.alertModal.open = false;
}

// Tabla global del entrenamiento: una fila por jugadora (ver StaffSessionTable.svelte).
function renderWellnessStaffTable(rows) {
  staff.rows = rows;
  staff.emptyShown = !rows.length;
}

// Color de intensidad del RPE de cada fila, reutilizado de RPE_LEVELS (el mismo que
// ve la propia jugadora en su modal).
export function staffRpeColor(rpe) {
  return wellnessRpeLevel(rpe).color;
}
