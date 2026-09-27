/* ================= EVENTOS (crear / editar / borrar) ================= */
// Modal "Añadir evento" (elegir tipo, con sus preconfiguraciones), el modal de alta /
// edición (Lugar enlazado con Google Maps, botón 🏠 Casa, intensidad del entreno) y la
// confirmación para eliminar un evento.
import { legacy } from '../../lib/legacy.js';
import { weekdayFullLabel, formatShortDate, attEventIso, attEventType, autoMonthAbbr } from '../../lib/dates.js';
import {
  attEvents, attSelection, HOME_VENUE, buildMapsSearchUrl, generateCustomEventId,
  withEmptyAttendance, saveEventToStorage, deleteEventFromStorage,
} from './events.js';
import { renderEventList, renderEventDetail } from './asistencia.svelte.js';
import { renderCalendarGrid } from './calendar.svelte.js';
import { renderThirdTime } from '../tercer-tiempo/tercer-tiempo.svelte.js';
import { renderNextMatchBanner } from '../partidos/partidos.svelte.js';
import { renderProfile } from '../perfil/perfil.svelte.js';
import { initFantasy } from '../fantasy/fantasy.svelte.js';

const t = (key) => legacy.t(key);

// Preconfiguraciones por tipo de evento, usadas al abrir el modal "Añadir evento"
// "placeRequired" marca si el campo Lugar es obligatorio para ese tipo (los partidos sí lo son).
// Los textos usan claves i18n (resueltas con t() al abrir el modal) en vez de
// literales fijos, para que las preconfiguraciones salgan también en catalán.
const newEventPresets = {
  training: { modalTitleKey:'att.newTraining', titlePlaceholderKey:'att.training', titleValueKey:'att.training', showMeet:false, startLabelKey:'att.start', place:'CEM Mar Bella', meet:'', start:'20:30', end:'22:00', placeRequired:false, isHome:true },
  match:    { modalTitleKey:'att.newMatch', titlePlaceholderKey:'att.matchTitlePlaceholder', titleValueKey:null, showMeet:true, startLabelKey:'att.start', place:'', meet:'', start:'17:30', end:'', placeRequired:true },
  meeting:  { modalTitleKey:'att.newMeeting', titlePlaceholderKey:'att.meetingTitlePlaceholder', titleValueKey:null, showMeet:false, startLabelKey:'att.timeOptional', place:'Sala del club', meet:'', start:'', end:'', placeRequired:false },
};

export const addTypeModal = $state({ open: false });

// Modal de alta / edición. Los valores iniciales son los del marcado antiguo, antes de
// abrirlo por primera vez.
export const eventForm = $state({
  open: false,
  // null = el texto por defecto del marcado (traducido)
  title: null,
  startLabel: null,
  showDelete: false,
  titlePlaceholder: 'Reunión de directiva',
  titleValue: '',
  date: '',
  meetTime: '',
  time: '',
  endTime: '',
  place: '',
  placeRequired: false,
  placeLabel: 'Lugar (opcional)',
  homeSelected: false,
  showPlaceHint: false,
  showMeet: true,
  showIntensity: true,
  // Intensidad seleccionada (solo aplica a entrenos)
  intensity: null,
  // Búsqueda de Google Maps que enseña la vista previa bajo el campo Lugar
  mapsQuery: '',
});

export const deleteConfirm = $state({ open: false });

let pendingNewEventType = null; // 'training' | 'match' | 'meeting' — preconfiguración activa del modal "Añadir evento"
let editingEventId = null; // id del evento que se está editando (null = el modal está en modo "crear")
let pendingPlaceMapsQuery = '';
// Marca si el lugar elegido para el partido que se está creando es la Casa (CEM Mar Bella).
// Solo se pone a true al pulsar el botón 🏠 Casa; escribir a mano lo desmarca.
let pendingIsHome = false;

