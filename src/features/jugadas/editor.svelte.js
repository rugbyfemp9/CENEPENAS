// Editor de jugadas animadas (solo admins): sección "jugada-editor".
//
// Se entra desde el "+" de Jugadas (eligiendo "Animación") o desde el botón "Editar
// animación" del modal de una jugada. Se colocan fichas (atacantes, defensas y el
// balón) en el campo y se mueven paso a paso; al reproducir, cada ficha va en línea
// recta de un paso al siguiente. El formato es el de board.js.
import { supabase } from '../../lib/supabase.js';
import { writeCache } from '../../lib/storage.js';
import { t } from '../../lib/i18n.svelte.js';
import { setSection } from '../../shell/navigation.svelte.js';
import { jugadas, playForm, canManagePlays, playsOf, animationOf } from './jugadas.svelte.js';
import { clampPoint, STEP_MS_DEFAULT, PITCH_W, PITCH_L, FULL_PITCH_VIEWBOX } from './board.js';

export const MAX_DEFENDERS = 15;
// Dorsales del banquillo del editor: en rugby el número es el puesto (9 = medio melé...).
export const SHIRT_NUMBERS = Array.from({ length: 15 }, (_, i) => i + 1);
// Dónde sale cada dorsal al sacarlo al campo (metros, alrededor de medio campo): una
// melé y la línea de tres cuartos. Así, al sacar varias, ya quedan con forma de equipo.
const DEFAULT_SPOTS = {
  1: [29, 57], 2: [32, 57], 3: [35, 57], 4: [30.5, 59.5], 5: [33.5, 59.5], 6: [27, 59], 7: [38, 59], 8: [32, 62],
  9: [32, 65], 10: [26, 68], 12: [21, 71], 13: [16, 74], 11: [9, 77], 14: [55, 74], 15: [32, 80],
};
// Velocidad de cada paso (lo que se tarda en llegar a él desde el anterior).
export const STEP_SPEEDS = [
  { id: 'slow', ms: 2000 },
  { id: 'normal', ms: STEP_MS_DEFAULT },
  { id: 'fast', ms: 700 },
];

export const editor = $state({
  playId: null,       // null = jugada nueva
  meta: { categoryId: '', title: '', description: '' },
  anim: null,         // { v, tokens, steps } (board.js)
  step: 0,            // paso que se está editando
  selectedId: null,   // ficha seleccionada (la que se quita con "Quitar")
  boardOpen: false,   // pizarra a pantalla completa (PlayBoardFull.svelte)
  preview: false,     // true = se está reproduciendo para probarla
  viewBox: FULL_PITCH_VIEWBOX, // encuadre de la pizarra (campo entero o acercado)
  zoomed: false,
  dirty: false,
  saving: false,
});

// La sección solo tiene sentido con algo cargado; si no (p. ej. al volver con el botón
// "atrás" después de guardar), setSection() manda de vuelta a Jugadas.
export function editorReady() {
  return canManagePlays() && !!editor.anim;
}

function load(playId, meta, anim) {
  editor.playId = playId;
  editor.meta = { ...meta };
  editor.anim = anim;
  editor.step = 0;
  editor.selectedId = null;
  editor.boardOpen = false;
  editor.preview = false;
  editor.dirty = false;
  editor.saving = false;
  editor.zoomed = false;
  editor.viewBox = FULL_PITCH_VIEWBOX;
}

// En el móvil el campo entero queda pequeño: "Acercar" encuadra unos 42 m de ancho
// alrededor de las fichas del paso actual (fichas al doble de tamaño). El encuadre se
// queda fijo mientras se edita, para que no se mueva al arrastrar; se recalcula al
// volver a acercar.
const ZOOM_W = 42;
const ZOOM_H = ZOOM_W * 128 / 78; // misma proporción que el marco de la pizarra
export function toggleZoom() {
  if (editor.zoomed) {
    editor.zoomed = false;
    editor.viewBox = FULL_PITCH_VIEWBOX;
    return;
  }
  const pts = Object.values(editor.anim?.steps[editor.step]?.pos || {});
  const cx = pts.length ? pts.reduce((s, p) => s + p[0], 0) / pts.length : PITCH_W / 2;
  const cy = pts.length ? pts.reduce((s, p) => s + p[1], 0) / pts.length : PITCH_L / 2;
  const x = Math.min(Math.max(cx - ZOOM_W / 2, -4), PITCH_W + 4 - ZOOM_W);
  const y = Math.min(Math.max(cy - ZOOM_H / 2, -4), PITCH_L + 4 - ZOOM_H);
  editor.zoomed = true;
  editor.viewBox = [x, y, ZOOM_W, ZOOM_H].map((n) => Math.round(n * 10) / 10).join(' ');
}

