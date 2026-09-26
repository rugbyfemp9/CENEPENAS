/* ================= FANTASY ================= */
// Montador de alineaciones: desplegable de partidos, campo con 15 posiciones + 8
// suplentes, banquillo de disponibles (quién ha dicho "sí" al partido), clic / arrastrar
// con ratón / arrastrar con el dedo, borrador local, alineaciones guardadas (privadas),
// publicar para un público, "Compartidas contigo" y el aviso de Inicio "X ha compartido
// contigo su alineación".
//
// Los partidos, sus respuestas de asistencia y el roster siguen en el código antiguo
// (no son reactivos). Igual que antes, el campo y el banquillo solo se vuelven a leer
// de ahí cuando se "pintan" (renderFantasyLineupUI): `fantasy.version` se incrementa en
// cada uno de esos momentos y todo lo que los lee depende de ese contador.
import { SvelteSet } from 'svelte/reactivity';
import { legacy } from '../../lib/legacy.js';

// 15 posiciones de rugby con su forma habitual sobre el campo (x/y en %)
export const fantasyPositions = [
  { num: 1, label: 'Pilar', x: 34.9, y: 16 },
  { num: 2, label: 'Talonador', x: 47.5, y: 16 },
  { num: 3, label: 'Pilar', x: 60.1, y: 16 },
  { num: 4, label: '2ª línea', x: 41.2, y: 27 },
  { num: 5, label: '2ª línea', x: 53.8, y: 27 },
  { num: 6, label: 'Ala', x: 29.3, y: 35 },
  { num: 7, label: 'Ala', x: 65.7, y: 35 },
  { num: 8, label: 'Octavo', x: 47.5, y: 40 },
  { num: 9, label: 'Medio melé', x: 57.8, y: 49 },
  { num: 10, label: 'Apertura', x: 37.2, y: 55 },
  { num: 11, label: 'Ala', x: 20.6, y: 66 },
  { num: 12, label: 'Centro', x: 40.6, y: 65 },
  { num: 13, label: 'Centro', x: 57.6, y: 65 },
  { num: 14, label: 'Ala', x: 74.4, y: 66 },
  { num: 15, label: 'Zaguero', x: 47.5, y: 79 },
];

// 8 suplentes, distribuidos en el margen derecho del campo
export const fantasySubPositions = [
  { num: 16, label: 'Suplente', x: 93.5, y: 15 },
  { num: 17, label: 'Suplente', x: 93.5, y: 25 },
  { num: 18, label: 'Suplente', x: 93.5, y: 35 },
  { num: 19, label: 'Suplente', x: 93.5, y: 45 },
  { num: 20, label: 'Suplente', x: 93.5, y: 55 },
  { num: 21, label: 'Suplente', x: 93.5, y: 65 },
  { num: 22, label: 'Suplente', x: 93.5, y: 75 },
  { num: 23, label: 'Suplente', x: 93.5, y: 85 },
];

export const fantasyAllPositions = fantasyPositions.concat(fantasySubPositions);

// Alturas (%) de todas las líneas horizontales, de arriba a abajo (campo real: 120m de largo, con margen decorativo del 8% arriba/abajo)
const tickYs = [15, 18.5, 30.4, 43, 50, 57, 69.6, 81.5, 85];
// Posiciones (%) a 5m y 15m de cada banda (dentro del margen izquierdo del 8% y derecho del 13%)
const tickXs = [13, 23, 72, 82];
export const pitchTicks = tickYs.flatMap((y) => tickXs.map((x) => ({ x, y })));

export const fantasy = $state({
  // Se incrementa cada vez que se "pinta" el campo + banquillo (renderFantasyLineupUI).
  // Mientras valga 0 no se ha pintado nunca (el campo y el banquillo salen vacíos).
  version: 0,
  // Alineación actual en memoria: { posNum: playerId | null }
  lineup: Object.fromEntries(fantasyAllPositions.map((p) => [p.num, null])),
  selectedMatchId: null,
  // Opciones del desplegable de partidos, fijadas en refreshFantasyMatchesAndUI()
  // (el texto con el mes traducido se calcula en ese momento, como antes).
  matchOptions: [],
  matchSelectDisabled: false,
  // Posiciones con algo arrastrándose encima (clase .drag-over). Al volver a pintar el
  // campo se vacía, igual que cuando se rehacía todo su HTML.
  dragOver: new SvelteSet(),
  // "Mis alineaciones": null = todavía no se ha pedido nunca; 'loading' | 'empty' | 'list'
  savedStatus: null,
  savedItems: [],
});

