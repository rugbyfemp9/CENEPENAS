/* ================= TERCER TIEMPO — GRUPOS FIJOS ================= */
// División fija de la plantilla en dos grupos. Cambia estos ids para ajustar quién
// está en cada grupo (de momento repartidos a mano, mitad y mitad).
const thirdTimeGroups = {
  A: [],
  B: []
};
function thirdTimeGroupOf(playerId){
  if(thirdTimeGroups.A.includes(playerId)) return 'A';
  if(thirdTimeGroups.B.includes(playerId)) return 'B';
  return null;
}
// Los partidos (no los entrenos) marcan el ritmo: en cada partido, un grupo cocina
// y el otro limpia, y se van alternando en orden cronológico.
// El tercer tiempo lo organiza siempre el equipo local, así que solo entran aquí los
// partidos jugados en casa (isHome === true). Los partidos ya existentes que no tienen
// el campo isHome definido (creados antes de esta función) se siguen tratando como
// partidos en casa para no perder sus pestañas de tercer tiempo ya creadas.
function thirdTimeMatches(){
  return attEvents
    .filter(ev => attEventType(ev) === 'match' && ev.isHome !== false)
    .slice()
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)));
}
// El "partido de esta semana" para el banner: el próximo que quede, o si no queda
// ninguno por delante, el último que hubo.
function thirdTimeCurrentMatch(){
  const matches = thirdTimeMatches();
  if(matches.length === 0) return null;
  const todayIso = todayLocalIso();
  const upcoming = matches.find(ev => attEventIso(ev) >= todayIso);
  return { match: upcoming || matches[matches.length - 1], index: matches.indexOf(upcoming || matches[matches.length - 1]) };
}
// Grupo A cocina en los partidos de índice par, grupo B en los impares (y al revés
// para limpiar) — así se van alternando partido a partido durante toda la temporada.
function thirdTimeRolesForIndex(index){
  const cookGroup = index % 2 === 0 ? 'A' : 'B';
  const cleanGroup = cookGroup === 'A' ? 'B' : 'A';
  return { cookGroup, cleanGroup };
}

// Partido cuyo detalle se está viendo ahora mismo (se fija al entrar desde la lista).
// Si no hay ninguno seleccionado, se usa el partido "actual" automático.
let selectedTercerMatchId = null;
function thirdTimeActiveMatch(){
  if(selectedTercerMatchId){
    const matches = thirdTimeMatches();
    const idx = matches.findIndex(m => m.id === selectedTercerMatchId);
    if(idx >= 0) return { match: matches[idx], index: idx };
  }
  return thirdTimeCurrentMatch();
}

/* --- Cambios de turno: alguien que no puede asistir pide a una compañera que la cubra --- */

// Solicitudes de cambio pendientes de aceptar.
let thirdTimeCovers = [];

// Turnos pendientes de devolver: quien recibió el favor (owedBy) se lo debe a quien
// la cubrió (owedTo).
let thirdTimeDebts = [];

let swapModalCtx = null; // { matchId, matchLabel } — partido sobre el que se pide el cambio

// ---- Cambios de turno y deudas: leídos y guardados en las tablas "third_time_covers"
// y "third_time_debts" de Supabase, igual que las multas, para que pedir un cambio,
// aceptarlo/rechazarlo o que se devuelva un favor se vea al momento desde cualquier
// cuenta o dispositivo (y no se pierda al recargar la página).
function coverRowToLocal(row){
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return {
    id: row.id,
    matchId: row.match_id,
    fromPlayerId: toLocalId(row.from_player_id),
    toPlayerId: toLocalId(row.to_player_id),
    status: row.status,
    auto: row.auto
  };
}
function debtRowToLocal(row){
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return {
    id: row.id,
    owedBy: toLocalId(row.owed_by),
    owedTo: toLocalId(row.owed_to),
    settled: row.settled,
    originMatchId: row.origin_match_id,
    originLabel: row.origin_label,
    settledMatchLabel: row.settled_match_label
  };
}

async function loadThirdTimeCovers(){
  const { data, error } = await supabaseClient.from('third_time_covers').select('*').order('created_at', { ascending:true });
  if(error){ console.error('No se pudieron cargar los cambios de turno', error); return; }
  thirdTimeCovers = (data || []).map(coverRowToLocal);
  renderThirdTime();
}
async function loadThirdTimeDebts(){
  const { data, error } = await supabaseClient.from('third_time_debts').select('*').order('created_at', { ascending:true });
  if(error){ console.error('No se pudieron cargar las deudas de tercer tiempo', error); return; }
  thirdTimeDebts = (data || []).map(debtRowToLocal);
  renderThirdTime();
}

