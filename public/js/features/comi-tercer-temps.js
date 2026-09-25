// ---- Comi Tercer Temps: pestañas Lista / Saldo ----
function setComiTercerTab(tab){
  document.querySelectorAll('.comi-tercer-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.comiTercerTab === tab);
  });
  document.getElementById('comi-tercer-panel-lista').classList.toggle('active', tab === 'lista');
  document.getElementById('comi-tercer-panel-saldo').classList.toggle('active', tab === 'saldo');
}

// ---- Comi Tercer Temps: lista de la compra (checklist compartida del equipo) ----
// Se guarda en Supabase (tabla "tercer_shopping_items"); arranca vacía hasta que
// loadTercerShoppingItems() traiga lo que haya guardado.
let tercerShoppingItems = [];
const TERCER_SHOPPING_TABLE = 'tercer_shopping_items';

function renderTercerShoppingList(){
  const box = document.getElementById('tercer-shopping-list');
  if(!box) return;
  const canManage = canManageTercerTemps();
  if(tercerShoppingItems.length === 0){
    box.innerHTML = `<div class="shopping-empty">La lista está vacía.${canManage ? ' Añade lo que haga falta comprar 👆' : ''}</div>`;
    return;
  }
  box.innerHTML = tercerShoppingItems.map(item => `
      <label class="shopping-item ${item.checked ? 'checked' : ''}">
        <input type="checkbox" ${item.checked ? 'checked' : ''} ${canManage ? `onchange="toggleTercerShoppingItem('${item.id}')"` : 'disabled'}>
        <span class="shopping-item-label">${escapeHtml(item.label)}</span>
        ${canManage ? `
        <button type="button" class="shopping-item-del" onclick="event.preventDefault(); deleteTercerShoppingItem('${item.id}')" aria-label="Eliminar" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>` : ''}
      </label>
    `).join('');
}
async function loadTercerShoppingItems(){
  const { data, error } = await supabaseClient
    .from(TERCER_SHOPPING_TABLE)
    .select('*')
    .order('created_at', { ascending:true });
  if(error){ console.error('No se ha podido cargar la lista de la compra', error); return; }
  tercerShoppingItems = (data || []).map(r => ({ id:r.id, label:r.label, checked:r.checked }));
  renderTercerShoppingList();
}
async function addTercerShoppingItem(){
  if(!canManageTercerTemps()) return;
  const input = document.getElementById('tercer-shopping-input');
  const label = input.value.trim();
  if(!label) return;
  input.value = '';
  const { data, error } = await supabaseClient.from(TERCER_SHOPPING_TABLE).insert({ label, checked:false }).select().single();
  if(error){ console.error('No se pudo añadir el artículo', error); return; }
  tercerShoppingItems.push({ id:data.id, label:data.label, checked:data.checked });
  renderTercerShoppingList();
}
async function toggleTercerShoppingItem(id){
  if(!canManageTercerTemps()) return;
  const item = tercerShoppingItems.find(i => i.id === id);
  if(!item) return;
  item.checked = !item.checked;
  renderTercerShoppingList();
  const { error } = await supabaseClient.from(TERCER_SHOPPING_TABLE).update({ checked:item.checked }).eq('id', id);
  if(error) console.error('No se pudo actualizar el artículo', error);
}
async function deleteTercerShoppingItem(id){
  if(!canManageTercerTemps()) return;
  tercerShoppingItems = tercerShoppingItems.filter(i => i.id !== id);
  renderTercerShoppingList();
  const { error } = await supabaseClient.from(TERCER_SHOPPING_TABLE).delete().eq('id', id);
  if(error) console.error('No se pudo eliminar el artículo', error);
}

// ---- Comi Tercer Temps: exactamente el mismo patrón que Comi Tesoreria ----
// Cada movimiento: fecha (iso), concepto, tipo ('ingreso'|'gasto') e importe (siempre positivo).
// Se guarda en Supabase (tabla "tercer_treasury_entries"); arranca vacío hasta que
// loadTercerTreasuryEntries() traiga lo que haya guardado.
let tercerTreasuryEntries = [];
let tercerTreasuryEditMode = false;