// Solo queda en window.storage el borrador (la alineación que estás montando sin
// haber pulsado "Guardar" todavía): es un autoguardado local, no algo que deba
// sincronizarse ni compartirse, así que sigue en el navegador como hasta ahora. Lo
// guardado con nombre y lo publicado ya vive en Supabase (fantasy_lineups y
// fantasy_published_lineups), con permisos que hacen cumplir quién puede verlo.
function fantasyDraftKey() {
  return 'fantasy:draft:' + (legacy.authUserId || 'anon');
}

// Autoguarda la alineación que se está montando (no las guardadas con nombre), para
// que sobreviva a un cierre o refresco de página, tal como promete el aviso de arriba.
async function saveFantasyDraft() {
  try {
    await legacy.storage.set(fantasyDraftKey(), JSON.stringify({ matchId: fantasy.selectedMatchId, lineup: $state.snapshot(fantasy.lineup) }), false);
  } catch (e) { /* si falla el autoguardado no interrumpimos la edición */ }
}

export async function loadFantasyDraft() {
  try {
    const r = await legacy.storage.get(fantasyDraftKey(), false);
    if (!r) return;
    const data = JSON.parse(r.value);
    if (data.matchId) fantasy.selectedMatchId = data.matchId;
    if (data.lineup) fantasyAllPositions.forEach((p) => { if (data.lineup[p.num]) fantasy.lineup[p.num] = data.lineup[p.num]; });
  } catch (e) { /* no había borrador guardado: se empieza en blanco */ }
}

export async function initFantasy() {
  await loadFantasyDraft();
  refreshFantasyMatchesAndUI();
}

// Al iniciar sesión (auth.js): el borrador se recarga ya con el id real fijado, y se
// comprueba si alguien te ha compartido una alineación mientras no tenías la app abierta.
export async function loadAfterLogin() {
  await loadFantasyDraft();
  refreshFantasyMatchesAndUI();
  checkInicioSharedLineupBanner();
}

// Se llama tanto al arrancar la app como cada vez que se entra en la pestaña Fantasy,
// para que el desplegable de partidos y el banquillo de disponibles reflejen siempre
// el roster y los partidos más recientes (que llegan de forma asíncrona desde Supabase).
export function refreshFantasyMatchesAndUI() {
  const matches = legacy.attEvents.filter((ev) => legacy.attEventType(ev) === 'match');

  if (!matches.length) {
    fantasy.matchOptions = [{ value: '', text: 'Todavía no hay partidos creados' }];
    fantasy.matchSelectDisabled = true;
    fantasy.selectedMatchId = null;
  } else {
    fantasy.matchSelectDisabled = false;
    fantasy.matchOptions = matches.map((ev, i) => ({
      value: ev.id,
      text: `${i === 0 ? 'Próximo partido — ' : ''}${ev.label} (${ev.date} ${legacy.monthAbbrFromEs(ev.month)})`,
    }));
    // Si el partido que ya tenías elegido sigue existiendo, se mantiene (para no perder
    // la alineación que estabas montando); si no, se coge el primero de la lista.
    if (!matches.some((m) => m.id === fantasy.selectedMatchId)) {
      fantasy.selectedMatchId = matches[0].id;
    }
  }

  renderFantasyLineupUI();
  // El partido activo puede haber cambiado (o ser el primero que se fija al arrancar):
  // se refresca "Mis alineaciones" para que muestre solo las de ese partido.
  loadSavedLineupsList();
}

export function onFantasyMatchChange(matchId) {
  fantasy.selectedMatchId = matchId;
  resetFantasyLineup(true);
  // Cada partido tiene sus propias alineaciones guardadas: al cambiar de partido en
  // la barra de arriba, se refresca la lista para que solo se vean las de este.
  loadSavedLineupsList();
}

