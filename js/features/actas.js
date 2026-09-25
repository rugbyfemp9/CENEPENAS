// ---- Partido: acta del partido (PDF procesado por la función Edge con Gemini) ----
// Se guarda en Supabase (tabla "match_reports", id = id del evento) para que quede
// visible para todo el equipo, no solo en la sesión de quien la sube. Se cachea aquí
// para no ir a Supabase cada vez que se reabre la pantalla dentro de la misma sesión.
let matchReportsByEventId = {};
let matchReportRealtimeSubscribed = false;

// El acta la puede subir el mismo cuerpo técnico/directiva que gestiona los eventos
// (incluida Capitana: mismo permiso, no pasa por effectiveRoleForPermissions).
function canEditMatchReport(){
  return isAdmin || rolesWithEventManagement.includes(myProfile.rol);
}

async function loadMatchReport(eventId){
const { data: header, error: headerError } = await supabaseClient
  .from('match_reports')
  .select('*')
  .eq('id', eventId)
  .maybeSingle();

if(headerError){
  console.error('No se ha podido cargar el acta del partido', headerError);
  return;
}
if(!header){
  matchReportsByEventId[eventId] = null;
  if(currentPartidoId === eventId) renderMatchReport(eventId);
  return;
}

const { data: players, error: playersError } = await supabaseClient
  .from('match_report_players')
  .select('*, match_report_cards(*)')
  .eq('match_id', eventId)
  .order('jersey_number', { ascending: true });

if(playersError){
  console.error('No se han podido cargar las jugadoras del acta', playersError);
  return;
}

matchReportsByEventId[eventId] = {
  ...header,
  players: (players || []).map(p => ({
    ...p,
    cards: (p.match_report_cards || []).map(c => ({ type: c.card_type, minute: c.minute }))
  }))
};
if(currentPartidoId === eventId) renderMatchReport(eventId);
}

function subscribeToMatchReportRealtime(){
if(matchReportRealtimeSubscribed) return;
matchReportRealtimeSubscribed = true;
supabaseClient
  .channel('match-report-sync')
  .on('postgres_changes', { event:'*', schema:'public', table:'match_report_players' }, payload => {
    const eventId = (payload.new && payload.new.match_id) || (payload.old && payload.old.match_id);
    if(eventId) loadMatchReport(eventId);
    // Si tienes abierta la pestaña "Estadísticas" de Jugadoras, se refresca con el
    // nuevo acta sin necesidad de recargar la página.
    if(document.getElementById('sec-plantilla')?.classList.contains('active') && plantillaActiveTab === 'estadisticas'){
      loadPlantillaStats();
    }
    // Lo mismo con "Partidos jugados" en tu Perfil, si lo tienes abierto.
    if(document.getElementById('sec-perfil')?.classList.contains('active')){
      loadProfileMatchesPlayedStat();
    }
  })
  .subscribe();
}

// ---- Guardado del acta ----
// El cruce jugadora-perfil, el cálculo de puntos (ensayos/transformaciones/cops de
// càstig) y el guardado en "match_report_players" + "match_report_cards" los hace
// la función Edge "process-match-report-pdf" (server-side, con Gemini). Aquí solo
// se lee lo que ella ya ha persistido — ver loadMatchReport() más abajo.

function matchReportCardBadgeHtml(card){
  const cls = card.type === 'roja' ? 'bad' : (card.type === 'amarilla' ? 'warn' : 'info');
  const label = card.type === 'roja' ? t('partido.cardRed') : (card.type === 'amarilla' ? t('partido.cardYellow') : (card.type || t('partido.cardGeneric')));
  return `<span class="badge ${cls}">${escapeHtml(label)}${card.minute != null ? ' · ' + card.minute + "'" : ''}</span>`;
}

