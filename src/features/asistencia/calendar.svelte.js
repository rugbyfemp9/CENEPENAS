/* ================= CALENDARIO ================= */
// Modal con el calendario mensual (entrenos, partidos, cumpleaños y planes), sus
// filtros y el popover con el detalle de cada evento.
//
// Como la lista de Asistencia, la cuadrícula es una "foto" que solo cambia al llamar a
// renderCalendarGrid() (al abrir el modal, cambiar de mes o de filtro, tras crear /
// editar / borrar un evento, al refrescar los eventos compartidos y al cambiar de idioma).
import { roster } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { translate } from '../../lib/i18n.svelte.js';
import { monthFullLabel, attEventIso, attEventType, formatIsoDate } from '../../lib/dates.js';
import { attEvents } from './events.js';
import { openEditEventModal, openDeleteEventConfirmFor } from './editor.svelte.js';

const t = (key) => translate(key);

// Los cumpleaños NO se guardan como lista aparte: se sincronizan automáticamente
// con la fecha de nacimiento ("birthdate", formato AAAA-MM-DD) que cada jugadora
// rellena en su perfil. Se ignora el año: solo se usa el día y el mes, así que el
// cumpleaños aparece cada año en el calendario sin tener que volver a crearlo.
function getBirthdayEvents(year) {
  return roster
    .filter((p) => p.birthdate)
    .map((p) => {
      const monthDay = p.birthdate.slice(5); // "AAAA-MM-DD" -> "MM-DD"
      return { iso: `${year}-${monthDay}`, label: displayName(p), type: 'birthday' };
    });
}

// Planes del club (tercer tiempo, etc.)
const calPlans = [];

// Eventos extra creados manualmente desde el botón "+" del calendario (reuniones, etc.)
const calCustomEvents = [];

// Los entrenos y partidos del calendario salen de attEvents (mismo origen que Asistencia)
function buildCalendarEvents() {
  const list = [];
  attEvents.forEach((ev) => {
    const type = attEventType(ev) === 'meeting' ? 'plan' : attEventType(ev);
    list.push({
      id: ev.id,
      iso: attEventIso(ev), label: ev.label, type,
      place: ev.place || '',
      placeMapsUrl: ev.placeMapsUrl || '',
      meetTime: ev.meetTime, startTime: ev.startTime,
    });
  });
  getBirthdayEvents(calYear).forEach((b) => list.push(b));
  calPlans.forEach((p) => list.push({ iso: p.iso, label: p.label, type: 'plan', place: p.place, startTime: p.time }));
  calCustomEvents.forEach((c) => list.push({ iso: c.iso, label: c.label, type: 'plan', place: c.place, startTime: c.time }));
  return list;
}

// Traducido dinámicamente (en vez de un objeto fijo) para que cambie con el idioma activo.
function calTypeLabel(type) {
  return { training: t('att.training'), match: t('att.match'), birthday: t('att.birthday'), plan: t('att.plan') }[type];
}

// NOTE: el calendario siempre empieza en agosto de 2026 (fijo), no en el mes actual, y
// conserva el último mes visto al cerrarlo y volver a abrirlo.
let calYear = 2026;
let calMonth = 7; // Agosto (0 = Enero)
let calChipLookup = {};

export const cal = $state({
  open: false,
  sidebarOpen: false,
  filters: { training: true, match: true, birthday: true, plan: true },
  // Filtros apagados (clase .dim), que solo cambian al tocarlos
  dim: { training: false, match: false, birthday: false, plan: false },
});

// null = todavía no se ha pintado nunca (el mes muestra el texto del marcado).
let gridView = $state.raw(null);
export const getGridView = () => gridView;

export function openCalendarModal() {
  cal.open = true;
  cal.sidebarOpen = false;
  renderCalendarGrid();
}
export function closeCalendarModal() {
  cal.open = false;
}
export function toggleCalSidebar() {
  cal.sidebarOpen = !cal.sidebarOpen;
}
export function calShiftMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendarGrid();
}
export function toggleCalFilter(type, checked) {
  cal.filters[type] = checked;
  cal.dim[type] = !checked;
  renderCalendarGrid();
}

export function renderCalendarGrid() {
  calChipLookup = {};

  const allEvents = buildCalendarEvents().filter((e) => cal.filters[e.type]);
  const eventsByDay = {};
  allEvents.forEach((e) => {
    (eventsByDay[e.iso] = eventsByDay[e.iso] || []).push(e);
  });

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  // getDay(): 0=domingo..6=sábado → lo pasamos a semana que empieza en lunes
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  // NOTE: "hoy" se calcula en UTC (toISOString), no en hora local como el resto de la app.
  const todayIso = new Date().toISOString().slice(0, 10);

  const days = [];
  let chipCounter = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = eventsByDay[iso] || [];
    days.push({
      d,
      today: iso === todayIso,
      chips: dayEvents.map((e) => {
        const chipId = 'chip' + (chipCounter++);
        calChipLookup[chipId] = e;
        return { chipId, type: e.type, label: e.type === 'match' ? t('att.match') : e.label };
      }),
    });
  }
  gridView = { label: monthFullLabel(calMonth) + ' ' + calYear, blanks: leadingBlanks, days };
}

// ---- Popover con el detalle de un evento del calendario ----
export const eventPopover = $state({
  open: false,
  date: '',
  // null = el texto por defecto del marcado (título / "Entreno", traducidos)
  typeText: null,
  typeClass: 'eventpop-type',
  title: null,
  meta: null,
  showActions: false,
});

// Evento que se está mostrando ahora mismo en el popover del calendario (null si es
// un cumpleaños u otro elemento que no se puede editar/eliminar desde aquí).
let eventpopEventId = null;

export function openEventPopover(chipId) {
  const e = calChipLookup[chipId];
  if (!e) return;

  eventpopEventId = e.id || null;

  eventPopover.date = formatIsoDate(e.iso);
  eventPopover.typeText = calTypeLabel(e.type);
  eventPopover.typeClass = 'eventpop-type t-' + e.type;
  eventPopover.title = e.label;
  eventPopover.meta = {
    place: e.place,
    placeMapsUrl: e.placeMapsUrl,
    meet: e.meetTime ? `⏰ ${t('att.meet')} ${e.meetTime}` : '',
    start: e.startTime ? `🏁 ${t('att.ko')} ${e.startTime}` : '',
  };

  // Los cumpleaños (y cualquier otro elemento sin id real detrás) no se pueden
  // editar ni eliminar desde aquí, así que se ocultan esos botones.
  // NOTE: no se comprueba canManageEvents(): cualquiera puede editar/eliminar desde aquí.
  eventPopover.showActions = !!eventpopEventId;
  eventPopover.open = true;
}
export function closeEventPopover() {
  eventPopover.open = false;
  eventpopEventId = null;
}
export function editEventFromPopover() {
  if (!eventpopEventId) return;
  const id = eventpopEventId;
  closeEventPopover();
  openEditEventModal(id);
}
export function deleteEventFromPopover() {
  if (!eventpopEventId) return;
  const id = eventpopEventId;
  closeEventPopover();
  openDeleteEventConfirmFor(id);
}

// Al cambiar de idioma (antes setLang()): applyI18n() devolvía el título y el tipo del
// popover a su texto por defecto, y luego se volvía a pintar la cuadrícula.
export function onCalendarLangChange() {
  eventPopover.title = null;
  eventPopover.typeText = null;
  renderCalendarGrid();
}
