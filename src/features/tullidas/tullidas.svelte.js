// ---- "Tullidas": lista de jugadoras apuntadas para vendaje antes de un partido ----
// Tabla en Supabase (créala si todavía no existe):
//
//   create table if not exists match_injuries (
//     id uuid primary key default gen_random_uuid(),
//     event_id text not null,
//     user_id uuid not null,
//     player_name text not null,
//     note text not null,
//     created_at timestamptz not null default now()
//   );
//
// El evento del modal es el evento abierto en el detalle de Asistencia
// (attSelection.currentEventId, src/features/asistencia/events.js), igual que antes.
import { legacy } from '../../lib/legacy.js';
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { myProfile, rosterById } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { attEvents, attSelection } from '../asistencia/events.js';
import { eventWhenDisplay } from '../../lib/dates.js';

export const tullidas = $state({
  open: false,
  // Evento cuya lista se está viendo (el currentEventId de cuando se abrió el modal).
  eventId: null,
  // "Partido vs X · Sábado 26/09/26 · ..." (se calcula al abrir, como antes).
  sub: '',
  // Cache en memoria: { [eventId]: [ {id, user_id, player_name, note, created_at}, ... ] }
  byEventId: {},
  input: null,
});

let tullidesRealtimeSubscribed = false;
// Id del próximo partido, para poder abrir "Tullidas" desde el banner de Inicio sin
// tener que entrar antes al detalle del evento (lo actualiza renderNextMatchBanner()).
let nextMatchTullidesEventId = null;
export function setNextMatchTullidesEventId(id) {
  nextMatchTullidesEventId = id;
}

export function isMine(row) {
  return row.user_id === auth.userId;
}

async function loadTullidesForEvent(eventId) {
  const { data, error } = await supabase
    .from('match_injuries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('No se ha podido cargar la lista de tullidas', error);
    return;
  }
  tullidas.byEventId[eventId] = data || [];
}

export function openTullidesModal() {
  const currentEventId = attSelection.currentEventId;
  const ev = attEvents.find((e) => e.id === currentEventId);
  if (!ev) return;
  tullidas.sub = `${ev.label} · ${eventWhenDisplay(ev)}`;
  tullidas.eventId = currentEventId;
  if (tullidas.input) tullidas.input.value = '';
  tullidas.open = true;
  loadTullidesForEvent(currentEventId);
  setTimeout(() => tullidas.input.focus(), 0);
}

// Atajo para abrir "Tullidas" del próximo partido desde el banner de Inicio, sin
// pasar antes por su detalle. Solo cambia currentEventId si hace falta (si ya
// estabas viendo el detalle de otro evento, no lo pisa innecesariamente).
export function openTullidesModalForNextMatch() {
  if (!nextMatchTullidesEventId) return;
  attSelection.currentEventId = nextMatchTullidesEventId;
  openTullidesModal();
}

export function closeTullidesModal() {
  tullidas.open = false;
}

// Al apuntarse, el nombre sale solo (el de la propia cuenta): no hace falta escribirlo,
// solo qué vendaje se necesita.
export async function addTullidesItem() {
  const input = tullidas.input;
  const note = input.value.trim();
  const currentEventId = attSelection.currentEventId;
  const authUserId = auth.userId;
  if (!note || !currentEventId || !authUserId) return;

  const row = {
    event_id: currentEventId,
    user_id: authUserId,
    player_name: displayName(rosterById.me) || myProfile.name || 'Alguien',
    note,
  };

  const { data, error } = await supabase.from('match_injuries').insert(row).select().single();
  if (error) {
    console.error('No se ha podido guardar en la lista de tullidas', error);
    return;
  }

  const eventId = attSelection.currentEventId;
  if (!tullidas.byEventId[eventId]) tullidas.byEventId[eventId] = [];
  tullidas.byEventId[eventId].push(data);
  input.value = '';
  input.focus();
}

export async function removeTullidesItem(id) {
  const { error } = await supabase
    .from('match_injuries')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId); // solo se puede borrar la propia fila
  if (error) {
    console.error('No se ha podido borrar de la lista de tullidas', error);
    return;
  }
  const rows = tullidas.byEventId[attSelection.currentEventId];
  if (rows) {
    const i = rows.findIndex((r) => r.id === id);
    if (i !== -1) rows.splice(i, 1);
  }
}

// Al borrar un evento (src/features/asistencia/events.js) se olvida también su lista.
export function forgetTullidesForEvent(eventId) {
  delete tullidas.byEventId[eventId];
}

// Sincroniza en directo la lista en cuanto cualquier persona se apunta, edita o se
// borra de "Tullidas" (esté abierto el modal o no, para tener siempre la caché al día).
export function subscribeToTullidesRealtime() {
  if (tullidesRealtimeSubscribed) return;
  tullidesRealtimeSubscribed = true;
  supabase
    .channel('tullides-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_injuries' }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if (!row || !row.event_id) return;
      if (!tullidas.byEventId[row.event_id]) tullidas.byEventId[row.event_id] = [];
      const rows = tullidas.byEventId[row.event_id];

      if (payload.eventType === 'DELETE') {
        const i = rows.findIndex((r) => r.id === row.id);
        if (i !== -1) rows.splice(i, 1);
      } else {
        const i = rows.findIndex((r) => r.id === row.id);
        if (i !== -1) rows[i] = row; else rows.push(row);
      }
    })
    .subscribe();
}
