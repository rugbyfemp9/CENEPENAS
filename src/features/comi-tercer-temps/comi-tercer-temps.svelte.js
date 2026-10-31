// ---- Comi Tercer Temps ----
// Dos pestañas: "Lista" (lista de la compra, una checklist compartida del equipo) y
// "Saldo" (su propia tesorería, con exactamente el mismo patrón que Comi Tesoreria:
// ver src/lib/treasury/).
import { supabase } from '../../lib/supabase.js';
import { roster } from '../../lib/roster.js';
import { createTreasury } from '../../lib/treasury/treasury.svelte.js';
import { t } from '../../lib/i18n.svelte.js';
import { canManageTercerTemps } from '../../lib/permissions.js';
import { COMISIONES } from '../../lib/roles.js';

// ---- Pestañas Lista / Saldo ----
export const comiTercer = $state({ tab: 'lista' });

export function setComiTercerTab(tab) {
  comiTercer.tab = tab;
}

// ---- Lista de la compra ----
// Se guarda en Supabase (tabla "tercer_shopping_items"); arranca vacía hasta que
// loadShoppingItems() traiga lo que haya guardado.
const TERCER_SHOPPING_TABLE = 'tercer_shopping_items';

export const shopping = $state({ items: [], input: '' });

export async function loadShoppingItems() {
  const { data, error } = await supabase
    .from(TERCER_SHOPPING_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('No se ha podido cargar la lista de la compra', error); return; }
  shopping.items = (data || []).map((r) => ({ id: r.id, label: r.label, checked: r.checked }));
}

export async function addShoppingItem() {
  if (!canManageTercerTemps()) return;
  const label = shopping.input.trim();
  if (!label) return;
  shopping.input = '';
  const { data, error } = await supabase.from(TERCER_SHOPPING_TABLE).insert({ label, checked: false }).select().single();
  if (error) { console.error('No se pudo añadir el artículo', error); return; }
  shopping.items.push({ id: data.id, label: data.label, checked: data.checked });
}

export async function toggleShoppingItem(id) {
  if (!canManageTercerTemps()) return;
  const item = shopping.items.find((i) => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  const { error } = await supabase.from(TERCER_SHOPPING_TABLE).update({ checked: item.checked }).eq('id', id);
  if (error) console.error('No se pudo actualizar el artículo', error);
}

export async function deleteShoppingItem(id) {
  if (!canManageTercerTemps()) return;
  shopping.items = shopping.items.filter((i) => i.id !== id);
  const { error } = await supabase.from(TERCER_SHOPPING_TABLE).delete().eq('id', id);
  if (error) console.error('No se pudo eliminar el artículo', error);
}

// ---- Saldo ----
// Personas de la plantilla que tienen marcado "Comi Tercer Temps" en su perfil
export function tercerTreasuryCommissionMembers() {
  return roster.filter((p) => p.comision === COMISIONES.tercerTemps);
}

export const tercerTreasury = createTreasury({
  table: 'tercer_treasury_entries',
  canManage: canManageTercerTemps,
  members: tercerTreasuryCommissionMembers,
  messages: {
    loadError: 'No se ha podido cargar la tesorería de Comi Tercer Temps',
    addError: 'No se pudo guardar el movimiento de Comi Tercer Temps',
    persistError: 'No se pudo guardar la tesorería de Comi Tercer Temps',
    // Se muestra en el desglose: getter para que siga el idioma activo.
    get noMembersNoEntries() { return t('comi.noMembersNoEntriesTercer'); },
  },
});
