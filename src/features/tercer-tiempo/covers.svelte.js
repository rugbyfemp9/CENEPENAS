/* --- Cambios de turno: alguien que no puede asistir pide a una compañera que la cubra --- */
// Solicitudes de cambio (third_time_covers), favores pendientes de devolver
// (third_time_debts), su devolución automática y el modal "No puedo asistir".
//
// Los arrays no son reactivos: igual que antes, las vistas solo se vuelven a leer de
// aquí cuando se llama a renderThirdTime() (tercer-tiempo.svelte.js).
import { supabase } from '../../lib/supabase.js';
import { auth, toRemotePlayerId } from '../../lib/session.svelte.js';
import { currentUserId, roster } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { t } from '../../lib/i18n.svelte.js';
import { renderThirdTime } from './tercer-tiempo.svelte.js';
import {
  thirdTimeCurrentMatch, thirdTimeActiveMatch, thirdTimeGroupOf, thirdTimeRolesForIndex, thirdTimeEventLabel,
} from './groups.js';

// Solicitudes de cambio pendientes de aceptar.
export let thirdTimeCovers = [];

// Turnos pendientes de devolver: quien recibió el favor (owedBy) se lo debe a quien
// la cubrió (owedTo).
export let thirdTimeDebts = [];

// ---- Cambios de turno y deudas: leídos y guardados en las tablas "third_time_covers"
// y "third_time_debts" de Supabase, igual que las multas, para que pedir un cambio,
// aceptarlo/rechazarlo o que se devuelva un favor se vea al momento desde cualquier
// cuenta o dispositivo (y no se pierda al recargar la página).
function coverRowToLocal(row) {
  const authUserId = auth.userId;
  const toLocalId = (id) => (id && id === authUserId ? 'me' : id);
  return {
    id: row.id,
    matchId: row.match_id,
    fromPlayerId: toLocalId(row.from_player_id),
    toPlayerId: toLocalId(row.to_player_id),
    status: row.status,
    auto: row.auto,
  };
}
function debtRowToLocal(row) {
  const authUserId = auth.userId;
  const toLocalId = (id) => (id && id === authUserId ? 'me' : id);
  return {
    id: row.id,
    owedBy: toLocalId(row.owed_by),
    owedTo: toLocalId(row.owed_to),
    settled: row.settled,
    originMatchId: row.origin_match_id,
    originLabel: row.origin_label,
    settledMatchLabel: row.settled_match_label,
  };
}

export async function loadThirdTimeCovers() {
  const { data, error } = await supabase.from('third_time_covers').select('*').order('created_at', { ascending: true });
  if (error) { console.error('No se pudieron cargar los cambios de turno', error); return; }
  thirdTimeCovers = (data || []).map(coverRowToLocal);
  renderThirdTime();
}
export async function loadThirdTimeDebts() {
  const { data, error } = await supabase.from('third_time_debts').select('*').order('created_at', { ascending: true });
  if (error) { console.error('No se pudieron cargar las deudas de tercer tiempo', error); return; }
  thirdTimeDebts = (data || []).map(debtRowToLocal);
  renderThirdTime();
}

// Inserta un cambio de turno nuevo en Supabase y sustituye su id local (temporal)
// por el id real que ha generado la base de datos.
async function persistCoverInsert(localId, cover) {
  const { data, error } = await supabase
    .from('third_time_covers')
    .insert({
      match_id: cover.matchId,
      from_player_id: toRemotePlayerId(cover.fromPlayerId),
      to_player_id: toRemotePlayerId(cover.toPlayerId),
      status: cover.status,
      auto: !!cover.auto,
    })
    .select()
    .single();
  if (error) {
    alert(t('tercer.alertCoverSyncError', { error: error.message }));
    return;
  }
  const local = thirdTimeCovers.find((c) => c.id === localId);
  if (local) local.id = data.id;
  renderThirdTime();
}
async function persistCoverUpdate(coverId, patch) {
  const { error } = await supabase.from('third_time_covers').update(patch).eq('id', coverId);
  if (error) {
    alert(t('tercer.syncErrorApplied', { error: error.message }));
  }
}
// Inserta una deuda nueva (favor pendiente de devolver) y devuelve su id real de Supabase.
async function persistDebtInsert(debt) {
  const { data, error } = await supabase
    .from('third_time_debts')
    .insert({
      owed_by: toRemotePlayerId(debt.owedBy),
      owed_to: toRemotePlayerId(debt.owedTo),
      settled: !!debt.settled,
      origin_match_id: debt.originMatchId,
      origin_label: debt.originLabel || null,
    })
    .select()
    .single();
  if (error) {
    alert(t('tercer.alertDebtSyncError', { error: error.message }));
    return null;
  }
  return data.id;
}
async function persistDebtUpdate(debtId, patch) {
  const remotePatch = {};
  if ('settled' in patch) remotePatch.settled = patch.settled;
  if ('settledMatchLabel' in patch) remotePatch.settled_match_label = patch.settledMatchLabel;
  const { error } = await supabase.from('third_time_debts').update(remotePatch).eq('id', debtId);
  if (error) {
    alert(t('tercer.syncErrorApplied', { error: error.message }));
  }
}

