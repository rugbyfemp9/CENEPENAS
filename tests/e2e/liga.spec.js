// Characterization tests for the "Liga" section (static snapshot of the Divisió
// d'Honor Catalana standings and results) and the league banner on Inicio.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';

const TEAMS_IN_ORDER = ['CORNE/CRUC', 'CNPN', 'CEFA UNIZAR', 'VPC ANDORRA', 'ALGONTEC ZARAGOZA', 'CE INEF LLEIDA'];
const CRESTS = {
  'CNPN': 'assets/img/logo.png',
  'CORNE/CRUC': 'assets/img/cornecruc.jpg',
  'CEFA UNIZAR': 'assets/img/cefaunizar.jpg',
  'VPC ANDORRA': 'assets/img/vpcandorra.jpeg',
  'ALGONTEC ZARAGOZA': 'assets/img/algfenix.png',
  'CE INEF LLEIDA': 'assets/img/inef.jpeg',
};
const ROUNDS = ['Jornada 1', 'Jornada 2', 'Jornada 3', 'Jornada 4', 'Jornada 5', 'Jornada 6', 'Jornada 7',
  'Jornada 8', 'Jornada 9', 'Jornada 10', 'Semifinal', 'Final'];

const standingsRows = (page) => page.locator('#liga-standings-table tbody tr');
const cellTexts = (row) => row.locator('td').allInnerTexts().then((cells) => cells.map((c) => c.trim()));
const tab = (page, name) => page.locator('.liga-tabs').getByRole('button', { name });

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