function updatePlaceMapsPreview() {
  eventForm.mapsQuery = pendingPlaceMapsQuery.trim();
}
export function onPlaceInput(value) {
  pendingPlaceMapsQuery = value;
  pendingIsHome = false;
  eventForm.homeSelected = false;
  updatePlaceMapsPreview();
}
export function selectHomePlace() {
  eventForm.place = HOME_VENUE.display;
  pendingPlaceMapsQuery = HOME_VENUE.mapsQuery;
  pendingIsHome = true;
  eventForm.homeSelected = true;
  updatePlaceMapsPreview();
}

export function openAttAddTypeModal() {
  addTypeModal.open = true;
}
export function closeAttAddTypeModal() {
  addTypeModal.open = false;
}

function setEventIntensityPicker(value) {
  eventForm.intensity = value;
}
export function selectEventIntensity(value) {
  // Volver a pulsar la misma opción la deselecciona (queda sin intensidad marcada)
  setEventIntensityPicker(eventForm.intensity === value ? null : value);
}

// Lo común a "crear" y "editar": campos según la preconfiguración del tipo.
function applyPresetFields(preset, isHome) {
  eventForm.titlePlaceholder = t(preset.titlePlaceholderKey);
  eventForm.placeRequired = !!preset.placeRequired;
  eventForm.placeLabel = t('att.place') + (preset.placeRequired ? '' : t('att.optionalSuffix'));
  eventForm.homeSelected = !!isHome;
  eventForm.showPlaceHint = pendingNewEventType === 'match';
}
function applyPresetTimes(preset) {
  eventForm.startLabel = t(preset.startLabelKey);
  eventForm.showMeet = preset.showMeet;
  // Si el tipo de evento no lleva convocatoria (entreno o reunión), se vacía el campo
  // aunque estuviera oculto (o el evento ya tuviera una hora de convocatoria guardada
  // de antes): así nunca se guarda una hora de convocatoria residual.
  // NOTE: por eso al editar un entreno automático se guarda meet_time ''.
  if (!preset.showMeet) eventForm.meetTime = '';
  eventForm.showIntensity = pendingNewEventType === 'training';
}

// NOTE: el botón "+" del calendario abre esto sin comprobar canManageEvents().
export function openAddEventModal(type) {
  editingEventId = null;
  pendingNewEventType = type || 'meeting';
  const preset = newEventPresets[pendingNewEventType];

  eventForm.showDelete = false;
  closeAttAddTypeModal();

  eventForm.title = t(preset.modalTitleKey);
  eventForm.titleValue = preset.titleValueKey ? t(preset.titleValueKey) : '';
  eventForm.date = '';
  eventForm.meetTime = preset.meet;
  eventForm.time = preset.start;
  eventForm.endTime = preset.end;
  eventForm.place = preset.place;
  applyPresetFields(preset, preset.isHome);
  pendingPlaceMapsQuery = preset.isHome ? HOME_VENUE.mapsQuery : preset.place;
  pendingIsHome = !!preset.isHome;
  updatePlaceMapsPreview();
  applyPresetTimes(preset);
  setEventIntensityPicker(null);

  eventForm.open = true;
}

export function openEditEventModal(eventId) {
  const ev = attEvents.find((e) => e.id === eventId);
  if (!ev) return;

  editingEventId = eventId;
  pendingNewEventType = attEventType(ev);
  const preset = newEventPresets[pendingNewEventType] || newEventPresets.meeting;

  eventForm.title = t('att.editEvent');
  eventForm.showDelete = true;
  eventForm.titleValue = ev.label;
  eventForm.date = attEventIso(ev);
  eventForm.meetTime = (ev.meetTime || '').replace('h', '');
  eventForm.time = (ev.startTime || '').replace('h', '');
  eventForm.endTime = (ev.endTime || '').replace('h', '');
  eventForm.place = ev.place || '';
  applyPresetFields(preset, ev.isHome);
  // NOTE: la búsqueda de Maps se rehace a partir del texto del lugar, así que al volver
  // a guardar se pierde la búsqueda más precisa que hubiera en place_maps_url.
  pendingPlaceMapsQuery = ev.place || '';
  pendingIsHome = !!ev.isHome;
  updatePlaceMapsPreview();
  applyPresetTimes(preset);
  setEventIntensityPicker(ev.intensity || null);

  eventForm.open = true;
}

