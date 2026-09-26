// ---- Banner "Próximo partido" (cabecera de Inicio) ----
function renderNextMatchBanner(){
  const banner = document.getElementById('next-match-banner');
  if(!banner) return;

  const todayIso = todayLocalIso();
  const nextMatch = attEvents
    .filter(ev => attEventType(ev) === 'match' && attEventIso(ev) >= todayIso)
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)))[0];

  const titleEl = document.getElementById('next-match-title');
  const subtitleEl = document.getElementById('next-match-subtitle');
  const confirmedEl = document.getElementById('next-match-confirmed');
  const chipsEl = document.getElementById('next-match-chips');
  const ctaBtn = document.getElementById('next-match-cta');
  const statusEl = document.getElementById('next-match-status');
  const gameDayActionsEl = document.getElementById('game-day-actions');
  const tullidesBtn = document.getElementById('next-match-tullides-btn');

  if(!nextMatch){
    titleEl.textContent = t('nextMatch.title');
    titleEl.classList.remove('game-day');
    subtitleEl.textContent = t('nextMatch.subtitleNone');
    confirmedEl.textContent = '—';
    chipsEl.style.display = '';
    ctaBtn.style.display = 'none';
    statusEl.style.display = 'none';
    gameDayActionsEl.style.display = 'none';
    tullidesBtn.style.display = 'none';
    return;
  }

  tullidesBtn.style.display = '';
  nextMatchTullidesEventId = nextMatch.id;

  const isGameDay = attEventIso(nextMatch) === todayIso;
  titleEl.textContent = isGameDay ? nextMatch.label : t('nextMatch.title');
  titleEl.classList.toggle('game-day', isGameDay);
  subtitleEl.textContent = isGameDay ? nextMatch.when : `${nextMatch.label} · ${nextMatch.when}`;
  confirmedEl.textContent = Object.values(nextMatch.attendance).filter(s => s === 'yes').length;

  if(isGameDay){
    chipsEl.style.display = 'none';
    ctaBtn.style.display = 'none';
    statusEl.style.display = 'none';
    gameDayActionsEl.style.display = '';
    matchdayChecklistCurrentMatchId = nextMatch.id;
    return;
  }
  gameDayActionsEl.style.display = 'none';
  chipsEl.style.display = '';

  const myStatus = nextMatch.attendance.me;
  if(myStatus === 'yes'){
    ctaBtn.style.display = 'none';
    statusEl.style.display = '';
    statusEl.textContent = t('nextMatch.statusConfirmed');
    statusEl.className = 'scoreboard-status ok';
  } else if(myStatus === 'no'){
    ctaBtn.style.display = 'none';
    statusEl.style.display = '';
    statusEl.textContent = t('nextMatch.statusRejected');
    statusEl.className = 'scoreboard-status bad';
  } else {
    statusEl.style.display = 'none';
    ctaBtn.style.display = '';
    ctaBtn.textContent = t('nextMatch.confirmCta');
    ctaBtn.onclick = () => openEventDetail(nextMatch.id);
  }
}
// ---- Nota "Recuerda": qué llevar al partido (checklist personal, banner de Inicio) ----
// Privada de verdad: se guarda en Supabase con tu owner_id (política de seguridad propia,
// como en Fantasy), así que solo tú la ves y solo tú la editas, pero te sigue a cualquier
// dispositivo en el que inicies sesión.
const MATCHDAY_CHECKLIST_DEFAULTS = [
  'Botes tacos', 'Mijetes', 'Hombreres', 'Pantalons equipció', 'Leggins o samarreta interior',
  'Roba Interior', 'Bucal', 'Sabo o coses per a la ducha', 'Roba pa cambiarse', 'Toalla', 'Hawaiana'
];
let matchdayChecklistItems = [];
let matchdayChecklistLoaded = false;
// Id del partido "de hoy" (lo fija renderNextMatchBanner cuando toca jugar). Se usa
// solo para decidir si hay que desmarcar todas las casillas al abrir la lista: los
// propios elementos de la lista nunca dependen de esto, se quedan siempre.
let matchdayChecklistCurrentMatchId = null;

