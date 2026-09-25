/* ---- Tricount: gastos compartidos y balances entre integrantes del equipo ---- */
// Se guarda en Supabase (tablas "tricount_expenses" y "tricount_settlements"); arranca
// vacío hasta que loadExpenses()/loadSettlements() traigan lo guardado (al entrar en
// la sección: hasta entonces, el banner de Inicio dice que estás al día).
import { SvelteSet } from 'svelte/reactivity';
import { legacy } from '../../lib/legacy.js';
import { t } from '../../lib/i18n.svelte.js';

const TRICOUNT_EXPENSES_TABLE = 'tricount_expenses';
const TRICOUNT_SETTLEMENTS_TABLE = 'tricount_settlements';

export const tricount = $state({
  expenses: [],
  // Pagos ya liquidados a mano (p.ej. "Marta le ha pagado 12€ a Laura" para saldar su
  // deuda). Se restan de los balances calculados a partir de los gastos, así que en
  // cuanto se marca un pago como hecho, los balances y la lista de "quién paga a quién"
  // se actualizan al momento.
  settlements: [],
  tab: 'gastos',            // 'gastos' | 'saldos'
  settlementOpen: false,    // "Ver reembolsos sugeridos", colapsado por defecto
  // Texto del botón de reembolsos tras pulsarlo (fijo en castellano); null = el texto
  // traducido de "tricount.viewSettlements", que vuelve a ponerse al cambiar de idioma.
  settlementToggleLabel: null,
});

// Modal de añadir/editar gasto. `editingId` es null en modo "nuevo gasto"; si no, el
// id del gasto que se está editando.
export const expenseForm = $state({
  open: false,
  editingId: null,
  // Título y botón se fijan al abrir el modal; null = el texto traducido de "nuevo
  // gasto" (que es también lo que vuelve a salir al cambiar de idioma).
  title: null,
  saveLabel: null,
  label: '',
  amount: '',
  iso: '',
  paidBy: '',
  players: [],              // opciones de "Pagado por" y "Entre quién se reparte", fijadas al abrir
  participants: new SvelteSet(),
});

window.addEventListener('app:langchange', () => {
  tricount.settlementToggleLabel = null;
  expenseForm.title = null;
  expenseForm.saveLabel = null;
});

const toLocalId = (id) => (id && id === legacy.authUserId ? 'me' : id);

function expenseRowToEntry(row) {
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    iso: row.iso,
    paidBy: toLocalId(row.paid_by),
    participants: (row.participants || []).map(toLocalId),
    createdBy: row.created_by || null,
  };
}

function settlementRowToEntry(row) {
  return { id: row.id, from: toLocalId(row.from_id), to: toLocalId(row.to_id), amount: Number(row.amount), iso: row.iso };
}

// Tricount es cosa de jugadoras: el resto de roles (cos técnico, directiva...) no
// deben aparecer como "pagado por" ni como participantes de un gasto, aunque estén
// en el roster general del club. Capitana cuenta como jugadora (effectiveRoleForPermissions).
export function tricountRosterPlayers() {
  return legacy.roster.filter((p) => legacy.effectiveRole(p.rol) === 'jugadora');
}

export async function loadExpenses() {
  const { data, error } = await legacy.supabase
    .from(TRICOUNT_EXPENSES_TABLE)
    .select('*')
    .order('iso', { ascending: false });
  if (error) { console.error('No se han podido cargar los gastos de Tricount', error); return; }
  tricount.expenses = (data || []).map(expenseRowToEntry);
}

export async function loadSettlements() {
  const { data, error } = await legacy.supabase
    .from(TRICOUNT_SETTLEMENTS_TABLE)
    .select('*')
    .order('iso', { ascending: false });
  if (error) { console.error('No se han podido cargar los pagos liquidados de Tricount', error); return; }
  tricount.settlements = (data || []).map(settlementRowToEntry);
}

