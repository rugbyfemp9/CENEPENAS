// Characterization tests for "Tercer tiempo" (the post-match social duty): the fixed
// groups A/B, which group cooks / cleans at each home match, the Inicio card, the list
// of upcoming matches, the history, the match detail (personal banner, group modal,
// swap requests, debts, food sign-up) and the automatic 3T fines.
//
// Home matches in chronological order (index -> group that cooks, the other cleans):
//   0 12/09 Partido vs Tarragona (past)   A cooks
//   1 19/09 Partido vs Gòtics    (past)   B cooks
//   2 26/09 Partido vs Santboi   (ce1, hardcoded, the "current" match)  A cooks
//   3 10/10 Partido vs Badalona           B cooks
// (03/10 Cornellà is away and not a tercer tiempo.)
// Groups (profiles.grupo_tercer_tiempo): A = Juls (the player), Rovi, Tanke;
// B = Carla, Paula. Staff / admin have no group.
// Seed covers on ce1: Paula -> Juls pending; Tanke covered by Carla (accepted), with the
// matching unsettled debt (Tanke owes Carla). Food (not tied to a match): Rovi pasta,
// Carla tortilla, Paula dulce; Juls has not signed up.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test'); // group B, covers Tanke on ce1
const PAULA = authUser(IDS.paula, 'paula@cnpenas.test'); // group B, Comi Tercer Temps
const AINA = authUser(IDS.aina, 'aina@cnpenas.test'); // "Tanke", group A, covered by Carla