// Carga tus elementos guardados (o te crea la lista básica de partida la primera vez),
// y si ha llegado un partido nuevo desde la última vez, desmarca todas las casillas.
async function loadMatchdayChecklist(){
  if(!currentAuthUserId) return;

  const { data: items, error: itemsError } = await supabaseClient
    .from('matchday_checklist_items')
    .select('id, label, checked, created_at')
    .eq('owner_id', currentAuthUserId)
    .order('created_at', { ascending: true });

  if(itemsError){
    console.error('No se ha podido cargar la lista de qué llevar', itemsError);
    return;
  }

  if(!items || items.length === 0){
    // Primera vez que abres la lista: la sembramos con los básicos, para no empezar
    // de una lista vacía. A partir de aquí son elementos normales, se pueden borrar.
    const defaultRows = MATCHDAY_CHECKLIST_DEFAULTS.map(label => ({ owner_id: currentAuthUserId, label, checked: false }));
    const { data: inserted, error: seedError } = await supabaseClient
      .from('matchday_checklist_items')
      .insert(defaultRows)
      .select('id, label, checked, created_at');
    if(seedError){
      console.error('No se ha podido crear la lista inicial de qué llevar', seedError);
      matchdayChecklistItems = [];
    } else {
      matchdayChecklistItems = inserted || [];
    }
  } else {
    matchdayChecklistItems = items;
  }

  // Si estamos en día de partido y es distinto del último partido para el que
  // marcamos casillas, las desmarcamos todas ahora (una sola vez por partido nuevo).
  if(matchdayChecklistCurrentMatchId){
    const { data: state } = await supabaseClient
      .from('matchday_checklist_state')
      .select('last_match_id')
      .eq('owner_id', currentAuthUserId)
      .maybeSingle();

    if(!state || state.last_match_id !== matchdayChecklistCurrentMatchId){
      if(matchdayChecklistItems.some(i => i.checked)){
        await supabaseClient
          .from('matchday_checklist_items')
          .update({ checked: false })
          .eq('owner_id', currentAuthUserId);
        matchdayChecklistItems.forEach(i => i.checked = false);
      }
      await supabaseClient
        .from('matchday_checklist_state')
        .upsert({ owner_id: currentAuthUserId, last_match_id: matchdayChecklistCurrentMatchId });
    }
  }

  matchdayChecklistLoaded = true;
}