test('standings table: header, six teams in order and every column', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');

  await expect(page.locator('#liga-panel-clasificacion')).toBeVisible();
  await expect(page.locator('#liga-standings-table thead th')).toHaveText(
    ['#', 'Equipo', 'J', 'G', 'E', 'P', 'PF', 'PC', 'DP', 'AF', 'AC', 'BO', 'BD', 'Pts'], { ignoreCase: true },
  );
  await expect(standingsRows(page)).toHaveCount(6);
  await expect(page.locator('#liga-standings-table tbody .liga-team')).toHaveText(TEAMS_IN_ORDER, { useInnerText: true });

  expect(await cellTexts(standingsRows(page).nth(0))).toEqual(['1', 'CORNE/CRUC', '10', '8', '0', '2', '226', '129', '+97', '34', '20', '2', '2', '36']);
  expect(await cellTexts(standingsRows(page).nth(1))).toEqual(['2', 'CNPN', '10', '8', '0', '2', '204', '92', '+112', '35', '12', '3', '1', '36']);
  expect(await cellTexts(standingsRows(page).nth(2))).toEqual(['3', 'CEFA UNIZAR', '10', '5', '1', '4', '157', '156', '+1', '27', '26', '2', '0', '22']);
  expect(await cellTexts(standingsRows(page).nth(3))).toEqual(['4', 'VPC ANDORRA', '10', '4', '1', '5', '197', '189', '+8', '30', '31', '2', '1', '21']);
  // Negative points difference: no "+" sign, just the minus.
  expect(await cellTexts(standingsRows(page).nth(4))).toEqual(['5', 'ALGONTEC ZARAGOZA', '10', '2', '0', '8', '160', '248', '-88', '25', '42', '1', '2', '11']);
  expect(await cellTexts(standingsRows(page).nth(5))).toEqual(['6', 'CE INEF LLEIDA', '10', '2', '0', '8', '129', '259', '-130', '22', '42', '1', '1', '10']);

  await expect(page.locator('#liga-standings-table .liga-pos')).toHaveText(['1', '2', '3', '4', '5', '6']);
  await expect(page.locator('#liga-standings-table .liga-pts')).toHaveText(['36', '36', '22', '21', '11', '10']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('CNPN row is highlighted and every team shows its crest', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');

  await expect(page.locator('#liga-standings-table tbody tr.liga-own-team')).toHaveCount(1);
  await expect(page.locator('#liga-standings-table tbody tr.liga-own-team .liga-team')).toHaveText('CNPN', { useInnerText: true });

  for (const [team, src] of Object.entries(CRESTS)) {
    const crest = page.locator('#liga-standings-table .liga-crest', { has: page.locator(`img[alt="${team}"]`) });
    await expect(crest).toHaveCount(1);
    await expect(crest).toHaveAttribute('title', team);
    await expect(crest.locator('img')).toHaveAttribute('src', src);
  }
  expect(relevantErrors(errors)).toEqual([]);
});

test('tabs switch between standings and results', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');

  await expect(tab(page, 'Clasificación')).toHaveClass(/active/);
  await expect(tab(page, 'Resultados')).not.toHaveClass(/active/);
  await expect(page.locator('#liga-panel-clasificacion')).toHaveClass(/active/);
  await expect(page.locator('#liga-panel-resultados')).not.toHaveClass(/active/);
  await expect(page.locator('#liga-standings-table')).toBeVisible();
  await expect(page.locator('#liga-results-list')).toBeHidden();

  await tab(page, 'Resultados').click();
  await expect(tab(page, 'Resultados')).toHaveClass(/active/);
  await expect(tab(page, 'Clasificación')).not.toHaveClass(/active/);
  await expect(page.locator('#liga-panel-resultados')).toHaveClass(/active/);
  await expect(page.locator('#liga-panel-clasificacion')).not.toHaveClass(/active/);
  await expect(page.locator('#liga-results-list')).toBeVisible();
  await expect(page.locator('#liga-standings-table')).toBeHidden();

  await tab(page, 'Clasificación').click();
  await expect(page.locator('#liga-panel-clasificacion')).toHaveClass(/active/);
  await expect(page.locator('#liga-standings-table')).toBeVisible();
  await expect(page.locator('#liga-results-list')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('results list every round with its matches; CNPN matches are highlighted', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');
  await tab(page, 'Resultados').click();

  await expect(page.locator('#liga-results-list .liga-jornada-heading')).toHaveText(ROUNDS);
  // 10 rounds x 3 matches + 2 semifinals + 1 final.
  await expect(page.locator('#liga-results-list .liga-match')).toHaveCount(33);
  // CNPN plays once per round, the semifinal and the final.
  await expect(page.locator('#liga-results-list .liga-match.liga-own-match')).toHaveCount(12);
  await expect(page.locator('#liga-results-list .liga-match.liga-own-match')).toContainText(Array(12).fill('CNPN'));

  const first = page.locator('#liga-results-list .liga-match').first();
  await expect(first.locator('.teams')).toHaveText(/VPC ANDORRA\s*43 - 38\s*CORNE\/CRUC/);
  await expect(first.locator('.score')).toHaveText('43 - 38');
  await expect(first.locator('.date')).toHaveText('11/10/2025');
  await expect(first).not.toHaveClass(/liga-own-match/);

  const final = page.locator('#liga-results-list .liga-match').last();
  await expect(final.locator('.teams')).toHaveText(/CORNE\/CRUC\s*8 - 13\s*CNPN/);
  await expect(final.locator('.date')).toHaveText('18/04/2026');
  await expect(final).toHaveClass(/liga-own-match/);
  // Home crest before the name, away crest after it.
  const crestAlts = await final.locator('.liga-crest img').evaluateAll((imgs) => imgs.map((i) => i.alt));
  expect(crestAlts).toEqual(['CORNE/CRUC', 'CNPN']);

  // NOTE: Jornada 10 keeps its source order even though its middle match has a later
  // date (21/03) than the other two (14/03); possibly a data typo.
  const j10 = page.locator('#liga-results-list .liga-match').nth(27);
  await expect(j10.locator('.date')).toHaveText('14/03/2026');
  await expect(page.locator('#liga-results-list .liga-match').nth(28).locator('.date')).toHaveText('21/03/2026');
  await expect(page.locator('#liga-results-list .liga-match').nth(29).locator('.teams')).toHaveText(/CORNE\/CRUC\s*24 - 11\s*CNPN/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('source note links to rugby.cat in a new tab', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'liga');
  const note = page.locator('#sec-liga .liga-source-note');
  await expect(note).toContainText('Datos de la temporada 2025-26, según');
  const link = note.getByRole('link', { name: 'rugby.cat' });
  await expect(link).toHaveAttribute('href', 'https://rugby.cat/dhc-femenina/divisio-dhonor-catalana-aon/');
  await expect(link).toHaveAttribute('target', '_blank');
  expect(relevantErrors(errors)).toEqual([]);
});

test('players see the same league data as admins', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await expect(page.locator('#league-position-num')).toHaveText('2º');
  await page.locator('#league-banner').click();
  await expect(page.locator('#sec-liga')).toHaveClass(/active/);
  await expect(page.locator('#liga-standings-table tbody .liga-team')).toHaveText(TEAMS_IN_ORDER, { useInnerText: true });
  await tab(page, 'Resultados').click();
  await expect(page.locator('#liga-results-list .liga-match')).toHaveCount(33);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: tabs, table header, source note and Inicio banner are translated', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#league-banner')).toContainText('Lliga');
  await expect(page.locator('#league-banner')).toContainText(/CNPN a la classificació/i);
  await expect(page.locator('#league-position-num')).toHaveText('2º');

  await goToSection(page, 'liga');
  await expect(page.locator('#sec-liga h2')).toHaveText('Lliga');
  await expect(page.locator('#sec-liga .back-link')).toHaveText(/Vestidor/);
  await expect(tab(page, 'Classificació')).toHaveClass(/active/);
  await expect(page.locator('#liga-standings-table thead th').nth(1)).toHaveText('Equip', { ignoreCase: true });
  await expect(page.locator('#sec-liga .liga-source-note')).toContainText('Dades de la temporada 2025-26, segons');

  await tab(page, 'Resultats').click();
  await expect(page.locator('#liga-panel-resultados')).toHaveClass(/active/);
  // Round names are data, not translated.
  await expect(page.locator('#liga-results-list .liga-jornada-heading').first()).toHaveText('Jornada 1');

  await page.evaluate(() => window.setLang('es'));
  await expect(tab(page, 'Resultados')).toHaveClass(/active/);
  await expect(page.locator('#liga-standings-table thead th').nth(1)).toHaveText('Equipo', { ignoreCase: true });
  expect(relevantErrors(errors)).toEqual([]);
});
