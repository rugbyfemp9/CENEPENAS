// --- Comida del tercer tiempo, por categorías con un número de huecos limitado ---
// Rejilla "Qué llevamos" del detalle, marcas ✓/✕ del día de partido y el modal para
// apuntarse (una misma o a una compañera).
//
// Los platos no son reactivos: igual que antes, la rejilla guarda una "foto" de lo que
// tiene que mostrar cada vez que se pinta (renderThirdTimeFood()).
// NOTA: la lista de comida no va ligada a ningún partido (se ve igual en todos).
import { supabase } from '../../lib/supabase.js';
import { auth, toRemotePlayerId } from '../../lib/session.svelte.js';
import { currentUserId, myRosterEntry, roster, rosterById } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { attEventIso, todayLocalIso } from '../../lib/dates.js';
import { t } from '../../lib/i18n.svelte.js';
import { thirdTimeCurrentMatch } from './groups.js';
import { checkThirdTimeAutoFines } from './auto-fines.js';

// Nota: a "Dulce" no le diste un límite concreto, así que le he puesto 3 huecos
// igual que la mayoría de categorías; dímelo si lo quieres distinto.
export const foodCategories = [
  { key: 'pasta', label: 'Pasta', limit: 3, emoji: '🍝' },
  { key: 'arroz', label: 'Arroz / Legumbres', limit: 3, emoji: '🍚' },
  { key: 'empanadas', label: 'Empanadas', limit: 2, emoji: '🥟' },
  { key: 'tortilla', label: 'Tortilla', limit: 2, emoji: '🍳' },
  { key: 'picar', label: 'Para picar', limit: 3, emoji: '🍟' },
  { key: 'dulce', label: 'Dulce', limit: 3, emoji: '🍰' },
  { key: 'otros', label: 'Otros', limit: 3, emoji: '🍽️' },
];
const thirdTimeFood = {};
foodCategories.forEach((c) => { thirdTimeFood[c.key] = []; });

// Cada entrada de comida se guarda en la tabla "third_time_food" de Supabase (igual
// que multas y cambios de turno), para que apuntarse, marcar traído/no traído o
// quitarse se vea al momento desde cualquier cuenta.
function foodRowToLocal(row) {
  const authUserId = auth.userId;
  const toLocalId = (id) => (id && id === authUserId ? 'me' : id);
  return { id: row.id, category: row.category, detail: row.detail, playerId: toLocalId(row.player_id), status: row.status || null };
}

// Busca si una jugadora ya se ha apuntado a algo (en cualquier categoría) y qué es
export function findFoodEntryForPlayer(playerId) {
  for (const cat of foodCategories) {
    const entries = thirdTimeFood[cat.key] || [];
    const idx = entries.findIndex((e) => e.playerId === playerId);
    if (idx !== -1) return { category: cat, entry: entries[idx], index: idx };
  }
  return null;
}

// El día del tercer tiempo es el mismo día que el partido que marca el turno actual
export function isThirdTimeDay() {
  const current = thirdTimeCurrentMatch();
  if (!current) return false;
  return attEventIso(current.match) === todayLocalIso();
}

export async function loadThirdTimeFood() {
  const { data, error } = await supabase.from('third_time_food').select('*').order('created_at', { ascending: true });
  if (error) { console.error('No se pudo cargar la lista de comida', error); return; }
  foodCategories.forEach((c) => { thirdTimeFood[c.key] = []; });
  (data || []).forEach((row) => {
    const local = foodRowToLocal(row);
    if (thirdTimeFood[local.category]) thirdTimeFood[local.category].push(local);
  });
  renderThirdTimeFood();
  checkThirdTimeAutoFines();
}

// Solo la persona de "Comi Tercer Temps" puede marcar traído/no traído (✓/✕), igual
// que solo Comi Tesoreria puede dar de alta multas nuevas.
function canManageThirdTimeFood() {
  const me = myRosterEntry();
  return auth.isAdmin || !!(me && me.comision === 'Comi Tercer Temps');
}

// ---- Rejilla "Qué llevamos": null mientras no se ha pintado nunca.
export const foodView = $state({ grid: null });

export function renderThirdTimeFood() {
  const supervising = isThirdTimeDay() && canManageThirdTimeFood();

  foodView.grid = foodCategories.map((cat) => {
    const entries = thirdTimeFood[cat.key] || [];
    const slots = [];
    for (let i = 0; i < cat.limit; i++) {
      const entry = entries[i];
      if (entry) {
        const player = rosterById[entry.playerId];
        const status = entry.status || null;
        slots.push({
          filled: true,
          index: i,
          status,
          text: `${String(entry.detail)} — ${player ? displayName(player) : t('sharedLineup.someone')}`,
          // Solo Comi Tercer Temps, el día del partido, tiene los botones ✓/✕. El resto
          // no tiene botones, pero sí ve el resultado: un recuadro verde con ✓ o rojo
          // con ✕ en cuanto Comi Tercer Temps lo marca.
          supervising,
          mine: entry.playerId === currentUserId,
        });
      } else {
        slots.push({ filled: false });
      }
    }
    return {
      key: cat.key,
      head: `${cat.emoji} ${t('tercer.food.' + cat.key)}`,
      count: `${entries.length}/${cat.limit}`,
      full: entries.length >= cat.limit,
      slots,
      broughtTitle: t('tercer.broughtIt'),
      missingTitle: t('tercer.didntBringIt'),
      removeTitle: t('tercer.removeMe'),
      signMeUp: t('tercer.signMeUp'),
    };
  });
}

