/* ================= ASISTENCIA (respuestas) ================= */
// Confirmar / declinar / deshacer (RSVP) con su lluvia de corazones, el modal de
// comentario / justificación, y la asistencia compartida en Supabase (tabla
// att_attendance) con su sincronización en tiempo real.
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { currentUserId, roster, rosterById } from '../../lib/roster.js';
import { translate } from '../../lib/i18n.svelte.js';
import { eventWhenDisplay } from '../../lib/dates.js';
import { attEvents, attSelection } from './events.js';
import { renderEventList, renderEventDetail } from './asistencia.svelte.js';
import { renderNextMatchBanner } from '../partidos/partidos.svelte.js';
import { renderProfile } from '../perfil/perfil.svelte.js';
import { renderWellnessReminderBanner } from '../wellness/wellness.svelte.js';

export function setMyRsvp(eventId, status, btnEl) {
  const ev = attEvents.find((e) => e.id === eventId);
  if (!ev) return;

  const isUndo = ev.attendance.me === status;
  ev.attendance.me = isUndo ? 'pending' : status; // repetir = deshacer
  if (isUndo) ev.comments.me = '';

  // Efecto de corazones saliendo del botón: azules al confirmar, rotos al declinar
  if (!isUndo) spawnRsvpHeartBurst(btnEl, status);

  renderEventList();
  if (attSelection.currentEventId === eventId) renderEventDetail();
  renderNextMatchBanner();
  renderProfile();
  // El recordatorio de Wellness se salta los eventos con "No asistiré".
  renderWellnessReminderBanner();

  // Guarda mi respuesta de forma compartida para que la vean todas las jugadoras
  saveMyAttendanceToStorage(eventId, ev.attendance.me, ev.comments.me);

  // Al declinar (o quedarse en "Dubtant"), pedimos el motivo en un modal
  if (!isUndo && (status === 'no' || status === 'maybe')) {
    openCommentModal(eventId, 'me');
  }
}

// ---- Asistencia compartida (Supabase, tabla att_attendance) ----
// Cada persona guarda su propia respuesta a un evento en una fila (event_id, user_id),
// con user_id = su ID real de Supabase Auth. No hace falta guardar el nombre: al
// pintar se usa rosterById, que ya trae los nombres reales desde la tabla "profiles".
async function saveMyAttendanceToStorage(eventId, status, comment) {
  const authUserId = auth.userId;
  if (!authUserId) return; // sin sesión iniciada no hay dónde guardarlo

  if (status === 'pending') {
    // Deshacer = borrar mi fila, para que vuelva a aparecer "Sin contestar"
    const { error } = await supabase.from('att_attendance')
      .delete().eq('event_id', eventId).eq('user_id', authUserId);
    if (error) console.error('No se ha podido deshacer la asistencia', error);
    return;
  }

  const { error } = await supabase.from('att_attendance').upsert({
    event_id: eventId,
    user_id: authUserId,
    status,
    comment: comment || '',
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('No se ha podido guardar la asistencia', error);
}

// Trae de Supabase la respuesta de TODAS las personas que ya han contestado a este
// evento, y la vuelca en ev.attendance / ev.comments (menos la mía, que ya la tengo
// en memoria más al día). Se llama justo antes de pintar el detalle de un evento.
export async function loadEventAttendanceFromStorage(ev) {
  const { data, error } = await supabase.from('att_attendance')
    .select('user_id, status, comment').eq('event_id', ev.id);
  if (error || !data) return;

  data.forEach((row) => {
    if (row.user_id === auth.userId) return;
    ev.attendance[row.user_id] = row.status;
    if (row.comment) ev.comments[row.user_id] = row.comment;

    // Si esa persona todavía no está en el roster local (p.ej. la Plantilla no se ha
    // cargado aún en esta sesión), la añadimos con lo poco que sabemos de ella para
    // que se pueda pintar en la lista de Asistirán/No asistirán; loadPlantilla() la
    // completará con su nombre real en cuanto termine de cargar.
    if (!rosterById[row.user_id]) {
      const newPlayer = {
        id: row.user_id, name: 'Alguien', mote: '', pos: '', comision: '',
        avatarUrl: '', injured: false, injuryIcon: '', birthdate: '', rm: {},
      };
      rosterById[row.user_id] = newPlayer;
      roster.push(newPlayer);
    }
  });
}

// Se refresca en cuanto cualquier cuenta confirma, rechaza o deshace su respuesta a un
// evento (sea el que tengas abierto o cualquier otro): actualiza el contador del banner
// de Inicio, la lista de eventos y, si tienes ese evento abierto, su detalle — todo sin
// que nadie tenga que recargar la página.
let attAttendanceRealtimeSubscribed = false;
export function subscribeToAttAttendanceRealtime() {
  if (attAttendanceRealtimeSubscribed) return;
  attAttendanceRealtimeSubscribed = true;
  supabase
    .channel('att-attendance-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'att_attendance' }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if (!row || !row.event_id) return;
      const ev = attEvents.find((e) => e.id === row.event_id);
      if (!ev) return;

      // No pisamos nuestra propia respuesta con la que acabamos de guardar: la tenemos
      // en memoria más al día que lo que tarde en llegar el propio evento realtime.
      if (row.user_id === auth.userId) return;

      if (payload.eventType === 'DELETE') {
        delete ev.attendance[row.user_id];
        delete ev.comments[row.user_id];
      } else {
        ev.attendance[row.user_id] = row.status;
        if (row.comment) ev.comments[row.user_id] = row.comment;
        else delete ev.comments[row.user_id];
      }

      renderNextMatchBanner();
      if (document.getElementById('sec-asistencia')?.classList.contains('active')) {
        renderEventList();
      }
      if (attSelection.currentEventId === row.event_id) renderEventDetail();
    })
    .subscribe();
}

// Trae MI propia respuesta guardada a cada evento. Es necesaria porque
// loadEventAttendanceFromStorage() y el realtime de arriba ignoran a propósito las
// filas de la propia cuenta (para no pisar en plena sesión lo que se acaba de marcar),
// así que sin esto la respuesta propia solo vive en memoria y se "borra" visualmente
// en cuanto se refresca la página, aunque siga guardada en Supabase.
export async function loadMyAttendanceFromStorage() {
  const authUserId = auth.userId;
  if (!authUserId) return;
  const { data, error } = await supabase
    .from('att_attendance')
    .select('event_id, status, comment')
    .eq('user_id', authUserId);
  if (error || !data) return;

  data.forEach((row) => {
    const ev = attEvents.find((e) => e.id === row.event_id);
    if (!ev) return;
    ev.attendance.me = row.status;
    if (row.comment) ev.comments.me = row.comment;
  });
}

function spawnRsvpHeartBurst(btnEl, status) {
  if (!btnEl || !btnEl.getBoundingClientRect) return;
  const rect = btnEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const emoji = status === 'yes' ? '💙' : status === 'maybe' ? '🤞' : '💔';
  const count = 5;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'rsvp-heart-burst';
    el.textContent = emoji;
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    el.style.fontSize = (17 + Math.random() * 9) + 'px';
    el.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 70) + 'px');
    el.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 40) + 'deg');
    el.style.animationDelay = (i * 55) + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