export function closeAddEventModal() {
  eventForm.open = false;
  editingEventId = null;
}

export function saveNewEvent() {
  const type = pendingNewEventType || 'meeting';
  const title = eventForm.titleValue.trim();
  const date = eventForm.date;
  const meetTime = eventForm.meetTime;
  const startTime = eventForm.time;
  const endTime = eventForm.endTime;
  const place = eventForm.place.trim();

  if (!title || !date) {
    alert(t('att.alertTitleDate'));
    return;
  }
  if (type === 'match' && !place) {
    alert(t('att.alertPlaceRequired'));
    return;
  }

  // NOTE: when (when_text) y, en los entrenos, el título por defecto salen en el
  // idioma activo al guardar.
  const d = new Date(date + 'T00:00:00');
  const when = `${weekdayFullLabel(d.getDay())} ${formatShortDate(date)}`
    + (place ? ` · ${place}` : '')
    + (startTime ? ` · ${startTime}${endTime ? ' - ' + endTime : ''}h` : '');

  const sharedFields = {
    label: title,
    date: d.getDate(),
    month: autoMonthAbbr[d.getMonth()],
    iso: date,
    when,
    place,
    placeMapsUrl: pendingPlaceMapsQuery.trim() ? buildMapsSearchUrl(pendingPlaceMapsQuery.trim()) : '',
    isHome: pendingIsHome,
    meetTime: meetTime ? meetTime + 'h' : '',
    startTime: startTime ? startTime + 'h' : '',
    endTime: endTime ? endTime + 'h' : '',
    intensity: type === 'training' ? eventForm.intensity : null,
  };

  if (editingEventId) {
    // Modo edición: actualizamos el evento existente sin tocar asistencia ni comentarios ya guardados
    const ev = attEvents.find((e) => e.id === editingEventId);
    if (ev) {
      Object.assign(ev, sharedFields);
      saveEventToStorage(ev);
    }
  } else {
    const newEvent = withEmptyAttendance({ id: generateCustomEventId(), type, comments: {}, ...sharedFields });
    attEvents.push(newEvent);
    saveEventToStorage(newEvent);
  }

  renderEventList();
  if (attSelection.currentEventId === editingEventId) renderEventDetail();

  closeAddEventModal();
  renderCalendarGrid();
  renderThirdTime();
  renderNextMatchBanner();
  renderProfile();
  initFantasy();
}

// ---- Eliminar evento (desde el modal de edición o el popover del calendario) ----
let pendingDeleteEventId = null;

export function openDeleteEventConfirm() {
  if (!editingEventId) return;
  pendingDeleteEventId = editingEventId;
  deleteConfirm.open = true;
}
// Desde el popover del calendario: se elimina ese evento aunque no se esté editando.
export function openDeleteEventConfirmFor(eventId) {
  editingEventId = eventId;
  openDeleteEventConfirm();
}
export function closeDeleteEventConfirm() {
  deleteConfirm.open = false;
  pendingDeleteEventId = null;
}
export function confirmDeleteEvent() {
  if (!pendingDeleteEventId) return;
  const idx = attEvents.findIndex((e) => e.id === pendingDeleteEventId);
  if (idx !== -1) attEvents.splice(idx, 1);
  deleteEventFromStorage(pendingDeleteEventId);

  // Si estábamos viendo el detalle del evento borrado, volvemos a la lista de Asistencia.
  if (attSelection.currentEventId === pendingDeleteEventId) {
    attSelection.currentEventId = null;
    legacy.setSection('asistencia');
  }

  pendingDeleteEventId = null;
  deleteConfirm.open = false;
  closeAddEventModal();

  renderEventList();
  renderCalendarGrid();
  renderThirdTime();
  renderNextMatchBanner();
  initFantasy();
}

// Al cambiar de idioma (antes setLang()): applyI18n() devolvía el título del modal y
// la etiqueta de la hora de inicio a su texto por defecto.
export function onEditorLangChange() {
  eventForm.title = null;
  eventForm.startLabel = null;
}