// Una jugada nueva va directa a la pizarra (no hay nada que ver sin fichas).
export function startNewAnimation(meta) {
  if (!canManagePlays()) return;
  load(null, meta, { v: 1, tokens: [], steps: [{ ms: STEP_MS_DEFAULT, pos: {} }] });
  setSection('jugada-editor');
  openBoard();
}

// La pizarra se edita a pantalla completa y sin scroll: en el móvil, al arrastrar una
// ficha la página se desplazaba en vez de moverse la ficha.
export function openBoard() {
  if (!editor.anim) return;
  editor.preview = false;
  editor.boardOpen = true;
}

export function closeBoard() {
  editor.boardOpen = false;
  editor.preview = false;
}

// Desde el modal "Añadir jugada" con "Animación": los datos del formulario pasan al
// editor, que es donde se guarda la jugada.
export function continueToEditor() {
  const title = playForm.title.trim();
  if (!playForm.categoryId || !title) {
    alert(t('jugadas.alertMissingFields'));
    return;
  }
  jugadas.addModalOpen = false;
  startNewAnimation({ categoryId: playForm.categoryId, title, description: playForm.description.trim() });
}

export function editAnimation(play) {
  if (!canManagePlays() || !play) return;
  const anim = animationOf(play);
  load(play.id, { categoryId: play.category_id, title: play.title, description: play.description || '' },
    anim || { v: 1, tokens: [], steps: [{ ms: STEP_MS_DEFAULT, pos: {} }] });
  jugadas.modalOpen = false;
  setSection('jugada-editor');
}

export function markDirty() {
  editor.dirty = true;
}

// ---- Fichas ----
const defenders = () => editor.anim.tokens.filter((tk) => tk.team === 'defense');
export const hasBall = () => editor.anim?.tokens.some((tk) => tk.team === 'ball') ?? false;

export function canAdd(team) {
  if (!editor.anim) return false;
  if (team === 'defense') return defenders().length < MAX_DEFENDERS;
  return !hasBall();
}

// ---- Banquillo: las atacantes van por dorsal ----
export function onPitch(n) {
  return editor.anim?.tokens.some((tk) => tk.id === 'a' + n) ?? false;
}

// Si la ficha está en sitios distintos según el paso, tiene movimientos que se perderían.
function hasMoves(id) {
  const [first, ...rest] = editor.anim.steps.map((st) => st.pos[id]);
  return rest.some((p) => p && first && (p[0] !== first[0] || p[1] !== first[1]));
}

function removeToken(id) {
  editor.anim.tokens = editor.anim.tokens.filter((tk) => tk.id !== id);
  for (const st of editor.anim.steps) delete st.pos[id];
  if (editor.selectedId === id) editor.selectedId = null;
  markDirty();
}

// Tocar un dorsal del banquillo saca a esa jugadora al campo (en su sitio de salida,
// en todos los pasos); tocarlo otra vez la quita. Si ya tenía movimientos, se pregunta
// antes, para que un toque sin querer no borre sus carreras.
export function toggleAttacker(n) {
  if (!editor.anim || !DEFAULT_SPOTS[n]) return;
  const id = 'a' + n;
  if (onPitch(n)) {
    if (hasMoves(id) && !confirm(t('jugadas.benchRemoveConfirm', { n }))) return;
    removeToken(id);
    return;
  }
  editor.anim.tokens.push({ id, team: 'attack', label: String(n) });
  for (const st of editor.anim.steps) st.pos[id] = clampPoint(DEFAULT_SPOTS[n]);
  editor.selectedId = id;
  markDirty();
}

