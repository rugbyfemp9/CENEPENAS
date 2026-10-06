// Tests for the second test in "Test": the plays quiz. Each question plays the
// animation of a play (from the "plays" table, see the seed) and you pick its name.
// Practice only: it never writes to test_scores.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed } from './fixtures/seed.js';

const hub = (page) => page.locator('#test-quiz-intro');
const play = (page) => page.locator('#test-plays-play');
const results = (page) => page.locator('#test-plays-results');
const options = (page) => play(page).locator('.test-quiz-option');
const restWrites = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const dialogs = (page) => {
  const seen = [];
  page.on('dialog', (d) => seen.push(d.message()));
  return seen;
};

// Which seeded play is on screen: "Salida del 8" has the 8, "Bucle del 10" the 10.
async function shownTitle(page) {
  return (await play(page).locator('[data-token="a8"]').count()) ? 'Salida del 8' : 'Bucle del 10';
}

async function openTest(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'test');
  return ctx;
}

test('Test shows two tests: rules and plays', async ({ page }) => {
  const { errors } = await openTest(page);
  await expect(hub(page).locator('h3')).toHaveText(['Test de reglas', 'Test de jugadas']);
  await expect(page.locator('#test-hub-rules')).toContainText('Ponte a prueba con 10 preguntas tipo test.');
  await expect(page.locator('#test-hub-plays')).toContainText('Mira la animación de una jugada y elige cómo se llama.');
  await expect(page.locator('#test-hub-plays').getByRole('button', { name: 'Empezar' })).toBeVisible();
  await expect(play(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('plays quiz: one question per animated play, pick the name, see the score; no points saved', async ({ page }) => {
  const { backend, errors } = await openTest(page);
  await page.locator('#test-plays-start').click();
  await expect(hub(page)).toBeHidden();
  await expect(play(page)).toBeVisible();
  await expect(page.locator('#test-back-intro')).toBeVisible();
  await expect(page.locator('#test-back-vestuario')).toBeHidden();

  // Two plays have an animation ("Cruce en el centro"'s data is unusable).
  await expect(page.locator('#test-plays-progress-label')).toHaveText('1 / 2');
  await expect(play(page).locator('h3')).toHaveText('¿Qué jugada es?');
  await expect(play(page).locator('.play-anim')).toHaveAttribute('data-state', 'playing');

  // Question 1: answer wrong on purpose.
  let title = await shownTitle(page);
  await expect(options(page)).toHaveCount(4);
  const texts = await options(page).allTextContents();
  expect(texts).toContain(title);
  expect(new Set(texts).size).toBe(4);
  expect(texts.every((x) => seed.plays.some((p) => p.title === x))).toBe(true);
  const wrong = texts.findIndex((x) => x !== title);
  await options(page).nth(wrong).click();
  await expect(options(page).nth(wrong)).toHaveClass(/incorrect/);
  await expect(options(page).filter({ hasText: title })).toHaveClass(/correct/);
  await expect(page.locator('#test-plays-explanation')).toContainText(`Era «${title}»`);
  // Answering locks the question.
  await options(page).filter({ hasText: title }).click();
  await expect(options(page).filter({ hasText: title })).not.toHaveClass(/incorrect/);
  await expect(page.locator('#test-plays-next-btn')).toHaveText('Siguiente');
  await page.locator('#test-plays-next-btn').click();

  // Question 2: the other play; answer right.
  await expect(page.locator('#test-plays-progress-label')).toHaveText('2 / 2');
  const title2 = await shownTitle(page);
  expect(title2).not.toBe(title);
  await options(page).filter({ hasText: title2 }).click();
  await expect(options(page).filter({ hasText: title2 })).toHaveClass(/correct/);
  await expect(page.locator('#test-plays-next-btn')).toHaveText('Finalizar');
  await page.locator('#test-plays-next-btn').click();

  await expect(results(page)).toBeVisible();
  await expect(page.locator('#test-plays-score')).toHaveText('1/2');
  await expect(results(page)).toContainText('¡Test de jugadas completado!');
  expect(restWrites(backend, 'test_scores')).toEqual([]);

  // Back to the two tests.
  await results(page).getByRole('button', { name: 'Volver a los tests' }).click();
  await expect(hub(page)).toBeVisible();
  await expect(results(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('plays quiz: "Volver a intentarlo" starts again, and the back link returns to the tests', async ({ page }) => {
  const { errors } = await openTest(page);
  await page.locator('#test-plays-start').click();
  for (let i = 0; i < 2; i++) {
    await options(page).first().click();
    await page.locator('#test-plays-next-btn').click();
  }
  await expect(results(page)).toBeVisible();
  await results(page).getByRole('button', { name: 'Volver a intentarlo' }).click();
  await expect(play(page)).toBeVisible();
  await expect(page.locator('#test-plays-progress-label')).toHaveText('1 / 2');

  await page.locator('#test-back-intro').click();
  await expect(hub(page)).toBeVisible();
  await expect(play(page)).toBeHidden();
  await expect(page.locator('#test-back-vestuario')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('plays quiz with no animated plays says so and stays on the tests', async ({ page }) => {
  const plays = seed.plays.map((p) => ({ ...p, animation: null }));
  const { errors } = await openTest(page, { seed: { ...seed, plays } });
  const seen = dialogs(page);
  await page.locator('#test-plays-start').click();
  await expect.poll(() => seen).toEqual(['Todavía no hay jugadas animadas. Créalas en Jugadas.']);
  await expect(hub(page)).toBeVisible();
  await expect(play(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('plays quiz needs at least two different names', async ({ page }) => {
  const plays = seed.plays.filter((p) => p.title === 'Salida del 8');
  const { errors } = await openTest(page, { seed: { ...seed, plays } });
  const seen = dialogs(page);
  await page.locator('#test-plays-start').click();
  await expect.poll(() => seen).toEqual(['Hacen falta al menos dos jugadas con nombres distintos para el test.']);
  await expect(hub(page)).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: the two tests and the plays quiz', async ({ page }) => {
  const { errors } = await openTest(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(hub(page).locator('h3')).toHaveText(['Test de regles', 'Test de jugades']);
  await page.locator('#test-hub-plays').getByRole('button', { name: 'Començar' }).click();
  await expect(play(page).locator('h3')).toHaveText('Quina jugada és?');
  expect(relevantErrors(errors)).toEqual([]);
});
