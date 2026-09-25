// Test: quiz de 10 preguntas al azar.
//
// Las preguntas viven en la tabla "test_questions" de Supabase (no en el diccionario
// I18N: son contenido, no interfaz). Cada vez que se pulsa "Iniciar test" se trae el
// banco completo y se eligen 10 al azar entre todas las disponibles.
import { legacy } from '../../lib/legacy.js';
import { t } from '../../lib/i18n.svelte.js';

export const quiz = $state({
  view: 'intro',      // 'intro' | 'play' | 'results'
  loading: false,
  selected: [],       // las 10 elegidas al azar para este intento
  index: 0,
  score: 0,
  chosen: null,       // índice de la opción elegida en la pregunta actual (null = sin responder)
});

export const ranking = $state({ open: false, status: 'idle', rows: [] });

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function startQuiz() {
  quiz.loading = true;
  const { data, error } = await legacy.supabase.from('test_questions').select('*');
  quiz.loading = false;

  if (error) {
    console.error('No se ha podido cargar el banco de preguntas', error);
    alert(t('test.loadError'));
    return;
  }
  if (!data || data.length === 0) {
    alert(t('test.noQuestions'));
    return;
  }

  quiz.selected = shuffleArray(data).slice(0, Math.min(10, data.length));
  quiz.index = 0;
  quiz.score = 0;
  quiz.chosen = null;
  quiz.view = 'play';
}

// Sale del test en marcha y vuelve a la pantalla de inicio de "Test" (no a Vestuario).
export function exitQuiz() {
  quiz.view = 'intro';
}

export function answer(chosenIndex) {
  if (quiz.chosen !== null) return;
  quiz.chosen = chosenIndex;
  if (chosenIndex === quiz.selected[quiz.index].correct_index) quiz.score++;
}

export function next() {
  if (quiz.index < quiz.selected.length - 1) {
    quiz.index++;
    quiz.chosen = null;
  } else {
    showResults();
  }
}

function showResults() {
  const total = quiz.selected.length;
  quiz.view = 'results';
  // 1 punto por cada respuesta acertada, +3 puntos extra si se acierta el 10/10.
  const earned = quiz.score + (quiz.score === total && total === 10 ? 3 : 0);
  savePoints(earned);
}

// Suma "earned" a los puntos acumulados de esta jugadora en la tabla test_scores.
// Se lee el total actual y se guarda el nuevo total (no hay contador atómico en
// Supabase para este caso sencillo, y aquí no hay riesgo real de dos intentos
// simultáneos de la misma persona).
async function savePoints(earned) {
  const userId = legacy.authUserId;
  if (!userId || !earned) return;
  try {
    const { data: existing, error: readError } = await legacy.supabase
      .from('test_scores')
      .select('points')
      .eq('profile_id', userId)
      .maybeSingle();
    if (readError) {
      console.error('No se ha podido leer el ranking del test', readError);
      return;
    }
    const newTotal = (existing && existing.points ? existing.points : 0) + earned;
    const { error: writeError } = await legacy.supabase
      .from('test_scores')
      .upsert({ profile_id: userId, points: newTotal, updated_at: new Date().toISOString() });
    if (writeError) console.error('No se ha podido guardar el ranking del test', writeError);
  } catch (e) {
    console.error('Error al guardar los puntos del test', e);
  }
}

export async function openRanking() {
  ranking.open = true;
  ranking.status = 'loading';
  const { data, error } = await legacy.supabase
    .from('test_scores')
    .select('profile_id, points')
    .order('points', { ascending: false });

  if (error) {
    console.error('No se ha podido cargar el ranking del test', error);
    ranking.status = 'error';
    return;
  }
  ranking.rows = (data || []).map((row) => {
    const p = legacy.rosterEntry(row.profile_id);
    const name = p ? legacy.displayName(p) : row.profile_id;
    return { points: row.points, name, avatarUrl: p ? p.avatarUrl : '', initials: legacy.initials(name) };
  });
  ranking.status = ranking.rows.length ? 'ok' : 'empty';
}