function renderMatchdayChecklist(){
  const box = document.getElementById('matchday-checklist-list');
  if(!box) return;
  const addRowHtml = `
      <div class="shopping-item-add">
        <button type="button" onclick="addMatchdayChecklistItem()" aria-label="Añadir">+</button>
        <input type="text" id="matchday-checklist-input" placeholder="Añadir algo más…" onkeydown="if(event.key==='Enter'){ event.preventDefault(); addMatchdayChecklistItem(); }">
      </div>
    `;
  if(matchdayChecklistItems.length === 0){
    box.innerHTML = '<div class="shopping-empty">No hay nada en la lista. Añade lo que necesites llevar 👇</div>' + addRowHtml;
    return;
  }
  box.innerHTML = matchdayChecklistItems.map(item => `
      <label class="shopping-item ${item.checked ? 'checked' : ''}">
        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleMatchdayChecklistItem('${item.id}')">
        <span class="shopping-item-label">${escapeHtml(item.label)}</span>
        <button type="button" class="shopping-item-del" onclick="event.preventDefault(); deleteMatchdayChecklistItem('${item.id}')" aria-label="Eliminar" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
        </button>
      </label>
    `).join('') + addRowHtml;
}
async function addMatchdayChecklistItem(){
  const input = document.getElementById('matchday-checklist-input');
  const label = input.value.trim();
  if(!label) return;
  input.value = '';

  const { data, error } = await supabaseClient
    .from('matchday_checklist_items')
    .insert({ owner_id: currentAuthUserId, label, checked: false })
    .select('id, label, checked, created_at')
    .single();

  if(error){
    console.error('No se ha podido añadir el elemento', error);
    alert('No se ha podido añadir. Inténtalo de nuevo.');
    return;
  }
  matchdayChecklistItems.push(data);
  renderMatchdayChecklist();
}
async function toggleMatchdayChecklistItem(id){
  const item = matchdayChecklistItems.find(i => i.id === id);
  if(!item) return;
  item.checked = !item.checked;
  renderMatchdayChecklist();

  const { error } = await supabaseClient
    .from('matchday_checklist_items')
    .update({ checked: item.checked })
    .eq('id', id);
  if(error){
    console.error('No se ha podido guardar la casilla', error);
    item.checked = !item.checked; // revertimos si no se ha podido guardar
    renderMatchdayChecklist();
  }
}
async function deleteMatchdayChecklistItem(id){
  matchdayChecklistItems = matchdayChecklistItems.filter(i => i.id !== id);
  renderMatchdayChecklist();

  const { error } = await supabaseClient.from('matchday_checklist_items').delete().eq('id', id);
  if(error) console.error('No se ha podido borrar el elemento', error);
}
async function openMatchdayChecklistModal(){
  const box = document.getElementById('matchday-checklist-list');
  if(box) box.innerHTML = '<div class="shopping-empty">Cargando…</div>';
  document.getElementById('matchday-checklist-modal').classList.add('active');
  await loadMatchdayChecklist();
  renderMatchdayChecklist();
}
function closeMatchdayChecklistModal(){
  document.getElementById('matchday-checklist-modal').classList.remove('active');
}

// ---- "Lista": pasar lista de convocatoria el día de partido ----
let matchdayRollCall = {}; // { matchId: { playerId: 'v' | 'x' } } — estado en memoria mientras se edita
let matchdayRollCallSavedAt = {}; // { matchId: isoString | null } — se rellena al cargar desde Supabase
let rollCallMatchId = null;

// Trae el estado guardado de la Lista para el próximo partido. Si ya se guardó una vez
// (saved_at con valor) y quien abre no es Comi Tesoreria, se bloquea: no se puede volver
// a pasar lista por libre, solo Comi Tesoreria puede corregirla.
async function openRollCallModal(){
  const todayIso = todayLocalIso();
  const nextMatch = attEvents
    .filter(ev => attEventType(ev) === 'match' && attEventIso(ev) >= todayIso)
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)))[0];
  if(!nextMatch) return;
  rollCallMatchId = nextMatch.id;

  const { data, error } = await supabaseClient
    .from('matchday_rollcall')
    .select('marks, saved_at')
    .eq('match_id', rollCallMatchId)
    .maybeSingle();
  if(error) console.error('No se ha podido cargar la Lista guardada', error);

  const savedAt = data ? data.saved_at : null;
  matchdayRollCallSavedAt[rollCallMatchId] = savedAt;

  if(savedAt && !appBridge.multas.canManage()){
    alert('Esta lista ya se ha pasado y guardado. Solo Comi Tesoreria puede volver a abrirla para corregirla.');
    return;
  }

  matchdayRollCall[rollCallMatchId] = (data && data.marks) ? { ...data.marks } : {};
  renderRollCallList();
  document.getElementById('rollcall-modal').classList.add('active');
}
function closeRollCallModal(){
  document.getElementById('rollcall-modal').classList.remove('active');
}
function renderRollCallList(){
  const box = document.getElementById('rollcall-list');
  const summaryEl = document.getElementById('rollcall-summary');
  if(!box || !rollCallMatchId) return;
  const match = attEvents.find(e => e.id === rollCallMatchId);
  if(!match) return;
  const confirmedIds = Object.entries(match.attendance).filter(([id, s]) => s === 'yes').map(([id]) => id);
  const state = matchdayRollCall[rollCallMatchId] || {};

  if(confirmedIds.length === 0){
    box.innerHTML = '<div class="shopping-empty">Todavía no hay ninguna jugadora confirmada para este partido.</div>';
    summaryEl.textContent = '';
    return;
  }

  box.innerHTML = confirmedIds.map(id => {
    const player = rosterById[id];
    if(!player) return '';
    const mark = state[id];
    return `
        <div class="rollcall-row">
          <span class="avatar">${avatarHtml(player.avatarUrl, initials(displayName(player)), player.injured, player.injuryIcon)}</span>
          <div class="meta"><b>${escapeHtml(displayName(player))}</b></div>
          <div class="rollcall-toggle">
            <button type="button" class="v ${mark === 'v' ? 'is-active' : ''}" onclick="setRollCallMark('${id}','v')" aria-label="Presente" title="Presente">✓</button>
            <button type="button" class="x ${mark === 'x' ? 'is-active' : ''}" onclick="setRollCallMark('${id}','x')" aria-label="Falta o llega tarde" title="Falta o llega tarde">✕</button>
          </div>
        </div>
      `;
  }).join('');

  const marked = Object.values(state).filter(Boolean).length;
  summaryEl.textContent = `${marked} de ${confirmedIds.length} marcadas`;
}
function setRollCallMark(playerId, mark){
  const state = matchdayRollCall[rollCallMatchId];
  if(!state) return;
  state[playerId] = state[playerId] === mark ? undefined : mark; // repetir = deshacer
  renderRollCallList();
}
  // Al guardar: cada jugadora marcada con ✕ recibe automáticamente una multa de