export async function setFoodSlotStatus(catKey, index, status) {
  if (!canManageThirdTimeFood()) return;
  const entries = thirdTimeFood[catKey];
  if (!entries || !entries[index]) return;
  const entry = entries[index];
  // Tocar el mismo botón otra vez quita la marca (vuelve a quedar por confirmar)
  entry.status = entry.status === status ? null : status;
  renderThirdTimeFood();
  const { error } = await supabase.from('third_time_food').update({ status: entry.status }).eq('id', entry.id);
  if (error) alert(t('tercer.syncErrorApplied', { error: error.message }));
  checkThirdTimeAutoFines();
}

// ---- Modal para apuntarse a una categoría
export const foodModal = $state({
  open: false,
  title: 'Añadir',
  // null = el texto de partida del marcado (data-i18n="tercer.foodSubSelf"), que
  // también volvía a ponerse al cambiar de idioma aunque el modal estuviera abierto.
  sub: null,
  confirmText: 'Apuntarme',
  detail: '',
  pickerOpen: false,
  // Todo el roster (una misma incluida), fijado al abrir el modal.
  options: [],
  selected: '',
});
let foodModalCategory = null;
let foodModalTargetPlayerId = null;

export function openFoodSlotModal(catKey) {
  foodModalCategory = catKey;
  foodModalTargetPlayerId = currentUserId;

  const cat = foodCategories.find((c) => c.key === catKey);
  foodModal.title = t('tercer.addToCategory', { category: cat ? t('tercer.food.' + cat.key) : '' });
  foodModal.detail = '';
  foodModal.sub = t('tercer.foodSubSelf');
  foodModal.confirmText = t('tercer.signMeUp');

  // Selector de compañera, cerrado por defecto (se apunta una misma)
  foodModal.pickerOpen = false;
  foodModal.options = roster.map((p) => ({ id: p.id, name: displayName(p) }));
  foodModal.selected = currentUserId;

  foodModal.open = true;
}
export function toggleFoodTeammatePicker() {
  const opening = !foodModal.pickerOpen;
  foodModal.pickerOpen = opening;

  if (!opening) {
    // Al cerrar el selector, volvemos a apuntarnos a una misma
    foodModalTargetPlayerId = currentUserId;
    foodModal.selected = currentUserId;
    updateFoodModalTargetTexts();
  }
}
export function onFoodTeammateChange(playerId) {
  foodModalTargetPlayerId = playerId;
  updateFoodModalTargetTexts();
}
function updateFoodModalTargetTexts() {
  const isMe = foodModalTargetPlayerId === currentUserId;
  const player = rosterById[foodModalTargetPlayerId];
  foodModal.sub = isMe
    ? t('tercer.foodSubSelf')
    : t('tercer.foodSubOther', { name: player ? displayName(player) : t('sharedLineup.someone') });
  foodModal.confirmText = isMe ? t('tercer.signMeUp') : t('tercer.signHerUp');
}
export function closeFoodSlotModal() {
  foodModal.open = false;
}
export async function confirmFoodSlot() {
  const detail = foodModal.detail.trim();
  if (!detail) { alert(t('tercer.writeWhatBring')); return; }

  const cat = foodCategories.find((c) => c.key === foodModalCategory);
  if (!cat) return;
  const entries = thirdTimeFood[cat.key];
  if (entries.length >= cat.limit) {
    alert(t('tercer.noSlotsLeft'));
    closeFoodSlotModal();
    renderThirdTimeFood();
    return;
  }

  // Por defecto se apunta la propia jugadora logueada, pero si se eligió una
  // compañera desde el selector, el plato se le asigna a ella
  const playerId = foodModalTargetPlayerId || currentUserId;
  closeFoodSlotModal();

  const { data, error } = await supabase
    .from('third_time_food')
    .insert({ category: cat.key, detail, player_id: toRemotePlayerId(playerId) })
    .select()
    .single();
  if (error) {
    alert(t('tercer.saveError', { error: error.message }));
    renderThirdTimeFood();
    return;
  }
  entries.push({ id: data.id, category: cat.key, detail, playerId, status: null });
  renderThirdTimeFood();
}
export async function removeFoodSlot(catKey, index) {
  const entries = thirdTimeFood[catKey];
  if (!entries || !entries[index]) return;
  const entry = entries[index];
  entries.splice(index, 1);
  renderThirdTimeFood();
  const { error } = await supabase.from('third_time_food').delete().eq('id', entry.id);
  if (error) alert(t('tercer.removeSyncError', { error: error.message }));
}
