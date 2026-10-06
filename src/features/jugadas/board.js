// Pizarra de jugadas: el formato de una jugada animada (columna "animation" de la
// tabla "plays") y las cuentas para pintarla y reproducirla. Sin Svelte: lo usan el
// visor (PlayAnimation.svelte), las miniaturas de las tarjetas y el editor.
//
// Coordenadas en METROS sobre un campo entero en vertical (como el de Fantasy):
// x de 0 a 70 (de banda a banda), y de 0 a 120 (de línea de balón muerto a línea de
// balón muerto; las zonas de ensayo son 0–10 y 110–120).
//
// {
//   v: 1,
//   tokens: [{ id: 'a9', team: 'attack', label: '9' }, { id: 'd1', team: 'defense', label: '' },
//            { id: 'ball', team: 'ball' }],
//   steps:  [{ ms: 1200, pos: { a9: [35, 60], d1: [40, 52], ball: [36, 61] } }, ...]
// }
//
// Cada paso tiene la posición de TODAS las fichas. steps[i].ms es lo que se tarda en
// llegar al paso i desde el anterior (el del paso 0 no se usa).

export const PITCH_W = 70;
export const PITCH_L = 120;
export const TEAMS = ['attack', 'defense', 'ball'];
export const STEP_MS_DEFAULT = 1200;
// Pausa en cada paso al reproducir, para que se vea dónde está cada una antes de seguir.
export const HOLD_MS = 400;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

export function clampPoint([x, y]) {
  return [round1(clamp(x, 0, PITCH_W)), round1(clamp(y, 0, PITCH_L))];
}

// Lo que llega de Supabase se revisa antes de pintarlo: fichas con id y equipo
// válidos, pasos con posición para cada ficha (si falta, se reutiliza la del paso
// anterior) y nada fuera del campo. Si no queda nada que pintar, null.
export function normalizeAnimation(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tokens) || !Array.isArray(raw.steps)) return null;
  const seen = new Set();
  const tokens = [];
  for (const tk of raw.tokens) {
    if (!tk || typeof tk.id !== 'string' || !tk.id || seen.has(tk.id) || !TEAMS.includes(tk.team)) continue;
    seen.add(tk.id);
    tokens.push({ id: tk.id, team: tk.team, label: tk.team === 'ball' ? '' : String(tk.label ?? '').slice(0, 3) });
  }
  if (!tokens.length) return null;

  const steps = [];
  let prev = null;
  for (const st of raw.steps) {
    if (!st || typeof st.pos !== 'object' || st.pos === null) continue;
    const pos = {};
    for (const tk of tokens) {
      const p = st.pos[tk.id];
      if (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) pos[tk.id] = clampPoint(p);
      else if (prev) pos[tk.id] = prev[tk.id];
    }
    if (Object.keys(pos).length !== tokens.length) continue;
    const ms = Number.isFinite(st.ms) && st.ms > 0 ? clamp(Math.round(st.ms), 200, 10000) : STEP_MS_DEFAULT;
    steps.push({ ms, pos });
    prev = pos;
  }
  if (!steps.length) return null;
  return { v: 1, tokens, steps };
}

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

// Posiciones yendo del paso `from` al siguiente, con progress de 0 a 1.
export function positionsAt(anim, from, progress = 0) {
  const a = anim.steps[from].pos;
  const next = anim.steps[from + 1];
  if (!next || progress <= 0) return a;
  if (progress >= 1) return next.pos;
  const e = ease(progress);
  const out = {};
  for (const id of Object.keys(a)) {
    const [x1, y1] = a[id];
    const [x2, y2] = next.pos[id];
    out[id] = [x1 + (x2 - x1) * e, y1 + (y2 - y1) * e];
  }
  return out;
}

// ---- Línea de tiempo de la reproducción ----
// [pausa en el paso 0][movimiento al 1][pausa en el 1][movimiento al 2]...[pausa final]
export function totalMs(anim) {
  let t = HOLD_MS;
  for (let i = 1; i < anim.steps.length; i++) t += anim.steps[i].ms + HOLD_MS;
  return t;
}

// En qué punto está la jugada a los `elapsed` ms: paso de salida y progreso (0–1) hacia
// el siguiente. `atStep` es el último paso al que se ha llegado (el que se resalta).
export function frameAt(anim, elapsed) {
  let t = elapsed - HOLD_MS;
  for (let i = 1; i < anim.steps.length; i++) {
    if (t < 0) return { from: i - 1, progress: 0, atStep: i - 1 };
    const ms = anim.steps[i].ms;
    if (t < ms) return { from: i - 1, progress: t / ms, atStep: i - 1 };
    t -= ms + HOLD_MS;
  }
  return { from: anim.steps.length - 1, progress: 0, atStep: anim.steps.length - 1 };
}

// Momento de la línea de tiempo en el que se acaba de llegar al paso `i`.
export function timeOfStep(anim, i) {
  let t = HOLD_MS;
  for (let k = 1; k <= i && k < anim.steps.length; k++) t += anim.steps[k].ms + (k < i ? HOLD_MS : 0);
  return i === 0 ? 0 : t;
}

// ---- Encuadre ----
// Zona del campo que se ve: la que ocupan las fichas en todos los pasos, con margen y
// con la proporción del marco (16:9 en el visor y en las miniaturas), para que las
// fichas se vean grandes aunque la jugada sea en un rincón del campo.
export function fitViewBox(anim, aspect = 16 / 9, pad = 8, minW = 30) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of anim.steps) {
    for (const [x, y] of Object.values(st.pos)) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  let w = Math.max(maxX - minX + pad * 2, minW);
  let h = Math.max(maxY - minY + pad * 2, minW / aspect);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Se centra en las fichas, pero sin salirse más de lo necesario del campo.
  const x = w >= PITCH_W ? cx - w / 2 : clamp(cx - w / 2, 0, PITCH_W - w);
  const y = h >= PITCH_L ? cy - h / 2 : clamp(cy - h / 2, 0, PITCH_L - h);
  return [x, y, w, h].map(round1).join(' ');
}

export const FULL_PITCH_VIEWBOX = `-4 -4 ${PITCH_W + 8} ${PITCH_L + 8}`;