// "Retraso" (si no la tenía ya para este partido). Y si alguien que estaba en ✕ pasa
// ahora a ✓ (o se desmarca), se le quita esa multa automática — siempre que siga
// pendiente de pago; una que ya se pagó no se toca. El estado se guarda en Supabase:
// la primera vez fija saved_at, que a partir de ahí bloquea la lista para quien no sea
// Comi Tesoreria (ver openRollCallModal).
async function saveRollCall(){
  const match = attEvents.find(e => e.id === rollCallMatchId);
  if(!match){ closeRollCallModal(); return; }
  const matchIso = attEventIso(match);
  const state = matchdayRollCall[rollCallMatchId] || {};

  let changed = false;

  // 1) Añadir multa a quien ahora está en ✕ y todavía no la tenía para este partido.
  //    Se espera (await) cada alta antes de seguir: así, si justo después tocara
  //    quitarla (paso 2), el id local ya es el real de Supabase y no queda a medias.
  for(const [playerId, mark] of Object.entries(state)){
    if(mark !== 'x') continue;
    const alreadyFined = fines.some(f => f.playerId === playerId && f.reasonId === 'retraso' && f.autoMatchIso === matchIso);
    if(alreadyFined) continue;
    const tempId = crypto.randomUUID();
    const newFine = { id:tempId, playerId, reasonId:'retraso', status:'pendiente', autoMatchIso:matchIso };
    fines.push(newFine);
    await appBridge.multas.persistInsert(tempId, newFine);
    changed = true;
  }

  // 2) Quitar la multa automática a quien ya no está en ✕ (ha pasado a ✓ o se ha
  //    desmarcado), solo si esa multa sigue pendiente de pago. IMPORTANTE: se borra en
  //    Supabase por jugadora + motivo + partido (no por el id local), porque ese id
  //    puede ser todavía temporal si la inserción tardó en confirmarse; borrando por
  //    estos criterios se elimina la fila real siempre, y de paso se limpia cualquier
  //    duplicado que hubiera quedado suelto de antes de este arreglo.
  const autoFinesForMatch = fines.filter(f => f.reasonId === 'retraso' && f.autoMatchIso === matchIso && f.status === 'pendiente');
  for(const f of autoFinesForMatch){
    if(state[f.playerId] === 'x') continue; // sigue marcada, se queda
    fines = fines.filter(fx => fx.id !== f.id);
    const { data, error } = await supabaseClient
      .from('fines')
      .delete()
      .eq('reason_id', 'retraso')
      .eq('auto_match_iso', matchIso)
      .eq('status', 'pendiente')
      .eq('player_id', toRemotePlayerId(f.playerId))
      .select();
    if(error){
      console.error('No se ha podido quitar la multa automática', error);
    }else if(!data || data.length === 0){
      // 0 filas borradas sin error suele ser una política de RLS bloqueando el borrado.
      console.error('La multa automática no se ha borrado en Supabase (revisa permisos de borrado en "fines").');
      appBridge.multas.load();
    }
    changed = true;
  }

  if(changed){
    appBridge.multas.refresh();
  }

  // La primera vez que se guarda fija saved_at; las siguientes veces se mantiene ese
  // mismo valor original (solo cambian las marcas), para que la lista siga "bloqueada".
  const savedAt = matchdayRollCallSavedAt[rollCallMatchId] || new Date().toISOString();
  matchdayRollCallSavedAt[rollCallMatchId] = savedAt;

  const { error } = await supabaseClient.from('matchday_rollcall').upsert({
    match_id: rollCallMatchId,
    marks: state,
    saved_at: savedAt,
    updated_at: new Date().toISOString()
  });
  if(error){
    alert('La lista se ha guardado en la app, pero no se ha podido sincronizar: ' + error.message);
  }

  closeRollCallModal();
}