export function fantasyAvailablePlayers() {
  fantasy.version; // dependencia reactiva: se relee al volver a pintar
  const ev = legacy.attEvents.find((e) => e.id === fantasy.selectedMatchId);
  if (!ev) return [];
  const placed = new Set(Object.values(fantasy.lineup).filter(Boolean));
  return legacy.roster.filter((p) => ev.attendance[p.id] === 'yes' && !placed.has(p.id));
}

// Datos de cada camiseta/posición, tanto para el campo (posicionada por x/y) como para
// los suplentes (margen derecho).
export function fantasySlots() {
  fantasy.version; // dependencia reactiva: se relee al volver a pintar
  return fantasyAllPositions.map((pos) => {
    const playerId = fantasy.lineup[pos.num];
    const player = playerId ? legacy.rosterById[playerId] : null;
    return {
      pos,
      isSub: pos.num > fantasyPositions.length,
      filled: !!player,
      name: player ? legacy.displayName(player) : '',
    };
  });
}

// Refresca campo + suplentes + banquillo de disponibles a la vez
function renderFantasyLineupUI() {
  fantasy.dragOver.clear();
  fantasy.version++;
  saveFantasyDraft();
}

// --- Clic sobre una camiseta del banquillo: se coloca sola en el primer hueco libre, en orden 1→15 ---
export function onBenchCardClick(playerId) {
  const nextPos = fantasyAllPositions.find((p) => !fantasy.lineup[p.num]);
  if (!nextPos) {
    alert('Ya no quedan huecos ni en el campo ni en el banquillo de suplentes. Quita a alguien para hacer sitio.');
    return;
  }
  assignToSlot(nextPos.num, playerId, null);
}

// --- Clic sobre una jugadora ya colocada en el campo: la quita y vuelve al banquillo ---
export function onSlotClick(posNum) {
  if (!fantasy.lineup[posNum]) return;
  fantasy.lineup[posNum] = null;
  renderFantasyLineupUI();
}

// --- Coloca/mueve una jugadora en una posición del campo, liberando su origen si venía de otra posición ---
function assignToSlot(posNum, playerId, fromPos) {
  fantasy.lineup[posNum] = playerId;
  if (fromPos !== null && fromPos !== undefined && fromPos !== posNum) {
    fantasy.lineup[fromPos] = null;
  }
  renderFantasyLineupUI();
}

