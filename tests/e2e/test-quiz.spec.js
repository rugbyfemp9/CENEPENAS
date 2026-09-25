// Characterization tests for the "Test" section (quiz of up to 10 random questions
// from the test_questions table, and the ranking modal backed by test_scores).
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed } from './fixtures/seed.js';

const withQuestions = (questions, extra = {}) => ({ ...seed, test_questions: questions, ...extra });

// Questions are picked at random, so every test finds the one on screen by its text.
function questionLookup(questions = seed.test_questions) {
  const byText = new Map(questions.map((q) => [q.question, q]));
  return async (page) => {
    const text = await page.locator('#test-quiz-question').textContent();
    const q = byText.get(text);
    expect(q, `question on screen "${text}" is in the bank`).toBeTruthy();
    return q;
  };
}

const options = (page) => page.locator('#test-quiz-options .test-quiz-option');
const nextBtn = (page) => page.locator('#test-quiz-next-btn');

async function openTest(page) {
  await openApp(page);
  await goToSection(page, 'test');
}

async function startQuiz(page, label = 'Iniciar test') {
  await page.locator('#test-quiz-intro').getByRole('button', { name: label }).click();
  await expect(page.locator('#test-quiz-play')).toBeVisible();
}

// Answers the question on screen (right or wrong) and returns what was on screen.
async function answer(page, current, correct) {
  const q = await current(page);
  const idx = correct ? q.correct_index : (q.correct_index + 1) % 4;
  await options(page).nth(idx).click();
  return { q, idx };
}

// Plays a whole quiz; `pattern(i)` says whether question i is answered right.
async function playQuiz(page, current, total, pattern) {
  const seen = [];
  for (let i = 0; i < total; i++) {
    await expect(page.locator('#test-quiz-progress-label')).toHaveText(`${i + 1} / ${total}`);
    const { q } = await answer(page, current, pattern(i));
    seen.push(q.question);
    await expect(nextBtn(page)).toHaveText(i === total - 1 ? 'Finalizar' : 'Siguiente');
    await nextBtn(page).click();
  }
  await expect(page.locator('#test-quiz-results')).toBeVisible();
  return seen;
}

const scoreWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === 'test_scores');

