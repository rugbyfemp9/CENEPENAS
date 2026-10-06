// Test de jugadas: se ve la animación de una jugada (las de la pizarra de Jugadas) y
// hay que elegir su nombre entre varias opciones. Es solo para practicar: no suma
// puntos al ranking del test.
//
// Las preguntas salen de las jugadas que tienen animación (columna "animation" de la
// tabla "plays"); los nombres incorrectos, de los títulos de las demás jugadas
// (primero las de la misma categoría, que se parecen más).
import { t } from '../../lib/i18n.svelte.js';
import { jugadas, loadPlays, animationOf } from '../jugadas/jugadas.svelte.js';

export const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 4;

export const playsQuiz = $state({
  view: 'off',      // 'off' | 'play' | 'results'
  loading: false,
  questions: [],    // [{ id, title, category, description, anim, options: [título, ...], correct }]
  index: 0,
  score: 0,
  chosen: null,     // índice de la opción elegida en la pregunta actual (null = sin responder)
});

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const norm = (s) => String(s || '').trim().toLowerCase();

function buildQuestion(play, plays) {
  const title = play.title.trim();
  const seen = new Set([norm(title)]);
  const others = (list) => shuffle(list).map((p) => p.title.trim()).filter((x) => {
    if (!x || seen.has(norm(x))) return false;
    seen.add(norm(x));
    return true;
  });
  const sameCategory = others(plays.filter((p) => p.id !== play.id && p.category_id === play.category_id));
  const rest = others(plays.filter((p) => p.id !== play.id && p.category_id !== play.category_id));
  const wrong = [...sameCategory, ...rest].slice(0, MAX_OPTIONS - 1);
  const options = shuffle([title, ...wrong]);
  return {
    id: play.id, title, category: play.category_id, description: play.description || '',
    anim: animationOf(play), options, correct: options.indexOf(title),
  };
}

export async function startPlaysQuiz() {
  playsQuiz.loading = true;
  await loadPlays();
  playsQuiz.loading = false;
  if (jugadas.status === 'error') {
    alert(t('test.playsLoadError'));
    return;
  }
  const plays = jugadas.plays.filter((p) => p.title && p.title.trim());
  const animated = plays.filter((p) => animationOf(p));
  if (!animated.length) {
    alert(t('test.playsNone'));
    return;
  }
  // Hacen falta al menos dos nombres distintos para que haya algo que elegir.
  if (new Set(plays.map((p) => norm(p.title))).size < 2) {
    alert(t('test.playsNotEnough'));
    return;
  }
  playsQuiz.questions = shuffle(animated).slice(0, MAX_QUESTIONS).map((p) => buildQuestion(p, plays));
  playsQuiz.index = 0;
  playsQuiz.score = 0;
  playsQuiz.chosen = null;
  playsQuiz.view = 'play';
}

export function exitPlaysQuiz() {
  playsQuiz.view = 'off';
}

export function answerPlay(i) {
  if (playsQuiz.chosen !== null) return;
  playsQuiz.chosen = i;
  if (i === playsQuiz.questions[playsQuiz.index].correct) playsQuiz.score++;
}

export function nextPlay() {
  if (playsQuiz.index < playsQuiz.questions.length - 1) {
    playsQuiz.index++;
    playsQuiz.chosen = null;
  } else {
    playsQuiz.view = 'results';
  }
}