function goToNextMatch(){
  const todayIso = todayLocalIso();
  const nextMatch = attEvents
    .filter(ev => attEventType(ev) === 'match' && attEventIso(ev) >= todayIso)
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)))[0];
  if(nextMatch) openEventDetail(nextMatch.id);
}

// Vestuario → Partidos: una tarjeta por cada partido que haya en Eventos (mismo
// origen que Asistencia/Calendario), sin filtrar por fecha. Usa el mismo aspecto que
// la tarjeta de Asistencia (con RSVP), pero al tocarla abre la pantalla propia de
// Partidos en vez del detalle de Asistencia.
function partidoCardHtml(ev){
  return `
      <div class="att-event att-event--match" onclick="openPartidoDetail('${ev.id}')">
        <div class="left">
          <div class="cal-date"><div class="d">${ev.date}</div><div class="m">${monthAbbrLabel(ev.month)}</div></div>
          <div class="info">
            <b>${ev.label}</b>
            <span>${escapeHtml(eventWhenDisplay(ev))}</span>
          </div>
        </div>
      </div>
    `;
}
function renderPartidosList(){
  const box = document.getElementById('partidos-list');
  if(!box) return;

  const matches = attEvents
    .filter(ev => attEventType(ev) === 'match')
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)));

  if(!matches.length){
    box.innerHTML = `<div class="att-roster-empty">${t('att.noMatchesScheduled')}</div>`;
    return;
  }
  box.innerHTML = matches.map(partidoCardHtml).join('');
}

// Pantalla propia de un partido: de momento solo el acta (licencias, titulares/
// suplentes, cambios y minutos, ensayos/transformaciones y tarjetas), leída del PDF
// con la función Edge "process-match-report-pdf".
let currentPartidoId = null;
function openPartidoDetail(eventId){
  currentPartidoId = eventId;
  const ev = attEvents.find(e => e.id === eventId);
  document.getElementById('partido-detalle-title').textContent = ev ? ev.label : 'Partido';
  setSection('partido-detalle');
  if(matchReportsByEventId[eventId] !== undefined){
    renderMatchReport(eventId); // ya la teníamos en caché de esta sesión: se pinta al momento
  }
  loadMatchReport(eventId); // y de todos modos se refresca contra Supabase por si ha cambiado
}