const coverId = (n) => `c1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const debtId = (n) => `c2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const foodId = (n) => `c3000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);

// 22:30 on match day (Saturday 26/09): the moment the automatic 3T fines kick in.
const MATCH_DAY_NIGHT = new Date('2026-09-26T22:30:00+02:00');
const MATCH_DAY_MORNING = new Date('2026-09-26T11:00:00+02:00');

const inicioCard = (page) => page.locator('#inicio-tercer-banner');
const listRows = (page) => page.locator('#tercer-list .att-event');
const historyRows = (page) => page.locator('#tercer-history-list .att-event');
const personal = (page) => page.locator('#tt-banner .tt-personal');
const summary = (page) => page.locator('#swap-summary-card');
const requestItems = (page) => page.locator('#swap-summary-card .swap-request-item');
const foodCats = (page) => page.locator('#tt-food-grid .tt-food-cat');
const foodCat = (page, label) => foodCats(page).filter({ has: page.locator('.tt-food-cat-head b', { hasText: label }) });
const foodModal = (page) => page.locator('#food-slot-modal');

async function start(page, { user = USERS.player, seed: s = seed, clock } = {}) {
  const ctx = await setupApp(page, { user, seed: s });
  if (clock) await page.clock.setFixedTime(clock);
  await openApp(page);
  return ctx;
}

async function openList(page, opts) {
  const ctx = await start(page, opts);
  await goToSection(page, 'tercer');
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  return ctx;
}

// Opens the detail of the current match (ce1) from the list, like a user would.
async function openCurrentDetail(page, opts) {
  const ctx = await openList(page, opts);
  await listRows(page).first().click();
  await expect(page.locator('#sec-tercer-detalle')).toHaveClass(/active/);
  return ctx;
}

// ---------------------------------------------------------------------------
// Inicio card
// ---------------------------------------------------------------------------

test('Inicio card: the player cooks at the next home match; "Apúntate" opens its detail', async ({ page }) => {
  const { backend, errors } = await start(page);
  const card = inicioCard(page);
  await expect(card).toBeVisible();
  await expect(card.locator('.tt-personal')).toHaveClass(/cook/);
  await expect(card.locator('.txt b')).toHaveText('Tercer tiempo');
  await expect(card.locator('.txt span')).toHaveText('Te toca cocinar · Partido vs Santboi');
  await expect(card.locator('.tt-signup-btn')).toHaveText('Apúntate');

  await card.locator('.tt-signup-btn').click();
  await expect(page.locator('#sec-tercer-detalle')).toHaveClass(/active/);
  await expect(page.locator('#tercer-detalle-title')).toHaveText('Tercer tiempo · Partido vs Santboi');
  // The back link goes to the list (the detail was opened with origin "tercer").
  await page.locator('#sec-tercer-detalle .back-link').click();
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  expect(backend.mutations.filter((m) => m.kind === 'rest')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio card: clicking the card itself opens the Tercer tiempo list', async ({ page }) => {
  const { errors } = await start(page);
  await inicioCard(page).locator('.txt').click();
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio card: group B player covering a group A teammate cooks and cleans', async ({ page }) => {
  const { errors } = await start(page, { user: CARLA });
  await expect(inicioCard(page).locator('.tt-personal')).toHaveClass(/cook/);
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Cocinas y limpias · Partido vs Santboi');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio card: a group B player cleans', async ({ page }) => {
  const { errors } = await start(page, { user: PAULA });
  await expect(inicioCard(page).locator('.tt-personal')).toHaveClass(/clean/);
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Te toca limpiar · Partido vs Santboi');
  await expect(inicioCard(page).locator('.tt-signup-btn')).toHaveText('Apúntate');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio card: a covered player is free and sees who covers her (no sign-up button)', async ({ page }) => {
  const { errors } = await start(page, { user: AINA });
  await expect(inicioCard(page).locator('.tt-personal')).toHaveClass(/none/);
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Libras · te cubre Carla');
  await expect(inicioCard(page).locator('.tt-signup-btn')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio card: a player without a group', async ({ page }) => {
  const s = { ...seed, profiles: seed.profiles.map((p) => (p.id === IDS.player ? { ...p, grupo_tercer_tiempo: null } : p)) };
  const { errors } = await start(page, { seed: s });
  await expect(inicioCard(page).locator('.tt-personal')).toHaveClass(/none/);
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Todavía no estás en ningún grupo');
  await expect(inicioCard(page).locator('.tt-signup-btn')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// List, history, groups overview
// ---------------------------------------------------------------------------

test('list shows upcoming home matches with my role and status', async ({ page }) => {
  const { backend, errors } = await openList(page);
  await expect(page.locator('#sec-tercer h2')).toHaveText('Tercer tiempo');
  await expect(listRows(page)).toHaveCount(2);
  await expect(listRows(page).locator('.cal-date .d')).toHaveText(['26', '10']);
  await expect(listRows(page).locator('.cal-date .m')).toHaveText(['Sep', 'Oct']);
  await expect(listRows(page).locator('.info b')).toHaveText(['vs Santboi', 'vs Badalona']);
  await expect(listRows(page).locator('.info span:not(.tt-list-role)')).toHaveText([
    'Sábado 26/09/26 · CEM Mar Bella · 17:30h',
    'Sábado 10/10/26 · CEM Mar Bella · 17:30h',
  ]);
  await expect(listRows(page).locator('.tt-list-role')).toHaveText(['Te toca cocinar', 'Te toca limpiar']);
  await expect(listRows(page).nth(0).locator('.tt-list-role')).toHaveClass(/cook/);
  await expect(listRows(page).nth(1).locator('.tt-list-role')).toHaveClass(/clean/);
  await expect(listRows(page).locator('.tt-list-status')).toHaveText(['🟢 Abierto', '🟡 Próximamente']);
  await expect(listRows(page).nth(0).locator('.tt-list-status')).toHaveClass(/open/);
  await expect(listRows(page).nth(1).locator('.tt-list-status')).toHaveClass(/soon/);
  await expect(page.locator('#tt-groups-btn')).toBeVisible();
  expect(backend.mutations.filter((m) => m.kind === 'rest')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('groups overview modal lists the members of each group', async ({ page }) => {
  const { errors } = await openList(page);
  await page.locator('#tt-groups-btn').click();
  const modal = page.locator('#tt-groups-overview-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Grupos del tercer tiempo');
  await expect(modal.locator('.modal-sub')).toHaveText('Quién integra cada grupo');
  const cols = modal.locator('.tt-groups-preview-col');
  await expect(cols.locator('.tt-groups-preview-title')).toHaveText(['Grupo A', 'Grupo B']);
  await expect(cols.nth(0).locator('.info b')).toHaveText(['Juls', 'Rovi', 'Tanke']);
  await expect(cols.nth(1).locator('.info b')).toHaveText(['Carla', 'Paula']);
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('without upcoming home matches the list shows the groups inline and hides the groups button', async ({ page }) => {
  // Everything after today is away; the hardcoded ce1 (26/09) always exists, so the
  // clock is moved past it.
  const { errors } = await openList(page, { clock: new Date('2026-10-20T10:00:00+02:00') });
  await expect(page.locator('#tercer-list .att-roster-empty')).toHaveText('Todavía no hay partidos programados. Mientras tanto, así están repartidos los grupos de tercer tiempo:');
  const cols = page.locator('#tercer-list .tt-groups-preview-col');
  await expect(cols.locator('.tt-groups-preview-title')).toHaveText(['Grupo A', 'Grupo B']);
  await expect(cols.nth(0).locator('.info b')).toHaveText(['Juls', 'Rovi', 'Tanke']);
  await expect(cols.nth(1).locator('.info b')).toHaveText(['Carla', 'Paula']);
  await expect(page.locator('#tt-groups-btn')).toBeHidden();
  // The Inicio card falls back to the last home match (10/10, index 3 -> group A cleans).
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Te toca limpiar · Partido vs Badalona');
  expect(relevantErrors(errors)).toEqual([]);
});

test('history lists past home matches newest first and opens their detail', async ({ page }) => {
  const { errors } = await openList(page);
  await page.getByRole('button', { name: 'Ver tercers tiempos pasados' }).click();
  await expect(page.locator('#sec-tercer-historial')).toHaveClass(/active/);
  await expect(page.locator('#sec-tercer-historial h2')).toHaveText('Pasados');
  await expect(historyRows(page)).toHaveCount(2);
  await expect(historyRows(page).locator('.info b')).toHaveText(['vs Gòtics', 'vs Tarragona']);
  await expect(historyRows(page).locator('.info span:not(.tt-list-role)')).toHaveText([
    'Sábado 19/09/26 · CEM Mar Bella · 17:30 - 19:00h',
    'Sábado 12/09/26 · CEM Mar Bella · 12:00 - 13:30h',
  ]);
  await expect(historyRows(page).locator('.tt-list-role')).toHaveText(['Te toca limpiar', 'Te toca cocinar']);
  await expect(historyRows(page).locator('.tt-list-status')).toHaveText(['🔒 Cerrado', '🔒 Cerrado']);

  await historyRows(page).nth(0).click();
  await expect(page.locator('#sec-tercer-detalle')).toHaveClass(/active/);
  await expect(page.locator('#tercer-detalle-title')).toHaveText('Tercer tiempo · Partido vs Gòtics');
  await expect(personal(page)).toHaveClass(/clean/);
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca limpiar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Gòtics');
  // NOTE: past matches still offer "No puedo asistir".
  await expect(personal(page).locator('.tt-swap-btn')).toHaveText('No puedo asistir');
  await expect(page.locator('#tt-banner .tt-group-box .name')).toHaveText('GRUP B');

  await page.locator('#sec-tercer-detalle .back-link').click();
  await expect(page.locator('#sec-tercer-historial')).toHaveClass(/active/);
  await page.locator('#sec-tercer-historial .back-link').click();
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('empty history', async ({ page }) => {
  const s = { ...seed, att_events: seed.att_events.filter((e) => e.iso >= '2026-09-25') };
  const { errors } = await start(page, { seed: s });
  await goToSection(page, 'tercer-historial');
  await expect(page.locator('#tercer-history-list')).toHaveText('Todavía no hay tercers tiempos archivados.');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Match detail
// ---------------------------------------------------------------------------

test('detail of the current match: personal banner, group box and group modal', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await expect(page.locator('#tercer-detalle-title')).toHaveText('Tercer tiempo · Partido vs Santboi');
  await expect(personal(page)).toHaveClass(/cook/);
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca cocinar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Santboi');
  await expect(personal(page).locator('.tt-swap-btn')).toHaveText('No puedo asistir');
  const box = page.locator('#tt-banner .tt-group-box');
  await expect(box.locator('.lbl')).toHaveText('3r TEMPS');
  await expect(box.locator('.name')).toHaveText('GRUP A');
  await expect(box.locator('.hint')).toHaveText('Ver integrantes');

  await box.click();
  const modal = page.locator('#tt-group-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#tt-group-modal-title')).toHaveText('Grupo A');
  await expect(page.locator('#tt-group-modal-sub')).toHaveText('Organización del tercer tiempo · Partido vs Santboi');
  const rows = modal.locator('.tt-roster-row');
  await expect(rows.locator('.info b')).toHaveText(['Juls', 'Rovi', 'Tanke']);
  // NOTE: the logged-in player's own rango is not shown (empty), the others show it.
  await expect(rows.locator('.info span')).toHaveText(['', 'veterana', 'novata']);
  await expect(rows.locator('.dish')).toHaveText(['Por apuntarse', '🍝 Macarrones a la boloñesa', 'Por apuntarse']);
  await expect(rows.nth(0)).toHaveClass(/pending/);
  await expect(rows.nth(1)).not.toHaveClass(/pending/);
  await expect(rows.nth(1).locator('.dot')).toHaveClass(/ready/);
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(backend.mutations.filter((m) => m.kind === 'rest')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('detail of a later match: roles alternate and the group box shows the cooking group', async ({ page }) => {
  const { errors } = await openList(page);
  await listRows(page).nth(1).click();
  await expect(page.locator('#tercer-detalle-title')).toHaveText('Tercer tiempo · Partido vs Badalona');
  await expect(personal(page)).toHaveClass(/clean/);
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca limpiar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Badalona');
  await expect(page.locator('#tt-banner .tt-group-box .name')).toHaveText('GRUP B');
  await page.locator('#tt-banner .tt-group-box').click();
  await expect(page.locator('#tt-group-modal-title')).toHaveText('Grupo B');
  await expect(page.locator('#tt-group-modal-sub')).toHaveText('Organización del tercer tiempo · Partido vs Badalona');
  // NOTE: the food list is not tied to a match, so the dishes signed up for Santboi show here too.
  await expect(page.locator('#tt-group-modal .tt-roster-row .dish')).toHaveText(['🍳 Tortilla de patatas con cebolla', '🍰 Brownie']);
  // The Inicio card keeps showing the current match.
  await goToSection(page, 'inicio');
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Te toca cocinar · Partido vs Santboi');
  expect(relevantErrors(errors)).toEqual([]);
});

test('detail seen by a covered player and by the teammate covering her', async ({ page, browser }) => {
  const { errors } = await openCurrentDetail(page, { user: AINA });
  await expect(personal(page)).toHaveClass(/none/);
  await expect(personal(page).locator('.txt b')).toHaveText('Este turno te lo cubre Carla');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Santboi');
  await expect(personal(page).locator('.tt-swap-btn')).toHaveCount(0);
  await expect(requestItems(page)).toHaveCount(1);
  await expect(requestItems(page).locator('.txt b')).toHaveText('Le debes un turno a Carla');
  await expect(requestItems(page).locator('.txt span')).toHaveText('Te cubrió · se le devolverá sola en el próximo tercer tiempo que te toque');
  await expect(requestItems(page).locator('.badge.bad')).toHaveText('Pendiente');
  expect(relevantErrors(errors)).toEqual([]);

  const other = await browser.newPage();
  const ctx2 = await openCurrentDetail(other, { user: CARLA });
  await expect(personal(other)).toHaveClass(/cook/);
  await expect(personal(other).locator('.txt b')).toHaveText('Te toca cocinar y limpiar');
  await expect(personal(other).locator('.txt span')).toHaveText('Grupo B · Partido vs Santboi · cubres a Tanke');
  await expect(personal(other).locator('.tt-swap-btn')).toHaveText('No puedo asistir');
  await expect(requestItems(other)).toHaveCount(1);
  await expect(requestItems(other).locator('.txt b')).toHaveText('Tanke te debe un turno');
  await expect(requestItems(other).locator('.txt span')).toHaveText('La cubriste · se le devolverá sola en el próximo tercer tiempo que le toque');
  await expect(requestItems(other).locator('.badge.info')).toHaveText('Por cobrar');
  expect(relevantErrors(ctx2.errors)).toEqual([]);
  await other.close();
});

// ---------------------------------------------------------------------------
// Swap requests and debts
// ---------------------------------------------------------------------------

test('incoming swap request: rejecting it', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await expect(summary(page).locator('h3')).toHaveText('Tus cambios de turno');
  await expect(requestItems(page)).toHaveCount(1);
  await expect(requestItems(page).locator('.txt b')).toHaveText('Paula te pide cubrir su turno');
  await expect(requestItems(page).locator('.txt span')).toHaveText('Partido vs Santboi');

  await requestItems(page).getByRole('button', { name: 'Rechazar' }).click();
  await expect(summary(page).locator('.swap-empty')).toHaveText('No tienes cambios de turno pendientes.');
  await expect(requestItems(page)).toHaveCount(0);
  await expect.poll(() => writesTo(backend, 'third_time_covers')).toHaveLength(1);
  const [upd] = writesTo(backend, 'third_time_covers');
  expect(upd.method).toBe('UPDATE');
  expect(upd.filters).toEqual([['id', `eq.${coverId(1)}`]]);
  expect(upd.body).toEqual({ status: 'rechazado' });
  expect(writesTo(backend, 'third_time_debts')).toEqual([]);
  // My roles do not change.
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca cocinar');
  expect(relevantErrors(errors)).toEqual([]);
});

test('incoming swap request: accepting it swaps the duty and records a debt', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await requestItems(page).getByRole('button', { name: 'Aceptar' }).click();

  // Paula (group B, cleaning) is now covered by me: I cook (my group) and clean (hers).
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca cocinar y limpiar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Santboi · cubres a Paula');
  await expect(requestItems(page)).toHaveCount(1);
  await expect(requestItems(page).locator('.txt b')).toHaveText('Paula te debe un turno');
  await expect(requestItems(page).locator('.badge.info')).toHaveText('Por cobrar');

  await expect.poll(() => writesTo(backend, 'third_time_debts')).toHaveLength(1);
  const covers = writesTo(backend, 'third_time_covers');
  expect(covers).toHaveLength(1);
  expect(covers[0]).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${coverId(1)}`]], body: { status: 'aceptado' } });
  const [debt] = writesTo(backend, 'third_time_debts');
  expect(debt.method).toBe('INSERT');
  expect(debt.body).toEqual([{
    owed_by: IDS.paula, owed_to: IDS.player, settled: false,
    origin_match_id: EVENT_IDS.matchNext, origin_label: 'Partido vs Santboi',
  }]);

  await goToSection(page, 'inicio');
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Cocinas y limpias · Partido vs Santboi');
  expect(relevantErrors(errors)).toEqual([]);
});