export function tricountBalances() {
  const balances = Object.fromEntries(tricountRosterPlayers().map((p) => [p.id, 0]));
  tricount.expenses.forEach((exp) => {
    const share = exp.amount / exp.participants.length;
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
    exp.participants.forEach((pid) => {
      balances[pid] = (balances[pid] || 0) - share;
    });
  });
  tricount.settlements.forEach((s) => {
    // Quien pagó su deuda queda menos "en rojo"; a quien le pagaron queda menos "en verde"
    balances[s.from] = (balances[s.from] || 0) + s.amount;
    balances[s.to] = (balances[s.to] || 0) - s.amount;
  });
  return balances;
}

// Algoritmo de liquidación mínima: empareja a quien más debe con a quien más le
// deben, una y otra vez, hasta saldar todo con el menor número de pagos posible.
export function tricountSettlementPlan() {
  const balances = tricountBalances();
  const creditors = [];
  const debtors = [];
  tricountRosterPlayers().forEach((p) => {
    // Se trabaja en céntimos para no arrastrar errores de redondeo con decimales
    const cents = Math.round((balances[p.id] || 0) * 100);
    if (cents > 0) creditors.push({ id: p.id, cents });
    else if (cents < 0) debtors.push({ id: p.id, cents: -cents });
  });
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const plan = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amountCents = Math.min(c.cents, d.cents);
    if (amountCents > 0) {
      plan.push({ from: d.id, to: c.id, amount: amountCents / 100 });
    }
    c.cents -= amountCents;
    d.cents -= amountCents;
    if (c.cents === 0) ci++;
    if (d.cents === 0) di++;
  }
  return plan;
}

// Nombre para mostrar de una persona del roster por su id local ('—' si ya no está).
export function rosterName(id) {
  const p = legacy.rosterById[id];
  return p ? legacy.displayName(p) : '—';
}

// Trocea un texto traducido con marcadores, p.ej. "{from} debe pagar {amount} a {to}",
// para poder pintar cada marcador con su propio elemento (<b>, <span class="amt">...).
export function templateParts(template) {
  return template.split(/(\{\w+\})/).filter((s) => s !== '').map((raw) => {
    const m = /^\{(\w+)\}$/.exec(raw);
    return { raw, key: m ? m[1] : null };
  });
}

