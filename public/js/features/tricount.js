/* ---- Tricount: gastos compartidos y balances entre integrantes del equipo ---- */
// Se guarda en Supabase (tablas "tricount_expenses" y "tricount_settlements"); arranca
// vacío hasta que loadTricountExpenses()/loadTricountSettlements() traigan lo guardado.
let tricountExpenses = [];
// Pagos ya liquidados a mano (p.ej. "Marta le ha pagado 12€ a Laura" para saldar su
// deuda). Se restan de los balances calculados a partir de los gastos, así que en
// cuanto se marca un pago como hecho, los balances y la lista de "quién paga a quién"
// se actualizan al momento.
let tricountSettlements = [];

const TRICOUNT_EXPENSES_TABLE = 'tricount_expenses';
const TRICOUNT_SETTLEMENTS_TABLE = 'tricount_settlements';

function tricountExpenseRowToEntry(row){
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    iso: row.iso,
    paidBy: toLocalId(row.paid_by),
    participants: (row.participants || []).map(toLocalId),
    createdBy: row.created_by || null
  };
}

// Tricount es cosa de jugadoras: el resto de roles (cos técnico, directiva...) no
// deben aparecer como "pagado por" ni como participantes de un gasto, aunque estén
// en el roster general del club. Capitana cuenta como jugadora (effectiveRoleForPermissions).
function tricountRosterPlayers(){
  return roster.filter(p => effectiveRoleForPermissions(p.rol) === 'jugadora');
}
function tricountSettlementRowToEntry(row){
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return { id:row.id, from:toLocalId(row.from_id), to:toLocalId(row.to_id), amount:Number(row.amount), iso:row.iso };
}

async function loadTricountExpenses(){
  const { data, error } = await supabaseClient
    .from(TRICOUNT_EXPENSES_TABLE)
    .select('*')
    .order('iso', { ascending:false });
  if(error){ console.error('No se han podido cargar los gastos de Tricount', error); return; }
  tricountExpenses = (data || []).map(tricountExpenseRowToEntry);
  renderTricount();
}

async function loadTricountSettlements(){
  const { data, error } = await supabaseClient
    .from(TRICOUNT_SETTLEMENTS_TABLE)
    .select('*')
    .order('iso', { ascending:false });
  if(error){ console.error('No se han podido cargar los pagos liquidados de Tricount', error); return; }
  tricountSettlements = (data || []).map(tricountSettlementRowToEntry);
  renderTricount();
}

function tricountBalances(){
  const balances = Object.fromEntries(tricountRosterPlayers().map(p => [p.id, 0]));
  tricountExpenses.forEach(exp => {
    const share = exp.amount / exp.participants.length;
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount;
    exp.participants.forEach(pid => {
      balances[pid] = (balances[pid] || 0) - share;
    });
  });
  tricountSettlements.forEach(s => {
    // Quien pagó su deuda queda menos "en rojo"; a quien le pagaron queda menos "en verde"
    balances[s.from] = (balances[s.from] || 0) + s.amount;
    balances[s.to] = (balances[s.to] || 0) - s.amount;
  });
  return balances;
}

// Algoritmo de liquidación mínima: empareja a quien más debe con a quien más le
// deben, una y otra vez, hasta saldar todo con el menor número de pagos posible.
function tricountSettlementPlan(){
  const balances = tricountBalances();
  const creditors = [];
  const debtors = [];
  tricountRosterPlayers().forEach(p => {
    // Se trabaja en céntimos para no arrastrar errores de redondeo con decimales
    const cents = Math.round((balances[p.id] || 0) * 100);
    if(cents > 0) creditors.push({ id:p.id, cents });
    else if(cents < 0) debtors.push({ id:p.id, cents:-cents });
  });
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const plan = [];
  let ci = 0, di = 0;
  while(ci < creditors.length && di < debtors.length){
    const c = creditors[ci];
    const d = debtors[di];
    const amountCents = Math.min(c.cents, d.cents);
    if(amountCents > 0){
      plan.push({ from:d.id, to:c.id, amount: amountCents / 100 });
    }
    c.cents -= amountCents;
    d.cents -= amountCents;
    if(c.cents === 0) ci++;
    if(d.cents === 0) di++;
  }
  return plan;
}