function renderTercerTreasury(){
  const balance = tercerTreasuryEntries.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
  const balanceEl = document.getElementById('tercer-treasury-balance');
  balanceEl.textContent = (balance < 0 ? '-' : '') + formatEuro(Math.abs(balance));
  balanceEl.classList.toggle('neg', balance < 0);

  // Cabecera: sólo hay columna de acciones (papelera) cuando está activo el modo edición
  document.getElementById('tercer-treasury-table-head').innerHTML = `
      <tr>
        <th class="col-date">Fecha</th><th class="col-concept">Concepto</th><th class="col-type">Tipo</th><th class="col-amount" style="text-align:right;">Importe</th>
        ${tercerTreasuryEditMode ? '<th class="col-actions"></th>' : ''}
      </tr>
    `;

  const body = document.getElementById('tercer-treasury-table-body');
  if(!tercerTreasuryEntries.length){
    const colspan = tercerTreasuryEditMode ? 5 : 4;
    body.innerHTML = `<tr><td colspan="${colspan}" class="treasury-table-empty">Todavía no hay movimientos registrados.</td></tr>`;
    return;
  }

  const sorted = [...tercerTreasuryEntries].sort((a, b) => b.iso.localeCompare(a.iso));

  if(!tercerTreasuryEditMode){
    body.innerHTML = sorted.map(e => {
      const [y, m, d] = e.iso.split('-');
      return `
          <tr>
            <td class="col-date">${d}/${m}/${y.slice(2)}</td>
            <td class="col-concept" title="${escapeHtml(e.concept)}">
              ${escapeHtml(e.concept)}
              ${e.responsibleId && rosterById[e.responsibleId] ? `<span class="tv-responsible">${escapeHtml(displayName(rosterById[e.responsibleId]))}</span>` : ''}
            </td>
            <td class="col-type"><span class="type-pill ${e.type}">${e.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
            <td class="col-amount amount-${e.type}" style="text-align:right;">${e.type === 'ingreso' ? '+' : '−'}${formatEuro(e.amount)}</td>
          </tr>
        `;
    }).join('');
    return;
  }

  // Modo edición: fecha/concepto/importe editables, tipo con un toque y papelera para borrar
  body.innerHTML = sorted.map(e => `
      <tr>
        <td class="col-date"><input type="date" class="tv-input" value="${e.iso}" onchange="updateTercerTreasuryField('${e.id}','iso',this.value)"></td>
        <td class="col-concept"><input type="text" class="tv-input" value="${escapeHtml(e.concept)}" oninput="updateTercerTreasuryField('${e.id}','concept',this.value)"></td>
        <td class="col-type">
          <button type="button" class="type-pill clickable ${e.type}" onclick="toggleTercerTreasuryEntryType('${e.id}')">${e.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</button>
        </td>
        <td class="col-amount">
          <input type="number" class="tv-input tv-amount" value="${e.amount}" min="0" step="0.01" oninput="updateTercerTreasuryField('${e.id}','amount',this.value)">
        </td>
        <td class="col-actions">
          <button type="button" class="tv-del-btn" onclick="openDeleteTercerTreasuryConfirm('${e.id}')" aria-label="Eliminar movimiento" title="Eliminar movimiento">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
}

function toggleTercerTreasuryEditMode(){
  if(!canManageTercerTemps()) return;
  tercerTreasuryEditMode = !tercerTreasuryEditMode;
  document.getElementById('tercer-treasury-edit-btn').classList.toggle('active', tercerTreasuryEditMode);
  document.getElementById('tercer-treasury-edit-btn-label').textContent = tercerTreasuryEditMode ? 'Hecho' : 'Editar';
  renderTercerTreasury();

  // Al pulsar "Hecho" (salir del modo edición) se guardan los cambios para todo el equipo
  if(!tercerTreasuryEditMode){
    persistTercerTreasuryEntries();
  }
}

const TERCER_TREASURY_TABLE = 'tercer_treasury_entries';

function tercerTreasuryRowToEntry(row){
  return { id:row.id, iso:row.iso, concept:row.concept, type:row.type, amount:Number(row.amount), responsibleId:row.responsible_id };
}

async function loadTercerTreasuryEntries(){
  const { data, error } = await supabaseClient
    .from(TERCER_TREASURY_TABLE)
    .select('*')
    .order('iso', { ascending:false });
  if(error){ console.error('No se ha podido cargar la tesorería de Comi Tercer Temps', error); return; }
  tercerTreasuryEntries = (data || []).map(tercerTreasuryRowToEntry);
  renderTercerTreasury();
}

async function addTercerTreasuryEntry({ iso, concept, type, amount, responsibleId }){
  const { data, error } = await supabaseClient
    .from(TERCER_TREASURY_TABLE)
    .insert({ iso, concept, type, amount, responsible_id: responsibleId || null })
    .select()
    .single();
  if(error){ console.error('No se pudo guardar el movimiento de Comi Tercer Temps', error); return null; }
  const entry = tercerTreasuryRowToEntry(data);
  tercerTreasuryEntries.push(entry);
  renderTercerTreasury();
  return entry;
}

async function persistTercerTreasuryEntries(){
  if(!tercerTreasuryEntries.length) return;
  const rows = tercerTreasuryEntries.map(e => ({
    id:e.id, iso:e.iso, concept:e.concept, type:e.type, amount:e.amount, responsible_id:e.responsibleId || null
  }));
  const { error } = await supabaseClient.from(TERCER_TREASURY_TABLE).upsert(rows);
  if(error) console.error('No se pudo guardar la tesorería de Comi Tercer Temps', error);
}

function updateTercerTreasuryField(id, field, rawValue){
  if(!canManageTercerTemps()) return;
  const entry = tercerTreasuryEntries.find(e => e.id === id);
  if(!entry) return;
  if(field === 'amount'){
    const n = parseFloat(rawValue);
    entry.amount = isNaN(n) ? 0 : n;
    const balance = tercerTreasuryEntries.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    const balanceEl = document.getElementById('tercer-treasury-balance');
    balanceEl.textContent = (balance < 0 ? '-' : '') + formatEuro(Math.abs(balance));
    balanceEl.classList.toggle('neg', balance < 0);
  } else {
    entry[field] = rawValue;
  }
}

function toggleTercerTreasuryEntryType(id){
  if(!canManageTercerTemps()) return;
  const entry = tercerTreasuryEntries.find(e => e.id === id);
  if(!entry) return;
  entry.type = entry.type === 'ingreso' ? 'gasto' : 'ingreso';
  renderTercerTreasury();
}

let tercerTreasuryDeleteTargetId = null;
function openDeleteTercerTreasuryConfirm(id){
  if(!canManageTercerTemps()) return;
  tercerTreasuryDeleteTargetId = id;
  document.getElementById('delete-tercer-treasury-confirm-modal').classList.add('active');
}
function closeDeleteTercerTreasuryConfirm(){
  document.getElementById('delete-tercer-treasury-confirm-modal').classList.remove('active');
  tercerTreasuryDeleteTargetId = null;
}
async function confirmDeleteTercerTreasuryEntry(){
  if(!tercerTreasuryDeleteTargetId || !canManageTercerTemps()) return;
  const id = tercerTreasuryDeleteTargetId;
  tercerTreasuryEntries = tercerTreasuryEntries.filter(e => e.id !== id);
  closeDeleteTercerTreasuryConfirm();
  renderTercerTreasury();
  const { error } = await supabaseClient.from(TERCER_TREASURY_TABLE).delete().eq('id', id);
  if(error) console.error('No se pudo eliminar el movimiento', error);
}

function setTercerTreasuryType(type){
  document.getElementById('tercer-treasury-type-input').value = type;
  document.getElementById('tx-tercer-type-gasto').classList.toggle('active', type === 'gasto');
  document.getElementById('tx-tercer-type-ingreso').classList.toggle('active', type === 'ingreso');
}
// Personas de la plantilla que tienen marcado "Comi Tercer Temps" en su perfil
function tercerTreasuryCommissionMembers(){
  return roster.filter(p => p.comision === 'Comi Tercer Temps');
}

function openTercerTreasuryBreakdownModal(){
  const members = tercerTreasuryCommissionMembers();
  const list = document.getElementById('tercer-treasury-breakdown-list');

  // Cuánto ha movido cada persona: suma de ingresos menos gastos de los movimientos
  // que ella registró, más un recuento de cuántos movimientos son suyos.
  const rows = members.map(p => {
    const own = tercerTreasuryEntries.filter(e => e.responsibleId === p.id);
    const net = own.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    return { id:p.id, name:p.name, mote:p.mote, net, count:own.length, injured:p.injured, injuryIcon:p.injuryIcon, avatarUrl:p.avatarUrl };
  });

  // Movimientos sin responsable asignado (por ejemplo, los que ya había antes de
  // añadir este campo), para que el desglose siga cuadrando con el saldo total.
  const unassigned = tercerTreasuryEntries.filter(e => !e.responsibleId || !rosterById[e.responsibleId]);
  if(unassigned.length){
    const net = unassigned.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    rows.push({ name:'Sin responsable asignado', net, count:unassigned.length, unassigned:true });
  }

  if(!rows.length){
    list.innerHTML = `<div class="treasury-table-empty">Todavía no hay nadie en Comi Tercer Temps ni movimientos registrados.</div>`;
  } else {
    const rowsDisplayNames = computeDisplayNames(rows.filter(r => !r.unassigned));
    list.innerHTML = rows.map(r => {
      const shownName = r.unassigned ? r.name : (rowsDisplayNames.get(r.id) || r.name);
      const netClass = r.net > 0 ? 'pos' : (r.net < 0 ? 'neg' : 'zero');
      const sign = r.net > 0 ? '+' : (r.net < 0 ? '−' : '');
      return `
          <div class="tv-breakdown-row ${r.unassigned ? 'unassigned' : ''}">
            <div class="avatar">${r.unassigned ? '—' : avatarHtml(r.avatarUrl, initials(shownName), r.injured, r.injuryIcon)}</div>
            <div class="meta">
              <b>${escapeHtml(shownName)}</b>
              <span>${r.count} movimiento${r.count === 1 ? '' : 's'}</span>
            </div>
            <div class="net ${netClass}">${sign}${formatEuro(Math.abs(r.net))}</div>
          </div>
        `;
    }).join('');
  }

  document.getElementById('tercer-treasury-breakdown-modal').classList.add('active');
}
function closeTercerTreasuryBreakdownModal(){
  document.getElementById('tercer-treasury-breakdown-modal').classList.remove('active');
}

function openAddTercerTreasuryModal(){
  if(!canManageTercerTemps()) return;
  document.getElementById('tercer-treasury-date-input').value = todayLocalIso();
  document.getElementById('tercer-treasury-concept-input').value = '';
  document.getElementById('tercer-treasury-amount-input').value = '';
  setTercerTreasuryType('ingreso');

  const members = tercerTreasuryCommissionMembers();
  const select = document.getElementById('tercer-treasury-responsible-input');
  const empty = document.getElementById('tercer-treasury-responsible-empty');
  if(members.length){
    select.innerHTML = members.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
    select.style.display = '';
    empty.style.display = 'none';
  } else {
    select.innerHTML = '';
    select.style.display = 'none';
    empty.style.display = 'block';
  }

  document.getElementById('add-tercer-treasury-modal').classList.add('active');
}
function closeAddTercerTreasuryModal(){
  document.getElementById('add-tercer-treasury-modal').classList.remove('active');
}
async function saveTercerTreasuryEntry(){
  if(!canManageTercerTemps()) return;
  const iso = document.getElementById('tercer-treasury-date-input').value;
  const concept = document.getElementById('tercer-treasury-concept-input').value.trim();
  const type = document.getElementById('tercer-treasury-type-input').value;
  const amount = parseFloat(document.getElementById('tercer-treasury-amount-input').value);
  const members = tercerTreasuryCommissionMembers();
  const responsibleId = members.length ? document.getElementById('tercer-treasury-responsible-input').value : null;

  if(!iso || !concept || !amount || amount <= 0){
    alert('Rellena la fecha, el concepto y un importe válido.');
    return;
  }

  const entry = await addTercerTreasuryEntry({ iso, concept, type, amount, responsibleId });
  if(!entry){
    alert('No se ha podido guardar el movimiento. Inténtalo de nuevo.');
    return;
  }
  closeAddTercerTreasuryModal();
}
