// ---- Comi Tesoreria ----
// Cada movimiento: fecha (iso), concepto, tipo ('ingreso'|'gasto') e importe (siempre positivo).
// Movimientos de tesorería del club ("Comi Tesorería"). Se guardan en Supabase
// (tabla "treasury_entries") para que estén sincronizados entre todo el mundo;
// arranca vacío hasta que loadTreasuryEntries() traiga lo que haya guardado.
let treasuryEntries = [];
let treasuryEditMode = false;

function formatEuro(n){
  return n.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' €';
}

function renderTreasury(){
  const balance = treasuryEntries.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
  const balanceEl = document.getElementById('treasury-balance');
  balanceEl.textContent = (balance < 0 ? '-' : '') + formatEuro(Math.abs(balance));
  balanceEl.classList.toggle('neg', balance < 0);

  // Cabecera: sólo hay columna de acciones (papelera) cuando está activo el modo edición
  document.getElementById('treasury-table-head').innerHTML = `
      <tr>
        <th class="col-date">Fecha</th><th class="col-concept">Concepto</th><th class="col-type">Tipo</th><th class="col-amount" style="text-align:right;">Importe</th>
        ${treasuryEditMode ? '<th class="col-actions"></th>' : ''}
      </tr>
    `;

  const body = document.getElementById('treasury-table-body');
  if(!treasuryEntries.length){
    const colspan = treasuryEditMode ? 5 : 4;
    body.innerHTML = `<tr><td colspan="${colspan}" class="treasury-table-empty">Todavía no hay movimientos registrados.</td></tr>`;
    return;
  }

  const sorted = [...treasuryEntries].sort((a, b) => b.iso.localeCompare(a.iso));

  if(!treasuryEditMode){
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
        <td class="col-date"><input type="date" class="tv-input" value="${e.iso}" onchange="updateTreasuryField('${e.id}','iso',this.value)"></td>
        <td class="col-concept"><input type="text" class="tv-input" value="${escapeHtml(e.concept)}" oninput="updateTreasuryField('${e.id}','concept',this.value)"></td>
        <td class="col-type">
          <button type="button" class="type-pill clickable ${e.type}" onclick="toggleTreasuryEntryType('${e.id}')">${e.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</button>
        </td>
        <td class="col-amount">
          <input type="number" class="tv-input tv-amount" value="${e.amount}" min="0" step="0.01" oninput="updateTreasuryField('${e.id}','amount',this.value)">
        </td>
        <td class="col-actions">
          <button type="button" class="tv-del-btn" onclick="openDeleteTreasuryConfirm('${e.id}')" aria-label="Eliminar movimiento" title="Eliminar movimiento">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
}

function toggleTreasuryEditMode(){
  if(!canManageClubTreasury()) return;
  treasuryEditMode = !treasuryEditMode;
  document.getElementById('treasury-edit-btn').classList.toggle('active', treasuryEditMode);
  document.getElementById('treasury-edit-btn-label').textContent = treasuryEditMode ? 'Hecho' : 'Editar';
  renderTreasury();

  // Al pulsar "Hecho" (salir del modo edición) se guardan los cambios para todo el equipo
  if(!treasuryEditMode){
    persistTreasuryEntries();
  }
}

const TREASURY_TABLE = 'treasury_entries';

function treasuryRowToEntry(row){
  return { id:row.id, iso:row.iso, concept:row.concept, type:row.type, amount:Number(row.amount), responsibleId:row.responsible_id };
}

// Trae los movimientos guardados en Supabase (todo el mundo ve los mismos).
async function loadTreasuryEntries(){
  const { data, error } = await supabaseClient
    .from(TREASURY_TABLE)
    .select('*')
    .order('iso', { ascending:false });
  if(error){ console.error('No se ha podido cargar la tesorería', error); return; }
  treasuryEntries = (data || []).map(treasuryRowToEntry);
  renderTreasury();
}

// Añade un movimiento nuevo directamente en Supabase (usado tanto desde el modal
// "Añadir movimiento" como cuando se genera solo, p.ej. al pagar una multa).
async function addTreasuryEntry({ iso, concept, type, amount, responsibleId }){
  const { data, error } = await supabaseClient
    .from(TREASURY_TABLE)
    .insert({ iso, concept, type, amount, responsible_id: responsibleId || null })
    .select()
    .single();
  if(error){ console.error('No se pudo guardar el movimiento de tesorería', error); return null; }
  const entry = treasuryRowToEntry(data);
  treasuryEntries.push(entry);
  renderTreasury();
  return entry;
}

// Guarda de golpe todos los cambios hechos en modo edición (fechas, conceptos,
// importes o tipo tocados directamente en la tabla).
async function persistTreasuryEntries(){
  if(!treasuryEntries.length) return;
  const rows = treasuryEntries.map(e => ({
    id:e.id, iso:e.iso, concept:e.concept, type:e.type, amount:e.amount, responsible_id:e.responsibleId || null
  }));
  const { error } = await supabaseClient.from(TREASURY_TABLE).upsert(rows);
  if(error) console.error('No se pudo guardar la tesorería', error);
}

function updateTreasuryField(id, field, rawValue){
  if(!canManageClubTreasury()) return;
  const entry = treasuryEntries.find(e => e.id === id);
  if(!entry) return;
  if(field === 'amount'){
    const n = parseFloat(rawValue);
    entry.amount = isNaN(n) ? 0 : n;
    const balance = treasuryEntries.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    const balanceEl = document.getElementById('treasury-balance');
    balanceEl.textContent = (balance < 0 ? '-' : '') + formatEuro(Math.abs(balance));
    balanceEl.classList.toggle('neg', balance < 0);
  } else {
    entry[field] = rawValue;
  }
}

function toggleTreasuryEntryType(id){
  if(!canManageClubTreasury()) return;
  const entry = treasuryEntries.find(e => e.id === id);
  if(!entry) return;
  entry.type = entry.type === 'ingreso' ? 'gasto' : 'ingreso';
  renderTreasury();
}

let treasuryDeleteTargetId = null;
function openDeleteTreasuryConfirm(id){
  if(!canManageClubTreasury()) return;
  treasuryDeleteTargetId = id;
  document.getElementById('delete-treasury-confirm-modal').classList.add('active');
}
function closeDeleteTreasuryConfirm(){
  document.getElementById('delete-treasury-confirm-modal').classList.remove('active');
  treasuryDeleteTargetId = null;
}
async function confirmDeleteTreasuryEntry(){
  if(!treasuryDeleteTargetId || !canManageClubTreasury()) return;
  const id = treasuryDeleteTargetId;
  treasuryEntries = treasuryEntries.filter(e => e.id !== id);
  closeDeleteTreasuryConfirm();
  renderTreasury();
  const { error } = await supabaseClient.from(TREASURY_TABLE).delete().eq('id', id);
  if(error) console.error('No se pudo eliminar el movimiento', error);
}

function setTreasuryType(type){
  document.getElementById('treasury-type-input').value = type;
  document.getElementById('tx-type-gasto').classList.toggle('active', type === 'gasto');
  document.getElementById('tx-type-ingreso').classList.toggle('active', type === 'ingreso');
}
// Personas de la plantilla que tienen marcado "Comi Tesoreria" en su perfil
function treasuryCommissionMembers(){
  return Object.values(rosterById).filter(p => p.comision === 'Comi Tesoreria');
}

function openTreasuryBreakdownModal(){
  const members = treasuryCommissionMembers();
  const list = document.getElementById('treasury-breakdown-list');

  // Cuánto ha movido cada persona: suma de ingresos menos gastos de los movimientos
  // que ella registró, más un recuento de cuántos movimientos son suyos.
  const rows = members.map(p => {
    const own = treasuryEntries.filter(e => e.responsibleId === p.id);
    const net = own.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    return { id:p.id, name:p.name, mote:p.mote, net, count:own.length, injured:p.injured, injuryIcon:p.injuryIcon, avatarUrl:p.avatarUrl };
  });

  // Movimientos sin responsable asignado (por ejemplo, los que ya había antes de
  // añadir este campo), para que el desglose siga cuadrando con el saldo total.
  const unassigned = treasuryEntries.filter(e => !e.responsibleId || !rosterById[e.responsibleId]);
  if(unassigned.length){
    const net = unassigned.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);
    rows.push({ name:'Sin responsable asignado', net, count:unassigned.length, unassigned:true });
  }

  if(!rows.length){
    list.innerHTML = `<div class="treasury-table-empty">Todavía no hay nadie en Comi Tesoreria ni movimientos registrados.</div>`;
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

  document.getElementById('treasury-breakdown-modal').classList.add('active');
}
function closeTreasuryBreakdownModal(){
  document.getElementById('treasury-breakdown-modal').classList.remove('active');
}

function openAddTreasuryModal(){
  if(!canManageClubTreasury()) return;
  document.getElementById('treasury-date-input').value = todayLocalIso();
  document.getElementById('treasury-concept-input').value = '';
  document.getElementById('treasury-amount-input').value = '';
  setTreasuryType('ingreso');

  const members = treasuryCommissionMembers();
  const select = document.getElementById('treasury-responsible-input');
  const empty = document.getElementById('treasury-responsible-empty');
  if(members.length){
    select.innerHTML = members.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
    select.style.display = '';
    empty.style.display = 'none';
  } else {
    select.innerHTML = '';
    select.style.display = 'none';
    empty.style.display = 'block';
  }

  document.getElementById('add-treasury-modal').classList.add('active');
}
function closeAddTreasuryModal(){
  document.getElementById('add-treasury-modal').classList.remove('active');
}
async function saveTreasuryEntry(){
  if(!canManageClubTreasury()) return;
  const iso = document.getElementById('treasury-date-input').value;
  const concept = document.getElementById('treasury-concept-input').value.trim();
  const type = document.getElementById('treasury-type-input').value;
  const amount = parseFloat(document.getElementById('treasury-amount-input').value);
  const members = treasuryCommissionMembers();
  const responsibleId = members.length ? document.getElementById('treasury-responsible-input').value : null;

  if(!iso || !concept || !amount || amount <= 0){
    alert('Rellena la fecha, el concepto y un importe válido.');
    return;
  }

  const entry = await addTreasuryEntry({ iso, concept, type, amount, responsibleId });
  if(!entry){
    alert('No se ha podido guardar el movimiento. Inténtalo de nuevo.');
    return;
  }
  closeAddTreasuryModal();
}