// Las defensas van sin número y salen en fila por delante de la melé; el balón, en el
// centro del campo.
export function addToken(team) {
  if (!canAdd(team)) return;
  let token;
  let at;
  if (team === 'defense') {
    const ids = new Set(defenders().map((tk) => tk.id));
    let n = 1;
    while (ids.has('d' + n)) n++;
    token = { id: 'd' + n, team, label: '' };
    at = [13 + ((n - 1) % 8) * 6, 54 - Math.floor((n - 1) / 8) * 5];
  } else {
    token = { id: 'ball', team: 'ball', label: '' };
    at = [35, 60];
  }
  editor.anim.tokens.push(token);
  for (const st of editor.anim.steps) st.pos[token.id] = clampPoint(at);
  editor.selectedId = token.id;
  markDirty();
}

export function selectToken(id) {
  editor.selectedId = id;
}

export function removeSelected() {
  if (!editor.selectedId || !editor.anim) return;
  removeToken(editor.selectedId);
}

// Mover una ficha solo cambia el paso que se está editando.
export function moveToken(id, point) {
  const st = editor.anim?.steps[editor.step];
  if (!st || !st.pos[id]) return;
  st.pos[id] = clampPoint(point);
  markDirty();
}

// ---- Pasos ----
export function setStep(i) {
  if (!editor.anim || i < 0 || i >= editor.anim.steps.length) return;
  editor.step = i;
}

// El paso nuevo va justo después del actual y empieza con las mismas posiciones.
export function addStep() {
  if (!editor.anim) return;
  const cur = editor.anim.steps[editor.step];
  editor.anim.steps.splice(editor.step + 1, 0, { ms: STEP_MS_DEFAULT, pos: $state.snapshot(cur.pos) });
  editor.step++;
  markDirty();
}

export function deleteStep() {
  if (!editor.anim || editor.anim.steps.length <= 1) return;
  editor.anim.steps.splice(editor.step, 1);
  editor.step = Math.max(0, editor.step - 1);
  markDirty();
}

export function setStepSpeed(ms) {
  const st = editor.anim?.steps[editor.step];
  if (!st || editor.step === 0) return;
  st.ms = ms;
  markDirty();
}

export function togglePreview() {
  editor.preview = !editor.preview;
}

// ---- Salir y guardar ----
export function leaveEditor() {
  if (editor.dirty && !confirm(t('jugadas.editorDiscardConfirm'))) return;
  editor.dirty = false;
  setSection('jugadas');
}

export async function saveAnimation() {
  if (!canManagePlays() || editor.saving || !editor.anim) return false;
  const title = editor.meta.title.trim();
  const description = editor.meta.description.trim();
  if (!editor.meta.categoryId || !title) {
    alert(t('jugadas.alertMissingFields'));
    return false;
  }
  if (!editor.anim.tokens.length) {
    alert(t('jugadas.alertNoTokens'));
    return false;
  }

  const animation = $state.snapshot(editor.anim);
  const row = { category_id: editor.meta.categoryId, title, description: description || null, animation };
  editor.saving = true;
  let result;
  if (editor.playId) {
    result = await supabase.from('plays').update(row).eq('id', editor.playId).select().single();
  } else {
    // Al final de su categoría, como las jugadas con vídeo.
    const sortOrder = Math.max(0, ...playsOf(row.category_id).map((p) => p.sort_order || 0)) + 10;
    result = await supabase.from('plays').insert({ ...row, video_url: null, sort_order: sortOrder }).select().single();
  }
  editor.saving = false;
  if (result.error) {
    console.error('No se ha podido guardar la jugada', result.error);
    alert(t('jugadas.alertSaveError', { error: result.error.message }));
    return false;
  }

  const i = jugadas.plays.findIndex((p) => p.id === result.data.id);
  if (i >= 0) jugadas.plays[i] = result.data;
  else jugadas.plays.push(result.data);
  writeCache('plays', { categories: jugadas.categories, plays: jugadas.plays });
  editor.dirty = false;
  editor.boardOpen = false;
  editor.anim = null;
  setSection('jugadas');
  return true;
}
