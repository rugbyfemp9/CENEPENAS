/* ================= FANTASY ================= */

// 15 posiciones de rugby con su forma habitual sobre el campo (x/y en %)
const fantasyPositions = [
  { num:1,  label:'Pilar',        x:34.9, y:16 },
  { num:2,  label:'Talonador',    x:47.5, y:16 },
  { num:3,  label:'Pilar',        x:60.1, y:16 },
  { num:4,  label:'2ª línea',     x:41.2, y:27 },
  { num:5,  label:'2ª línea',     x:53.8, y:27 },
  { num:6,  label:'Ala',          x:29.3, y:35 },
  { num:7,  label:'Ala',          x:65.7, y:35 },
  { num:8,  label:'Octavo',       x:47.5, y:40 },
  { num:9,  label:'Medio melé',   x:57.8, y:49 },
  { num:10, label:'Apertura',     x:37.2, y:55 },
  { num:11, label:'Ala',          x:20.6, y:66 },
  { num:12, label:'Centro',       x:40.6, y:65 },
  { num:13, label:'Centro',       x:57.6, y:65 },
  { num:14, label:'Ala',          x:74.4, y:66 },
  { num:15, label:'Zaguero',      x:47.5, y:79 }
];

// 8 suplentes, distribuidos en el margen derecho del campo
const fantasySubPositions = [
  { num:16, label:'Suplente', x:93.5, y:15 },
  { num:17, label:'Suplente', x:93.5, y:25 },
  { num:18, label:'Suplente', x:93.5, y:35 },
  { num:19, label:'Suplente', x:93.5, y:45 },
  { num:20, label:'Suplente', x:93.5, y:55 },
  { num:21, label:'Suplente', x:93.5, y:65 },
  { num:22, label:'Suplente', x:93.5, y:75 },
  { num:23, label:'Suplente', x:93.5, y:85 }
];

const fantasyAllPositions = fantasyPositions.concat(fantasySubPositions);

// Alineación actual en memoria: { posNum: playerId | null }
let fantasyLineup = {};
fantasyAllPositions.forEach(p => fantasyLineup[p.num] = null);

let fantasySelectedMatchId = null;
// Solo queda en window.storage el borrador (la alineación que estás montando sin
// haber pulsado "Guardar" todavía): es un autoguardado local, no algo que deba
// sincronizarse ni compartirse, así que sigue en el navegador como hasta ahora. Lo
// guardado con nombre y lo publicado ya vive en Supabase (fantasy_lineups y
// fantasy_published_lineups), con permisos que hacen cumplir quién puede verlo.
function fantasyDraftKey(){
  return 'fantasy:draft:' + (currentAuthUserId || 'anon');
}

// Autoguarda la alineación que se está montando (no las guardadas con nombre), para
// que sobreviva a un cierre o refresco de página, tal como promete el aviso de arriba.
async function saveFantasyDraft(){
  try{
    await window.storage.set(fantasyDraftKey(), JSON.stringify({ matchId:fantasySelectedMatchId, lineup:fantasyLineup }), false);
  }catch(e){ /* si falla el autoguardado no interrumpimos la edición */ }
}

async function loadFantasyDraft(){
  try{
    const r = await window.storage.get(fantasyDraftKey(), false);
    if(!r) return;
    const data = JSON.parse(r.value);
    if(data.matchId) fantasySelectedMatchId = data.matchId;
    if(data.lineup) fantasyAllPositions.forEach(p => { if(data.lineup[p.num]) fantasyLineup[p.num] = data.lineup[p.num]; });
  }catch(e){ /* no había borrador guardado: se empieza en blanco */ }
}

async function initFantasy(){
  await loadFantasyDraft();
  refreshFantasyMatchesAndUI();
}