function renderTricountSettlement(){
  const box = document.getElementById('tricount-settlement-list');
  if(!box) return;
  const plan = tricountSettlementPlan();
  if(plan.length === 0){
    box.innerHTML = `<div class="tricount-settlement-empty">${escapeHtml(t('tricount.settlementEmpty'))}</div>`;
    return;
  }
  box.innerHTML = plan.map(item => {
    const from = rosterById[item.from];
    const to = rosterById[item.to];
    const fromName = from ? displayName(from) : '—';
    const toName = to ? displayName(to) : '—';
    return `
        <div class="tricount-settlement-item">
          <div class="txt">${t('tricount.mustPay', { from: `<b>${escapeHtml(fromName)}</b>`, amount: `<span class="amt">${formatEuro(item.amount)}</span>`, to: `<b>${escapeHtml(toName)}</b>` })}</div>
          <button type="button" class="settle-btn" onclick="settleTricountPayment('${item.from}','${item.to}',${item.amount})">${escapeHtml(t('tricount.markPaid'))}</button>
        </div>
      `;
  }).join('');
}
async function settleTricountPayment(fromId, toId, amount){
  const { data, error } = await supabaseClient
    .from(TRICOUNT_SETTLEMENTS_TABLE)
    .insert({ from_id: toRemotePlayerId(fromId), to_id: toRemotePlayerId(toId), amount, iso: todayLocalIso() })
    .select()
    .single();
  if(error){ console.error('No se pudo guardar el pago liquidado', error); return; }
  tricountSettlements.push(tricountSettlementRowToEntry(data));
  renderTricount();
}
async function undoTricountSettlement(id){
  tricountSettlements = tricountSettlements.filter(s => s.id !== id);
  renderTricount();
  const { error } = await supabaseClient.from(TRICOUNT_SETTLEMENTS_TABLE).delete().eq('id', id);
  if(error) console.error('No se pudo deshacer el pago liquidado', error);
}
function renderTricountSettledList(){
  const box = document.getElementById('tricount-settled-list');
  const head = document.getElementById('tricount-settled-head');
  if(!box) return;
  if(tricountSettlements.length === 0){
    box.innerHTML = '';
    if(head) head.style.display = 'none';
    return;
  }
  if(head) head.style.display = '';
  const sorted = tricountSettlements.slice().sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));
  box.innerHTML = sorted.map(s => {
    const from = rosterById[s.from];
    const to = rosterById[s.to];
    const fromName = from ? displayName(from) : '—';
    const toName = to ? displayName(to) : '—';
    return `
        <div class="tricount-settled-item">
          <div class="txt">${t('tricount.paidTo', { from: `<b>${escapeHtml(fromName)}</b>`, amount: formatEuro(s.amount), to: `<b>${escapeHtml(toName)}</b>` })}</div>
          <button type="button" class="undo-btn" onclick="undoTricountSettlement('${s.id}')">${escapeHtml(t('tricount.undo'))}</button>
        </div>
      `;
  }).join('');
}

function renderTricountMyBalance(){
  const box = document.getElementById('tricount-my-balance');
  if(!box) return;
  const balances = tricountBalances();
  const n = balances[currentUserId] || 0;
  const cls = n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : 'zero';
  const sign = n > 0.005 ? '+' : n < -0.005 ? '−' : '';
  const hint = n > 0.005 ? t('tricount.theyOweYou') : n < -0.005 ? t('tricount.youOwe') : t('tricount.upToDate');
  box.innerHTML = `
      <div class="label">${escapeHtml(t('tricount.myBalance'))}</div>
      <div class="amt ${cls}">${sign}${formatEuro(Math.abs(n))}</div>
      <div class="hint">${escapeHtml(hint)}</div>
    `;
}

function renderTricountBalances(){
  const box = document.getElementById('tricount-balance-grid');
  if(!box) return;
  const balances = tricountBalances();
  box.innerHTML = tricountRosterPlayers().map(p => {
    const n = balances[p.id] || 0;
    const cls = n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : 'zero';
    const hint = n > 0.005 ? t('tricount.balanceOwed') : n < -0.005 ? t('tricount.balanceOwes') : t('tricount.balanceEven');
    return `
        <div class="tricount-balance-card">
          <b>${escapeHtml(displayName(p))}</b>
          <span class="amt ${cls}">${formatEuro(Math.abs(n))}</span>
          <span class="hint">${escapeHtml(hint)}</span>
        </div>
      `;
  }).join('');
}

