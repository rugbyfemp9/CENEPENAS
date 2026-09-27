// ---- "Lista": pasar lista de convocatoria el día de partido ----
// Las marcas son objetos normales (no reactivos), como antes; lo que se ve en el modal
// es la "foto" que guarda renderRollCallList() en rollcall.view. El roster sigue en el
// código antiguo: Jugadoras/Perfil llaman a renderRollCallList() al recargarlo.
import { supabase } from '../../lib/supabase.js';
import { toRemotePlayerId } from '../../lib/session.svelte.js';
import { rosterById } from '../../lib/roster.js';
import { displayName, initials } from '../../lib/names.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso } from '../../lib/dates.js';
import { finesState, canManageFines, persistFineInsert, refreshAfterChange, loadFines } from '../multas/multas.svelte.js';
import { findNextMatch } from './partidos.svelte.js';

export const rollcall = $state({
  open: false,
  // null = todavía no se ha pintado nunca (caja vacía);
  // { empty, rows: [...], summary } (empty = nadie confirmado todavía)
  view: null,
});

let matchdayRollCall = {}; // { matchId: { playerId: 'v' | 'x' } } — estado en memoria mientras se edita
let matchdayRollCallSavedAt = {}; // { matchId: isoString | null } — se rellena al cargar desde Supabase
let rollCallMatchId = null;

// Trae el estado guardado de la Lista para el próximo partido. Si ya se guardó una vez
// (saved_at con valor) y quien abre no es Comi Tesoreria, se bloquea: no se puede volver
// a pasar lista por libre, solo Comi Tesoreria puede corregirla.
export async function openRollCallModal() {
  const nextMatch = findNextMatch();
  if (!nextMatch) return;
  rollCallMatchId = nextMatch.id;

  const { data, error } = await supabase
    .from('matchday_rollcall')
    .select('marks, saved_at')
    .eq('match_id', rollCallMatchId)
    .maybeSingle();
  if (error) console.error('No se ha podido cargar la Lista guardada', error);

  const savedAt = data ? data.saved_at : null;
  matchdayRollCallSavedAt[rollCallMatchId] = savedAt;

  if (savedAt && !canManageFines()) {
    alert('Esta lista ya se ha pasado y guardado. Solo Comi Tesoreria puede volver a abrirla para corregirla.');
    return;
  }

  matchdayRollCall[rollCallMatchId] = (data && data.marks) ? { ...data.marks } : {};
  renderRollCallList();
  rollcall.open = true;
}

export function closeRollCallModal() {
  rollcall.open = false;
}

export function renderRollCallList() {
  if (!rollCallMatchId) return;
  const match = attEvents.find((e) => e.id === rollCallMatchId);
  if (!match) return;
  const confirmedIds = Object.entries(match.attendance).filter(([, s]) => s === 'yes').map(([id]) => id);
  const state = matchdayRollCall[rollCallMatchId] || {};

  if (confirmedIds.length === 0) {
    rollcall.view = { empty: true, rows: [], summary: '' };
    return;
  }

  const rows = [];
  confirmedIds.forEach((id) => {
    const player = rosterById[id];
    if (!player) return;
    const name = displayName(player);
    rows.push({
      id,
      name,
      avatarUrl: player.avatarUrl,
      initials: initials(name),
      injured: player.injured,
      injuryIcon: player.injuryIcon,
      mark: state[id],
    });
  });

  const marked = Object.values(state).filter(Boolean).length;
  rollcall.view = { empty: false, rows, summary: `${marked} de ${confirmedIds.length} marcadas` };
}

export function setRollCallMark(playerId, mark) {
  const state = matchdayRollCall[rollCallMatchId];
  if (!state) return;
  state[playerId] = state[playerId] === mark ? undefined : mark; // repetir = deshacer
  renderRollCallList();
}

// Al guardar: cada jugadora marcada con ✕ recibe automáticamente una multa de
// "Retraso" (si no la tenía ya para este partido). Y si alguien que estaba en ✕ pasa
// ahora a ✓ (o se desmarca), se le quita esa multa automática — siempre que siga
// pendiente de pago; una que ya se pagó no se toca. El estado se guarda en Supabase:
// la primera vez fija saved_at, que a partir de ahí bloquea la lista para quien no sea
// Comi Tesoreria (ver openRollCallModal).
export async function saveRollCall() {
  const match = attEvents.find((e) => e.id === rollCallMatchId);
  if (!match) { closeRollCallModal(); return; }
  const matchIso = attEventIso(match);
  const state = matchdayRollCall[rollCallMatchId] || {};

  let changed = false;

  // 1) Añadir multa a quien ahora está en ✕ y todavía no la tenía para este partido.
  //    Se espera (await) cada alta antes de seguir: así, si justo después tocara
  //    quitarla (paso 2), el id local ya es el real de Supabase y no queda a medias.
  for (const [playerId, mark] of Object.entries(state)) {
    if (mark !== 'x') continue;
    const alreadyFined = finesState.list.some((f) => f.playerId === playerId && f.reasonId === 'retraso' && f.autoMatchIso === matchIso);
    if (alreadyFined) continue;
    const tempId = crypto.randomUUID();
    const newFine = { id: tempId, playerId, reasonId: 'retraso', status: 'pendiente', autoMatchIso: matchIso };
    finesState.list.push(newFine);
    await persistFineInsert(tempId, newFine);
    changed = true;
  }

  // 2) Quitar la multa automática a quien ya no está en ✕ (ha pasado a ✓ o se ha
  //    desmarcado), solo si esa multa sigue pendiente de pago. IMPORTANTE: se borra en
  //    Supabase por jugadora + motivo + partido (no por el id local), porque ese id
  //    puede ser todavía temporal si la inserción tardó en confirmarse; borrando por
  //    estos criterios se elimina la fila real siempre, y de paso se limpia cualquier
  //    duplicado que hubiera quedado suelto de antes de este arreglo.
  const autoFinesForMatch = finesState.list.filter((f) => f.reasonId === 'retraso' && f.autoMatchIso === matchIso && f.status === 'pendiente');
  for (const f of autoFinesForMatch) {
    if (state[f.playerId] === 'x') continue; // sigue marcada, se queda
    finesState.list = finesState.list.filter((fx) => fx.id !== f.id);
    const { data, error } = await supabase
      .from('fines')
      .delete()
      .eq('reason_id', 'retraso')
      .eq('auto_match_iso', matchIso)
      .eq('status', 'pendiente')
      .eq('player_id', toRemotePlayerId(f.playerId))
      .select();
    if (error) {
      console.error('No se ha podido quitar la multa automática', error);
    } else if (!data || data.length === 0) {
      // 0 filas borradas sin error suele ser una política de RLS bloqueando el borrado.
      console.error('La multa automática no se ha borrado en Supabase (revisa permisos de borrado en "fines").');
      loadFines();
    }
    changed = true;
  }

  if (changed) {
    refreshAfterChange();
  }

  // La primera vez que se guarda fija saved_at; las siguientes veces se mantiene ese
  // mismo valor original (solo cambian las marcas), para que la lista siga "bloqueada".
  const savedAt = matchdayRollCallSavedAt[rollCallMatchId] || new Date().toISOString();
  matchdayRollCallSavedAt[rollCallMatchId] = savedAt;

  const { error } = await supabase.from('matchday_rollcall').upsert({
    match_id: rollCallMatchId,
    marks: state,
    saved_at: savedAt,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    alert('La lista se ha guardado en la app, pero no se ha podido sincronizar: ' + error.message);
  }

  closeRollCallModal();
}