// Se llama tanto al arrancar la app como cada vez que se entra en la pestaña Fantasy,
// para que el desplegable de partidos y el banquillo de disponibles reflejen siempre
// el roster y los partidos más recientes (que llegan de forma asíncrona desde Supabase).
function refreshFantasyMatchesAndUI(){
  const select = document.getElementById('fantasy-match-select');
  if(!select) return;

  const matches = attEvents.filter(ev => attEventType(ev) === 'match');

  if(!matches.length){
    select.innerHTML = `<option value="">Todavía no hay partidos creados</option>`;
    select.disabled = true;
    fantasySelectedMatchId = null;
  } else {
    select.disabled = false;
    select.innerHTML = matches.map((ev, i) =>
      `<option value="${ev.id}">${i === 0 ? 'Próximo partido — ' : ''}${escapeHtml(ev.label)} (${ev.date} ${monthAbbrLabel(ev.month)})</option>`
    ).join('');
    // Si el partido que ya tenías elegido sigue existiendo, se mantiene (para no perder
    // la alineación que estabas montando); si no, se coge el primero de la lista.
    if(!matches.some(m => m.id === fantasySelectedMatchId)){
      fantasySelectedMatchId = matches[0].id;
    }
    select.value = fantasySelectedMatchId;
  }

  renderFantasyLineupUI();
  // El partido activo puede haber cambiado (o ser el primero que se fija al arrancar):
  // se refresca "Mis alineaciones" para que muestre solo las de ese partido.
  loadSavedLineupsList();
}

function onFantasyMatchChange(matchId){
  fantasySelectedMatchId = matchId;
  resetFantasyLineup(true);
  // Cada partido tiene sus propias alineaciones guardadas: al cambiar de partido en
  // la barra de arriba, se refresca la lista para que solo se vean las de este.
  loadSavedLineupsList();
}

function fantasyAvailablePlayers(){
  const ev = attEvents.find(e => e.id === fantasySelectedMatchId);
  if(!ev) return [];
  const placed = new Set(Object.values(fantasyLineup).filter(Boolean));
  return roster.filter(p => ev.attendance[p.id] === 'yes' && !placed.has(p.id));
}

// Refresca campo + suplentes + banquillo de disponibles a la vez
function renderFantasyLineupUI(){
  renderFantasyPitch();
  renderFantasyBench();
  saveFantasyDraft();
}

// Construye el marcado de una camiseta/posición, tanto para el campo (posicionada por x/y)
// como para la fila de suplentes (en flujo normal)
function fantasySlotMarkup(pos, isSub){
  const playerId = fantasyLineup[pos.num];
  const player = playerId ? rosterById[playerId] : null;
  const inner = player
    ? `<span class="jstripes"></span><span class="jsleeve l"></span><span class="jsleeve r"></span><span class="slot-num-filled">${pos.num}</span>`
    : `<span class="slot-num">${pos.num}</span>`;
  const wrapClass = isSub ? 'pitch-slot sub-pitch-slot' : 'pitch-slot';
  const posStyle = ` style="left:${pos.x}%; top:${pos.y}%;"`;
  return `
      <div class="rugby-slot ${wrapClass}${player ? ' filled' : ''}" data-pos="${pos.num}"${posStyle}
           ondragover="onSlotDragOver(event,${pos.num})" ondragleave="onSlotDragLeave(event,${pos.num})" ondrop="onSlotDrop(event,${pos.num})">
        <button class="slot-shape" draggable="${player ? 'true' : 'false'}"
                ondragstart="onSlotDragStart(event,${pos.num})"
                ontouchstart="onSlotTouchStart(event,${pos.num})"
                onclick="onSlotClick(${pos.num})" title="${pos.num} · ${escapeHtml(pos.label)}${player ? ' · ' + escapeHtml(displayName(player)) : ''}">
          ${inner}
        </button>
        ${player ? `<span class="slot-pname">${escapeHtml(displayName(player))}</span>` : ''}
      </div>
    `;
}