// --- Drag & drop (ratón, escritorio) ---
// NOTE: .jersey-card y .slot-shape usan `all:unset` (css/fantasy.css), que en Chromium
// también quita el `-webkit-user-drag` de [draggable=true]: allí un arrastre real con el
// ratón no llega a empezar (solo funcionan el clic y el arrastre táctil). Se deja igual.
export function onBenchDragStart(ev, playerId) {
  ev.dataTransfer.setData('text/plain', JSON.stringify({ source: 'bench', playerId }));
}
export function onSlotDragStart(ev, posNum) {
  const playerId = fantasy.lineup[posNum];
  if (!playerId) { ev.preventDefault(); return; }
  ev.dataTransfer.setData('text/plain', JSON.stringify({ source: 'slot', playerId, fromPos: posNum }));
}
export function onSlotDragOver(ev, posNum) {
  ev.preventDefault();
  fantasy.dragOver.add(posNum);
}
export function onSlotDragLeave(ev, posNum) {
  fantasy.dragOver.delete(posNum);
}
export function onSlotDrop(ev, posNum) {
  ev.preventDefault();
  fantasy.dragOver.delete(posNum);
  let data;
  try { data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
  if (!data) return;
  assignToSlot(posNum, data.playerId, data.source === 'slot' ? data.fromPos : null);
}
export function onBenchDrop(ev) {
  ev.preventDefault();
  let data;
  try { data = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
  if (!data || data.source !== 'slot') return;
  fantasy.lineup[data.fromPos] = null;
  renderFantasyLineupUI();
}

// --- Drag & drop táctil (móvil) ---
let touchDrag = null; // { payload, ghost, offsetX, offsetY, lastSlotEl }

export function onBenchTouchStart(ev, playerId) {
  startTouchDrag(ev, { source: 'bench', playerId });
}
export function onSlotTouchStart(ev, posNum) {
  const playerId = fantasy.lineup[posNum];
  if (!playerId) return; // slot vacío: nada que arrastrar (el clic ya lo gestiona onSlotClick)
  startTouchDrag(ev, { source: 'slot', playerId, fromPos: posNum });
}

function startTouchDrag(ev, payload) {
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
    lastSlotEl: null,
  };
}

const slotPos = (slotEl) => parseInt(slotEl.dataset.pos, 10);

// Se registran en el document (ver Fantasy.svelte): el dedo puede acabar fuera del
// elemento en el que empezó el arrastre.
export function onTouchDragMove(ev) {
  if (!touchDrag) return;
  ev.preventDefault();
  const touch = ev.touches[0];
  touchDrag.ghost.style.left = (touch.clientX - touchDrag.offsetX) + 'px';
  touchDrag.ghost.style.top = (touch.clientY - touchDrag.offsetY) + 'px';

  touchDrag.ghost.style.display = 'none';
  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  touchDrag.ghost.style.display = '';

  const slotEl = under && under.closest ? under.closest('.rugby-slot') : null;
  if (touchDrag.lastSlotEl && touchDrag.lastSlotEl !== slotEl) {
    fantasy.dragOver.delete(slotPos(touchDrag.lastSlotEl));
  }
  if (slotEl) fantasy.dragOver.add(slotPos(slotEl));
  touchDrag.lastSlotEl = slotEl;
}

export function onTouchDragEnd(ev) {
  if (!touchDrag) return;
  const { payload, ghost, lastSlotEl } = touchDrag;
  if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
  if (lastSlotEl) fantasy.dragOver.delete(slotPos(lastSlotEl));

  const touch = ev.changedTouches && ev.changedTouches[0];
  touchDrag = null;
  if (!touch) return;

  const under = document.elementFromPoint(touch.clientX, touch.clientY);
  const slotEl = under && under.closest ? under.closest('.rugby-slot') : null;
  const benchEl = under && under.closest ? under.closest('.fantasy-bench') : null;

  if (slotEl) {
    assignToSlot(slotPos(slotEl), payload.playerId, payload.source === 'slot' ? payload.fromPos : null);
  } else if (benchEl && payload.source === 'slot') {
    fantasy.lineup[payload.fromPos] = null;
    renderFantasyLineupUI();
  }
}

export function resetFantasyLineup(skipConfirm) {
  if (!skipConfirm && !confirm('¿Quitar a todas las jugadoras del campo?')) return;
  fantasyAllPositions.forEach((p) => { fantasy.lineup[p.num] = null; });
  renderFantasyLineupUI();
}

// --- Guardar (privado, solo lo ve quien lo crea) ---
export const saveModal = $state({ open: false, name: '' });

export function openSaveLineupModal() {
  saveModal.name = '';
  saveModal.open = true;
}
export function closeSaveLineupModal() {
  saveModal.open = false;
}
export async function confirmSaveLineup() {
  const name = saveModal.name.trim();
  if (!name) { alert('Ponle un nombre a la alineación.'); return; }

  // Se guarda en Supabase con owner_id = tu usuario: la política de seguridad de la
  // tabla (RLS) hace que nadie más que tú pueda leer ni esta fila ni ninguna otra con
  // un owner_id distinto al tuyo, así que es privada de verdad, no solo en la interfaz.
  const { error } = await legacy.supabase.from('fantasy_lineups').insert({
    owner_id: legacy.authUserId,
    match_id: fantasy.selectedMatchId,
    name,
    lineup: $state.snapshot(fantasy.lineup),
  });

  if (error) {
    console.error('No se pudo guardar la alineación', error);
    alert('No se ha podido guardar. Inténtalo de nuevo.');
    return;
  }
  closeSaveLineupModal();
  loadSavedLineupsList();
}

export function placedCount(lineup) {
  return Object.values(lineup).filter(Boolean).length;
}

export async function loadSavedLineupsList() {
  fantasy.savedStatus = 'loading';

  // No hace falta filtrar aquí por "es mía": la política de RLS de fantasy_lineups ya
  // impide que esta consulta devuelva alineaciones de otra persona.
  const { data, error } = await legacy.supabase
    .from('fantasy_lineups')
    .select('id, name, lineup, match_id, created_at')
    .eq('match_id', fantasy.selectedMatchId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    fantasy.savedStatus = 'empty';
    fantasy.savedItems = [];
    return;
  }
  fantasy.savedItems = data;
  fantasy.savedStatus = 'list';
}

// Pone en el campo una alineación (guardada o compartida) y fija su partido.
function applyLoadedLineup(data) {
  if (data.match_id) fantasy.selectedMatchId = data.match_id;
  fantasyAllPositions.forEach((p) => { fantasy.lineup[p.num] = (data.lineup && data.lineup[p.num]) || null; });
  renderFantasyLineupUI();
}

export async function loadSavedLineup(id) {
  const { data, error } = await legacy.supabase
    .from('fantasy_lineups')
    .select('match_id, lineup')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) { alert('No se ha podido cargar esa alineación.'); return; }
  applyLoadedLineup(data);
}