// Cabecera de fecha para agrupar el listado de gastos, tipo "23 de agosto de 2026"
function tricountDateHeading(iso){
  if(!iso) return t('tricount.noDate');
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${withDePrefix(monthFullLabel(m - 1))} de ${y}`;
}

function renderTricountSummary(){
  const mineEl = document.getElementById('tricount-summary-mine');
  const totalEl = document.getElementById('tricount-summary-total');
  if(!mineEl || !totalEl) return;
  const mine = tricountExpenses.filter(e => e.paidBy === currentUserId).reduce((sum, e) => sum + e.amount, 0);
  const total = tricountExpenses.reduce((sum, e) => sum + e.amount, 0);
  mineEl.textContent = formatEuro(mine);
  totalEl.textContent = formatEuro(total);
}

function renderTricountExpenses(){
  const box = document.getElementById('tricount-expense-list');
  if(!box) return;
  if(tricountExpenses.length === 0){
    box.innerHTML = `<div class="att-roster-empty">${escapeHtml(t('tricount.expensesEmpty'))}</div>`;
    return;
  }
  // Del más reciente al más antiguo, agrupados por fecha
  const sorted = tricountExpenses.slice().sort((a, b) => (b.iso || '').localeCompare(a.iso || ''));
  let lastIso = null;
  box.innerHTML = sorted.map(exp => {
    const payer = rosterById[exp.paidBy];
    let heading = '';
    if(exp.iso !== lastIso){
      heading = `<div class="tricount-date-heading">${escapeHtml(tricountDateHeading(exp.iso))}</div>`;
      lastIso = exp.iso;
    }
    const peopleWord = exp.participants.length === 1 ? t('tricount.person') : t('tricount.people');
    return `
        ${heading}
        <div class="tricount-expense-item">
          <div class="info">
            <b>${escapeHtml(exp.label)}</b>
            <span>${escapeHtml(t('tricount.paidBy', { name: payer ? displayName(payer) : '—', count: exp.participants.length, peopleWord }))}</span>
          </div>
          <div class="right">
            <span class="amt">${formatEuro(exp.amount)}</span>
            ${exp.createdBy && exp.createdBy === currentAuthUserId ? `
            <button type="button" class="tricount-expense-del" onclick="openEditTricountModal('${exp.id}')" data-i18n-attr="aria-label:tricount.edit,title:tricount.edit" aria-label="Editar" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>` : ''}
            <button type="button" class="tricount-expense-del" onclick="deleteTricountExpense('${exp.id}')" data-i18n-attr="aria-label:tricount.delete,title:tricount.delete" aria-label="Eliminar" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </div>
        </div>
      `;
  }).join('');
}

function setTricountTab(tab){
  document.querySelectorAll('.tricount-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tricountTab === tab));
  document.getElementById('tricount-panel-gastos').classList.toggle('active', tab === 'gastos');
  document.getElementById('tricount-panel-saldos').classList.toggle('active', tab === 'saldos');
}

function toggleTricountSettlementPanel(){
  const panel = document.getElementById('tricount-settlement-collapse');
  const btn = document.getElementById('tricount-settlement-toggle');
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'block' : 'none';
  btn.classList.toggle('open', opening);
  btn.querySelector('span').textContent = opening ? 'Ocultar reembolsos sugeridos' : 'Ver reembolsos sugeridos';
}

function renderTricount(){
  renderTricountMyBalance();
  renderTricountBalances();
  renderTricountSettlement();
  renderTricountSummary();
  renderTricountExpenses();
  renderTricountSettledList();
  renderInicioTricountBanner();
}

// Tarjeta de "Tricount" en Inicio: mismo componente visual (.tt-personal) que Multas
// y Tercer tiempo. Se llama desde renderTricount(), así que se mantiene al día cada
// vez que se carga o cambia algún gasto/liquidación (incluido en directo, vía la
// suscripción realtime de Tricount).
function renderInicioTricountBanner(){
  const box = document.getElementById('inicio-tricount-banner');
  if(!box) return;

  const balances = tricountBalances();
  const n = balances[currentUserId] || 0;
  const cls = n > 0.005 ? 'tricount-pos' : n < -0.005 ? 'tricount-neg' : 'tricount-zero';
  const msg = n > 0.005
    ? t('tricount.owed', {amount: formatEuro(n)})
    : n < -0.005
      ? t('tricount.owe', {amount: formatEuro(Math.abs(n))})
      : t('tricount.even');

  box.innerHTML = `
      <div class="tt-personal ${cls} tt-personal-stacked">
        <div class="icon emoji">🧾</div>
        <div class="txt">
          <b>${escapeHtml(t('tricount.title'))}</b>
          <span>${escapeHtml(msg)}</span>
        </div>
        <div class="tt-personal-actions">
          <button class="tt-swap-btn" onclick="event.stopPropagation(); setSection('tricount')">${escapeHtml(t('tricount.cta'))}</button>
        </div>
      </div>
    `;
}

function renderTricountParticipantsList(){
  const box = document.getElementById('tricount-participants-list');
  if(!box) return;
  box.innerHTML = tricountRosterPlayers().map(p => `
      <label class="tricount-participant-row">
        <input type="checkbox" ${tricountModalParticipants.has(p.id) ? 'checked' : ''} onchange="toggleTricountParticipant('${p.id}')">
        ${escapeHtml(displayName(p))}
      </label>
    `).join('');
}
function toggleTricountParticipant(id){
  if(tricountModalParticipants.has(id)) tricountModalParticipants.delete(id);
  else tricountModalParticipants.add(id);
}

// Pone el modal en modo "nuevo gasto": pagado por una misma por defecto y nadie
// marcado todavía en "entre quién se reparte" (se elige a mano cada vez).
function openAddTricountModal(){
  editingTricountExpenseId = null;
  document.getElementById('tricount-modal-title').textContent = t('tricount.newExpense');
  document.getElementById('tricount-modal-save-btn').textContent = t('tricount.saveExpense');
  document.getElementById('tricount-desc').value = '';
  document.getElementById('tricount-amount').value = '';
  document.getElementById('tricount-date').value = todayLocalIso();
  const paidBySelect = document.getElementById('tricount-paidby');
  paidBySelect.innerHTML = tricountRosterPlayers().map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
  paidBySelect.value = currentUserId;
  tricountModalParticipants = new Set();
  renderTricountParticipantsList();
  document.getElementById('add-tricount-modal').classList.add('active');
}
// Igual que abrir el modal para un gasto nuevo, pero precargando lo que ya tenía el
// gasto. Solo quien lo creó puede llegar aquí (ver el botón de editar en la lista).
function openEditTricountModal(id){
  const exp = tricountExpenses.find(e => e.id === id);
  if(!exp) return;
  if(!exp.createdBy || exp.createdBy !== currentAuthUserId){
    alert('Solo quien creó el gasto puede editarlo.');
    return;
  }
  editingTricountExpenseId = id;
  document.getElementById('tricount-modal-title').textContent = t('tricount.editExpense');
  document.getElementById('tricount-modal-save-btn').textContent = t('tricount.saveChanges');
  document.getElementById('tricount-desc').value = exp.label;
  document.getElementById('tricount-amount').value = exp.amount;
  document.getElementById('tricount-date').value = exp.iso;
  const paidBySelect = document.getElementById('tricount-paidby');
  paidBySelect.innerHTML = tricountRosterPlayers().map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
  paidBySelect.value = exp.paidBy;
  tricountModalParticipants = new Set(exp.participants);
  renderTricountParticipantsList();
  document.getElementById('add-tricount-modal').classList.add('active');
}
function closeAddTricountModal(){
  document.getElementById('add-tricount-modal').classList.remove('active');
  editingTricountExpenseId = null;
}
async function saveTricountExpense(){
  const label = document.getElementById('tricount-desc').value.trim();
  const amount = parseFloat(document.getElementById('tricount-amount').value);
  const iso = document.getElementById('tricount-date').value;
  const paidBy = document.getElementById('tricount-paidby').value;
  const participants = Array.from(tricountModalParticipants);

  if(!label || !amount || amount <= 0){
    alert('Ponle un concepto y un importe válido al gasto.');
    return;
  }
  if(!paidBy){
    alert('Indica quién ha pagado el gasto.');
    return;
  }
  if(participants.length === 0){
    alert('Elige entre quién se reparte el gasto.');
    return;
  }

  if(editingTricountExpenseId){
    const { data, error } = await supabaseClient
      .from(TRICOUNT_EXPENSES_TABLE)
      .update({
        label, amount, iso,
        paid_by: toRemotePlayerId(paidBy),
        participants: participants.map(toRemotePlayerId)
      })
      .eq('id', editingTricountExpenseId)
      .select()
      .single();
    if(error){
      console.error('No se pudo actualizar el gasto', error);
      alert('No se ha podido guardar el cambio. Inténtalo de nuevo.');
      return;
    }
    const updated = tricountExpenseRowToEntry(data);
    tricountExpenses = tricountExpenses.map(e => e.id === updated.id ? updated : e);
  } else {
    const { data, error } = await supabaseClient
      .from(TRICOUNT_EXPENSES_TABLE)
      .insert({
        label, amount, iso,
        paid_by: toRemotePlayerId(paidBy),
        participants: participants.map(toRemotePlayerId),
        created_by: currentAuthUserId
      })
      .select()
      .single();
    if(error){
      console.error('No se pudo guardar el gasto', error);
      alert('No se ha podido guardar el gasto. Inténtalo de nuevo.');
      return;
    }
    tricountExpenses.push(tricountExpenseRowToEntry(data));
  }

  closeAddTricountModal();
  renderTricount();
}
async function deleteTricountExpense(id){
  tricountExpenses = tricountExpenses.filter(e => e.id !== id);
  renderTricount();
  const { error } = await supabaseClient.from(TRICOUNT_EXPENSES_TABLE).delete().eq('id', id);
  if(error) console.error('No se pudo eliminar el gasto', error);
}
