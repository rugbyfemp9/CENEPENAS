// ---- Wellness / RPE (tabla Supabase "attendance_wellness") ----
// Valoración que rellena cada jugadora tras un evento:
//   1) RPE (esfuerzo percibido, 1-10) con slider, emoji, color y texto dinámicos.
//   2) Horas de sueño: selector de un solo clic (<6h, 7-8h, >8h).
//   3) Estado de ánimo: 5 emojis de un solo clic.
//   4) Molestias físicas: Sí/No y, si Sí, en qué zona.
// Todo se guarda junto, en una sola fila por (event_id, user_id).
// Todo el módulo (botón + modal) es SOLO para el rol jugadora: ver canUseWellness()
// (src/lib/permissions.js) y el detalle de un evento (src/features/asistencia).
//
// Los eventos (attEvents, src/features/asistencia/events.js) no son reactivos; el perfil
// y la sesión siguen viviendo en el código antiguo.
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { canUseWellness } from '../../lib/permissions.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso, attEventType, eventWhenDisplay, hasEventEnded } from '../../lib/dates.js';
import { t } from '../../lib/i18n.svelte.js';

// Cada valor del 1 al 10 tiene su propio emoji, color y texto descriptivo, tal como
// los ha definido el club (algunos "emoji" son directamente el círculo de color).
export const RPE_LEVELS = {
  1:  { emoji: '😌', color: '#2E9E6C', key: 'att.rpe1' },
  2:  { emoji: '🟢', color: '#3CAE73', key: 'att.rpe2' },
  3:  { emoji: '🙂', color: '#8DB93C', key: 'att.rpe3' },
  4:  { emoji: '🟡', color: '#E3B23C', key: 'att.rpe4' },
  5:  { emoji: '🏃‍♀️', color: '#DE9F3F', key: 'att.rpe5' },
  6:  { emoji: '🟠', color: '#D8894A', key: 'att.rpe6' },
  7:  { emoji: '🥵', color: '#D8704A', key: 'att.rpe7' },
  8:  { emoji: '🔴', color: '#D8564A', key: 'att.rpe8' },
  9:  { emoji: '🔥', color: '#B33A2E', key: 'att.rpe9' },
  10: { emoji: '💀', color: '#7A1E1E', key: 'att.rpe10' },
};
export function wellnessRpeLevel(v) {
  return RPE_LEVELS[Number(v)] || RPE_LEVELS[5];
}

export const wellnessModal = $state({
  open: false,
  // false hasta la primera apertura: se ve el marcado inicial (🙂, sin descripción)
  shown: false,
  eventId: null,
  sub: '',
  rpe: 5,
  hasDiscomfort: null, // null = todavía no se ha abierto nunca (ninguna opción marcada)
  sleep: null, // 'lt6' | '7-8' | 'gt8' | null (todavía sin elegir)
  mood: null, // 1-5 | null (todavía sin elegir)
  discomfortDetail: '',
});

export function setWellnessDiscomfort(hasDiscomfort) {
  wellnessModal.hasDiscomfort = hasDiscomfort;
}

// Tocar la opción ya seleccionada la deselecciona (vuelve a "todavía sin elegir", es
// decir, val = null): así se puede dejar el campo vacío aunque antes se hubiera
// marcado algo por error, sin tener que cerrar el modal y volver a entrar.
export function setWellnessSleep(val) {
  wellnessModal.sleep = (val !== null && val === wellnessModal.sleep) ? null : val;
}

export function setWellnessMood(val) {
  wellnessModal.mood = (val !== null && Number(val) === Number(wellnessModal.mood)) ? null : val;
}

export async function openWellnessModal(eventId) {
  if (!canUseWellness()) return;
  const ev = attEvents.find((e) => e.id === eventId);
  if (!ev) return;

  wellnessModal.eventId = eventId;
  wellnessModal.sub = `${ev.label} · ${eventWhenDisplay(ev)}`;

  // Valores por defecto mientras se cargan (si ya había una respuesta previa, se
  // sobrescriben en cuanto llega la respuesta de Supabase, más abajo).
  wellnessModal.shown = true;
  wellnessModal.rpe = 5;
  wellnessModal.sleep = null;
  wellnessModal.mood = null;
  wellnessModal.hasDiscomfort = false;
  wellnessModal.discomfortDetail = '';

  wellnessModal.open = true;

  const authUserId = auth.userId;
  if (!authUserId) return; // sin sesión iniciada no hay nada que cargar
  const { data, error } = await supabase.from('attendance_wellness')
    .select('rpe, sleep_hours, mood, has_discomfort, discomfort_detail')
    .eq('event_id', eventId).eq('user_id', authUserId).maybeSingle();
  if (error) { console.error('No se ha podido cargar el wellness', error); return; }
  // Si mientras cargaba se cerró el modal o se abrió el de otro evento, no pisamos nada
  if (wellnessModal.eventId !== eventId || !data) return;

  wellnessModal.rpe = Number(data.rpe || 5);
  wellnessModal.sleep = data.sleep_hours || null;
  wellnessModal.mood = data.mood || null;
  wellnessModal.hasDiscomfort = !!data.has_discomfort;
  wellnessModal.discomfortDetail = data.discomfort_detail || '';
}