export async function deleteSavedLineup(id) {
  if (!confirm('¿Eliminar esta alineación guardada?')) return;
  const { error } = await legacy.supabase.from('fantasy_lineups').delete().eq('id', id);
  if (error) { alert('No se ha podido eliminar. Inténtalo de nuevo.'); }
  loadSavedLineupsList();
}

// --- Publicar (elegir con quién se comparte) ---
export const publishModal = $state({
  open: false,
  audience: null,
  // Opciones de "Persona", fijadas al abrir el modal (todo el roster, tú incluida como 'me')
  people: [],
  personId: '',
});

export function openPublishModal() {
  publishModal.audience = null;
  publishModal.people = legacy.roster.map((p) => ({ id: p.id, name: legacy.displayName(p) }));
  publishModal.personId = publishModal.people.length ? publishModal.people[0].id : '';
  publishModal.open = true;
}
export function closePublishModal() {
  publishModal.open = false;
}
export function selectPublishAudience(type) {
  publishModal.audience = type;
}
export async function confirmPublish() {
  const publishAudience = publishModal.audience;
  if (!publishAudience) { alert('Elige con quién quieres compartirla.'); return; }
  if (Object.values(fantasy.lineup).every((v) => !v)) { alert('Coloca al menos una jugadora antes de publicar.'); return; }

  const personaId = publishAudience === 'persona' ? publishModal.personId : null;
  const audienceLabel = {
    jugadoras: 'Jugadoras', staff: 'Staff', capitanas: 'Capitanas',
    persona: legacy.displayName(legacy.roster.find((p) => p.id === personaId)) || 'Una persona',
  }[publishAudience];

  // Se guarda en Supabase: la política de seguridad de fantasy_published_lineups es la
  // que hace cumplir "solo la ven los perfiles designados" (por rol, o por persona_id si
  // eliges a alguien concreto) — no depende de que el navegador de cada quien la filtre.
  const { error } = await legacy.supabase.from('fantasy_published_lineups').insert({
    published_by: legacy.authUserId,
    match_id: fantasy.selectedMatchId,
    name: 'Alineación de ' + (legacy.me ? legacy.displayName(legacy.me) : 'un usuario'),
    lineup: $state.snapshot(fantasy.lineup),
    audience: publishAudience,
    persona_id: personaId,
  });

  if (error) {
    console.error('No se pudo publicar la alineación', error);
    alert('No se ha podido publicar. Inténtalo de nuevo.');
    return;
  }
  closePublishModal();
  alert('Alineación publicada para: ' + audienceLabel);
}

// --- Compartidas contigo (lo que otras han publicado y te incluye) ---
// (El filtrado por rol/persona lo hace la política de RLS de Supabase.)
export const sharedModal = $state({
  open: false,
  // null = todavía no se ha pedido nunca; 'loading' | 'empty' | 'list'
  status: null,
  items: [],
});

const AUDIENCE_LABELS = { jugadoras: 'Jugadoras', staff: 'Staff', capitanas: 'Capitanas', persona: 'Ti' };