// Normaliza un nombre para poder compararlo (sin acentos, minúsculas, espacios
// simples), igual que hace la función Edge en el servidor.
function normalizeRosterName(s){
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Cruza cada jugadora del acta (ya filtrado a solo CNPN por la función Edge) con un
// perfil de la app registrado en `roster`. Orden de prioridad:
//   1) profile_id ya asignado por el servidor al procesar el PDF
//   2) coincidencia por número de licencia
//   3) coincidencia por nombre completo
// Si no se encuentra ninguna, la jugadora no tiene (todavía) cuenta en la app.
function findRosterMatchForReportPlayer(p){
  if(p.profile_id && rosterById[p.profile_id]) return rosterById[p.profile_id];

  if(p.license_number){
    const targetLicense = String(p.license_number).trim();
    const byLicense = roster.find(r => r.licencia && String(r.licencia).trim() === targetLicense);
    if(byLicense) return byLicense;
  }

  const targetName = normalizeRosterName(p.player_name);
  if(targetName){
    const byName = roster.find(r => normalizeRosterName(r.name) === targetName);
    if(byName) return byName;
  }

  return null;
}

 function matchReportPlayerRowHtml(p){
const matched = findRosterMatchForReportPlayer(p);
const displayName = matched ? matched.name : (p.player_name || t('partido.noName'));
const cardsHtml = (p.cards || []).map(matchReportCardBadgeHtml).join(' ');
return `
    <tr>
      <td class="num">${p.jersey_number != null ? p.jersey_number : '—'}</td>
      <td class="name">${escapeHtml(displayName)}${!matched ? ` <span class="muted" style="font-weight:400;">${escapeHtml(t('partido.noProfileInApp'))}</span>` : ''}</td>
      <td class="muted">${p.is_starter ? t('partido.starter') : t('partido.substitute')}</td>
      <td class="num">${p.minutes_played != null ? p.minutes_played : '—'}</td>
      <td class="num">${p.tries_count || '—'}</td>
      <td class="num">${p.conversions_count || '—'}</td>
      <td class="num">${p.penalties_count || '—'}</td>
      <td class="num">${p.points || '—'}</td>
      <td>${cardsHtml || '—'}</td>
    </tr>
  `;
}

function renderMatchReport(eventId){
  const box = document.getElementById('match-report-box');
  if(!box) return;
  const canEdit = canEditMatchReport();
  const uploadBtn = document.getElementById('match-report-upload-btn');
  const createBtn = document.getElementById('match-report-create-btn');
  const deleteBtn = document.getElementById('match-report-delete-btn');
  if(uploadBtn) uploadBtn.style.display = canEdit ? 'flex' : 'none';
  if(createBtn) createBtn.style.display = canEdit ? 'flex' : 'none';

  const report = matchReportsByEventId[eventId];
  const hasData = !!(report && report.players && report.players.length);
  if(deleteBtn) deleteBtn.style.display = (canEdit && hasData) ? 'flex' : 'none';

  if(!hasData){
    box.innerHTML = `
        <div class="gym-routine-empty">
          <p>${escapeHtml(t('partido.noActaYet'))}</p>
          ${canEdit ? `
            <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
              <button class="btn" onclick="openMatchReportUploadModal()">${escapeHtml(t('partido.uploadPdf'))}</button>
              <button class="btn-ghost" onclick="openMatchReportBuilderModal()">${escapeHtml(t('partido.createManual'))}</button>
            </div>
          ` : ''}
        </div>
      `;
    return;
  }

  // Titulares primero, después suplentes; dentro de cada grupo, por dorsal.
  const players = [...report.players].sort((a, b) => {
  if (!!a.is_starter !== !!b.is_starter) return a.is_starter ? -1 : 1;
  return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
  });

  box.innerHTML = `
      ${report.match_duration_estimated ? `<div class="gym-split-note" style="margin-bottom:12px;"><span class="dot"></span> ${escapeHtml(t('partido.durationAssumed'))}</div>` : ''}
      <div style="overflow-x:auto;">
        <table class="gym-exercise-table">
          <thead>
           <tr>
            <th>${escapeHtml(t('partido.colNum'))}</th>
            <th>${escapeHtml(t('partido.colPlayerUpper'))}</th>
            <th>${escapeHtml(t('partido.colState'))}</th>
            <th>${escapeHtml(t('partido.colMin'))}</th>
            <th>A</th>
            <th>T</th>
            <th>CC</th>
            <th>${escapeHtml(t('partido.colPoints'))}</th>
            <th>${escapeHtml(t('partido.colCardsUpper'))}</th>
          </tr>
          </thead>
          <tbody>${players.map(matchReportPlayerRowHtml).join('')}</tbody>
        </table>
      </div>
    `;
}

function openMatchReportUploadModal(){
  document.getElementById('match-report-pdf-input').value = '';
  document.getElementById('match-report-upload-status').textContent = '';
  document.getElementById('match-report-upload-modal').classList.add('active');
}
function closeMatchReportUploadModal(){
  document.getElementById('match-report-upload-modal').classList.remove('active');
}

async function uploadMatchReportPdf(){
const fileInput = document.getElementById('match-report-pdf-input');
const statusBox = document.getElementById('match-report-upload-status');
const submitBtn = document.getElementById('match-report-upload-submit-btn');
const cancelBtn = document.getElementById('match-report-upload-cancel-btn');
const file = fileInput.files && fileInput.files[0];

if(!file){
  statusBox.textContent = 'Elige primero un archivo PDF.';
  statusBox.style.color = 'var(--bad)';
  return;
}
if(!currentPartidoId){
  statusBox.textContent = 'No se ha podido identificar el partido.';
  statusBox.style.color = 'var(--bad)';
  return;
}

submitBtn.disabled = true;
cancelBtn.disabled = true;
statusBox.style.color = 'var(--text-muted)';
statusBox.textContent = 'Subiendo y leyendo el acta con Gemini… puede tardar unos segundos.';

try{
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : null;
  if(!accessToken){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = 'Tu sesión ha caducado, vuelve a iniciar sesión e inténtalo de nuevo.';
    return;
  }

  const form = new FormData();
  form.append('pdf', file);
  form.append('match_id', currentPartidoId);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/process-match-report-pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  const result = await res.json();

  if(!res.ok || result.error){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = result.error || 'No se ha podido procesar el acta.';
    return;
  }

  await loadMatchReport(currentPartidoId);
  statusBox.style.color = 'var(--ok)';
  const aviso = result.unmatchedOwnTeamNames && result.unmatchedOwnTeamNames.length
    ? ` (${result.unmatchedOwnTeamNames.length} jugadora/s no identificadas: revísalas)`
    : '';
  statusBox.textContent = `¡Acta cargada! (${result.playersMatched}/${result.playersProcessed} jugadoras cruzadas)${aviso} Cerrando…`;
  setTimeout(closeMatchReportUploadModal, 1200);
}catch(e){
  statusBox.style.color = 'var(--bad)';
  statusBox.textContent = 'Error al subir el acta: ' + e.message;
}finally{
  submitBtn.disabled = false;
  cancelBtn.disabled = false;
}
}

// ---- Crear/editar acta a mano (alternativa a subir el PDF) ----
// Se guarda exactamente en las mismas tablas que usa la función Edge
// ("match_reports", "match_report_players", "match_report_cards"), así que el
// resultado se ve igual en la tabla del acta y cuenta igual en "Jugadoras" →
// Estadísticas. Igual que al subir un PDF nuevo, guardar sustituye por completo
// lo que hubiera antes para este partido (no se suma a lo anterior).
let actaBuilderRows = [];

function emptyActaBuilderRow(){
  return { jerseyNumber:'', playerId:'', entryMinute:0, exitMinute:80, tries:0, conversions:0, penalties:0, cards:[] };
}

function openMatchReportBuilderModal(){
  const existing = matchReportsByEventId[currentPartidoId];
  if(existing && existing.players && existing.players.length){
    // Se precarga con lo que ya había, para poder corregirlo sin partir de cero.
    // El minuto de entrada/salida no se guarda tal cual en la base de datos (solo
    // los minutos totales jugados), así que aquí se reconstruye de forma razonable:
    // titular → entra en el 0; suplente → se asume que jugó hasta el final.
    actaBuilderRows = existing.players.map(p => {
      const isStarter = !!p.is_starter;
      const minutesPlayed = p.minutes_played != null ? p.minutes_played : 80;
      return {
        jerseyNumber: p.jersey_number ?? '',
        playerId: p.profile_id || '',
        entryMinute: isStarter ? 0 : Math.max(0, 80 - minutesPlayed),
        exitMinute: isStarter ? Math.min(80, minutesPlayed) : 80,
        tries: p.tries_count || 0,
        conversions: p.conversions_count || 0,
        penalties: p.penalties_count || 0,
        cards: (p.cards || []).map(c => ({ type:c.type, minute:c.minute }))
      };
    });
  } else {
    actaBuilderRows = [emptyActaBuilderRow()];
  }
  document.getElementById('acta-builder-status').textContent = '';
  renderActaBuilderRows();
  document.getElementById('match-report-builder-modal').classList.add('active');
}
function closeMatchReportBuilderModal(){
  document.getElementById('match-report-builder-modal').classList.remove('active');
}

function actaBuilderCardHtml(rowIndex, card, cardIndex){
  return `
      <span style="display:inline-flex; align-items:center; gap:3px; background:var(--bg-soft,#eef2f6); border-radius:6px; padding:2px 4px;">
        <select style="font-size:11px; padding:1px; border-radius:4px;" onchange="updateActaBuilderCard(${rowIndex}, ${cardIndex}, 'type', this.value)">
          <option value="amarilla" ${card.type === 'amarilla' ? 'selected' : ''}>Amarilla</option>
          <option value="roja" ${card.type === 'roja' ? 'selected' : ''}>Roja</option>
        </select>
        <input type="number" min="0" max="80" placeholder="min" value="${card.minute ?? ''}" style="width:38px; font-size:11px;" oninput="updateActaBuilderCard(${rowIndex}, ${cardIndex}, 'minute', this.value)">
        <button type="button" onclick="removeActaBuilderCard(${rowIndex}, ${cardIndex})" style="border:none; background:none; cursor:pointer; color:var(--bad); font-weight:700; padding:0 2px;">✕</button>
      </span>
    `;
}
function actaBuilderRowHtml(row, i){
  const playerOptions = roster.map(p => `<option value="${p.id}" ${row.playerId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
  const cardsHtml = row.cards.map((c, ci) => actaBuilderCardHtml(i, c, ci)).join('');
  return `
      <tr>
        <td><input type="number" min="0" max="99" value="${row.jerseyNumber}" style="width:52px;" oninput="updateActaBuilderRow(${i}, 'jerseyNumber', this.value)"></td>
        <td><select style="min-width:150px;" onchange="updateActaBuilderRow(${i}, 'playerId', this.value)"><option value="">Elegir…</option>${playerOptions}</select></td>
        <td><input type="number" min="0" max="80" value="${row.entryMinute}" style="width:56px;" oninput="updateActaBuilderRow(${i}, 'entryMinute', this.value)"></td>
        <td><input type="number" min="0" max="80" value="${row.exitMinute}" style="width:56px;" oninput="updateActaBuilderRow(${i}, 'exitMinute', this.value)"></td>
        <td><input type="number" min="0" value="${row.tries}" style="width:44px;" oninput="updateActaBuilderRow(${i}, 'tries', this.value)"></td>
        <td><input type="number" min="0" value="${row.conversions}" style="width:44px;" oninput="updateActaBuilderRow(${i}, 'conversions', this.value)"></td>
        <td><input type="number" min="0" value="${row.penalties}" style="width:44px;" oninput="updateActaBuilderRow(${i}, 'penalties', this.value)"></td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; min-width:130px;">
            ${cardsHtml}
            <button type="button" class="btn-ghost" style="padding:2px 8px; font-size:11px;" onclick="addActaBuilderCard(${i})">+ tarjeta</button>
          </div>
        </td>
        <td><button type="button" onclick="removeActaBuilderRow(${i})" title="Quitar jugadora" style="border:none; background:none; cursor:pointer; color:var(--bad); font-weight:700; font-size:14px; padding:2px 6px;">✕</button></td>
      </tr>
    `;
}
function renderActaBuilderRows(){
  document.getElementById('acta-builder-rows').innerHTML = actaBuilderRows.map(actaBuilderRowHtml).join('');
}
function addActaBuilderRow(){
  actaBuilderRows.push(emptyActaBuilderRow());
  renderActaBuilderRows();
}
function removeActaBuilderRow(i){
  actaBuilderRows.splice(i, 1);
  renderActaBuilderRows();
}
function updateActaBuilderRow(i, field, value){
  const row = actaBuilderRows[i];
  if(!row) return;
  if(field === 'playerId'){
    row.playerId = value;
  } else if(field === 'jerseyNumber'){
    row.jerseyNumber = value === '' ? '' : parseInt(value, 10);
  } else {
    row[field] = value === '' ? 0 : parseInt(value, 10);
  }
}
function addActaBuilderCard(i){
  const row = actaBuilderRows[i];
  if(!row) return;
  row.cards.push({ type:'amarilla', minute:null });
  renderActaBuilderRows();
}
function updateActaBuilderCard(i, ci, field, value){
  const card = actaBuilderRows[i] && actaBuilderRows[i].cards[ci];
  if(!card) return;
  card[field] = field === 'minute' ? (value === '' ? null : parseInt(value, 10)) : value;
}
function removeActaBuilderCard(i, ci){
  actaBuilderRows[i].cards.splice(ci, 1);
  renderActaBuilderRows();
}

async function saveActaBuilder(){
  const statusBox = document.getElementById('acta-builder-status');
  const saveBtn = document.getElementById('acta-builder-save-btn');
  const cancelBtn = document.getElementById('acta-builder-cancel-btn');

  const validRows = actaBuilderRows.filter(r => r.playerId);
  if(validRows.length === 0){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = 'Añade al menos una jugadora y elige su nombre.';
    return;
  }
  if(!currentPartidoId){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = 'No se ha podido identificar el partido.';
    return;
  }

  saveBtn.disabled = true;
  cancelBtn.disabled = true;
  statusBox.style.color = 'var(--text-muted)';
  statusBox.textContent = 'Guardando acta…';

  try{
    const { error: headerError } = await supabaseClient.from('match_reports').upsert({
      id: currentPartidoId,
      match_duration_minutes: 80,
      match_duration_estimated: false,
      updated_at: new Date().toISOString()
    });
    if(headerError) throw new Error(headerError.message);

    // Se sustituye entera: se borran antes las jugadoras (y sus tarjetas) que
    // hubiera ya guardadas de este mismo partido, igual que hace la función Edge
    // al procesar un PDF, para que nunca se sumen datos de dos actas distintas.
    const { data: oldPlayers, error: oldPlayersError } = await supabaseClient
      .from('match_report_players').select('id').eq('match_id', currentPartidoId);
    if(oldPlayersError) throw new Error(oldPlayersError.message);
    const oldIds = (oldPlayers || []).map(p => p.id);
    if(oldIds.length){
      const { error: delCardsError } = await supabaseClient.from('match_report_cards').delete().in('match_report_player_id', oldIds);
      if(delCardsError) throw new Error(delCardsError.message);
    }
    const { error: delPlayersError } = await supabaseClient.from('match_report_players').delete().eq('match_id', currentPartidoId);
    if(delPlayersError) throw new Error(delPlayersError.message);

    const rowsToInsert = validRows.map(r => {
      const player = rosterById[r.playerId];
      const entry = Math.max(0, Math.min(80, Number(r.entryMinute) || 0));
      const exit = Math.max(0, Math.min(80, Number(r.exitMinute) || 0));
      return {
        match_id: currentPartidoId,
        profile_id: toRemotePlayerId(r.playerId),
        is_own_team: true,
        jersey_number: r.jerseyNumber === '' ? null : r.jerseyNumber,
        player_name: player ? player.name : null,
        license_number: player ? (player.licencia || null) : null,
        is_starter: entry === 0,
        minutes_played: Math.max(0, exit - entry),
        tries_count: Number(r.tries) || 0,
        conversions_count: Number(r.conversions) || 0,
        penalties_count: Number(r.penalties) || 0,
        points: (Number(r.tries) || 0) * 5 + (Number(r.conversions) || 0) * 2 + (Number(r.penalties) || 0) * 3,
        _cards: (r.cards || []).filter(c => c.minute !== null && c.minute !== '')
      };
    });

    const { data: inserted, error: insertError } = await supabaseClient
      .from('match_report_players')
      .insert(rowsToInsert.map(({ _cards, ...row }) => row))
      .select('id');
    if(insertError) throw new Error(insertError.message);

    const cardRows = (inserted || []).flatMap((row, i) =>
      (rowsToInsert[i]._cards || []).map(c => ({
        match_report_player_id: row.id,
        card_type: c.type,
        minute: c.minute
      }))
    );
    if(cardRows.length){
      const { error: cardsError } = await supabaseClient.from('match_report_cards').insert(cardRows);
      if(cardsError) throw new Error(cardsError.message);
    }

    await loadMatchReport(currentPartidoId);
    statusBox.style.color = 'var(--ok)';
    statusBox.textContent = '¡Acta guardada!';
    setTimeout(closeMatchReportBuilderModal, 900);
  }catch(e){
    statusBox.style.color = 'var(--bad)';
    statusBox.textContent = 'No se ha podido guardar: ' + e.message;
  }finally{
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

// ---- Eliminar el acta entera (jugadoras + tarjetas + cabecera) ----
async function deleteMatchReport(){
  if(!currentPartidoId) return;
  if(!confirm('¿Seguro que quieres borrar el acta de este partido? Se perderán todos los datos: jugadoras, minutos, puntos y tarjetas.')) return;

  try{
    const { data: oldPlayers, error: oldPlayersError } = await supabaseClient
      .from('match_report_players').select('id').eq('match_id', currentPartidoId);
    if(oldPlayersError) throw new Error(oldPlayersError.message);
    const oldIds = (oldPlayers || []).map(p => p.id);
    if(oldIds.length){
      const { error: delCardsError } = await supabaseClient.from('match_report_cards').delete().in('match_report_player_id', oldIds);
      if(delCardsError) throw new Error(delCardsError.message);
    }
    const { error: delPlayersError } = await supabaseClient.from('match_report_players').delete().eq('match_id', currentPartidoId);
    if(delPlayersError) throw new Error(delPlayersError.message);
    const { error: delHeaderError } = await supabaseClient.from('match_reports').delete().eq('id', currentPartidoId);
    if(delHeaderError) throw new Error(delHeaderError.message);

    await loadMatchReport(currentPartidoId);
  }catch(e){
    alert('No se ha podido borrar el acta: ' + e.message);
  }
}