export function closeWellnessModal() {
  wellnessModal.open = false;
  wellnessModal.eventId = null;
}

export async function saveWellnessModal() {
  if (!wellnessModal.eventId) return;
  const authUserId = auth.userId;
  if (!authUserId) { closeWellnessModal(); return; } // sin sesión, no hay dónde guardarlo

  const eventId = wellnessModal.eventId;
  const rpe = Number(wellnessModal.rpe);
  const discomfortDetail = wellnessModal.discomfortDetail.trim();

  const { error } = await supabase.from('attendance_wellness').upsert({
    event_id: eventId,
    user_id: authUserId,
    rpe,
    sleep_hours: wellnessModal.sleep,
    mood: wellnessModal.mood,
    has_discomfort: wellnessModal.hasDiscomfort,
    discomfort_detail: wellnessModal.hasDiscomfort ? discomfortDetail : '',
    updated_at: new Date().toISOString(),
    // onConflict: se indica explícitamente (event_id, user_id) para que, si ya había
    // una valoración de esta jugadora para este entreno, SUSTITUYA esa fila en vez de
    // crear una segunda — así entrar de nuevo y guardar otros valores reemplaza a los
    // anteriores. Requiere que en Supabase exista una constraint UNIQUE sobre
    // (event_id, user_id) en "attendance_wellness".
  }, { onConflict: 'event_id,user_id' });
  if (error) {
    console.error('No se ha podido guardar el wellness', error);
    alert(t('att.wellnessSaveError'));
    return;
  }
  closeWellnessModal();
  // Si el entreno recién valorado era el que señalaba el banner de Inicio, se
  // recalcula para que desaparezca (o pase al siguiente entreno pendiente, si hay).
  renderWellnessReminderBanner();
}

// ---- Banner "Entreno pendiente de valorar" (Inicio) ----
// Recuerda a las jugadoras que valoren el Wellness/RPE del entreno finalizado más
// reciente que todavía no tienen valorado. Solo visible para el rol jugadora (misma
// condición que el resto del módulo, ver canUseWellness()).
export const reminder = $state({
  // null = todavía sin calcular (manda el CSS: oculto); luego 'flex' o 'none'
  display: null,
  eventId: null,
});

function hideReminder() {
  reminder.display = 'none';
  reminder.eventId = null;
}

export async function renderWellnessReminderBanner() {
  const authUserId = auth.userId;
  if (!canUseWellness() || !authUserId) { hideReminder(); return; }

  const now = new Date();
  // Igual que en el selector de eventos de Cos Tècnic (populateWellnessStaffEventSelect):
  // cualquier evento que no sea una reunión cuenta para el Wellness/RPE (entrenos Y
  // partidos), no solo entrenos. Antes solo miraba 'training', así que si el último
  // evento finalizado de una jugadora era un partido, el banner nunca lo encontraba
  // aunque tuviera una valoración pendiente de verdad.
  const pastTrainings = attEvents
    .filter((ev) => attEventType(ev) !== 'meeting' && hasEventEnded(ev, now))
    .sort((a, b) => {
      const isoCmp = attEventIso(b).localeCompare(attEventIso(a));
      if (isoCmp !== 0) return isoCmp;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });

  if (!pastTrainings.length) { hideReminder(); return; }

  const { data, error } = await supabase.from('attendance_wellness')
    .select('event_id').eq('user_id', authUserId)
    .in('event_id', pastTrainings.map((ev) => ev.id));
  if (error) {
    console.error('No se ha podido comprobar el wellness pendiente', error);
    hideReminder();
    return;
  }

  const ratedIds = new Set((data || []).map((row) => row.event_id));
  const pending = pastTrainings.find((ev) => !ratedIds.has(ev.id));

  if (!pending) { hideReminder(); return; }

  reminder.eventId = pending.id;
  reminder.display = 'flex';
}

// Abre directamente el modal de valoración Wellness/RPE del entreno pendiente que
// señala el banner, sin pasar antes por el detalle del evento.
export function openWellnessReminderBanner() {
  if (!reminder.eventId) return;
  openWellnessModal(reminder.eventId);
}