// ---- Modal de comentario / justificación ----
export const commentModal = $state({
  open: false,
  // null = el título por defecto del marcado ("Comentario", traducido)
  title: null,
  sub: '',
  text: '',
});
let commentModalCtx = null; // { eventId, playerId } mientras el modal está abierto

// El comentario/justificación de asistencia es siempre sobre uno mismo: nadie puede
// abrir el modal para comentar/editar la de otra persona (ver también el botón, que
// ya solo se pinta para la propia fila en attRosterRowView).
export function openCommentModal(eventId, playerId) {
  if (playerId !== currentUserId) return;
  const ev = attEvents.find((e) => e.id === eventId);
  const player = rosterById[playerId];
  if (!ev || !player) return;

  commentModalCtx = { eventId, playerId };
  // "Dubtant": el comentario explica de qué depende que pueda venir.
  commentModal.title = translate(ev.attendance.me === 'maybe' ? 'att.maybeReason' : 'att.justifyAbsence');
  commentModal.sub = `${ev.label} · ${eventWhenDisplay(ev)}`;
  commentModal.text = ev.comments[playerId] || '';
  commentModal.open = true;
  setTimeout(() => document.getElementById('comment-modal-textarea').focus(), 0);
}

export function closeCommentModal() {
  commentModal.open = false;
  commentModalCtx = null;
}

export function saveCommentModal() {
  if (!commentModalCtx) return;
  const { eventId, playerId } = commentModalCtx;
  if (playerId !== currentUserId) return;
  const ev = attEvents.find((e) => e.id === eventId);
  if (!ev) return;

  ev.comments[playerId] = commentModal.text.trim();
  closeCommentModal();
  renderEventList();
  if (attSelection.currentEventId === eventId) renderEventDetail();

  // Es siempre mi propia justificación (ver guarda arriba): se actualiza también en
  // el guardado compartido.
  saveMyAttendanceToStorage(eventId, ev.attendance.me, ev.comments.me);
}

// Al cambiar de idioma (antes setLang()): applyI18n() devolvía el título a
// "Comentario" y, si el modal estaba abierto, se volvía a escribir el subtítulo.
// NOTE: por eso el título deja de decir "Justifica tu ausencia" (se mantiene igual).
export function onCommentModalLangChange() {
  commentModal.title = null;
  if (commentModal.open && commentModalCtx) {
    const ev = attEvents.find((e) => e.id === commentModalCtx.eventId);
    if (ev) commentModal.sub = `${ev.label} · ${eventWhenDisplay(ev)}`;
  }
}
