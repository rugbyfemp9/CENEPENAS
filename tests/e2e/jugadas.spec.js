// Tests for the "Jugadas" section: the team's playbook, one animation/video per play,
// organised by category. For now every play is a placeholder without a video.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';

const sec = (page) => page.locator('#sec-jugadas');
const filter = (page, name) => sec(page).locator('.jugadas-filter').filter({ hasText: name });
const modal = (page) => page.locator('#play-modal');

test('Vestuario card opens Jugadas and the back link returns to Vestuario', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'vestuario');
  await page.locator('#sec-vestuario .vest-card.i-jugadas').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(sec(page).locator('h2')).toHaveText('Jugadas');

  await sec(page).locator('.back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('lists the placeholder plays grouped by category, and filters by category', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'jugadas');

  await expect(sec(page).locator('.jugadas-filter')).toHaveText(['Todas 12', 'Touch 3', 'Melé 2', 'Ataque 3', 'Defensa 2', 'Patadas 2']);
  await expect(filter(page, 'Todas')).toHaveClass(/active/);
  await expect(sec(page).locator('.jugadas-group-title')).toHaveText([/Touch/, /Melé/, /Ataque/, /Defensa/, /Patadas/]);
  await expect(sec(page).locator('.play-card')).toHaveCount(12);
  await expect(sec(page).locator('.play-card .play-soon').first()).toHaveText('Próximamente');

  await filter(page, 'Touch').click();
  await expect(filter(page, 'Touch')).toHaveClass(/active/);
  await expect(filter(page, 'Todas')).not.toHaveClass(/active/);
  await expect(sec(page).locator('.jugadas-group-title')).toHaveText([/Touch/]);
  await expect(sec(page).locator('.play-card .play-cap b')).toHaveText(['Touch 1', 'Touch 2', 'Touch 3']);

  await filter(page, 'Todas').click();
  await expect(sec(page).locator('.play-card')).toHaveCount(12);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a play opens in a modal with the "video coming soon" placeholder', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'jugadas');
  await filter(page, 'Ataque').click();
  await sec(page).locator('.play-card').filter({ hasText: 'Ataque 2' }).click();

  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('h3')).toHaveText('Ataque 2');
  await expect(modal(page).locator('.modal-sub')).toHaveText('Ataque');
  await expect(modal(page).locator('.play-frame')).toContainText('El vídeo de esta jugada llegará pronto.');
  await expect(modal(page).locator('video')).toHaveCount(0);

  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('players see the same plays from the desktop sidebar', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await page.locator('.sidebar .nav button[data-section="jugadas"]').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(sec(page).locator('.play-card')).toHaveCount(12);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: title, filters and placeholder texts are translated', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'jugadas');
  await expect(sec(page).locator('h2')).toHaveText('Jugades');
  await expect(sec(page).locator('.back-link')).toHaveText(/Vestidor/);
  await expect(sec(page).locator('.jugadas-filter')).toHaveText(['Totes 12', 'Touch 3', 'Melé 2', 'Atac 3', 'Defensa 2', 'Xuts 2']);
  await expect(sec(page).locator('.play-card .play-soon').first()).toHaveText('Properament');

  await sec(page).locator('.play-card').filter({ hasText: 'Xuts 1' }).click();
  await expect(modal(page).locator('.play-frame')).toContainText("El vídeo d'aquesta jugada arribarà aviat.");
  expect(relevantErrors(errors)).toEqual([]);
});