export function openSharedLineupsModal() {
  sharedModal.open = true;
  loadSharedLineupsList();
}
export function closeSharedLineupsModal() {
  sharedModal.open = false;
}

async function loadSharedLineupsList() {
  sharedModal.status = 'loading';

  const { data, error } = await legacy.supabase
    .from('fantasy_published_lineups')
    .select('id, name, audience, published_by, match_id, created_at')
    .eq('match_id', fantasy.selectedMatchId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    sharedModal.status = 'empty';
    sharedModal.items = [];
    return;
  }

  sharedModal.items = data.map((it) => {
    const publisher = legacy.rosterById[it.published_by];
    return {
      id: it.id,
      name: it.name,
      publisherName: publisher ? legacy.displayName(publisher) : 'Alguien',
      audienceLabel: AUDIENCE_LABELS[it.audience] || '',
    };
  });
  sharedModal.status = 'list';
}

export async function loadSharedLineup(id) {
  const { data, error } = await legacy.supabase
    .from('fantasy_published_lineups')
    .select('match_id, lineup')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) { alert('No se ha podido cargar esa alineación.'); return; }

  applyLoadedLineup(data);
  closeSharedLineupsModal();
}

// --- Aviso en Inicio: "X ha compartido contigo su alineación" ---
// Se comprueba al entrar en Inicio (ver setSection). Solo se muestra la más reciente
// que te hayan compartido (y que no sea la tuya propia); si ya la has descartado antes
// en este dispositivo, no vuelve a salir.
export const sharedBanner = $state({
  visible: false,
  // id de la alineación que anuncia el aviso (null = ninguna)
  key: null,
  // Nombre de quien la publica y del partido; null = el texto genérico traducido
  // ("Alguien" / "el próximo partido"). `text` es null hasta el primer aviso.
  text: null,
});

async function readDismissedBanners() {
  let dismissed = [];
  try {
    const d = await legacy.storage.get('fantasy:dismissed-banners', false);
    if (d && d.value) dismissed = JSON.parse(d.value);
  } catch (e) { /* todavía no se ha descartado ninguna */ }
  return dismissed;
}

export async function checkInicioSharedLineupBanner() {
  if (!legacy.authUserId) { sharedBanner.visible = false; return; }

  const { data, error } = await legacy.supabase
    .from('fantasy_published_lineups')
    .select('id, match_id, published_by, created_at')
    .neq('published_by', legacy.authUserId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) { sharedBanner.visible = false; sharedBanner.key = null; return; }
  const latest = data[0];

  const dismissed = await readDismissedBanners();

  if (dismissed.includes(latest.id)) { sharedBanner.visible = false; sharedBanner.key = null; return; }

  const ev = legacy.attEvents.find((e) => e.id === latest.match_id);
  const publisher = legacy.rosterById[latest.published_by];

  sharedBanner.key = latest.id;
  sharedBanner.text = {
    publisherName: publisher ? legacy.displayName(publisher) : null,
    matchLabel: ev ? ev.label : null,
  };
  sharedBanner.visible = true;
}

// Marca una alineación compartida como "ya vista" para que no vuelva a aparecer el
// aviso — se usa tanto al pulsar el banner para entrar como al cerrarlo con la "x".
async function markSharedLineupBannerSeen(key) {
  if (!key) return;
  const dismissed = await readDismissedBanners();

  if (!dismissed.includes(key)) {
    dismissed.push(key);
    try { await legacy.storage.set('fantasy:dismissed-banners', JSON.stringify(dismissed), false); } catch (e) { /* no pasa nada si falla, se volverá a intentar */ }
  }
}

export function openInicioSharedLineup() {
  if (!sharedBanner.key) return;
  const key = sharedBanner.key;

  sharedBanner.visible = false;
  sharedBanner.key = null;
  markSharedLineupBannerSeen(key);

  legacy.setSection('fantasy');
  loadSharedLineup(key);
}

export function dismissInicioSharedLineupBanner(event) {
  event.stopPropagation();
  if (!sharedBanner.key) return;
  const key = sharedBanner.key;

  sharedBanner.visible = false;
  sharedBanner.key = null;
  markSharedLineupBannerSeen(key);
}
