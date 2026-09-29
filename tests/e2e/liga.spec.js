// Tests for the "Liga" section (live matchready.es widget of the Divisió d'Honor
// Catalana, the same one rugby.cat shows) and the league banner on Inicio.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';

const EMBED_URL = 'https://matchready.es/rugbycat/web/ca/public/calendar/47/112/combined/classification/';
const embed = (page) => page.locator('#sec-liga iframe.liga-embed');

test('Inicio banner shows CNPN position and opens the Liga section', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  const banner = page.locator('#league-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('DHC');
  await expect(banner).toContainText('Liga');
  await expect(page.locator('#league-position-num')).toHaveText('2º');
  await expect(banner).toContainText(/CNPN en la clasificación/i);

  await banner.click();
  await expect(page.locator('#sec-liga')).toHaveClass(/active/);
  await expect(page.locator('#sec-inicio')).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Vestuario card opens Liga and the back link returns to Vestuario', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'vestuario');
  await page.locator('#sec-vestuario .vest-card.i-liga').click();
  await expect(page.locator('#sec-liga')).toHaveClass(/active/);
  await expect(page.locator('#sec-liga h2')).toHaveText('Liga');
  await expect(page.locator('#sec-liga')).toContainText("Divisió d'Honor Catalana AON");

  await page.locator('#sec-liga .back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('shows the live matchready standings in an iframe', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');

  await expect(embed(page)).toHaveCount(1);
  await expect(embed(page)).toBeVisible();
  await expect(embed(page)).toHaveAttribute('src', EMBED_URL);
  await expect(embed(page)).toHaveAttribute('title', "Clasificación de la Divisió d'Honor Catalana AON");
  // The widget brings its own tabs, so the old snapshot tabs and tables are gone.
  await expect(page.locator('#sec-liga .liga-tabs, #sec-liga table')).toHaveCount(0);

  // setupApp serves a stub page for matchready.es (tests never reach the real site).
  await expect(page.frameLocator('#sec-liga iframe.liga-embed').locator('body')).toContainText('CNPN');
  expect(relevantErrors(errors)).toEqual([]);
});

test('source note links to rugby.cat in a new tab', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');
  const note = page.locator('#sec-liga .liga-source-note');
  await expect(note).toHaveText('Datos en directo de rugby.cat. Si no se ve, abre el enlace.');
  const link = note.getByRole('link', { name: 'rugby.cat' });
  await expect(link).toHaveAttribute('href', 'https://rugby.cat/dhc-femenina/divisio-dhonor-catalana-aon/');
  await expect(link).toHaveAttribute('target', '_blank');
  expect(relevantErrors(errors)).toEqual([]);
});

test('players see the same league section as admins', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await expect(page.locator('#league-position-num')).toHaveText('2º');
  await page.locator('#league-banner').click();
  await expect(page.locator('#sec-liga')).toHaveClass(/active/);
  await expect(embed(page)).toHaveAttribute('src', EMBED_URL);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: iframe title, source note and Inicio banner are translated', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#league-banner')).toContainText('Lliga');
  await expect(page.locator('#league-banner')).toContainText(/CNPN a la classificació/i);
  await expect(page.locator('#league-position-num')).toHaveText('2º');

  await goToSection(page, 'liga');
  await expect(page.locator('#sec-liga h2')).toHaveText('Lliga');
  await expect(page.locator('#sec-liga .back-link')).toHaveText(/Vestidor/);
  await expect(embed(page)).toHaveAttribute('title', "Classificació de la Divisió d'Honor Catalana AON");
  await expect(page.locator('#sec-liga .liga-source-note')).toHaveText("Dades en directe de rugby.cat. Si no es veu, obre l'enllaç.");

  await page.evaluate(() => window.setLang('es'));
  await expect(embed(page)).toHaveAttribute('title', "Clasificación de la Divisió d'Honor Catalana AON");
  expect(relevantErrors(errors)).toEqual([]);
});