// Aplica automáticamente los cambios que se le deben a alguien: si a la compañera que te
// hizo un favor le toca cocinar o limpiar en el próximo tercer tiempo, ese turno se te
// asigna a ti para devolvérselo, sin que nadie tenga que acordarse
// NOTA: lo hace la app de cualquiera que la tenga abierta (aunque no tenga nada que ver
// con esa deuda), cada vez que se repinta el Tercer tiempo.
export function resolveThirdTimeDebts() {
  const current = thirdTimeCurrentMatch();
  if (!current) return;
  const { match, index } = current;

  thirdTimeDebts.filter((d) => !d.settled).forEach((d) => {
    if (d.originMatchId === match.id) return; // no devolver el favor en el mismo partido en que se pidió

    const group = thirdTimeGroupOf(d.owedTo);
    const { cookGroup, cleanGroup } = thirdTimeRolesForIndex(index);
    const hasDuty = group === cookGroup || group === cleanGroup;
    if (!hasDuty) return;

    const already = thirdTimeCovers.some((c) => c.matchId === match.id && c.fromPlayerId === d.owedTo && c.status === 'aceptado');
    if (already) return;

    const tempId = 'ttc-temp-' + Math.random().toString(36).slice(2);
    const newCover = { id: tempId, matchId: match.id, fromPlayerId: d.owedTo, toPlayerId: d.owedBy, status: 'aceptado', auto: true };
    thirdTimeCovers.push(newCover);
    d.settled = true;
    d.settledMatchLabel = match.label;

    // Se guarda en Supabase sin bloquear el render: si falla, se reintentará en la
    // próxima vez que se recalculen los turnos.
    persistCoverInsert(tempId, newCover);
    persistDebtUpdate(d.id, { settled: true, settledMatchLabel: match.label });
  });
}

// ---- Modal "No puedo asistir"
export const swapModal = $state({
  open: false,
  // Partido del subtítulo ("Vas a pedir que alguien te cubra en …"): el texto lo
  // traduce el modal, así sigue el cambio de idioma.
  matchLabel: '',
  // Compañeras que se ofrecen (se fijan al abrir el modal).
  // NOTA: se ofrece todo el roster menos una misma, staff y jugadoras del otro grupo incluidas.
  options: [],
  // Se incrementa en cada apertura para volver a crear el <select> (y que quede
  // elegida la primera opción, como al rellenarlo de nuevo con innerHTML).
  seq: 0,
});
let swapModalCtx = null; // { matchId, matchLabel } — partido sobre el que se pide el cambio

export function openSwapModal() {
  const current = thirdTimeActiveMatch();
  if (!current) return;
  swapModalCtx = { matchId: current.match.id, matchLabel: current.match.label };

  swapModal.matchLabel = current.match.label;
  swapModal.options = roster.filter((p) => p.id !== currentUserId)
    .map((p) => ({ id: p.id, name: displayName(p) }));
  swapModal.seq++;
  swapModal.open = true;
}
export function closeSwapModal() {
  swapModal.open = false;
  swapModalCtx = null;
}
// toPlayerId: lo elegido en el desplegable.
export async function confirmSwapRequest(toPlayerId) {
  if (!swapModalCtx) return;
  if (!toPlayerId) return;

  const tempId = 'ttc-temp-' + Math.random().toString(36).slice(2);
  const newCover = { id: tempId, matchId: swapModalCtx.matchId, fromPlayerId: currentUserId, toPlayerId, status: 'pendiente', auto: false };
  thirdTimeCovers.push(newCover);
  closeSwapModal();
  renderThirdTime();
  await persistCoverInsert(tempId, newCover);
}

// La compañera elegida acepta: sus roles para ese partido se permutan al momento
export async function acceptSwap(coverId) {
  const c = thirdTimeCovers.find((x) => x.id === coverId);
  if (!c || c.status !== 'pendiente') return;
  c.status = 'aceptado';
  renderThirdTime();
  await persistCoverUpdate(coverId, { status: 'aceptado' });

  // Se guarda el favor: en el próximo tercer tiempo en el que le toque a quien ha cubierto,
  // se le devolverá el turno automáticamente sin tener que acordarse
  const tempDebtId = 'ttd-temp-' + Math.random().toString(36).slice(2);
  const newDebt = {
    id: tempDebtId,
    owedBy: c.fromPlayerId,
    owedTo: c.toPlayerId,
    settled: false,
    originMatchId: c.matchId,
    originLabel: thirdTimeEventLabel(c.matchId),
  };
  thirdTimeDebts.push(newDebt);
  renderThirdTime();

  const remoteId = await persistDebtInsert(newDebt);
  if (remoteId) newDebt.id = remoteId;
}
export async function rejectSwap(coverId) {
  const c = thirdTimeCovers.find((x) => x.id === coverId);
  if (!c || c.status !== 'pendiente') return;
  c.status = 'rechazado';
  renderThirdTime();
  await persistCoverUpdate(coverId, { status: 'rechazado' });
}
