/* ================= MULTAS ================= */

// Los 4 motivos fijos, cada uno con su importe
const fineReasons = [
  { id:'amarilla', label:'Tarjeta amarilla', short:'TA', amount:5 },
  { id:'roja',     label:'Tarjeta roja',     short:'TR', amount:10 },
  { id:'retraso',  label:'Retraso',          short:'R',  amount:2 },
  { id:'tercer',   label:'Tercer tiempo',    short:'3T', amount:7 }
];
const fineReasonById = Object.fromEntries(fineReasons.map(r => [r.id, r]));

// ---- Multas: leídas y guardadas en la tabla "fines" de Supabase, para que cualquier
// interacción (dar de alta, pagar, confirmar un pago, deshacer) se vea al momento desde
// cualquier dispositivo. Solo Comi Tesoreria puede dar de alta multas nuevas — eso se
// controla tanto aquí (ocultando el botón) como en Supabase con una política de RLS,
// que es la que de verdad impide el alta aunque alguien abra la consola del navegador.
function fineRowToLocal(row){
  // La fila de Supabase usa el id real de auth.users; localmente "yo" siempre se
  // identifica como 'me', igual que en el resto de la app (roster, avatares, etc.).
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return {
    id: row.id,
    playerId: toLocalId(row.player_id),
    reasonId: row.reason_id,
    status: row.status,
    paidToId: row.paid_to_id ? toLocalId(row.paid_to_id) : null,
    autoMatchIso: row.auto_match_iso || null,
    paidAt: row.paid_at || null
  };
}
function toRemotePlayerId(localId){
  // Para escribir en Supabase hace falta el id real de auth.users; 'me' se traduce
  // al id de quien ha iniciado sesión.
  return localId === 'me' ? currentAuthUserId : localId;
}

async function loadFines(){
  const { data, error } = await supabaseClient
    .from('fines')
    .select('id, player_id, reason_id, status, paid_to_id, auto_match_iso, paid_at, created_at')
    .order('created_at', { ascending:true });
  if(error){
    console.error('No se pudieron cargar las multas', error);
    return;
  }
  fines = (data || []).map(fineRowToLocal);
  renderMyFinesSummary();
  renderInicioFinesBanner();
  renderFinesTable();
  renderFinesHistory();
  renderFineConfirmRequests();
  updateFinesSummaries();
  loadPlantilla();
}