test('"No puedo asistir": the swap modal, cancel and sending a request', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await personal(page).getByRole('button', { name: 'No puedo asistir' }).click();
  const modal = page.locator('#swap-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('No puedo asistir');
  await expect(page.locator('#swap-modal-sub')).toHaveText('Vas a pedir que alguien te cubra en "Partido vs Santboi". En cuanto lo confirmes, le llegará un aviso a tu compañera para que acepte el cambio.');
  // NOTE: every roster member except me is offered, staff and other-group players included.
  await expect(page.locator('#swap-teammate-select option')).toHaveText(['Rovi', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(writesTo(backend, 'third_time_covers')).toEqual([]);

  await personal(page).getByRole('button', { name: 'No puedo asistir' }).click();
  await page.locator('#swap-teammate-select').selectOption({ label: 'Rovi' });
  await modal.getByRole('button', { name: 'Enviar aviso' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await expect.poll(() => writesTo(backend, 'third_time_covers')).toHaveLength(1);
  const [ins] = writesTo(backend, 'third_time_covers');
  expect(ins.method).toBe('INSERT');
  expect(ins.body).toEqual([{ match_id: EVENT_IDS.matchNext, from_player_id: IDS.player, to_player_id: IDS.marta, status: 'pendiente', auto: false }]);

  // Still cooking until Rovi accepts, but the button disappears.
  await expect(personal(page).locator('.txt b')).toHaveText('Te toca cocinar');
  await expect(personal(page).locator('.tt-swap-btn')).toHaveCount(0);
  await expect(requestItems(page)).toHaveCount(2);
  await expect(requestItems(page).nth(1).locator('.txt b')).toHaveText('Esperando que Rovi confirme el cambio');
  await expect(requestItems(page).nth(1).locator('.txt span')).toHaveText('Partido vs Santboi');
  await expect(requestItems(page).nth(1).locator('.badge.warn')).toHaveText('Pendiente');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a debt from an earlier match is settled automatically at the next match where the creditor has a duty', async ({ page }) => {
  // Juls owes Rovi a turn from 19/09. Rovi (group A) cooks at ce1, so Juls is assigned
  // Rovi's turn automatically and the debt is marked as settled.
  const s = {
    ...seed,
    third_time_debts: [
      ...seed.third_time_debts,
      { id: debtId(9), owed_by: IDS.player, owed_to: IDS.marta, settled: false, origin_match_id: EVENT_IDS.matchPast2, origin_label: 'Partido vs Gòtics', settled_match_label: null, created_at: '2026-09-19T21:00:00Z' },
    ],
  };
  const { backend, errors } = await openCurrentDetail(page, { seed: s });
  await expect.poll(() => writesTo(backend, 'third_time_debts')).toHaveLength(1);
  await expect.poll(() => writesTo(backend, 'third_time_covers')).toHaveLength(1);
  const [cover] = writesTo(backend, 'third_time_covers');
  expect(cover.method).toBe('INSERT');
  expect(cover.body).toEqual([{ match_id: EVENT_IDS.matchNext, from_player_id: IDS.marta, to_player_id: IDS.player, status: 'aceptado', auto: true }]);
  const [debt] = writesTo(backend, 'third_time_debts');
  expect(debt.method).toBe('UPDATE');
  expect(debt.filters).toEqual([['id', `eq.${debtId(9)}`]]);
  expect(debt.body).toEqual({ settled: true, settled_match_label: 'Partido vs Santboi' });

  await expect(personal(page).locator('.txt b')).toHaveText('Te toca cocinar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grupo A · Partido vs Santboi · cubres a Rovi');
  // The settled debt no longer appears in my summary (only Paula's request).
  await expect(requestItems(page)).toHaveCount(1);
  await expect(requestItems(page).locator('.txt b')).toHaveText('Paula te pide cubrir su turno');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a debt is settled by whoever opens the app, even a player not involved', async ({ page }) => {
  const s = {
    ...seed,
    third_time_debts: [
      { id: debtId(9), owed_by: IDS.aina, owed_to: IDS.paula, settled: false, origin_match_id: EVENT_IDS.matchPast2, origin_label: 'Partido vs Gòtics', settled_match_label: null, created_at: '2026-09-19T21:00:00Z' },
    ],
  };
  // NOTE: the settling is done client-side by every logged-in user's app (here Carla's).
  const { backend, errors } = await start(page, { user: CARLA, seed: s });
  await expect.poll(() => writesTo(backend, 'third_time_covers')).toHaveLength(1);
  expect(writesTo(backend, 'third_time_covers')[0].body).toEqual([{ match_id: EVENT_IDS.matchNext, from_player_id: IDS.paula, to_player_id: IDS.aina, status: 'aceptado', auto: true }]);
  await expect.poll(() => writesTo(backend, 'third_time_debts')).toHaveLength(1);
  expect(writesTo(backend, 'third_time_debts')[0].body).toEqual({ settled: true, settled_match_label: 'Partido vs Santboi' });
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Food sign-up
// ---------------------------------------------------------------------------

test('food grid: categories with limited slots', async ({ page }) => {
  const { errors } = await openCurrentDetail(page);
  await expect(page.locator('#sec-tercer-detalle .tt-food-section .fantasy-label')).toHaveText('Qué llevamos');
  await expect(foodCats(page).locator('.tt-food-cat-head b')).toHaveText([
    '🍝 Pasta', '🍚 Arroz / Legumbres', '🥟 Empanadas', '🍳 Tortilla', '🍟 Para picar', '🍰 Dulce', '🍽️ Otros',
  ]);
  await expect(foodCats(page).locator('.tt-food-count')).toHaveText(['1/3', '0/3', '0/2', '1/2', '0/3', '1/3', '0/3']);
  await expect(foodCats(page).locator('.tt-food-count.full')).toHaveCount(0);
  await expect(foodCats(page).locator('.tt-food-slot')).toHaveCount(19);
  await expect(foodCats(page).locator('.tt-food-slot.empty')).toHaveCount(16);
  await expect(foodCats(page).locator('.tt-food-slot:not(.empty) .txt')).toHaveText([
    'Macarrones a la boloñesa — Rovi', 'Tortilla de patatas con cebolla — Carla', 'Brownie — Paula',
  ]);
  await expect(foodCat(page, 'Pasta').locator('.tt-food-slot.empty').first()).toHaveText('+Apuntarme');
  // Nobody can remove other people's dishes; no ✓/✕ outside match day.
  await expect(foodCats(page).locator('.del')).toHaveCount(0);
  await expect(foodCats(page).locator('.tt-food-check')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('food: signing myself up, validation, and removing myself', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  const msgs = [];
  page.on('dialog', (d) => msgs.push(d.message()));

  await foodCat(page, 'Arroz').locator('.tt-food-slot.empty').first().click();
  await expect(foodModal(page)).toHaveClass(/active/);
  await expect(page.locator('#food-slot-modal-title')).toHaveText('Añadir a Arroz / Legumbres');
  await expect(page.locator('#food-slot-modal-sub')).toHaveText('Se apunta con tu nombre automáticamente.');
  await expect(page.locator('#food-slot-confirm-btn')).toHaveText('Apuntarme');
  await expect(page.locator('#food-slot-input')).toHaveValue('');
  await expect(page.locator('#food-teammate-picker')).toBeHidden();

  await page.locator('#food-slot-confirm-btn').click();
  await expect.poll(() => msgs).toEqual(['Escribe qué vas a traer.']);
  await expect(foodModal(page)).toHaveClass(/active/);
  await page.locator('#food-slot-input').fill('   ');
  await page.locator('#food-slot-confirm-btn').click();
  await expect.poll(() => msgs).toHaveLength(2);
  expect(writesTo(backend, 'third_time_food')).toEqual([]);

  await page.locator('#food-slot-input').fill('  Lentejas estofadas ');
  await page.locator('#food-slot-confirm-btn').click();
  await expect(foodModal(page)).not.toHaveClass(/active/);
  const arroz = foodCat(page, 'Arroz');
  await expect(arroz.locator('.tt-food-count')).toHaveText('1/3');
  await expect(arroz.locator('.tt-food-slot:not(.empty) .txt')).toHaveText('Lentejas estofadas — Juls');
  await expect(arroz.locator('.del')).toHaveCount(1);

  const [ins] = writesTo(backend, 'third_time_food');
  expect(ins.method).toBe('INSERT');
  expect(ins.body).toEqual([{ category: 'arroz', detail: 'Lentejas estofadas', player_id: IDS.player }]);
  const newId = backend.db.third_time_food.find((r) => r.detail === 'Lentejas estofadas').id;

  // I now appear as signed up in my group's modal.
  await page.locator('#tt-banner .tt-group-box').click();
  await expect(page.locator('#tt-group-modal .tt-roster-row').nth(0).locator('.dish')).toHaveText('🍚 Lentejas estofadas');
  await page.locator('#tt-group-modal').getByRole('button', { name: 'Cerrar' }).click();

  await arroz.locator('.del').click();
  await expect(arroz.locator('.tt-food-count')).toHaveText('0/3');
  await expect(arroz.locator('.tt-food-slot.empty')).toHaveCount(3);
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(2);
  const del = writesTo(backend, 'third_time_food')[1];
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `eq.${newId}`]]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('food: signing up a teammate and filling a category', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await foodCat(page, 'Tortilla').locator('.tt-food-slot.empty').click();
  await expect(page.locator('#food-slot-modal-title')).toHaveText('Añadir a Tortilla');

  await page.locator('.food-modal-teammate-btn').click();
  await expect(page.locator('.food-modal-teammate-btn')).toHaveClass(/active/);
  await expect(page.locator('#food-teammate-picker')).toBeVisible();
  // Whole roster, me included and preselected.
  await expect(page.locator('#food-teammate-select option')).toHaveText(['Juls', 'Rovi', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);
  await expect(page.locator('#food-teammate-select option:checked')).toHaveText('Juls');

  await page.locator('#food-teammate-select').selectOption({ label: 'Tanke' });
  await expect(page.locator('#food-slot-modal-sub')).toHaveText('Se apuntará con el nombre de Tanke.');
  await expect(page.locator('#food-slot-confirm-btn')).toHaveText('Apuntarla');

  // Closing the picker goes back to signing up myself.
  await page.locator('.food-modal-teammate-btn').click();
  await expect(page.locator('#food-teammate-picker')).toBeHidden();
  await expect(page.locator('#food-slot-modal-sub')).toHaveText('Se apunta con tu nombre automáticamente.');
  await expect(page.locator('#food-slot-confirm-btn')).toHaveText('Apuntarme');

  await page.locator('.food-modal-teammate-btn').click();
  await page.locator('#food-teammate-select').selectOption({ label: 'Tanke' });
  await page.locator('#food-slot-input').fill('Tortilla de calabacín');
  await page.locator('#food-slot-confirm-btn').click();
  await expect(foodModal(page)).not.toHaveClass(/active/);

  const tortilla = foodCat(page, 'Tortilla');
  await expect(tortilla.locator('.tt-food-count')).toHaveText('2/2');
  await expect(tortilla.locator('.tt-food-count')).toHaveClass(/full/);
  await expect(tortilla.locator('.tt-food-slot.empty')).toHaveCount(0);
  await expect(tortilla.locator('.tt-food-slot .txt')).toHaveText(['Tortilla de patatas con cebolla — Carla', 'Tortilla de calabacín — Tanke']);
  // Not mine, so no remove button.
  await expect(tortilla.locator('.del')).toHaveCount(0);

  const writes = writesTo(backend, 'third_time_food');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual([{ category: 'tortilla', detail: 'Tortilla de calabacín', player_id: IDS.aina }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('food: cancelling the modal writes nothing', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page);
  await foodCat(page, 'Otros').locator('.tt-food-slot.empty').first().click();
  await page.locator('#food-slot-input').fill('Pan');
  await foodModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(foodModal(page)).not.toHaveClass(/active/);
  await expect(foodCat(page, 'Otros').locator('.tt-food-count')).toHaveText('0/3');
  expect(writesTo(backend, 'third_time_food')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('match day: Comi Tercer Temps marks dishes as brought / not brought', async ({ page }) => {
  const { backend, errors } = await openCurrentDetail(page, { user: PAULA, clock: MATCH_DAY_MORNING });
  const pasta = foodCat(page, 'Pasta').locator('.tt-food-slot:not(.empty)');
  await expect(foodCats(page).locator('.tt-food-check.check')).toHaveCount(3);
  await expect(foodCats(page).locator('.tt-food-check.cross')).toHaveCount(3);
  await expect(pasta.locator('.tt-food-check.check')).toHaveAttribute('title', 'Ha traído lo prometido');
  await expect(pasta.locator('.tt-food-check.cross')).toHaveAttribute('title', 'No lo ha traído');
  // Her own dish also has the remove button.
  await expect(foodCat(page, 'Dulce').locator('.del')).toHaveCount(1);

  await pasta.locator('.tt-food-check.check').click();
  await expect(pasta).toHaveClass(/brought/);
  await expect(pasta.locator('.tt-food-check.check')).toHaveClass(/on/);
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(1);

  await pasta.locator('.tt-food-check.cross').click();
  await expect(pasta).toHaveClass(/missing/);
  await expect(pasta).not.toHaveClass(/brought/);
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(2);

  // Pressing the active mark again clears it.
  await pasta.locator('.tt-food-check.cross').click();
  await expect(pasta).not.toHaveClass(/missing/);
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(3);

  const writes = writesTo(backend, 'third_time_food');
  expect(writes.map((w) => w.method)).toEqual(['UPDATE', 'UPDATE', 'UPDATE']);
  expect(writes.map((w) => w.filters)).toEqual([[['id', `eq.${foodId(1)}`]], [['id', `eq.${foodId(1)}`]], [['id', `eq.${foodId(1)}`]]]);
  expect(writes.map((w) => w.body)).toEqual([{ status: 'brought' }, { status: 'missing' }, { status: null }]);
  // Before 22:00 no automatic fines.
  expect(writesTo(backend, 'fines')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('match day: other players only see the brought / not brought badges', async ({ page }) => {
  const s = { ...seed, third_time_food: seed.third_time_food.map((f, i) => ({ ...f, status: ['brought', 'missing', null][i] })) };
  const { errors } = await openCurrentDetail(page, { seed: s, clock: MATCH_DAY_MORNING });
  await expect(foodCats(page).locator('.tt-food-check')).toHaveCount(0);
  await expect(foodCats(page).locator('.tt-food-status-badge')).toHaveText(['✓', '✕']);
  await expect(foodCat(page, 'Pasta').locator('.tt-food-status-badge')).toHaveClass(/brought/);
  await expect(foodCat(page, 'Pasta').locator('.tt-food-slot:not(.empty)')).toHaveClass(/brought/);
  await expect(foodCat(page, 'Tortilla').locator('.tt-food-status-badge')).toHaveClass(/missing/);
  await expect(foodCat(page, 'Tortilla').locator('.tt-food-slot:not(.empty)')).toHaveClass(/missing/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Automatic 3T fines (checkThirdTimeAutoFines)
// ---------------------------------------------------------------------------

test('automatic fines: at 22:00 on match day every cook who did not sign up gets a 7 € fine', async ({ page }) => {
  // Cooks at ce1 (group A adjusted by accepted covers): Juls (no dish -> fined),
  // Rovi (pasta, unchecked -> not fined), Carla covering Tanke (tortilla -> not fined).
  // Tanke is covered, so she is not fined.
  const { backend, errors } = await start(page, { clock: MATCH_DAY_NIGHT });
  await expect.poll(() => writesTo(backend, 'fines')).toHaveLength(1);
  const [ins] = writesTo(backend, 'fines');
  expect(ins.method).toBe('INSERT');
  expect(ins.body).toEqual([{ player_id: IDS.player, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-26' }]);

  await goToSection(page, 'multas');
  await expect(page.locator('#fines-table-body tr').filter({ hasText: 'Juls' }).locator('.fine-chip', { hasText: '3T' })).toHaveCount(1);
  // Reloading does not fine again (the fine is already there for this match).
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  expect(writesTo(backend, 'fines')).toHaveLength(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('automatic fines: a cook marked as "not brought" is fined too; already fined players are skipped', async ({ page }) => {
  const s = {
    ...seed,
    third_time_food: seed.third_time_food.map((f) => (f.player_id === IDS.marta ? { ...f, status: 'missing' } : { ...f, status: 'brought' })),
    fines: [...seed.fines, { id: 'f0000000-0000-4000-8000-000000000099', player_id: IDS.player, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-26', paid_at: null, created_at: '2026-09-26T22:00:00Z' }],
  };
  const { backend, errors } = await start(page, { seed: s, clock: MATCH_DAY_NIGHT });
  await expect.poll(() => writesTo(backend, 'fines')).toHaveLength(1);
  await page.waitForTimeout(300);
  const writes = writesTo(backend, 'fines');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual([{ player_id: IDS.marta, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-26' }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('automatic fines: nothing before 22:00 nor on other days', async ({ page, browser }) => {
  const { backend, errors } = await start(page, { clock: new Date('2026-09-26T21:59:00+02:00') });
  await page.waitForTimeout(300);
  expect(writesTo(backend, 'fines')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);

  const other = await browser.newPage();
  const ctx2 = await start(other, { clock: new Date('2026-09-25T23:00:00+02:00') });
  await other.waitForTimeout(300);
  expect(writesTo(ctx2.backend, 'fines')).toEqual([]);
  expect(relevantErrors(ctx2.errors)).toEqual([]);
  await other.close();
});

test('automatic fines: marking a dish as not brought after 22:00 fines that cook at once', async ({ page }) => {
  // NOTE: the fines are written by whoever has the app open: here Paula's app also
  // fines Juls (no dish) on load.
  const { backend, errors } = await openCurrentDetail(page, { user: PAULA, clock: MATCH_DAY_NIGHT });
  await expect.poll(() => writesTo(backend, 'fines')).toHaveLength(1);
  expect(writesTo(backend, 'fines')[0].body[0]).toMatchObject({ player_id: IDS.player, reason_id: 'tercer', auto_match_iso: '2026-09-26' });

  await foodCat(page, 'Pasta').locator('.tt-food-check.cross').click();
  await expect.poll(() => writesTo(backend, 'fines')).toHaveLength(2);
  expect(writesTo(backend, 'fines')[1].body).toEqual([{ player_id: IDS.marta, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-26' }]);
  // Un-marking does not remove the fine; marking again does not duplicate it.
  await foodCat(page, 'Pasta').locator('.tt-food-check.cross').click();
  await foodCat(page, 'Pasta').locator('.tt-food-check.cross').click();
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(3);
  expect(writesTo(backend, 'fines')).toHaveLength(2);
  // Paula (group B) is not a cook at ce1, her dish status is irrelevant.
  await foodCat(page, 'Dulce').locator('.tt-food-check.cross').click();
  await expect.poll(() => writesTo(backend, 'third_time_food')).toHaveLength(4);
  expect(writesTo(backend, 'fines')).toHaveLength(2);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Language and staff
// ---------------------------------------------------------------------------

test('Catalan texts', async ({ page }) => {
  const { errors } = await openCurrentDetail(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#tercer-detalle-title')).toHaveText('Tercer temps · Partido vs Santboi');
  await expect(personal(page).locator('.txt b')).toHaveText('Et toca cuinar');
  await expect(personal(page).locator('.txt span')).toHaveText('Grup A · Partido vs Santboi');
  await expect(personal(page).locator('.tt-swap-btn')).toHaveText('No puc assistir');
  await expect(page.locator('#tt-banner .tt-group-box .hint')).toHaveText('Veure integrants');
  await expect(summary(page).locator('h3')).toHaveText('Els teus canvis de torn');
  await expect(requestItems(page).locator('.txt b')).toHaveText('Paula et demana cobrir el seu torn');
  await expect(requestItems(page).getByRole('button')).toHaveText(['Rebutjar', 'Acceptar']);
  await expect(foodCats(page).locator('.tt-food-cat-head b')).toHaveText([
    '🍝 Pasta', '🍚 Arròs / Llegums', '🥟 Empanades', '🍳 Truita', '🍟 Per picar', '🍰 Dolç', '🍽️ Altres',
  ]);
  await expect(page.locator('#sec-tercer-detalle .tt-food-section .fantasy-label')).toHaveText('Què portem');

  await page.locator('#sec-tercer-detalle .back-link').click();
  await expect(page.locator('#sec-tercer h2')).toHaveText('Tercer temps');
  await expect(listRows(page).locator('.tt-list-role')).toHaveText(['Et toca cuinar', 'Et toca netejar']);
  await expect(listRows(page).locator('.tt-list-status')).toHaveText(['🟢 Obert', '🟡 Properament']);
  await expect(listRows(page).locator('.cal-date .m')).toHaveText(['Set', 'Oct']);
  await goToSection(page, 'inicio');
  await expect(inicioCard(page).locator('.txt b')).toHaveText('Tercer temps');
  await expect(inicioCard(page).locator('.txt span')).toHaveText('Et toca cuinar · Partido vs Santboi');
  await expect(inicioCard(page).locator('.tt-signup-btn')).toHaveText("Apunta't");
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff (the admin account) does not see Tercer tiempo and is redirected to Vestuario', async ({ page }) => {
  const { backend, errors } = await start(page, { user: USERS.admin });
  await expect(inicioCard(page)).toBeHidden();
  for (const id of ['tercer', 'tercer-historial', 'tercer-detalle']) {
    await goToSection(page, id);
    await expect(page.locator(`#sec-${id}`)).not.toHaveClass(/active/);
    await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  }
  expect(writesTo(backend, 'third_time_covers')).toEqual([]);
  expect(writesTo(backend, 'third_time_debts')).toEqual([]);
  expect(writesTo(backend, 'third_time_food')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});