// Cabecera de fecha para agrupar el listado de gastos, tipo "23 de agosto de 2026"
export function tricountDateHeading(iso) {
  if (!iso) return t('tricount.noDate');
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${legacy.withDePrefix(legacy.monthFullLabel(m - 1))} de ${y}`;
}

// Clase y textos según el saldo (con medio céntimo de margen para el redondeo)
export function balanceKind(n) {
  return n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : 'zero';
}

export function setTricountTab(tab) {
  tricount.tab = tab;
}

export function toggleSettlementPanel() {
  const opening = !tricount.settlementOpen;
  tricount.settlementOpen = opening;
  tricount.settlementToggleLabel = opening ? 'Ocultar reembolsos sugeridos' : 'Ver reembolsos sugeridos';
}

export async function settleTricountPayment(fromId, toId, amount) {
  const { data, error } = await legacy.supabase
    .from(TRICOUNT_SETTLEMENTS_TABLE)
    .insert({ from_id: legacy.toRemotePlayerId(fromId), to_id: legacy.toRemotePlayerId(toId), amount, iso: legacy.todayIso() })
    .select()
    .single();
  if (error) { console.error('No se pudo guardar el pago liquidado', error); return; }
  tricount.settlements.push(settlementRowToEntry(data));
}

export async function undoTricountSettlement(id) {
  tricount.settlements = tricount.settlements.filter((s) => s.id !== id);
  const { error } = await legacy.supabase.from(TRICOUNT_SETTLEMENTS_TABLE).delete().eq('id', id);
  if (error) console.error('No se pudo deshacer el pago liquidado', error);
}

// Opciones del modal: las jugadoras de ahora mismo. Si quien pagó no está entre
// ellas, el desplegable se queda sin nada elegido (y al guardar pide elegir a alguien).
function fillPlayers(paidBy) {
  expenseForm.players = tricountRosterPlayers().map((p) => ({ id: p.id, name: legacy.displayName(p) }));
  expenseForm.paidBy = expenseForm.players.some((p) => p.id === paidBy) ? paidBy : '';
}

// Pone el modal en modo "nuevo gasto": pagado por una misma por defecto y nadie
// marcado todavía en "entre quién se reparte" (se elige a mano cada vez).
export function openAddTricountModal() {
  expenseForm.editingId = null;
  expenseForm.title = t('tricount.newExpense');
  expenseForm.saveLabel = t('tricount.saveExpense');
  expenseForm.label = '';
  expenseForm.amount = '';
  expenseForm.iso = legacy.todayIso();
  fillPlayers(legacy.currentUserId);
  expenseForm.participants = new SvelteSet();
  expenseForm.open = true;
}

// Igual que abrir el modal para un gasto nuevo, pero precargando lo que ya tenía el
// gasto. Solo quien lo creó puede llegar aquí (ver el botón de editar en la lista).
export function openEditTricountModal(id) {
  const exp = tricount.expenses.find((e) => e.id === id);
  if (!exp) return;
  if (!exp.createdBy || exp.createdBy !== legacy.authUserId) {
    alert('Solo quien creó el gasto puede editarlo.');
    return;
  }
  expenseForm.editingId = id;
  expenseForm.title = t('tricount.editExpense');
  expenseForm.saveLabel = t('tricount.saveChanges');
  expenseForm.label = exp.label;
  expenseForm.amount = exp.amount;
  expenseForm.iso = exp.iso;
  fillPlayers(exp.paidBy);
  expenseForm.participants = new SvelteSet(exp.participants);
  expenseForm.open = true;
}

export function closeAddTricountModal() {
  expenseForm.open = false;
  expenseForm.editingId = null;
}

export function toggleTricountParticipant(id) {
  if (expenseForm.participants.has(id)) expenseForm.participants.delete(id);
  else expenseForm.participants.add(id);
}

export async function saveTricountExpense() {
  const label = String(expenseForm.label).trim();
  const amount = parseFloat(expenseForm.amount);
  const iso = expenseForm.iso;
  const paidBy = expenseForm.paidBy;
  const participants = Array.from(expenseForm.participants);

  if (!label || !amount || amount <= 0) {
    alert('Ponle un concepto y un importe válido al gasto.');
    return;
  }
  if (!paidBy) {
    alert('Indica quién ha pagado el gasto.');
    return;
  }
  if (participants.length === 0) {
    alert('Elige entre quién se reparte el gasto.');
    return;
  }

  if (expenseForm.editingId) {
    const { data, error } = await legacy.supabase
      .from(TRICOUNT_EXPENSES_TABLE)
      .update({
        label, amount, iso,
        paid_by: legacy.toRemotePlayerId(paidBy),
        participants: participants.map(legacy.toRemotePlayerId),
      })
      .eq('id', expenseForm.editingId)
      .select()
      .single();
    if (error) {
      console.error('No se pudo actualizar el gasto', error);
      alert('No se ha podido guardar el cambio. Inténtalo de nuevo.');
      return;
    }
    const updated = expenseRowToEntry(data);
    tricount.expenses = tricount.expenses.map((e) => (e.id === updated.id ? updated : e));
  } else {
    const { data, error } = await legacy.supabase
      .from(TRICOUNT_EXPENSES_TABLE)
      .insert({
        label, amount, iso,
        paid_by: legacy.toRemotePlayerId(paidBy),
        participants: participants.map(legacy.toRemotePlayerId),
        created_by: legacy.authUserId,
      })
      .select()
      .single();
    if (error) {
      console.error('No se pudo guardar el gasto', error);
      alert('No se ha podido guardar el gasto. Inténtalo de nuevo.');
      return;
    }
    tricount.expenses.push(expenseRowToEntry(data));
  }

  closeAddTricountModal();
}

// NOTA: cualquiera puede borrar cualquier gasto, sin confirmación (editar, en cambio,
// solo quien lo creó).
export async function deleteTricountExpense(id) {
  tricount.expenses = tricount.expenses.filter((e) => e.id !== id);
  const { error } = await legacy.supabase.from(TRICOUNT_EXPENSES_TABLE).delete().eq('id', id);
  if (error) console.error('No se pudo eliminar el gasto', error);
}