// Inserta una multa nueva en Supabase y, si sale bien, sustituye su id local (temporal)
// por el id real que ha generado la base de datos.
async function persistFineInsert(localId, fine){
  const { data, error } = await supabaseClient
    .from('fines')
    .insert({
      player_id: toRemotePlayerId(fine.playerId),
      reason_id: fine.reasonId,
      status: fine.status,
      paid_to_id: fine.paidToId ? toRemotePlayerId(fine.paidToId) : null,
      auto_match_iso: fine.autoMatchIso || null
    })
    .select()
    .single();

  if(error){
    alert('La multa se ha guardado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
    return;
  }
  const local = fines.find(f => f.id === localId);
  if(local) local.id = data.id;
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();
}

// Actualiza en Supabase una multa ya existente (pagar, confirmar, deshacer, o editar
// su jugadora/motivo).
async function persistFineUpdate(fineId, patch){
  const remotePatch = {};
  if('status' in patch) remotePatch.status = patch.status;
  if('paidToId' in patch) remotePatch.paid_to_id = patch.paidToId ? toRemotePlayerId(patch.paidToId) : null;
  if('playerId' in patch) remotePatch.player_id = toRemotePlayerId(patch.playerId);
  if('reasonId' in patch) remotePatch.reason_id = patch.reasonId;

  const { error } = await supabaseClient.from('fines').update(remotePatch).eq('id', fineId);
  if(error){
    alert('El cambio se ha aplicado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
  }
}

// Elimina una multa por completo (deshacer): solo Comi Tesoreria puede hacerlo. Se usa
// sobre todo para las multas de "Retraso" que se generan solas al guardar la Lista del
// día de partido, por si alguien se marcó mal con "✕" por error.
async function deleteFine(fineId){
  if(!canManageFines()){
    alert('Solo Comi Tesoreria puede deshacer una multa.');
    return;
  }
  if(!confirm('¿Deshacer esta multa? Se eliminará por completo.')) return;

  fines = fines.filter(f => f.id !== fineId);
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();

  const { data, error } = await supabaseClient.from('fines').delete().eq('id', fineId).select();
  if(error){
    alert('No se ha podido deshacer la multa en Supabase: ' + error.message);
    loadFines(); // por si acaso, recargamos el estado real desde el servidor
  }else if(!data || data.length === 0){
    // Supabase no da error si el borrado no afecta a ninguna fila (p.ej. si una
    // política de RLS lo bloquea): por eso se comprueba aquí explícitamente. Si pasa,
    // recargamos desde el servidor para que la multa "fantasma" vuelva a aparecer
    // ahora (y no como sorpresa en el próximo refresh) y avisamos del motivo real.
    alert('La multa no se ha podido eliminar en Supabase (probablemente por permisos). Revisa la política de borrado de la tabla "fines".');
    loadFines();
  }
}

// Cualquier cambio en la tabla "fines" (lo haga quien lo haga, desde cualquier
// dispositivo) se recarga aquí al momento, sin tener que refrescar la página.
function subscribeToFinesRealtime(){
  supabaseClient
    .channel('fines-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'fines' }, () => loadFines())
    .subscribe();
}

// Cada multa es una entrada individual: una jugadora + un motivo + un estado

function updateFinesSummaries(){
  const pending = fines.filter(f => f.status === 'pendiente');
  const total = pending.reduce((sum, f) => sum + fineReasonById[f.reasonId].amount, 0);

  const vestEl = document.getElementById('vest-multas-total');
  if(vestEl) vestEl.textContent = total + ' € pendientes';

  const inicioTotalEl = document.getElementById('inicio-multas-total');
  if(inicioTotalEl) inicioTotalEl.textContent = total + ' €';

  const inicioCountEl = document.getElementById('inicio-multas-count');
  if(inicioCountEl) inicioCountEl.textContent = pending.length + (pending.length === 1 ? ' multa sin cobrar' : ' multas sin cobrar');
}

function renderMyFinesSummary(){
  const box = document.getElementById('my-fines-card');
  // Independiente de la propia situación de multas: refresca los avisos de pago
  // pendientes de confirmar que le tocan a esta persona (si es de Comi Tesoreria).
  renderFineConfirmRequests();
  if(!box) return;

  const myPending = fines.filter(f => f.playerId === currentUserId && f.status === 'pendiente');
  const total = myPending.reduce((sum, f) => sum + fineReasonById[f.reasonId].amount, 0);

  if(myPending.length === 0){
    box.innerHTML = `
        <div class="my-fines-head clear">
          <div>
            <div class="label">${escapeHtml(t('fines.yourSituation'))}</div>
            <div class="amount">${escapeHtml(t('fines.upToDate'))}</div>
          </div>
        </div>
      `;
    return;
  }

  box.innerHTML = `
      <div class="my-fines-head owing">
        <div>
          <div class="label">${escapeHtml(t('fines.youOwe'))}</div>
          <div class="amount">${total} €</div>
        </div>
      </div>
      <div class="my-fines-list">
        ${myPending.map(f => {
          const r = fineReasonById[f.reasonId];
          const awaiting = !!f.paidToId;
          return `
            <div class="my-fine-row">
              <div>
                <div class="reason">${r.label}</div>
                <div class="amt">${r.amount} €</div>
              </div>
              ${awaiting
                ? `<span class="fine-awaiting-badge">${escapeHtml(t('fines.awaitingConfirmation'))}</span>`
                : `<button class="pay-fine-btn" onclick="payMyFine('${f.id}')">${escapeHtml(t('fines.payTitle'))}</button>`}
            </div>
          `;
        }).join('')}
      </div>
    `;
}

// Banner de "Multas pendientes" en Inicio: mismo tamaño que el de Tercer tiempo,
// cambia de color/mensaje según lo que debe el usuario que ha iniciado sesión.

function renderInicioFinesBanner(){
  const box = document.getElementById('inicio-fines-banner');
  if(!box) return;

  const myPending = fines.filter(f => f.playerId === currentUserId && f.status === 'pendiente');
  const total = myPending.reduce((sum, f) => sum + fineReasonById[f.reasonId].amount, 0);

  if(myPending.length === 0){
    box.innerHTML = `
        <div class="tt-personal fines-ok tt-personal-stacked">
          <div class="icon">${fineMoneyBagIconSvg()}</div>
          <div class="txt">
            <b>${escapeHtml(t('fines.title'))}</b>
            <span>${escapeHtml(t('fines.ok'))}</span>
          </div>
        </div>
      `;
    return;
  }

  const goToFinesBtn = `
      <div class="tt-personal-actions">
        <button class="tt-swap-btn" onclick="event.stopPropagation(); setSection('multas')">${escapeHtml(t('fines.cta'))}</button>
      </div>
    `;

  if(total < 5){
    box.innerHTML = `
        <div class="tt-personal fines-warn tt-personal-stacked">
          <div class="icon">${fineMoneyBagIconSvg()}</div>
          <div class="txt">
            <b>${escapeHtml(t('fines.title'))}</b>
            <span>${escapeHtml(t('fines.warn', {total}))}</span>
          </div>
          ${goToFinesBtn}
        </div>
      `;
  } else {
    box.innerHTML = `
        <div class="tt-personal fines-danger tt-personal-stacked">
          <div class="icon">${fineMoneyBagIconSvg()}</div>
          <div class="txt">
            <b>${escapeHtml(t('fines.title'))}</b>
            <span>${escapeHtml(t('fines.danger', {total}))}</span>
          </div>
          ${goToFinesBtn}
        </div>
      `;
  }
}

let fineToPayId = null;

function payMyFine(fineId){
  openPayFineModal(fineId);
}

function openPayFineModal(fineId){
  const f = fines.find(x => x.id === fineId);
  if(!f) return;
  fineToPayId = fineId;

  const members = treasuryCommissionMembers();
  const select = document.getElementById('pay-fine-responsible-input');
  const empty = document.getElementById('pay-fine-responsible-empty');
  if(members.length){
    select.innerHTML = members.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
    select.style.display = '';
    empty.style.display = 'none';
  } else {
    select.innerHTML = '';
    select.style.display = 'none';
    empty.style.display = 'block';
  }

  document.getElementById('pay-fine-modal').classList.add('active');
}
function closePayFineModal(){
  document.getElementById('pay-fine-modal').classList.remove('active');
  fineToPayId = null;
}
function confirmPayFine(){
  const f = fines.find(x => x.id === fineToPayId);
  if(!f) return;

  const members = treasuryCommissionMembers();
  const responsibleId = members.length ? document.getElementById('pay-fine-responsible-input').value : null;
  if(members.length && !responsibleId){
    alert('Elige a quién de Comi Tesoreria se le ha pagado.');
    return;
  }

  if(responsibleId){
    // No se da por pagada todavía: queda a la espera de que esa persona de Comi
    // Tesoreria confirme que de verdad ha recibido el pago (ver renderFineConfirmRequests).
    f.paidToId = responsibleId;
    persistFineUpdate(f.id, { paidToId:responsibleId });
    closePayFineModal();
    renderMyFinesSummary();
    renderInicioFinesBanner();
    renderFinesTable();
    updateFinesSummaries();
    return;
  }

  // No hay nadie en Comi Tesoreria a quien pedirle confirmación: se da el pago
  // por bueno directamente, como antes.
  f.status = 'pagada';
  f.paidAt = todayLocalIso();
  persistFineUpdate(f.id, { status:'pagada', paidToId:null, paid_at:f.paidAt });
  const player = rosterById[f.playerId];
  const reason = fineReasonById[f.reasonId];
  addTreasuryEntry({
    iso: todayLocalIso(),
    concept: `Multa (${reason.label})${player ? ' — ' + displayName(player) : ''}`,
    type:'ingreso',
    amount: reason.amount,
    responsibleId: null
  });

  closePayFineModal();
  renderMyFinesSummary();
    renderInicioFinesBanner();
  renderFinesTable();
  updateFinesSummaries();
}

// Responde a un aviso de "X te ha pagado su multa": si se confirma, la multa pasa
// a pagada de verdad y el ingreso se añade a Comi Tesoreria; si no, la multa vuelve
// a quedar pendiente de pago, sin nadie asignado.
function respondFineConfirmation(fineId, accepted){
  const f = fines.find(x => x.id === fineId);
  if(!f) return;

  if(accepted){
    f.status = 'pagada';
    f.paidAt = todayLocalIso();
    persistFineUpdate(f.id, { status:'pagada', paid_at:f.paidAt });
    const player = rosterById[f.playerId];
    const reason = fineReasonById[f.reasonId];
    addTreasuryEntry({
      iso: todayLocalIso(),
      concept: `Multa (${reason.label})${player ? ' — ' + displayName(player) : ''}`,
      type:'ingreso',
      amount: reason.amount,
      responsibleId: f.paidToId
    });
  } else {
    f.paidToId = null;
    persistFineUpdate(f.id, { paidToId:null });
  }

  renderMyFinesSummary();
    renderInicioFinesBanner();
  renderFinesTable();
  updateFinesSummaries();
}

// Avisos, en la sección de Multas, para la persona de Comi Tesoreria a la que se ha
// marcado como pagada una multa: debe confirmar antes de que se dé por buena.
function renderFineConfirmRequests(){
  const box = document.getElementById('fine-confirm-requests');
  if(!box) return;

  const requests = fines.filter(f => f.status === 'pendiente' && f.paidToId === currentUserId);

  if(!requests.length){
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }

  box.style.display = 'flex';
  box.innerHTML = requests.map(f => {
    const payer = rosterById[f.playerId];
    const reason = fineReasonById[f.reasonId];
    const payerName = payer ? displayName(payer) : t('sharedLineup.someone');
    return `
        <div class="fine-confirm-row">
          <span class="avatar">${payer ? avatarHtml(payer.avatarUrl, initials(payerName), payer.injured, payer.injuryIcon) : ''}</span>
          <div class="fine-confirm-msg">
            ${t('fines.paidYouMsg', { name: `<b>${escapeHtml(payerName)}</b>` })}
            <span class="fine-confirm-sub">${escapeHtml(reason.label)} · ${reason.amount} €</span>
          </div>
          <div class="fine-confirm-actions">
            <button type="button" class="v" onclick="respondFineConfirmation('${f.id}', true)" aria-label="${escapeHtml(t('fines.confirmPayment'))}" title="${escapeHtml(t('fines.confirmPayment'))}">✓</button>
            <button type="button" class="x" onclick="respondFineConfirmation('${f.id}', false)" aria-label="${escapeHtml(t('fines.notTrue'))}" title="${escapeHtml(t('fines.notTrue'))}">✕</button>
          </div>
        </div>
      `;
  }).join('');
}

function renderFinesTable(){
  const body = document.getElementById('fines-table-body');
  if(!body) return;

  // Se obtienen directamente de las multas ya guardadas (no del roster), para que
  // cualquier jugadora con una multa pendiente aparezca aquí, incluida una misma.
  const playerIdsWithFines = [...new Set(
    fines.filter(f => f.status === 'pendiente').map(f => f.playerId)
  )];

  if(playerIdsWithFines.length === 0){
    body.innerHTML = `<tr><td colspan="4" style="color:var(--text-muted); text-align:center; padding:24px;">${escapeHtml(t('fines.noneOwed'))}</td></tr>`;
    return;
  }

  body.innerHTML = playerIdsWithFines.map(playerId => {
    const player = rosterById[playerId];
    const playerFines = fines.filter(f => f.playerId === playerId);
    const pending = playerFines.filter(f => f.status === 'pendiente');
    const total = pending.reduce((sum, f) => sum + fineReasonById[f.reasonId].amount, 0);

    // Se agrupan las multas pendientes por motivo, así que si hay varias del mismo
    // tipo (p.ej. 2 tarjetas rojas) se muestra un único símbolo con el recuento
    // delante ("2TR") en vez de repetir el símbolo una vez por multa.
    const pendingByReason = pending.reduce((acc, f) => {
      (acc[f.reasonId] = acc[f.reasonId] || []).push(f);
      return acc;
    }, {});
    const chips = Object.entries(pendingByReason).map(([reasonId, group]) => {
      const r = fineReasonById[reasonId];
      const count = group.length;
      // Al hacer clic se actúa sobre una multa que todavía no se haya marcado como
      // pagada (si todas están ya a la espera de confirmación, se usa la primera).
      const target = group.find(f => !f.paidToId) || group[0];
      const anyAwaiting = group.some(f => f.paidToId);
      const label = (count > 1 ? `${count}${r.short}` : r.short) + (anyAwaiting ? ' ⏳' : '');
      const editTitle = (count > 1
        ? t('fines.chipEditMulti', { count, label: r.label, amount: r.amount })
        : t('fines.chipEditSingle', { label: r.label, amount: r.amount }));
      const payTitle = (count > 1
        ? t('fines.chipPayMulti', { count, label: r.label, amount: r.amount })
        : t('fines.chipPaySingle', { label: r.label, amount: r.amount }))
        + (anyAwaiting ? ` ${t('fines.chipSomeAwaiting')}` : '');
      // En modo edición (solo Comi Tesoreria), un clic abre el panel de editar/eliminar
      // esa multa; fuera de ese modo, un clic la marca como pagada, como siempre.
      const chipOnclick = finesEditMode
        ? `openEditFineModal('${target.id}')`
        : `toggleFinePaid('${target.id}')`;
      return `<span class="fine-chip-wrap"><button class="fine-chip" data-reason="${reasonId}" onclick="${chipOnclick}" title="${finesEditMode ? editTitle : payTitle}">${label}</button></span>`;
    }).join('');

    const statusBadge = `<span class="badge bad">${escapeHtml(t('fines.pendingBadge'))}</span>`;

    return `
        <tr>
          <td class="player-row"><div class="avatar">${avatarHtml(player.avatarUrl, initials(displayName(player)), player.injured, player.injuryIcon)}</div><div class="meta"><b>${escapeHtml(displayName(player))}</b></div></td>
          <td>${chips}</td>
          <td>${total} €</td>
          <td>${statusBadge}</td>
        </tr>
      `;
  }).join('');
}

// ---- Histórico de multas pagadas: se abre con el icono de reloj de "Multas del
// equipo" y lista todo lo que ya está marcado como pagado (lo que desaparece de la
// tabla principal en cuanto se paga, queda archivado aquí en vez de perderse).
function openFinesHistoryModal(){
  renderFinesHistory();
  document.getElementById('fines-history-modal').classList.add('active');
}
function closeFinesHistoryModal(){
  document.getElementById('fines-history-modal').classList.remove('active');
}
function renderFinesHistory(){
  const box = document.getElementById('fines-history-list');
  if(!box) return;

  const paid = fines
    .filter(f => f.status === 'pagada')
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

  if(paid.length === 0){
    box.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:20px 0;">${escapeHtml(t('fines.noHistoryYet'))}</div>`;
    return;
  }

  box.innerHTML = paid.map(f => {
    const player = rosterById[f.playerId];
    const reason = fineReasonById[f.reasonId];
    const paidTo = f.paidToId ? rosterById[f.paidToId] : null;
    return `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--line); border-radius:10px;">
          <div class="avatar">${avatarHtml(player ? player.avatarUrl : '', initials(player ? displayName(player) : '?'), false, '')}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13.5px;">${escapeHtml(player ? displayName(player) : t('sharedLineup.someone'))}</div>
            <div style="font-size:12px; color:var(--text-muted);">
              ${escapeHtml(reason ? reason.label : '')} · ${reason ? reason.amount : ''} €
              ${paidTo ? ` · ${escapeHtml(t('fines.paidToSuffix', { name: displayName(paidTo) }))}` : ''}
            </div>
          </div>
          <div style="font-size:12px; color:var(--text-muted); white-space:nowrap;">${f.paidAt ? formatFullDate(f.paidAt) : '—'}</div>
        </div>
      `;
  }).join('');
}

function toggleFinePaid(fineId){
  const f = fines.find(x => x.id === fineId);
  if(!f) return;
  if(f.status === 'pendiente'){
    if(f.paidToId){
      const responsible = rosterById[f.paidToId];
      alert(t('fines.alreadyPaidWaiting', { name: responsible ? displayName(responsible) : t('sharedLineup.someone') }));
      return;
    }
    openPayFineModal(fineId);
    return;
  }
  // Des-marcar una multa ya pagada no genera ningún movimiento, solo la vuelve a dejar pendiente
  f.status = 'pendiente';
  f.paidToId = null;
  persistFineUpdate(f.id, { status:'pendiente', paidToId:null });
  renderFinesTable();
  renderMyFinesSummary();
    renderInicioFinesBanner();
  updateFinesSummaries();
}

// --- Modal de alta de multa ---
let fineModalPlayerId = null;
let fineModalReasonIds = new Set();

function openFineModal(){
  if(!canManageFines()){
    alert(t('fines.onlyTreasuryAdd'));
    return;
  }
  fineModalPlayerId = null;
  fineModalReasonIds = new Set();
  const input = document.getElementById('fine-player-search-input');
  input.value = '';
  input.classList.remove('has-selection');
  closeFinePlayerSearchResults();
  renderFineReasonGrid();
  updateFineTotal();
  document.getElementById('fine-modal').classList.add('active');
}

function closeFineModal(){
  document.getElementById('fine-modal').classList.remove('active');
  closeFinePlayerSearchResults();
}

// Fuente única de datos del buscador: todo el roster ya registrado y activo en la
// app (rosterById, alimentado desde Supabase por loadPlantilla), incluida la propia
// usuaria ('me'), para poder ponerse una multa a una misma. Nunca se genera ni
// inventa ninguna jugadora ficticia.
function getFinePlayerPool(){
  return Object.values(rosterById);
}

// Normaliza texto para comparar ignorando mayúsculas y tildes/diacríticos.
function normalizeFineSearchText(str){
  return (str || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function closeFinePlayerSearchResults(){
  const results = document.getElementById('fine-player-search-results');
  results.innerHTML = '';
  results.classList.remove('open');
}

// Al escribir se invalida cualquier jugadora fijada anteriormente: solo queda
// confirmada de nuevo cuando se elige explícitamente una fila del desplegable.
function onFinePlayerSearchInput(){
  fineModalPlayerId = null;
  document.getElementById('fine-player-search-input').classList.remove('has-selection');
  renderFinePlayerSearchResults();
}

function onFinePlayerSearchFocus(){
  renderFinePlayerSearchResults();
}

function renderFinePlayerSearchResults(){
  const input = document.getElementById('fine-player-search-input');
  const results = document.getElementById('fine-player-search-results');
  const query = normalizeFineSearchText(input.value);

  if(!query){
    closeFinePlayerSearchResults();
    return;
  }

  const pool = getFinePlayerPool();
  // Jerarquía visual estándar de la app para desambiguar (mote > nombre de pila >
  // nombre de pila + inicial del apellido si hay nombres duplicados).
  const displayNames = computeDisplayNames(pool);

  const matches = pool.filter(p => {
    const shown = displayNames.get(p.id) || p.name || '';
    return [p.name, p.mote, shown].some(txt => normalizeFineSearchText(txt).includes(query));
  });

  if(!matches.length){
    results.innerHTML = `<div class="fine-player-search-empty">Sin coincidencias</div>`;
    results.classList.add('open');
    return;
  }

  results.innerHTML = matches.map(p => {
    const shown = displayNames.get(p.id) || p.name || 'Sin nombre';
    return `
        <button type="button" class="fine-player-search-result" onclick="selectFinePlayer('${p.id}')">
          <span class="avatar">${avatarHtml(p.avatarUrl, initials(shown), p.injured, p.injuryIcon)}</span>
          <span>${escapeHtml(shown)}</span>
        </button>
      `;
  }).join('');
  results.classList.add('open');
}

// Fija la jugadora sancionada: guarda su id, deja su nombre en la casilla a modo
// de confirmación visual y cierra el desplegable de resultados.
function selectFinePlayer(playerId){
  const player = rosterById[playerId];
  if(!player) return;
  fineModalPlayerId = playerId;
  const input = document.getElementById('fine-player-search-input');
  input.value = displayName(player);
  input.classList.add('has-selection');
  closeFinePlayerSearchResults();
}

// Se conserva este nombre de función porque ya se invoca desde otros puntos de la app
// (subida/borrado de foto de perfil, cambios en "tocada/lesionada"…) para refrescar
// cualquier vista que esté pintando avatares del roster; aquí repinta el desplegable
// de búsqueda si está abierto, para que los avatares se actualicen al momento.
function renderFinePlayerGrid(){
  const results = document.getElementById('fine-player-search-results');
  if(results && results.classList.contains('open')) renderFinePlayerSearchResults();
}

// Cierra el desplegable de resultados si se hace clic fuera del buscador de jugadora.
document.addEventListener('click', function(e){
  const wrap = document.getElementById('fine-player-search');
  if(wrap && !wrap.contains(e.target)) closeFinePlayerSearchResults();
});

function renderFineReasonGrid(){
  const box = document.getElementById('fine-reason-grid');
  box.innerHTML = fineReasons.map(r => `
      <button class="fine-reason-box ${fineModalReasonIds.has(r.id) ? 'selected' : ''}" data-reason="${r.id}" onclick="toggleFineReason('${r.id}')" title="${r.label}">
        <b>${r.short}</b>
        <span>${r.amount} €</span>
      </button>
    `).join('');
}

function toggleFineReason(reasonId){
  if(fineModalReasonIds.has(reasonId)) fineModalReasonIds.delete(reasonId);
  else fineModalReasonIds.add(reasonId);
  renderFineReasonGrid();
  updateFineTotal();
}

function updateFineTotal(){
  const total = [...fineModalReasonIds].reduce((sum, id) => sum + fineReasonById[id].amount, 0);
  document.getElementById('fine-total-amount').textContent = total + ' €';
}

function saveFine(){
  if(!canManageFines()){
    alert(t('fines.onlyTreasuryAdd'));
    return;
  }
  if(!fineModalPlayerId || fineModalReasonIds.size === 0){
    alert(t('fines.choosePlayerReason'));
    return;
  }
  fineModalReasonIds.forEach(reasonId => {
    const tempId = crypto.randomUUID();
    const newFine = { id:tempId, playerId:fineModalPlayerId, reasonId, status:'pendiente', paidToId:null };
    fines.push(newFine);
    persistFineInsert(tempId, newFine);
  });
  closeFineModal();
  renderFinesTable();
  renderMyFinesSummary();
    renderInicioFinesBanner();
  updateFinesSummaries();
  loadPlantilla();
}

// ---- Editar multa: mismo patrón que el modal de alta, pero centrado en una
// jugadora ya existente. La rejilla de motivos es multi-selección: "Eliminar multa"
// borra todas las multas pendientes de esa jugadora cuyo motivo esté marcado (si un
// motivo marcado no tiene multa, simplemente no pasa nada con él). "Guardar cambios"
// sigue sirviendo para renombrar una multa concreta a otra jugadora/motivo, y por
// eso solo funciona cuando hay exactamente un motivo marcado.
let editFineId = null;
let editFineModalPlayerId = null;
let editFineModalReasonIds = new Set();

function openEditFineModal(fineId){
  if(!canManageFines()){
    alert('Solo Comi Tesoreria puede editar multas.');
    return;
  }
  const fine = fines.find(f => f.id === fineId);
  if(!fine) return;

  editFineId = fineId;
  editFineModalPlayerId = fine.playerId;
  // Se preseleccionan todos los motivos por los que esta jugadora tiene ahora mismo
  // una multa pendiente, para que la rejilla refleje su situación real de partida.
  editFineModalReasonIds = new Set(
    fines.filter(f => f.playerId === fine.playerId && f.status === 'pendiente').map(f => f.reasonId)
  );

  const player = rosterById[fine.playerId];
  const input = document.getElementById('edit-fine-player-search-input');
  input.value = player ? displayName(player) : '';
  input.classList.add('has-selection');
  closeEditFinePlayerSearchResults();

  renderEditFineReasonGrid();
  updateEditFineTotal();
  document.getElementById('edit-fine-modal').classList.add('active');
}

function closeEditFineModal(){
  document.getElementById('edit-fine-modal').classList.remove('active');
  closeEditFinePlayerSearchResults();
}

function closeEditFinePlayerSearchResults(){
  const results = document.getElementById('edit-fine-player-search-results');
  if(!results) return;
  results.innerHTML = '';
  results.classList.remove('open');
}

function onEditFinePlayerSearchInput(){
  editFineModalPlayerId = null;
  document.getElementById('edit-fine-player-search-input').classList.remove('has-selection');
  renderEditFinePlayerSearchResults();
}
function onEditFinePlayerSearchFocus(){
  renderEditFinePlayerSearchResults();
}
function renderEditFinePlayerSearchResults(){
  const input = document.getElementById('edit-fine-player-search-input');
  const results = document.getElementById('edit-fine-player-search-results');
  const query = normalizeFineSearchText(input.value);

  if(!query){
    closeEditFinePlayerSearchResults();
    return;
  }

  const pool = getFinePlayerPool();
  const displayNames = computeDisplayNames(pool);
  const matches = pool.filter(p => {
    const shown = displayNames.get(p.id) || p.name || '';
    return [p.name, p.mote, shown].some(txt => normalizeFineSearchText(txt).includes(query));
  });

  if(!matches.length){
    results.innerHTML = `<div class="fine-player-search-empty">Sin coincidencias</div>`;
    results.classList.add('open');
    return;
  }

  results.innerHTML = matches.map(p => {
    const shown = displayNames.get(p.id) || p.name || 'Sin nombre';
    return `
        <button type="button" class="fine-player-search-result" onclick="selectEditFinePlayer('${p.id}')">
          <span class="avatar">${avatarHtml(p.avatarUrl, initials(shown), p.injured, p.injuryIcon)}</span>
          <span>${escapeHtml(shown)}</span>
        </button>
      `;
  }).join('');
  results.classList.add('open');
}
function selectEditFinePlayer(playerId){
  const player = rosterById[playerId];
  if(!player) return;
  editFineModalPlayerId = playerId;
  const input = document.getElementById('edit-fine-player-search-input');
  input.value = displayName(player);
  input.classList.add('has-selection');
  closeEditFinePlayerSearchResults();
}
document.addEventListener('click', function(e){
  const wrap = document.getElementById('edit-fine-player-search');
  if(wrap && !wrap.contains(e.target)) closeEditFinePlayerSearchResults();
});

function renderEditFineReasonGrid(){
  const box = document.getElementById('edit-fine-reason-grid');
  box.innerHTML = fineReasons.map(r => `
      <button class="fine-reason-box ${editFineModalReasonIds.has(r.id) ? 'selected' : ''}" data-reason="${r.id}" onclick="toggleEditFineReason('${r.id}')" title="${r.label}">
        <b>${r.short}</b>
        <span>${r.amount} €</span>
      </button>
    `).join('');
}
function toggleEditFineReason(reasonId){
  if(editFineModalReasonIds.has(reasonId)) editFineModalReasonIds.delete(reasonId);
  else editFineModalReasonIds.add(reasonId);
  renderEditFineReasonGrid();
  updateEditFineTotal();
}
function updateEditFineTotal(){
  const total = [...editFineModalReasonIds].reduce((sum, id) => sum + fineReasonById[id].amount, 0);
  document.getElementById('edit-fine-total-amount').textContent = total + ' €';
}

async function saveEditFine(){
  if(!canManageFines()){
    alert(t('fines.onlyTreasuryEdit'));
    return;
  }
  if(!editFineModalPlayerId || editFineModalReasonIds.size !== 1){
    alert(t('fines.editSaveHint'));
    return;
  }
  const newReasonId = [...editFineModalReasonIds][0];
  const fine = fines.find(f => f.id === editFineId);
  if(!fine) return;

  fine.playerId = editFineModalPlayerId;
  fine.reasonId = newReasonId;

  const idToUpdate = editFineId;
  closeEditFineModal();
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();
  loadPlantilla();

  await persistFineUpdate(idToUpdate, { playerId:editFineModalPlayerId, reasonId:newReasonId });
}

// Borra todas las multas PENDIENTES de la jugadora elegida cuyo motivo esté marcado
// en la rejilla. Si un motivo marcado no tiene ninguna multa para esa jugadora, se
// ignora sin más — no se crea ni se avisa, simplemente no hay nada que borrar.
async function deleteFineFromEditModal(){
  if(!canManageFines()){
    alert(t('fines.onlyTreasuryDelete'));
    return;
  }
  if(!editFineModalPlayerId){
    alert(t('fines.choosePlayer'));
    return;
  }
  if(editFineModalReasonIds.size === 0){
    alert(t('fines.chooseReasonToDelete'));
    return;
  }

  const toDelete = fines.filter(f =>
    f.playerId === editFineModalPlayerId &&
    f.status === 'pendiente' &&
    editFineModalReasonIds.has(f.reasonId)
  );

  if(toDelete.length === 0){
    closeEditFineModal();
    return;
  }
  if(!confirm(toDelete.length === 1 ? t('fines.deleteConfirmOne') : t('fines.deleteConfirmMany', { count: toDelete.length }))) return;

  closeEditFineModal();

  const idsToDelete = toDelete.map(f => f.id);
  fines = fines.filter(f => !idsToDelete.includes(f.id));
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();

  const { data, error } = await supabaseClient.from('fines').delete().in('id', idsToDelete).select();
  if(error){
    alert(t('fines.deleteError', { error: error.message }));
    loadFines();
  }else if(!data || data.length < idsToDelete.length){
    // Supabase no da error si el borrado no afecta a ninguna fila (p.ej. si una
    // política de RLS lo bloquea), solo devuelve menos filas de las esperadas.
    // Se recarga desde el servidor para que cualquier multa "fantasma" vuelva a
    // aparecer ahora mismo (y no como sorpresa en el próximo refresh).
    alert('Alguna multa no se ha podido eliminar en Supabase (probablemente por permisos). Revisa la política de borrado de la tabla "fines".');
    loadFines();
  }
}
