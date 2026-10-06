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

export const MAX_ATTACKERS = 15;
export const MAX_DEFENDERS = 15;
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
const attackers = () => editor.anim.tokens.filter((tk) => tk.team === 'attack');
const defenders = () => editor.anim.tokens.filter((tk) => tk.team === 'defense');
export const hasBall = () => editor.anim?.tokens.some((tk) => tk.team === 'ball') ?? false;

export function canAdd(team) {
  if (!editor.anim) return false;
  if (team === 'attack') return attackers().length < MAX_ATTACKERS;
  if (team === 'defense') return defenders().length < MAX_DEFENDERS;
  return !hasBall();
}

// Las atacantes llevan el primer dorsal libre (1–15); las defensas, sin número. Salen
// en fila cerca del centro (atacantes un poco más abajo que las defensas) para que no
// se tapen unas a otras.
export function addToken(team) {
  if (!canAdd(team)) return;
  let token;
  let at;
  if (team === 'attack') {
    const used = new Set(attackers().map((tk) => Number(tk.label)));
    let n = 1;
    while (used.has(n)) n++;
    token = { id: 'a' + n, team, label: String(n) };
    at = [13 + ((n - 1) % 8) * 6, 66 + Math.floor((n - 1) / 8) * 5];
  } else if (team === 'defense') {
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
  const id = editor.selectedId;
  if (!id || !editor.anim) return;
  editor.anim.tokens = editor.anim.tokens.filter((tk) => tk.id !== id);
  for (const st of editor.anim.steps) delete st.pos[id];
  editor.selectedId = null;
  markDirty();
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