test('intro screen: start button, ranking button and back link to Vestuario', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await expect(page.locator('#sec-test')).toHaveClass(/active/);
  await expect(page.locator('#test-quiz-intro')).toContainText('Ponte a prueba con 10 preguntas tipo test.');
  await expect(page.locator('#test-quiz-intro').getByRole('button', { name: 'Iniciar test' })).toBeVisible();
  await expect(page.locator('#sec-test').getByRole('button', { name: 'Ranking de puntuación' })).toBeVisible();
  await expect(page.locator('#test-quiz-play')).toBeHidden();
  await expect(page.locator('#test-quiz-results')).toBeHidden();
  await expect(page.locator('#test-back-intro')).toBeHidden();

  await page.locator('#test-back-vestuario').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('starting picks 10 distinct questions from the bank, one at a time with 4 options', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  const current = questionLookup();

  await expect(page.locator('#test-quiz-intro')).toBeHidden();
  await expect(page.locator('#test-back-vestuario')).toBeHidden();
  await expect(page.locator('#test-back-intro')).toBeVisible();
  await expect(page.locator('#test-quiz-progress-label')).toHaveText('1 / 10');
  await expect(page.locator('#test-quiz-explanation')).toBeHidden();
  await expect(nextBtn(page)).toBeHidden();

  const q = await current(page);
  await expect(options(page)).toHaveText([q.option_a, q.option_b, q.option_c, q.option_d]);

  // 12 questions in the bank -> 10 different ones are asked.
  const seen = await playQuiz(page, current, 10, () => true);
  expect(new Set(seen).size).toBe(10);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a right answer is marked correct, locks the options and shows the explanation', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  const current = questionLookup();

  const { q, idx } = await answer(page, current, true);
  await expect(options(page).nth(idx)).toHaveClass(/correct/);
  await expect(page.locator('#test-quiz-options .test-quiz-option.incorrect')).toHaveCount(0);
  await expect(page.locator('#test-quiz-options .test-quiz-option.disabled')).toHaveCount(4);
  await expect(page.locator('#test-quiz-explanation')).toBeVisible();
  await expect(page.locator('#test-quiz-explanation')).toContainText('Explicación');
  await expect(page.locator('#test-quiz-explanation-text')).toHaveText(q.explanation);
  await expect(page.locator('#test-quiz-progress-fill')).toHaveAttribute('style', /width:\s*10%/);
  await expect(nextBtn(page)).toHaveText('Siguiente');

  // A second click after answering changes nothing.
  await options(page).nth((idx + 1) % 4).click();
  await expect(page.locator('#test-quiz-options .test-quiz-option.incorrect')).toHaveCount(0);

  await nextBtn(page).click();
  await expect(page.locator('#test-quiz-progress-label')).toHaveText('2 / 10');
  await expect(page.locator('#test-quiz-options .test-quiz-option.disabled')).toHaveCount(0);
  await expect(page.locator('#test-quiz-explanation')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('a wrong answer is marked incorrect and the right one is highlighted', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  const current = questionLookup();

  const { q, idx } = await answer(page, current, false);
  await expect(options(page).nth(idx)).toHaveClass(/incorrect/);
  await expect(options(page).nth(q.correct_index)).toHaveClass(/(^|\s)correct(\s|$)/);
  await expect(page.locator('#test-quiz-options .test-quiz-option.correct')).toHaveCount(1);
  await expect(page.locator('#test-quiz-options .test-quiz-option.incorrect')).toHaveCount(1);
  await expect(page.locator('#test-quiz-explanation-text')).toHaveText(q.explanation);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a perfect 10/10 earns 13 points (10 + 3 bonus) and shows up in the ranking', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  await playQuiz(page, questionLookup(), 10, () => true);

  await expect(page.locator('#test-quiz-play')).toBeHidden();
  await expect(page.locator('#test-quiz-score')).toHaveText('10/10');
  await expect(page.locator('#test-quiz-score-text')).toHaveText('¡Test completado!');
  await expect(page.locator('#test-back-intro')).toBeHidden();
  await expect(page.locator('#test-back-vestuario')).toBeVisible();

  await expect.poll(() => scoreWrites(backend).length).toBe(1);
  const [write] = scoreWrites(backend);
  expect(write.method).toBe('UPSERT');
  expect(write.body).toHaveLength(1);
  expect(write.body[0]).toMatchObject({ profile_id: USERS.admin.id, points: 13 });

  await page.locator('#sec-test').getByRole('button', { name: 'Ranking de puntuación' }).click();
  await expect(page.locator('#test-ranking-list')).toHaveText(/Rovi\s*42 pts[\s\S]*Juls\s*27 pts[\s\S]*Tanke\s*19 pts[\s\S]*Montse\s*13 pts[\s\S]*Paula\s*8 pts/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a partial score is added to the points already stored, without bonus', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openTest(page);
  await startQuiz(page);
  // 3 wrong, 7 right.
  await playQuiz(page, questionLookup(), 10, (i) => i >= 3);
  await expect(page.locator('#test-quiz-score')).toHaveText('7/10');

  await expect.poll(() => scoreWrites(backend).length).toBe(1);
  expect(scoreWrites(backend)[0].body[0]).toMatchObject({ profile_id: USERS.player.id, points: 27 + 7 });
  expect(relevantErrors(errors)).toEqual([]);
});

test('0/10 writes nothing to test_scores', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  await playQuiz(page, questionLookup(), 10, () => false);
  await expect(page.locator('#test-quiz-score')).toHaveText('0/10');
  await page.waitForTimeout(300);
  expect(scoreWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('with fewer than 10 questions all are asked and a perfect score has no bonus', async ({ page }) => {
  const questions = [
    { id: 'q1', question: 'Pregunta uno', option_a: 'A1', option_b: 'B1', option_c: 'C1', option_d: 'D1', correct_index: 0, explanation: 'Porque sí.' },
    // No explanation: the explanation box stays hidden.
    { id: 'q2', question: 'Pregunta dos', option_a: 'A2', option_b: 'B2', option_c: 'C2', option_d: 'D2', correct_index: 3, explanation: null },
    // Option texts are shown as text, never as HTML.
    { id: 'q3', question: '<i>Pregunta tres</i>', option_a: '<b>negrita</b>', option_b: 'B3', option_c: 'C3', option_d: 'D3', correct_index: 2, explanation: '' },
  ];
  const { backend, errors } = await setupApp(page, { seed: withQuestions(questions) });
  await openTest(page);
  await startQuiz(page);
  const current = questionLookup(questions);

  const seen = [];
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('#test-quiz-progress-label')).toHaveText(`${i + 1} / 3`);
    const { q } = await answer(page, current, true);
    seen.push(q.id);
    if (q.id === 'q1') await expect(page.locator('#test-quiz-explanation')).toBeVisible();
    else await expect(page.locator('#test-quiz-explanation')).toBeHidden();
    if (q.id === 'q3') {
      await expect(page.locator('#test-quiz-question')).toHaveText('<i>Pregunta tres</i>');
      await expect(options(page).first()).toHaveText('<b>negrita</b>');
      await expect(page.locator('#test-quiz-options b, #test-quiz-question i')).toHaveCount(0);
    }
    await nextBtn(page).click();
  }
  expect(seen.sort()).toEqual(['q1', 'q2', 'q3']);
  await expect(page.locator('#test-quiz-score')).toHaveText('3/3');

  await expect.poll(() => scoreWrites(backend).length).toBe(1);
  expect(scoreWrites(backend)[0].body[0]).toMatchObject({ profile_id: USERS.admin.id, points: 3 });
  expect(relevantErrors(errors)).toEqual([]);
});

test('an empty question bank shows an alert and stays on the intro', async ({ page }) => {
  const { errors } = await setupApp(page, { seed: withQuestions([]) });
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await openTest(page);
  await page.locator('#test-quiz-intro').getByRole('button', { name: 'Iniciar test' }).click();
  await expect.poll(() => dialogs).toEqual(['Todavía no hay preguntas cargadas para el test.']);
  await expect(page.locator('#test-quiz-intro')).toBeVisible();
  await expect(page.locator('#test-quiz-play')).toBeHidden();
  await expect(page.locator('#test-quiz-intro').getByRole('button', { name: 'Iniciar test' })).toBeEnabled();
  expect(relevantErrors(errors)).toEqual([]);
});

test('a failure loading the questions shows an alert and stays on the intro', async ({ page }) => {
  await setupApp(page);
  // Registered after setupApp, so it wins over the fake backend for this table.
  await page.route(/\/rest\/v1\/test_questions/, (route) => route.fulfill({
    status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ message: 'boom' }),
  }));
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await openTest(page);
  await page.locator('#test-quiz-intro').getByRole('button', { name: 'Iniciar test' }).click();
  await expect.poll(() => dialogs).toEqual(['No se ha podido cargar el banco de preguntas. Inténtalo de nuevo.']);
  await expect(page.locator('#test-quiz-intro')).toBeVisible();
  await expect(page.locator('#test-quiz-play')).toBeHidden();
});

test('leaving a quiz half way goes back to the intro; "Volver a intentarlo" starts over', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await startQuiz(page);
  const current = questionLookup();
  await answer(page, current, true);
  await nextBtn(page).click();
  await expect(page.locator('#test-quiz-progress-label')).toHaveText('2 / 10');

  await page.locator('#test-back-intro').click();
  await expect(page.locator('#test-quiz-intro')).toBeVisible();
  await expect(page.locator('#test-quiz-play')).toBeHidden();
  await expect(page.locator('#test-back-intro')).toBeHidden();
  await expect(page.locator('#test-back-vestuario')).toBeVisible();
  await expect(page.locator('#sec-test')).toHaveClass(/active/);

  await startQuiz(page);
  await expect(page.locator('#test-quiz-progress-label')).toHaveText('1 / 10');
  await playQuiz(page, current, 10, (i) => i % 2 === 0);
  await expect(page.locator('#test-quiz-score')).toHaveText('5/10');

  await page.locator('#test-quiz-results').getByRole('button', { name: 'Volver a intentarlo' }).click();
  await expect(page.locator('#test-quiz-play')).toBeVisible();
  await expect(page.locator('#test-quiz-results')).toBeHidden();
  await expect(page.locator('#test-quiz-progress-label')).toHaveText('1 / 10');
  await expect(page.locator('#test-quiz-options .test-quiz-option.disabled')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('ranking modal lists players by points and closes', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: { ...seed, test_scores: [
    ...seed.test_scores,
    // NOTE: a score whose profile is not in the roster shows the raw profile id (a UUID
    // in real data) instead of a name.
    { profile_id: 'unknown-profile', points: 30, updated_at: '2026-09-18T20:00:00Z' },
  ] } });
  await openTest(page);
  const modal = page.locator('#test-ranking-modal');
  await expect(modal).not.toHaveClass(/active/);
  await page.locator('#sec-test').getByRole('button', { name: 'Ranking de puntuación' }).click();
  await expect(modal).toHaveClass(/active/);
  await expect(modal).toContainText('Ranking del test');
  await expect(page.locator('#test-ranking-list b')).toHaveText(['Rovi', 'unknown-profile', 'Juls', 'Tanke', 'Paula']);
  await expect(page.locator('#test-ranking-list')).toHaveText(/1\s*R?\s*Rovi\s*42 pts[\s\S]*2[\s\S]*unknown-profile\s*30 pts[\s\S]*3[\s\S]*Juls\s*27 pts[\s\S]*4[\s\S]*Tanke\s*19 pts[\s\S]*5[\s\S]*Paula\s*8 pts/);

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  // Clicking the dark overlay outside the box also closes it.
  await page.locator('#sec-test').getByRole('button', { name: 'Ranking de puntuación' }).click();
  await expect(modal).toHaveClass(/active/);
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('ranking modal with no scores shows the empty message', async ({ page }) => {
  const { errors } = await setupApp(page, { seed: { ...seed, test_scores: [] } });
  await openTest(page);
  await page.locator('#sec-test').getByRole('button', { name: 'Ranking de puntuación' }).click();
  await expect(page.locator('#test-ranking-list')).toHaveText('Todavía nadie ha hecho el test.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: intro, buttons during the quiz, results and ranking are translated', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openTest(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#test-quiz-intro')).toContainText('Posa’t a prova amb 10 preguntes tipus test.');
  await expect(page.locator('#test-back-vestuario')).toHaveText(/Vestidor/);

  await page.locator('#sec-test').getByRole('button', { name: 'Rànquing de puntuació' }).click();
  await expect(page.locator('#test-ranking-modal')).toContainText('Rànquing del test');
  await expect(page.locator('#test-ranking-list')).toContainText('42 pts');
  await page.locator('#test-ranking-modal').getByRole('button', { name: 'Tancar' }).click();
  await expect(page.locator('#test-ranking-modal')).not.toHaveClass(/active/);

  await startQuiz(page, 'Iniciar test');
  const current = questionLookup();
  await answer(page, current, true);
  await expect(page.locator('#test-quiz-explanation')).toContainText('Explicació');
  await expect(nextBtn(page)).toHaveText('Següent');
  // Switching language while the "next" button is showing updates it too.
  await page.evaluate(() => window.setLang('es'));
  await expect(nextBtn(page)).toHaveText('Siguiente');
  await page.evaluate(() => window.setLang('ca'));
  await expect(nextBtn(page)).toHaveText('Següent');
  await nextBtn(page).click();

  for (let i = 1; i < 10; i++) {
    await answer(page, current, true);
    await expect(nextBtn(page)).toHaveText(i === 9 ? 'Finalitzar' : 'Següent');
    await nextBtn(page).click();
  }
  await expect(page.locator('#test-quiz-score')).toHaveText('10/10');
  await expect(page.locator('#test-quiz-score-text')).toHaveText('Test completat!');
  await expect(page.locator('#test-quiz-results').getByRole('button', { name: 'Torna-ho a provar' })).toBeVisible();
  await page.evaluate(() => window.setLang('es'));
  await expect(page.locator('#test-quiz-score-text')).toHaveText('¡Test completado!');
  expect(relevantErrors(errors)).toEqual([]);
});