function renderFantasyPitch(){
  const pitch = document.getElementById('fantasy-pitch');
  if(!pitch) return;

  // Alturas (%) de todas las líneas horizontales, de arriba a abajo (campo real: 120m de largo, con margen decorativo del 8% arriba/abajo)
  const tickYs = [15, 18.5, 30.4, 43, 50, 57, 69.6, 81.5, 85];
  // Posiciones (%) a 5m y 15m de cada banda (dentro del margen izquierdo del 8% y derecho del 13%)
  const tickXs = [13, 23, 72, 82];
  const ticksHtml = tickYs.map(y =>
    tickXs.map(x => `<div class="pitch-tick" style="top:${y}%;left:${x}%;"></div>`).join('')
  ).join('');

  pitch.innerHTML = `
      <button type="button" class="fantasy-pitch-refresh-btn" onclick="resetFantasyLineup()" title="Vaciar el campo" aria-label="Vaciar el campo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>
      </button>
      <div class="pitch-ingoal top"></div>
      <div class="pitch-ingoal bottom"></div>
      <div class="pitch-sideline left"></div>
      <div class="pitch-sideline right"></div>
      <div class="pitch-line dead-top"></div>
      <div class="pitch-line try-top"></div>
      <div class="pitch-line dashed-long line-5-top"></div>
      <div class="pitch-line line-22-top"></div>
      <div class="pitch-line dashed-long line-10-top"></div>
      <div class="pitch-line half"></div>
      <div class="pitch-line dashed-long line-10-bottom"></div>
      <div class="pitch-line line-22-bottom"></div>
      <div class="pitch-line dashed-long line-5-bottom"></div>
      <div class="pitch-line try-bottom"></div>
      <div class="pitch-line dead-bottom"></div>
      ${ticksHtml}
      <div class="pitch-centerspot"></div>
    ` + fantasyPositions.map(pos => fantasySlotMarkup(pos, false)).join('')
    + fantasySubPositions.map(pos => fantasySlotMarkup(pos, true)).join('');
}

function renderFantasyBench(){
  const bench = document.getElementById('fantasy-bench');
  const countEl = document.getElementById('fantasy-bench-count');
  if(!bench) return;

  const available = fantasyAvailablePlayers();
  countEl.textContent = available.length;

  if(available.length === 0){
    bench.innerHTML = fantasySelectedMatchId
      ? `<div class="fantasy-bench-empty">No hay jugadoras disponibles.</div>`
      : `<div class="fantasy-bench-empty">Crea un partido en Asistencia para poder montar una alineación.</div>`;
    return;
  }

  bench.innerHTML = available.map(p => `
      <button class="jersey-card" draggable="true" ondragstart="onBenchDragStart(event,'${p.id}')"
              ontouchstart="onBenchTouchStart(event,'${p.id}')"
              onclick="onBenchCardClick('${p.id}')" title="${escapeHtml(displayName(p))}">
        <div class="jersey-shape"><span class="jstripes"></span><span class="jsleeve l"></span><span class="jsleeve r"></span></div>
        <div class="jname">${escapeHtml(displayName(p))}</div>
      </button>
    `).join('');
}

// --- Clic sobre una camiseta del banquillo: se coloca sola en el primer hueco libre, en orden 1→15 ---
function onBenchCardClick(playerId){
  const nextPos = fantasyAllPositions.find(p => !fantasyLineup[p.num]);
  if(!nextPos){
    alert('Ya no quedan huecos ni en el campo ni en el banquillo de suplentes. Quita a alguien para hacer sitio.');
    return;
  }
  assignToSlot(nextPos.num, playerId, null);
}

// --- Clic sobre una jugadora ya colocada en el campo: la quita y vuelve al banquillo ---
function onSlotClick(posNum){
  if(!fantasyLineup[posNum]) return;
  fantasyLineup[posNum] = null;
  renderFantasyLineupUI();
}

// --- Coloca/mueve una jugadora en una posición del campo, liberando su origen si venía de otra posición ---
function assignToSlot(posNum, playerId, fromPos){
  fantasyLineup[posNum] = playerId;
  if(fromPos !== null && fromPos !== undefined && fromPos !== posNum){
    fantasyLineup[fromPos] = null;
  }
  renderFantasyLineupUI();
}