// Inserta un cambio de turno nuevo en Supabase y sustituye su id local (temporal)
// por el id real que ha generado la base de datos.
async function persistCoverInsert(localId, cover){
  const { data, error } = await supabaseClient
    .from('third_time_covers')
    .insert({
      match_id: cover.matchId,
      from_player_id: toRemotePlayerId(cover.fromPlayerId),
      to_player_id: toRemotePlayerId(cover.toPlayerId),
      status: cover.status,
      auto: !!cover.auto
    })
    .select()
    .single();
  if(error){
    alert('La solicitud se ha guardado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
    return;
  }
  const local = thirdTimeCovers.find(c => c.id === localId);
  if(local) local.id = data.id;
  renderThirdTime();
}
async function persistCoverUpdate(coverId, patch){
  const { error } = await supabaseClient.from('third_time_covers').update(patch).eq('id', coverId);
  if(error){
    alert('El cambio se ha aplicado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
  }
}
// Inserta una deuda nueva (favor pendiente de devolver) y devuelve su id real de Supabase.
async function persistDebtInsert(debt){
  const { data, error } = await supabaseClient
    .from('third_time_debts')
    .insert({
      owed_by: toRemotePlayerId(debt.owedBy),
      owed_to: toRemotePlayerId(debt.owedTo),
      settled: !!debt.settled,
      origin_match_id: debt.originMatchId,
      origin_label: debt.originLabel || null
    })
    .select()
    .single();
  if(error){
    alert('La deuda se ha guardado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
    return null;
  }
  return data.id;
}
async function persistDebtUpdate(debtId, patch){
  const remotePatch = {};
  if('settled' in patch) remotePatch.settled = patch.settled;
  if('settledMatchLabel' in patch) remotePatch.settled_match_label = patch.settledMatchLabel;
  const { error } = await supabaseClient.from('third_time_debts').update(remotePatch).eq('id', debtId);
  if(error){
    alert('El cambio se ha aplicado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
  }
}

// Cualquier cambio en cambios de turno, deudas o comida del tercer tiempo (lo haga
// quien lo haga, desde cualquier dispositivo) se recarga aquí al momento.
function subscribeToThirdTimeRealtime(){
  supabaseClient
    .channel('third-time-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'third_time_covers' }, () => loadThirdTimeCovers())
    .on('postgres_changes', { event:'*', schema:'public', table:'third_time_debts' }, () => loadThirdTimeDebts())
    .on('postgres_changes', { event:'*', schema:'public', table:'third_time_food' }, () => loadThirdTimeFood())
    .subscribe();
}

// Roles reales de una jugadora para un partido: su grupo de base, menos lo que haya
// cedido a otra persona, más lo que haya asumido cubriendo a alguien
function thirdTimeEffectiveRoles(playerId, matchId, index){
  const { cookGroup, cleanGroup } = thirdTimeRolesForIndex(index);
  const group = thirdTimeGroupOf(playerId);
  const roles = new Set();
  if(group === cookGroup) roles.add('cook');
  if(group === cleanGroup) roles.add('clean');

  const coveredAway = thirdTimeCovers.find(c => c.status === 'aceptado' && c.matchId === matchId && c.fromPlayerId === playerId);
  if(coveredAway) roles.clear();

  thirdTimeCovers
    .filter(c => c.status === 'aceptado' && c.matchId === matchId && c.toPlayerId === playerId)
    .forEach(c => {
      const fromGroup = thirdTimeGroupOf(c.fromPlayerId);
      if(fromGroup === cookGroup) roles.add('cook');
      if(fromGroup === cleanGroup) roles.add('clean');
    });

  return roles;
}

// Todas las jugadoras que de verdad tienen un rol concreto en un partido (grupo base
// ya ajustado por los cambios de turno aceptados) — se usa para las multas automáticas
function thirdTimeEffectiveMembers(role, matchId, index){
  return roster.map(p => p.id).filter(id => thirdTimeEffectiveRoles(id, matchId, index).has(role));
}

// Aplica automáticamente los cambios que se le deben a alguien: si a la compañera que te
// hizo un favor le toca cocinar o limpiar en el próximo tercer tiempo, ese turno se te
// asigna a ti para devolvérselo, sin que nadie tenga que acordarse
function resolveThirdTimeDebts(){
  const current = thirdTimeCurrentMatch();
  if(!current) return;
  const { match, index } = current;

  thirdTimeDebts.filter(d => !d.settled).forEach(d => {
    if(d.originMatchId === match.id) return; // no devolver el favor en el mismo partido en que se pidió

    const group = thirdTimeGroupOf(d.owedTo);
    const { cookGroup, cleanGroup } = thirdTimeRolesForIndex(index);
    const hasDuty = group === cookGroup || group === cleanGroup;
    if(!hasDuty) return;

    const already = thirdTimeCovers.some(c => c.matchId === match.id && c.fromPlayerId === d.owedTo && c.status === 'aceptado');
    if(already) return;

    const tempId = 'ttc-temp-' + Math.random().toString(36).slice(2);
    const newCover = { id:tempId, matchId: match.id, fromPlayerId: d.owedTo, toPlayerId: d.owedBy, status:'aceptado', auto:true };
    thirdTimeCovers.push(newCover);
    d.settled = true;
    d.settledMatchLabel = match.label;

    // Se guarda en Supabase sin bloquear el render: si falla, se reintentará en la
    // próxima vez que se recalculen los turnos.
    persistCoverInsert(tempId, newCover);
    persistDebtUpdate(d.id, { settled:true, settledMatchLabel: match.label });
  });
}

function openSwapModal(){
  const current = thirdTimeActiveMatch();
  if(!current) return;
  swapModalCtx = { matchId: current.match.id, matchLabel: current.match.label };

  document.getElementById('swap-modal-sub').textContent = t('tercer.swapSub', { match: current.match.label });

  const select = document.getElementById('swap-teammate-select');
  select.innerHTML = roster.filter(p => p.id !== currentUserId)
    .map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');

  document.getElementById('swap-modal').classList.add('active');
}
function closeSwapModal(){
  document.getElementById('swap-modal').classList.remove('active');
  swapModalCtx = null;
}
async function confirmSwapRequest(){
  if(!swapModalCtx) return;
  const toPlayerId = document.getElementById('swap-teammate-select').value;
  if(!toPlayerId) return;

  const tempId = 'ttc-temp-' + Math.random().toString(36).slice(2);
  const newCover = { id:tempId, matchId: swapModalCtx.matchId, fromPlayerId: currentUserId, toPlayerId, status:'pendiente', auto:false };
  thirdTimeCovers.push(newCover);
  closeSwapModal();
  renderThirdTime();
  await persistCoverInsert(tempId, newCover);
}

// La compañera elegida acepta: sus roles para ese partido se permutan al momento
async function acceptSwap(coverId){
  const c = thirdTimeCovers.find(x => x.id === coverId);
  if(!c || c.status !== 'pendiente') return;
  c.status = 'aceptado';
  renderThirdTime();
  await persistCoverUpdate(coverId, { status:'aceptado' });

  // Se guarda el favor: en el próximo tercer tiempo en el que le toque a quien ha cubierto,
  // se le devolverá el turno automáticamente sin tener que acordarse
  const tempDebtId = 'ttd-temp-' + Math.random().toString(36).slice(2);
  const newDebt = {
    id: tempDebtId,
    owedBy: c.fromPlayerId,
    owedTo: c.toPlayerId,
    settled:false,
    originMatchId: c.matchId,
    originLabel: thirdTimeEventLabel(c.matchId)
  };
  thirdTimeDebts.push(newDebt);
  renderThirdTime();

  const remoteId = await persistDebtInsert(newDebt);
  if(remoteId) newDebt.id = remoteId;
}
async function rejectSwap(coverId){
  const c = thirdTimeCovers.find(x => x.id === coverId);
  if(!c || c.status !== 'pendiente') return;
  c.status = 'rechazado';
  renderThirdTime();
  await persistCoverUpdate(coverId, { status:'rechazado' });
}

function thirdTimeEventLabel(matchId){
  const ev = attEvents.find(e => e.id === matchId);
  return ev ? ev.label : '';
}

function renderThirdTime(){
  resolveThirdTimeDebts();
  renderTercerList();
  renderTercerHistory();
  renderThirdTimeBanner();
  renderSwapSummary();
  renderInicioTercerBanner();
}

// Iconos compartidos entre el banner de Vestuario y el de Inicio
function thirdTimeCookIconSvg(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16v2a6 6 0 01-6 6h-4a6 6 0 01-6-6v-2z"/><path d="M2 12h20M9 8c-1-1-1-2.2 0-3M12 8c-1-1-1-2.2 0-3M15 8c-1-1-1-2.2 0-3"/></svg>`;
}
function thirdTimeCleanIconSvg(){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.4 4.2L18 8.5l-4.6 1.3L12 14l-1.4-4.2L6 8.5l4.6-1.3L12 3z"/><path d="M19 15l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8L17 17.4l1.8-.6z"/></svg>`;
}

// Tarjeta de "Tercer tiempo" en Inicio: mismo componente visual (.tt-personal) que el
// banner de Vestuario, con tu rol para el próximo partido en casa y un botón para apuntarte.
function renderInicioTercerBanner(){
  const box = document.getElementById('inicio-tercer-banner');
  if(!box) return;

  const current = thirdTimeCurrentMatch();
  if(!current){
    box.innerHTML = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.none'))}</span></div>
        </div>
      `;
    return;
  }

  const { match, index } = current;
  const myRoles = thirdTimeEffectiveRoles(currentUserId, match.id, index);
  const myGroup = thirdTimeGroupOf(currentUserId);
  const coveredAwayBy = thirdTimeCovers.find(c => c.status === 'aceptado' && c.matchId === match.id && c.fromPlayerId === currentUserId);

  const signupBtn = `
      <div class="tt-personal-actions">
        <button class="tt-swap-btn tt-signup-btn" onclick="event.stopPropagation(); openTercerDetail('${match.id}','tercer')">${escapeHtml(t('tercer.signup'))}</button>
      </div>
    `;

  if(myRoles.has('cook') && myRoles.has('clean')){
    box.innerHTML = `
        <div class="tt-personal cook">
          <div class="icon">${thirdTimeCookIconSvg()}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.cookAndClean', {match: match.label}))}</span></div>
          ${signupBtn}
        </div>`;
  } else if(myRoles.has('cook')){
    box.innerHTML = `
        <div class="tt-personal cook">
          <div class="icon">${thirdTimeCookIconSvg()}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.cook', {match: match.label}))}</span></div>
          ${signupBtn}
        </div>`;
  } else if(myRoles.has('clean')){
    box.innerHTML = `
        <div class="tt-personal clean">
          <div class="icon">${thirdTimeCleanIconSvg()}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.clean', {match: match.label}))}</span></div>
          ${signupBtn}
        </div>`;
  } else if(coveredAwayBy){
    box.innerHTML = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.freeCovered', {name: displayName(rosterById[coveredAwayBy.toPlayerId])}))}</span></div>
        </div>`;
  } else if(myGroup){
    box.innerHTML = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.free', {match: match.label}))}</span></div>
        </div>`;
  } else {
    box.innerHTML = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.title'))}</b><span>${escapeHtml(t('tercer.noGroup'))}</span></div>
        </div>`;
  }
}

// Entra en el detalle de un partido concreto desde la lista de Tercer tiempo (o su histórico)
let tercerDetailOrigin = 'tercer';
function openTercerDetail(matchId, origin){
  selectedTercerMatchId = matchId;
  tercerDetailOrigin = origin === 'tercer-historial' ? 'tercer-historial' : 'tercer';
  renderThirdTime();
  setSection('tercer-detalle');
}
function backFromTercerDetalle(){
  setSection(tercerDetailOrigin);
}

// 🟢 Abierto = el partido "actual" (el próximo que queda, o el último si no queda ninguno);
// 🟡 Próximamente = partidos futuros más lejanos; 🔒 Cerrado = partidos ya pasados.
function tercerMatchStatus(ev, openMatchId, todayIso){
  if(attEventIso(ev) < todayIso) return { code:'closed', emoji:'🔒', label:t('tercer.statusClosed') };
  if(ev.id === openMatchId) return { code:'open', emoji:'🟢', label:t('tercer.statusOpen') };
  return { code:'soon', emoji:'🟡', label:t('tercer.statusSoon') };
}

// Rol de una jugadora para un partido, en las tres variantes que pide la tarjeta
function tercerMyRoleLabel(playerId, matchId, index){
  const roles = thirdTimeEffectiveRoles(playerId, matchId, index);
  if(roles.has('cook')) return { text:t('tercer.roleCook'), cls:'cook' };
  if(roles.has('clean')) return { text:t('tercer.roleClean'), cls:'clean' };
  return { text:t('tercer.roleFree'), cls:'free' };
}

// Columna con los integrantes de un grupo (avatar + nombre). Se usa tanto en la vista
// vacía de Tercer tiempo como en el modal "Grupos del tercer tiempo".
function thirdTimeGroupPreviewCol(letter){
  const memberIds = thirdTimeGroups[letter] || [];
  const rows = memberIds.map(id => {
    const player = rosterById[id];
    if(!player) return '';
    return `
        <div class="tt-groups-preview-row">
          <span class="avatar">${avatarHtml(player.avatarUrl, initials(displayName(player)), player.injured, player.injuryIcon)}</span>
          <div class="info"><b>${escapeHtml(displayName(player))}</b></div>
        </div>
      `;
  }).join('');
  return `
      <div class="tt-groups-preview-col">
        <div class="tt-groups-preview-title">${escapeHtml(t('tercer.groupLabel', { letter }))}</div>
        ${rows || `<div class="tt-groups-preview-empty">${escapeHtml(t('tercer.noPlayersInGroup'))}</div>`}
      </div>
    `;
}

function openThirdTimeGroupsOverviewModal(){
  document.getElementById('tt-groups-overview-list').innerHTML =
    thirdTimeGroupPreviewCol('A') + thirdTimeGroupPreviewCol('B');
  document.getElementById('tt-groups-overview-modal').classList.add('active');
}
function closeThirdTimeGroupsOverviewModal(){
  document.getElementById('tt-groups-overview-modal').classList.remove('active');
}

function renderTercerList(){
  const box = document.getElementById('tercer-list');
  if(!box) return;

  const matches = thirdTimeMatches();
  const todayIso = todayLocalIso();
  // Los partidos ya jugados se archivan automáticamente a las 23:59 del mismo día
  // (en cuanto cambia la fecha local) y dejan de aparecer aquí; se consultan en "Pasados".
  const upcoming = matches
    .map((ev, index) => ({ ev, index }))
    .filter(({ ev }) => attEventIso(ev) >= todayIso);

  // El botón "grupo" (integrantes de cada grupo) solo tiene sentido si hay próximos
  // partidos en la lista; si no hay ninguno, esa misma información ya se muestra
  // directamente en la página (ver más abajo), así que el botón se oculta.
  const groupsBtn = document.getElementById('tt-groups-btn');
  if(groupsBtn) groupsBtn.style.display = upcoming.length > 0 ? '' : 'none';

  if(upcoming.length === 0){
    box.innerHTML = `
        <div class="att-roster-empty" style="margin-bottom:14px;">${escapeHtml(t('tercer.noMatchesGroups'))}</div>
        <div class="tt-groups-preview">
          ${thirdTimeGroupPreviewCol('A')}
          ${thirdTimeGroupPreviewCol('B')}
        </div>
      `;
    return;
  }

  const openMatch = thirdTimeCurrentMatch();
  const openMatchId = openMatch ? openMatch.match.id : null;

  box.innerHTML = upcoming.map(({ ev, index }) => {
    const status = tercerMatchStatus(ev, openMatchId, todayIso);
    const role = tercerMyRoleLabel(currentUserId, ev.id, index);
    const rival = ev.label.replace(/^(Partido|Partit)\s+/i, '');
    return `
        <div class="att-event" onclick="openTercerDetail('${ev.id}','tercer')">
          <div class="left">
            <div class="cal-date"><div class="d">${ev.date}</div><div class="m">${monthAbbrLabel(ev.month)}</div></div>
            <div class="info">
              <b>${escapeHtml(rival)}</b>
              <span>${escapeHtml(eventWhenDisplay(ev))}</span>
              <span class="tt-list-role ${role.cls}">${role.text}</span>
            </div>
          </div>
          <div class="actions">
            <span class="tt-list-status ${status.code}">${status.emoji} ${status.label}</span>
          </div>
        </div>
      `;
  }).join('');
}

// Partidos en casa ya jugados: se listan aparte, del más reciente al más antiguo.
function renderTercerHistory(){
  const box = document.getElementById('tercer-history-list');
  if(!box) return;

  const matches = thirdTimeMatches();
  const todayIso = todayLocalIso();
  const past = matches
    .map((ev, index) => ({ ev, index }))
    .filter(({ ev }) => attEventIso(ev) < todayIso)
    .reverse();

  if(past.length === 0){
    box.innerHTML = `<div class="att-roster-empty">${escapeHtml(t('tercer.noHistoryYet'))}</div>`;
    return;
  }

  box.innerHTML = past.map(({ ev, index }) => {
    const role = tercerMyRoleLabel(currentUserId, ev.id, index);
    const rival = ev.label.replace(/^(Partido|Partit)\s+/i, '');
    return `
        <div class="att-event" onclick="openTercerDetail('${ev.id}','tercer-historial')">
          <div class="left">
            <div class="cal-date"><div class="d">${ev.date}</div><div class="m">${monthAbbrLabel(ev.month)}</div></div>
            <div class="info">
              <b>${escapeHtml(rival)}</b>
              <span>${escapeHtml(eventWhenDisplay(ev))}</span>
              <span class="tt-list-role ${role.cls}">${role.text}</span>
            </div>
          </div>
          <div class="actions">
            <span class="tt-list-status closed">🔒 ${escapeHtml(t('tercer.statusClosed'))}</span>
          </div>
        </div>
      `;
  }).join('');
}

function renderSwapSummary(){
  const box = document.getElementById('swap-summary-card');
  if(!box) return;

  const incoming = thirdTimeCovers.filter(c => c.status === 'pendiente' && c.toPlayerId === currentUserId);
  const outgoing = thirdTimeCovers.filter(c => c.status === 'pendiente' && c.fromPlayerId === currentUserId);
  const owedToMe = thirdTimeDebts.filter(d => !d.settled && d.owedTo === currentUserId);
  const iOwe = thirdTimeDebts.filter(d => !d.settled && d.owedBy === currentUserId);

  let html = `<div class="section-head" style="margin-bottom:2px;"><h3 style="margin:0; font-size:16px;">${escapeHtml(t('tercer.yourSwaps'))}</h3></div>`;

  if(incoming.length === 0 && outgoing.length === 0 && owedToMe.length === 0 && iOwe.length === 0){
    box.innerHTML = html + `<div class="swap-empty">${escapeHtml(t('tercer.noSwapsPending'))}</div>`;
    return;
  }

  incoming.forEach(c => {
    html += `
        <div class="swap-request-item">
          <div class="txt">
            <b>${t('tercer.incomingRequest', { name: escapeHtml(displayName(rosterById[c.fromPlayerId])) })}</b>
            <span>${escapeHtml(thirdTimeEventLabel(c.matchId))}</span>
          </div>
          <div class="swap-request-actions">
            <button class="btn-xs reject" onclick="rejectSwap('${c.id}')">${escapeHtml(t('tercer.reject'))}</button>
            <button class="btn-xs accept" onclick="acceptSwap('${c.id}')">${escapeHtml(t('tercer.accept'))}</button>
          </div>
        </div>
      `;
  });

  outgoing.forEach(c => {
    html += `
        <div class="swap-request-item">
          <div class="txt">
            <b>${t('tercer.outgoingWaiting', { name: escapeHtml(displayName(rosterById[c.toPlayerId])) })}</b>
            <span>${escapeHtml(thirdTimeEventLabel(c.matchId))}</span>
          </div>
          <span class="badge warn">${escapeHtml(t('fines.pendingBadge'))}</span>
        </div>
      `;
  });

  owedToMe.forEach(d => {
    html += `
        <div class="swap-request-item">
          <div class="txt">
            <b>${t('tercer.owedToMeMsg', { name: escapeHtml(displayName(rosterById[d.owedBy])) })}</b>
            <span>${escapeHtml(t('tercer.owedToMeSub'))}</span>
          </div>
          <span class="badge info">${escapeHtml(t('tercer.toCollectBadge'))}</span>
        </div>
      `;
  });

  iOwe.forEach(d => {
    html += `
        <div class="swap-request-item">
          <div class="txt">
            <b>${t('tercer.iOweMsg', { name: escapeHtml(displayName(rosterById[d.owedTo])) })}</b>
            <span>${escapeHtml(t('tercer.iOweSub'))}</span>
          </div>
          <span class="badge bad">${escapeHtml(t('fines.pendingBadge'))}</span>
        </div>
      `;
  });

  box.innerHTML = html;
}

function renderThirdTimeBanner(){
  const box = document.getElementById('tt-banner');
  if(!box) return;

  const current = thirdTimeActiveMatch();
  const titleEl = document.getElementById('tercer-detalle-title');
  if(titleEl) titleEl.textContent = current ? t('tercer.detailTitleWithMatch', { match: current.match.label }) : t('tercer.title');
  if(!current){
    box.innerHTML = `<div class="tt-personal none">${escapeHtml(t('tercer.noMatchForGroups'))}</div>`;
    return;
  }

  const { match, index } = current;
  const { cookGroup, cleanGroup } = thirdTimeRolesForIndex(index);
  const myGroup = thirdTimeGroupOf(currentUserId);
  const myRoles = thirdTimeEffectiveRoles(currentUserId, match.id, index);

  const coveredAwayBy = thirdTimeCovers.find(c => c.status === 'aceptado' && c.matchId === match.id && c.fromPlayerId === currentUserId);
  const coveringFor = thirdTimeCovers.filter(c => c.status === 'aceptado' && c.matchId === match.id && c.toPlayerId === currentUserId);
  const hasPendingOutgoing = thirdTimeCovers.some(c => c.status === 'pendiente' && c.matchId === match.id && c.fromPlayerId === currentUserId);

  const cookIcon = thirdTimeCookIconSvg();
  const cleanIcon = thirdTimeCleanIconSvg();

  const swapBtn = `<button class="tt-swap-btn" onclick="openSwapModal()">${escapeHtml(t('tercer.cantAttend'))}</button>`;

  let noteExtra = '';
  if(coveringFor.length){
    noteExtra = ' · cubres a ' + coveringFor.map(c => displayName(rosterById[c.fromPlayerId])).join(', ');
  }

  let personalHtml;
  if(myRoles.has('cook') && myRoles.has('clean')){
    personalHtml = `
        <div class="tt-personal cook">
          <div class="icon">${cookIcon}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.roleCookAndClean'))}</b><span>${escapeHtml(t('tercer.groupLabel', { letter: myGroup }))} · ${escapeHtml(match.label)}${noteExtra}</span></div>
          <div class="tt-personal-actions">
            ${hasPendingOutgoing ? '' : swapBtn}
          </div>
        </div>`;
  } else if(myRoles.has('cook')){
    personalHtml = `
        <div class="tt-personal cook">
          <div class="icon">${cookIcon}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.roleCook'))}</b><span>${escapeHtml(t('tercer.groupLabel', { letter: myGroup }))} · ${escapeHtml(match.label)}${noteExtra}</span></div>
          <div class="tt-personal-actions">
            ${hasPendingOutgoing ? '' : swapBtn}
          </div>
        </div>`;
  } else if(myRoles.has('clean')){
    personalHtml = `
        <div class="tt-personal clean">
          <div class="icon">${cleanIcon}</div>
          <div class="txt"><b>${escapeHtml(t('tercer.roleClean'))}</b><span>${escapeHtml(t('tercer.groupLabel', { letter: myGroup }))} · ${escapeHtml(match.label)}${noteExtra}</span></div>
          ${hasPendingOutgoing ? '' : swapBtn}
        </div>`;
  } else if(coveredAwayBy){
    personalHtml = `
        <div class="tt-personal none">
          <div class="txt"><b>${t('tercer.coveredByMsg', { name: escapeHtml(displayName(rosterById[coveredAwayBy.toPlayerId])) })}</b><span>${escapeHtml(t('tercer.groupLabel', { letter: myGroup }))} · ${escapeHtml(match.label)}</span></div>
        </div>`;
  } else if(hasPendingOutgoing){
    personalHtml = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.swapPendingConfirm'))}</b><span>${escapeHtml(t('tercer.groupLabel', { letter: myGroup }))} · ${escapeHtml(match.label)}</span></div>
        </div>`;
  } else {
    personalHtml = `
        <div class="tt-personal none">
          <div class="txt"><b>${escapeHtml(t('tercer.noGroup'))}</div>
        </div>`;
  }

  box.innerHTML = personalHtml + `
      <button class="tt-group-box" onclick="openThirdTimeGroupModal('${cookGroup}')">
        <div class="lbl">3r TEMPS</div>
        <div class="name">GRUP ${cookGroup}</div>
        <div class="hint">${escapeHtml(t('tercer.viewMembers'))}</div>
      </button>
    `;
}

function openThirdTimeGroupModal(groupLetter){
  const memberIds = thirdTimeGroups[groupLetter] || [];
  const current = thirdTimeActiveMatch();
  const matchLabel = current ? current.match.label : '';

  document.getElementById('tt-group-modal-title').textContent = t('tercer.groupLabel', { letter: groupLetter });
  document.getElementById('tt-group-modal-sub').textContent = matchLabel
    ? t('tercer.groupOrgWithMatch', { match: matchLabel })
    : t('tercer.groupOrg');

  const list = document.getElementById('tt-group-modal-list');
  list.innerHTML = memberIds.map(id => {
    const player = rosterById[id];
    if(!player) return '';
    const found = findFoodEntryForPlayer(id);
    const ready = !!found;
    const dishTxt = found ? `${found.category.emoji} ${found.entry.detail}` : t('tercer.notSignedUp');
    return `
        <div class="tt-roster-row${ready ? '' : ' pending'}">
          <span class="dot ${ready ? 'ready' : 'pending'}"></span>
          <div class="info"><b>${escapeHtml(displayName(player))}</b><span>${escapeHtml(player.pos)}</span></div>
          <div class="dish">${escapeHtml(dishTxt)}</div>
        </div>
      `;
  }).join('');

  document.getElementById('tt-group-modal').classList.add('active');
}
function closeThirdTimeGroupModal(){
  document.getElementById('tt-group-modal').classList.remove('active');
}

// --- Comida del tercer tiempo, por categorías con un número de huecos limitado ---
// Nota: a "Dulce" no le diste un límite concreto, así que le he puesto 3 huecos
// igual que la mayoría de categorías; dímelo si lo quieres distinto.
const foodCategories = [
  { key:'pasta',      label:'Pasta',              limit:3, emoji:'🍝' },
  { key:'arroz',      label:'Arroz / Legumbres',  limit:3, emoji:'🍚' },
  { key:'empanadas',  label:'Empanadas',          limit:2, emoji:'🥟' },
  { key:'tortilla',   label:'Tortilla',           limit:2, emoji:'🍳' },
  { key:'picar',      label:'Para picar',         limit:3, emoji:'🍟' },
  { key:'dulce',      label:'Dulce',              limit:3, emoji:'🍰' },
  { key:'otros',      label:'Otros',              limit:3, emoji:'🍽️' }
];
let thirdTimeFood = {};
foodCategories.forEach(c => thirdTimeFood[c.key] = []);
let foodModalCategory = null;

// Cada entrada de comida se guarda en la tabla "third_time_food" de Supabase (igual
// que multas y cambios de turno), para que apuntarse, marcar traído/no traído o
// quitarse se vea al momento desde cualquier cuenta.
function foodRowToLocal(row){
  const toLocalId = id => (id && id === currentAuthUserId) ? 'me' : id;
  return { id: row.id, category: row.category, detail: row.detail, playerId: toLocalId(row.player_id), status: row.status || null };
}

// Busca si una jugadora ya se ha apuntado a algo (en cualquier categoría) y qué es
function findFoodEntryForPlayer(playerId){
  for(const cat of foodCategories){
    const entries = thirdTimeFood[cat.key] || [];
    const idx = entries.findIndex(e => e.playerId === playerId);
    if(idx !== -1) return { category:cat, entry:entries[idx], index:idx };
  }
  return null;
}

// El día del tercer tiempo es el mismo día que el partido que marca el turno actual
function isThirdTimeDay(){
  const current = thirdTimeCurrentMatch();
  if(!current) return false;
  return attEventIso(current.match) === todayLocalIso();
}

// Recuento automático: el domingo del partido a las 22:00h, a quien le tocaba cocinar
// y se marcó con ✕ (no trajo lo prometido) o se quedó en amarillo (no se apuntó a nada)
// se le pone una multa de 7€ en Multas. Se comprueba que no se le haya puesto ya para
// este mismo partido, para no duplicarla si se repite la comprobación.
function checkThirdTimeAutoFines(){
  if(!isThirdTimeDay()) return;
  if(new Date().getHours() < 22) return;

  const current = thirdTimeCurrentMatch();
  if(!current) return;
  const { match, index } = current;
  const matchIso = attEventIso(match);
  // Se usan los miembros reales (ya ajustados por cambios de turno aceptados), no el
  // grupo fijo en bruto: quien haya sido cubierta no debe multarse, y quien haya
  // cubierto a otra sí responde por esa tarea
  const memberIds = thirdTimeEffectiveMembers('cook', match.id, index);

  let changed = false;
  memberIds.forEach(id => {
    const found = findFoodEntryForPlayer(id);
    // Se le pone multa si marcaron que no lo trajo (✕), o si nunca se apuntó a nada (amarillo)
    const shouldFine = found ? found.entry.status === 'missing' : true;
    if(!shouldFine) return;

    const alreadyFined = fines.some(f => f.playerId === id && f.reasonId === 'tercer' && f.autoMatchIso === matchIso);
    if(alreadyFined) return;

    const tempId = crypto.randomUUID();
    const newFine = { id:tempId, playerId:id, reasonId:'tercer', status:'pendiente', autoMatchIso:matchIso };
    fines.push(newFine);
    appBridge.multas.persistInsert(tempId, newFine);
    changed = true;
  });

  if(changed){
    appBridge.multas.refresh();
  }
}

async function loadThirdTimeFood(){
  const { data, error } = await supabaseClient.from('third_time_food').select('*').order('created_at', { ascending:true });
  if(error){ console.error('No se pudo cargar la lista de comida', error); return; }
  foodCategories.forEach(c => thirdTimeFood[c.key] = []);
  (data || []).forEach(row => {
    const local = foodRowToLocal(row);
    if(thirdTimeFood[local.category]) thirdTimeFood[local.category].push(local);
  });
  renderThirdTimeFood();
  checkThirdTimeAutoFines();
}

// Por si se deja la pestaña abierta y el reloj cruza las 22:00h, se vuelve a
// comprobar cada minuto si hay que poner alguna multa automática.
function initThirdTimeFood(){
  setInterval(checkThirdTimeAutoFines, 60000);
}

// Solo la persona de "Comi Tercer Temps" puede marcar traído/no traído (✓/✕), igual
// que solo Comi Tesoreria puede dar de alta multas nuevas.
function canManageThirdTimeFood(){
  const me = rosterById[currentUserId];
  return isAdmin || !!(me && me.comision === 'Comi Tercer Temps');
}

function renderThirdTimeFood(){
  const box = document.getElementById('tt-food-grid');
  if(!box) return;

  const supervising = isThirdTimeDay() && canManageThirdTimeFood();

  box.innerHTML = foodCategories.map(cat => {
    const entries = thirdTimeFood[cat.key] || [];
    const full = entries.length >= cat.limit;
    const slots = [];

    for(let i = 0; i < cat.limit; i++){
      const entry = entries[i];
      if(entry){
        const player = rosterById[entry.playerId];
        const mine = entry.playerId === currentUserId;
        const status = entry.status || null;
        const checkButtons = supervising ? `
              <button class="tt-food-check check${status === 'brought' ? ' on' : ''}" onclick="setFoodSlotStatus('${cat.key}', ${i}, 'brought')" title="${escapeHtml(t('tercer.broughtIt'))}">✓</button>
              <button class="tt-food-check cross${status === 'missing' ? ' on' : ''}" onclick="setFoodSlotStatus('${cat.key}', ${i}, 'missing')" title="${escapeHtml(t('tercer.didntBringIt'))}">✕</button>
          ` : '';
        // Para quien no es Comi Tercer Temps no hay botones, pero sí se ve el resultado:
        // un recuadro verde con ✓ o rojo con ✕ en cuanto Comi Tercer Temps lo marca.
        const statusBadge = !supervising && status
          ? `<span class="tt-food-status-badge ${status === 'brought' ? 'brought' : 'missing'}">${status === 'brought' ? '✓' : '✕'}</span>`
          : '';
        slots.push(`
            <div class="tt-food-slot${status === 'brought' ? ' brought' : ''}${status === 'missing' ? ' missing' : ''}">
              <span class="txt">${escapeHtml(entry.detail)} — ${escapeHtml(player ? displayName(player) : t('sharedLineup.someone'))}</span>
              <div class="tt-food-slot-actions">
                ${statusBadge}
                ${checkButtons}
                ${mine ? `<button class="del" onclick="removeFoodSlot('${cat.key}', ${i})" title="${escapeHtml(t('tercer.removeMe'))}">✕</button>` : ''}
              </div>
            </div>
          `);
      } else {
        slots.push(`
            <button class="tt-food-slot empty" onclick="openFoodSlotModal('${cat.key}')">
              <span class="plus">+</span><span>${escapeHtml(t('tercer.signMeUp'))}</span>
            </button>
          `);
      }
    }

    return `
        <div class="tt-food-cat">
          <div class="tt-food-cat-head">
            <b>${cat.emoji} ${escapeHtml(t('tercer.food.' + cat.key))}</b>
            <span class="tt-food-count${full ? ' full' : ''}">${entries.length}/${cat.limit}</span>
          </div>
          <div class="tt-food-slots">${slots.join('')}</div>
        </div>
      `;
  }).join('');
}

async function setFoodSlotStatus(catKey, index, status){
  if(!canManageThirdTimeFood()) return;
  const entries = thirdTimeFood[catKey];
  if(!entries || !entries[index]) return;
  const entry = entries[index];
  // Tocar el mismo botón otra vez quita la marca (vuelve a quedar por confirmar)
  entry.status = entry.status === status ? null : status;
  renderThirdTimeFood();
  const { error } = await supabaseClient.from('third_time_food').update({ status: entry.status }).eq('id', entry.id);
  if(error) alert(t('tercer.syncErrorApplied', { error: error.message }));
  checkThirdTimeAutoFines();
}

let foodModalTargetPlayerId = null;

function openFoodSlotModal(catKey){
  foodModalCategory = catKey;
  foodModalTargetPlayerId = currentUserId;

  const cat = foodCategories.find(c => c.key === catKey);
  document.getElementById('food-slot-modal-title').textContent = t('tercer.addToCategory', { category: cat ? t('tercer.food.' + cat.key) : '' });
  document.getElementById('food-slot-input').value = '';
  document.getElementById('food-slot-modal-sub').textContent = t('tercer.foodSubSelf');
  document.getElementById('food-slot-confirm-btn').textContent = t('tercer.signMeUp');

  // Selector de compañera, cerrado por defecto (se apunta una misma)
  document.getElementById('food-teammate-picker').style.display = 'none';
  document.querySelector('.food-modal-teammate-btn').classList.remove('active');
  const select = document.getElementById('food-teammate-select');
  select.innerHTML = roster.map(p => `<option value="${p.id}"${p.id === currentUserId ? ' selected' : ''}>${escapeHtml(displayName(p))}</option>`).join('');

  document.getElementById('food-slot-modal').classList.add('active');
}
function toggleFoodTeammatePicker(){
  const picker = document.getElementById('food-teammate-picker');
  const btn = document.querySelector('.food-modal-teammate-btn');
  const opening = picker.style.display === 'none';
  picker.style.display = opening ? 'block' : 'none';
  btn.classList.toggle('active', opening);

  if(!opening){
    // Al cerrar el selector, volvemos a apuntarnos a una misma
    foodModalTargetPlayerId = currentUserId;
    document.getElementById('food-teammate-select').value = currentUserId;
    updateFoodModalTargetTexts();
  }
}
function onFoodTeammateChange(playerId){
  foodModalTargetPlayerId = playerId;
  updateFoodModalTargetTexts();
}
function updateFoodModalTargetTexts(){
  const isMe = foodModalTargetPlayerId === currentUserId;
  const player = rosterById[foodModalTargetPlayerId];
  document.getElementById('food-slot-modal-sub').textContent = isMe
    ? t('tercer.foodSubSelf')
    : t('tercer.foodSubOther', { name: player ? displayName(player) : t('sharedLineup.someone') });
  document.getElementById('food-slot-confirm-btn').textContent = isMe ? t('tercer.signMeUp') : t('tercer.signHerUp');
}
function closeFoodSlotModal(){
  document.getElementById('food-slot-modal').classList.remove('active');
}
async function confirmFoodSlot(){
  const detail = document.getElementById('food-slot-input').value.trim();
  if(!detail){ alert(t('tercer.writeWhatBring')); return; }

  const cat = foodCategories.find(c => c.key === foodModalCategory);
  if(!cat) return;
  const entries = thirdTimeFood[cat.key];
  if(entries.length >= cat.limit){
    alert(t('tercer.noSlotsLeft'));
    closeFoodSlotModal();
    renderThirdTimeFood();
    return;
  }

  // Por defecto se apunta la propia jugadora logueada, pero si se eligió una
  // compañera desde el selector, el plato se le asigna a ella
  const playerId = foodModalTargetPlayerId || currentUserId;
  closeFoodSlotModal();

  const { data, error } = await supabaseClient
    .from('third_time_food')
    .insert({ category: cat.key, detail, player_id: toRemotePlayerId(playerId) })
    .select()
    .single();
  if(error){
    alert(t('tercer.saveError', { error: error.message }));
    renderThirdTimeFood();
    return;
  }
  entries.push({ id: data.id, category: cat.key, detail, playerId, status: null });
  renderThirdTimeFood();
}
async function removeFoodSlot(catKey, index){
  const entries = thirdTimeFood[catKey];
  if(!entries || !entries[index]) return;
  const entry = entries[index];
  entries.splice(index, 1);
  renderThirdTimeFood();
  const { error } = await supabaseClient.from('third_time_food').delete().eq('id', entry.id);
  if(error) alert(t('tercer.removeSyncError', { error: error.message }));
}