// --- Drag & drop (ratón, escritorio) ---
function onBenchDragStart(ev, playerId){
  ev.dataTransfer.setData('text/plain', JSON.stringify({ source:'bench', playerId }));
}
function onSlotDragStart(ev, posNum){
  const playerId = fantasyLineup[posNum];
  if(!playerId){ ev.preventDefault(); return; }
  ev.dataTransfer.setData('text/plain', JSON.stringify({ source:'slot', playerId, fromPos:posNum }));
}
function onSlotDragOver(ev, posNum){
  ev.preventDefault();
  document.querySelector(`.rugby-slot[data-pos="${posNum}"]`).classList.add('drag-over');
}
function onSlotDragLeave(ev, posNum){
  document.querySelector(`.rugby-slot[data-pos="${posNum}"]`).classList.remove('drag-over');
}
function onSlotDrop(ev, posNum){
  ev.preventDefault();
  document.querySelector(`.rugby-slot[data-pos="${posNum}"]`).classList.remove('drag-over');
  let data;
  try{ data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch(e){ return; }
  if(!data) return;
  assignToSlot(posNum, data.playerId, data.source === 'slot' ? data.fromPos : null);
}
function onBenchDrop(ev){
  ev.preventDefault();
  let data;
  try{ data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch(e){ return; }
  if(!data || data.source !== 'slot') return;
  fantasyLineup[data.fromPos] = null;
  renderFantasyLineupUI();
}

// --- Drag & drop táctil (móvil) ---
let touchDrag = null; // { payload, ghost, offsetX, offsetY, lastSlotEl }

function onBenchTouchStart(ev, playerId){
  startTouchDrag(ev, { source:'bench', playerId });
}
function onSlotTouchStart(ev, posNum){
  const playerId = fantasyLineup[posNum];
  if(!playerId) return; // slot vacío: nada que arrastrar (el clic ya lo gestiona onSlotClick)
  startTouchDrag(ev, { source:'slot', playerId, fromPos:posNum });
}

function startTouchDrag(ev, payload){
  const touch = ev.touches[0];
  const sourceEl = ev.currentTarget;
  const rect = sourceEl.getBoundingClientRect();

  const ghost = sourceEl.cloneNode(true);
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.margin = '0';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost.style.opacity = '0.9';
  ghost.style.transform = 'scale(1.1)';
  ghost.style.boxShadow = '0 10px 24px rgba(15,27,45,.4)';
  document.body.appendChild(ghost);

  touchDrag = {
    payload, ghost,
    offsetX: touch.clientX - rect.left,
    offsetY: touch.clientY - rect.top,
    lastSlotEl: null
  };
}

function onTouchDragMove(ev){
  if(!touchDrag) return;
  ev.preventDefault();
  const touch = ev.touches[0];
  touchDrag.ghost.style.left = (touch.clientX - touchDrag.offsetX) + 'px';
  touchDrag.ghost.style.top = (touch.clientY - touchDrag.offsetY) + 'px';

  touchDrag.ghost.style.display = 'none';
  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  touchDrag.ghost.style.display = '';

  const slotEl = under && under.closest ? under.closest('.rugby-slot') : null;
  if(touchDrag.lastSlotEl && touchDrag.lastSlotEl !== slotEl){
    touchDrag.lastSlotEl.classList.remove('drag-over');
  }
  if(slotEl) slotEl.classList.add('drag-over');
  touchDrag.lastSlotEl = slotEl;
}

function onTouchDragEnd(ev){
  if(!touchDrag) return;
  const { payload, ghost, lastSlotEl } = touchDrag;
  if(ghost.parentNode) ghost.parentNode.removeChild(ghost);
  if(lastSlotEl) lastSlotEl.classList.remove('drag-over');

  const touch = ev.changedTouches && ev.changedTouches[0];
  touchDrag = null;
  if(!touch) return;

  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  const slotEl = under && under.closest ? under.closest('.rugby-slot') : null;
  const benchEl = under && under.closest ? under.closest('.fantasy-bench') : null;

  if(slotEl){
    const posNum = parseInt(slotEl.dataset.pos, 10);
    assignToSlot(posNum, payload.playerId, payload.source === 'slot' ? payload.fromPos : null);
  } else if(benchEl && payload.source === 'slot'){
    fantasyLineup[payload.fromPos] = null;
    renderFantasyLineupUI();
  }
}

document.addEventListener('touchmove', onTouchDragMove, { passive:false });
document.addEventListener('touchend', onTouchDragEnd);
document.addEventListener('touchcancel', onTouchDragEnd);

// Cierra el desplegable de "lesionada / tocada" si se hace clic fuera de él
document.addEventListener('click', function(e){
  const wrap = document.querySelector('.injury-toggle-wrap');
  const picker = document.getElementById('injury-picker');
  if(wrap && picker && picker.classList.contains('open') && !wrap.contains(e.target)){
    picker.classList.remove('open');
  }
});

function resetFantasyLineup(skipConfirm){
  if(!skipConfirm && !confirm('¿Quitar a todas las jugadoras del campo?')) return;
  fantasyAllPositions.forEach(p => fantasyLineup[p.num] = null);
  renderFantasyLineupUI();
}

// --- Guardar (privado, solo lo ve quien lo crea) ---
function openSaveLineupModal(){
  document.getElementById('lineup-name-input').value = '';
  document.getElementById('save-lineup-modal').classList.add('active');
}
function closeSaveLineupModal(){
  document.getElementById('save-lineup-modal').classList.remove('active');
}
async function confirmSaveLineup(){
  const name = document.getElementById('lineup-name-input').value.trim();
  if(!name){ alert('Ponle un nombre a la alineación.'); return; }

  // Se guarda en Supabase con owner_id = tu usuario: la política de seguridad de la
  // tabla (RLS) hace que nadie más que tú pueda leer ni esta fila ni ninguna otra con
  // un owner_id distinto al tuyo, así que es privada de verdad, no solo en la interfaz.
  const { error } = await supabaseClient.from('fantasy_lineups').insert({
    owner_id: currentAuthUserId,
    match_id: fantasySelectedMatchId,
    name,
    lineup: fantasyLineup
  });

  if(error){
    console.error('No se pudo guardar la alineación', error);
    alert('No se ha podido guardar. Inténtalo de nuevo.');
    return;
  }
  closeSaveLineupModal();
  loadSavedLineupsList();
}

async function loadSavedLineupsList(){
  const box = document.getElementById('fantasy-saved-list');
  if(!box) return;
  box.innerHTML = `<div class="fantasy-saved-empty">Cargando…</div>`;

  // No hace falta filtrar aquí por "es mía": la política de RLS de fantasy_lineups ya
  // impide que esta consulta devuelva alineaciones de otra persona.
  const { data, error } = await supabaseClient
    .from('fantasy_lineups')
    .select('id, name, lineup, match_id, created_at')
    .eq('match_id', fantasySelectedMatchId)
    .order('created_at', { ascending: false });

  if(error || !data || data.length === 0){
    box.innerHTML = `<div class="fantasy-saved-empty">Aún no tienes alineaciones guardadas para este partido.</div>`;
    return;
  }

  box.innerHTML = data.map(it => `
      <div class="fantasy-saved-item">
        <div class="info" onclick="loadSavedLineup('${it.id}')">
          <b>${escapeHtml(it.name)}</b>
          <span>${Object.values(it.lineup).filter(Boolean).length}/${fantasyAllPositions.length} colocadas</span>
        </div>
        <button class="del-btn" onclick="deleteSavedLineup('${it.id}')" title="Eliminar">✕</button>
      </div>
    `).join('');
}

async function loadSavedLineup(id){
  const { data, error } = await supabaseClient
    .from('fantasy_lineups')
    .select('match_id, lineup')
    .eq('id', id)
    .maybeSingle();

  if(error || !data){ alert('No se ha podido cargar esa alineación.'); return; }

  if(data.match_id){
    fantasySelectedMatchId = data.match_id;
    document.getElementById('fantasy-match-select').value = data.match_id;
  }
  fantasyAllPositions.forEach(p => fantasyLineup[p.num] = (data.lineup && data.lineup[p.num]) || null);
  renderFantasyLineupUI();
}

async function deleteSavedLineup(id){
  if(!confirm('¿Eliminar esta alineación guardada?')) return;
  const { error } = await supabaseClient.from('fantasy_lineups').delete().eq('id', id);
  if(error){ alert('No se ha podido eliminar. Inténtalo de nuevo.'); }
  loadSavedLineupsList();
}

// --- Publicar (elegir con quién se comparte) ---
let publishAudience = null;
function openPublishModal(){
  publishAudience = null;
  document.querySelectorAll('.publish-audience-opt').forEach(b => b.classList.remove('selected'));
  document.getElementById('publish-person-wrap').style.display = 'none';
  const personSelect = document.getElementById('publish-person-select');
  personSelect.innerHTML = roster.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');
  document.getElementById('publish-modal').classList.add('active');
}
function closePublishModal(){
  document.getElementById('publish-modal').classList.remove('active');
}
function selectPublishAudience(type){
  publishAudience = type;
  document.querySelectorAll('.publish-audience-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.audience === type);
  });
  document.getElementById('publish-person-wrap').style.display = type === 'persona' ? 'block' : 'none';
}
async function confirmPublish(){
  if(!publishAudience){ alert('Elige con quién quieres compartirla.'); return; }
  if(Object.values(fantasyLineup).every(v => !v)){ alert('Coloca al menos una jugadora antes de publicar.'); return; }

  const personaId = publishAudience === 'persona' ? document.getElementById('publish-person-select').value : null;
  const audienceLabel = {
    jugadoras:'Jugadoras', staff:'Staff', capitanas:'Capitanas',
    persona: displayName(roster.find(p => p.id === personaId)) || 'Una persona'
  }[publishAudience];

  // Se guarda en Supabase: la política de seguridad de fantasy_published_lineups es la
  // que hace cumplir "solo la ven los perfiles designados" (por rol, o por persona_id si
  // eliges a alguien concreto) — no depende de que el navegador de cada quien la filtre.
  const { error } = await supabaseClient.from('fantasy_published_lineups').insert({
    published_by: currentAuthUserId,
    match_id: fantasySelectedMatchId,
    name: 'Alineación de ' + (rosterById[currentUserId] ? displayName(rosterById[currentUserId]) : 'un usuario'),
    lineup: fantasyLineup,
    audience: publishAudience,
    persona_id: personaId
  });

  if(error){
    console.error('No se pudo publicar la alineación', error);
    alert('No se ha podido publicar. Inténtalo de nuevo.');
    return;
  }
  closePublishModal();
  alert('Alineación publicada para: ' + audienceLabel);
}

// --- Compartidas contigo (lo que otras han publicado y te incluye) ---
// STAFF_ROLES ya no se usa aquí para filtrar (eso ahora lo hace la política de RLS de
// Supabase), pero se deja igual por si se necesita en otro sitio para roles de staff.
const STAFF_ROLES = ['entrenador/a', 'delegado/a', 'directiva'];

// --- Aviso en Inicio: "X ha compartido contigo su alineación" ---
// Se comprueba al entrar en Inicio (ver setSection). Solo se muestra la más reciente
// que te hayan compartido (y que no sea la tuya propia); si ya la has descartado antes
// en este dispositivo, no vuelve a salir.
let inicioSharedLineupKey = null;

async function checkInicioSharedLineupBanner(){
  const box = document.getElementById('inicio-shared-lineup-banner');
  if(!box) return;
  if(!currentAuthUserId){ box.style.display = 'none'; return; }

  const { data, error } = await supabaseClient
    .from('fantasy_published_lineups')
    .select('id, match_id, published_by, created_at')
    .neq('published_by', currentAuthUserId)
    .order('created_at', { ascending: false })
    .limit(1);

  if(error || !data || data.length === 0){ box.style.display = 'none'; inicioSharedLineupKey = null; return; }
  const latest = data[0];

  let dismissed = [];
  try{
    const d = await window.storage.get('fantasy:dismissed-banners', false);
    if(d && d.value) dismissed = JSON.parse(d.value);
  }catch(e){ /* todavía no se ha descartado ninguna */ }

  if(dismissed.includes(latest.id)){ box.style.display = 'none'; inicioSharedLineupKey = null; return; }

  const ev = attEvents.find(e => e.id === latest.match_id);
  const matchLabel = ev ? ev.label : t('sharedLineup.nextMatchFallback');
  const publisher = rosterById[latest.published_by];
  const publisherName = publisher ? displayName(publisher) : t('sharedLineup.someone');

  inicioSharedLineupKey = latest.id;
  document.getElementById('inicio-shared-lineup-text').innerHTML =
    t('sharedLineup.text', { name: `<b>${escapeHtml(publisherName)}</b>`, match: `<b>${escapeHtml(matchLabel)}</b>` });
  box.style.display = '';
}

// Marca una alineación compartida como "ya vista" para que no vuelva a aparecer el
// aviso — se usa tanto al pulsar el banner para entrar como al cerrarlo con la "x".
async function markSharedLineupBannerSeen(key){
  if(!key) return;
  let dismissed = [];
  try{
    const d = await window.storage.get('fantasy:dismissed-banners', false);
    if(d && d.value) dismissed = JSON.parse(d.value);
  }catch(e){ /* todavía no había ninguna descartada */ }

  if(!dismissed.includes(key)){
    dismissed.push(key);
    try{ await window.storage.set('fantasy:dismissed-banners', JSON.stringify(dismissed), false); }catch(e){ /* no pasa nada si falla, se volverá a intentar */ }
  }
}

function openInicioSharedLineup(){
  if(!inicioSharedLineupKey) return;
  const key = inicioSharedLineupKey;

  document.getElementById('inicio-shared-lineup-banner').style.display = 'none';
  inicioSharedLineupKey = null;
  markSharedLineupBannerSeen(key);

  setSection('fantasy');
  loadSharedLineup(key);
}

function dismissInicioSharedLineupBanner(event){
  event.stopPropagation();
  if(!inicioSharedLineupKey) return;
  const key = inicioSharedLineupKey;

  document.getElementById('inicio-shared-lineup-banner').style.display = 'none';
  inicioSharedLineupKey = null;
  markSharedLineupBannerSeen(key);
}

function openSharedLineupsModal(){
  const ev = attEvents.find(e => e.id === fantasySelectedMatchId);
  const matchLabel = document.getElementById('shared-lineups-modal-match');
  if(matchLabel) matchLabel.textContent = ev ? ev.label : 'el partido seleccionado';
  document.getElementById('shared-lineups-modal').classList.add('active');
  loadSharedLineupsList();
}
function closeSharedLineupsModal(){
  document.getElementById('shared-lineups-modal').classList.remove('active');
}

async function loadSharedLineupsList(){
  const box = document.getElementById('shared-lineups-list');
  if(!box) return;
  box.innerHTML = `<div class="fantasy-saved-empty">Cargando…</div>`;

  const { data, error } = await supabaseClient
    .from('fantasy_published_lineups')
    .select('id, name, audience, published_by, match_id, created_at')
    .eq('match_id', fantasySelectedMatchId)
    .order('created_at', { ascending: false });

  if(error || !data || data.length === 0){
    box.innerHTML = `<div class="fantasy-saved-empty">Todavía no hay alineaciones compartidas contigo para este partido.</div>`;
    return;
  }

  const AUDIENCE_LABELS = { jugadoras:'Jugadoras', staff:'Staff', capitanas:'Capitanas', persona:'Ti' };

  box.innerHTML = data.map(it => {
    const publisher = rosterById[it.published_by];
    return `
      <div class="shared-lineup-item" onclick="loadSharedLineup('${it.id}')">
        <div class="info">
          <b>${escapeHtml(it.name)}</b>
          <span>${escapeHtml(publisher ? displayName(publisher) : 'Alguien')} · para ${escapeHtml(AUDIENCE_LABELS[it.audience] || '')}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function loadSharedLineup(id){
  const { data, error } = await supabaseClient
    .from('fantasy_published_lineups')
    .select('match_id, lineup')
    .eq('id', id)
    .maybeSingle();

  if(error || !data){ alert('No se ha podido cargar esa alineación.'); return; }

  if(data.match_id){
    fantasySelectedMatchId = data.match_id;
    document.getElementById('fantasy-match-select').value = data.match_id;
  }
  fantasyAllPositions.forEach(p => fantasyLineup[p.num] = (data.lineup && data.lineup[p.num]) || null);
  renderFantasyLineupUI();
  closeSharedLineupsModal();
}
