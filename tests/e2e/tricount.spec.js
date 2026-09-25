// Characterization tests for "Tricount" (shared expenses between players):
// expenses list, balances, suggested settlement plan, settle/undo, the add/edit
// expense modal and the Inicio banner.
//
// Seed (tests/e2e/fixtures/seed.js), seen by the player Juls:
//   Gasolina viaje a Tarragona  48    (12/09) paid by Juls,  split Juls/Rovi/Carla/Tanke
//   Cena post-partido           90    (19/09) paid by Rovi,  split Juls/Rovi/Carla/Paula/Tanke
//   Peajes                      12,60 (12/09) paid by Carla, split Juls/Carla/Tanke
//   settled: Tanke paid Rovi 18 (21/09)
// Balances: Juls +13,80 · Rovi +42 · Carla −21,60 · Paula −18 · Tanke −16,20
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Carla Font: jugadora (Comi Tesoreria), paid "Peajes".
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test');

const PLAYERS = ['Juls', 'Rovi', 'Carla', 'Paula', 'Tanke'];
const EXPENSE_ID = { gasolina: 'b1000000-0000-4000-8000-000000000001', cena: 'b1000000-0000-4000-8000-000000000002' };
const SETTLEMENT_ID = 'b2000000-0000-4000-8000-000000000001';

const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const expenseItem = (page, label) => page.locator('.tricount-expense-item').filter({ hasText: label });
const balanceCard = (page, name) => page.locator('.tricount-balance-card').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });

async function openTricount(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'tricount');
  await expect(page.locator('#sec-tricount')).toHaveClass(/active/);
  return ctx;
}
async function openSaldos(page) {
  await page.locator('.tricount-tabs').getByRole('button', { name: 'Saldos' }).click();
  await expect(page.locator('#tricount-panel-saldos')).toBeVisible();
}
async function openSettlements(page) {
  await page.locator('#tricount-settlement-toggle').click();
  await expect(page.locator('#tricount-settlement-collapse')).toBeVisible();
}

test('Gastos tab lists expenses grouped by date, newest first, with the summary totals', async ({ page }) => {
  const { errors } = await openTricount(page);
  await expect(page.locator('#tricount-panel-gastos')).toBeVisible();
  await expect(page.locator('#tricount-panel-saldos')).toBeHidden();

  await expect(page.locator('#tricount-summary-mine')).toHaveText('48,00 €');
  await expect(page.locator('#tricount-summary-total')).toHaveText('150,60 €');

  await expect(page.locator('.tricount-date-heading')).toHaveText(['19 de septiembre de 2026', '12 de septiembre de 2026']);
  await expect(page.locator('.tricount-expense-item .info b')).toHaveText(['Cena post-partido', 'Gasolina viaje a Tarragona', 'Peajes']);
  await expect(page.locator('.tricount-expense-item .info span')).toHaveText([
    'Pagado por Rovi · Entre 5 personas',
    'Pagado por Juls · Entre 4 personas',
    'Pagado por Carla · Entre 3 personas',
  ]);
  await expect(page.locator('.tricount-expense-item .amt')).toHaveText(['90,00 €', '48,00 €', '12,60 €']);

  // Only the creator of an expense can edit it; everybody gets a delete button.
  await expect(page.locator('.tricount-expense-item').getByRole('button', { name: 'Editar' })).toHaveCount(1);
  await expect(expenseItem(page, 'Gasolina viaje a Tarragona').getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(expenseItem(page, 'Cena post-partido').getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(page.locator('.tricount-expense-item').getByRole('button', { name: 'Eliminar' })).toHaveCount(3);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Saldos tab shows my balance and the per-player breakdown (only jugadoras/Capitana)', async ({ page }) => {
  const { errors } = await openTricount(page);
  await openSaldos(page);
  await expect(page.locator('#tricount-panel-gastos')).toBeHidden();
  await expect(page.locator('.tricount-tabs').getByRole('button', { name: 'Saldos' })).toHaveClass(/active/);

  const mine = page.locator('#tricount-my-balance');
  await expect(mine.locator('.label')).toHaveText('Tu saldo');
  await expect(mine.locator('.amt')).toHaveText('+13,80 €');
  await expect(mine.locator('.amt')).toHaveClass(/pos/);
  await expect(mine.locator('.hint')).toHaveText('Te deben dinero');

  // Staff (Jordi, Núria, Sergi) and the admin account are not part of Tricount.
  await expect(page.locator('.tricount-balance-card b')).toHaveText(PLAYERS);
  await expect(page.locator('.tricount-balance-card .amt')).toHaveText(['13,80 €', '42,00 €', '21,60 €', '18,00 €', '16,20 €']);
  await expect(page.locator('.tricount-balance-card .hint')).toHaveText(['le deben', 'le deben', 'debe', 'debe', 'debe']);
  await expect(balanceCard(page, 'Rovi').locator('.amt')).toHaveClass(/pos/);
  await expect(balanceCard(page, 'Carla').locator('.amt')).toHaveClass(/neg/);

  // Back to Gastos
  await page.locator('.tricount-tabs').getByRole('button', { name: 'Gastos' }).click();
  await expect(page.locator('#tricount-panel-gastos')).toBeVisible();
  await expect(page.locator('#tricount-panel-saldos')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('suggested reimbursements are collapsed by default and show the minimum settlement plan', async ({ page }) => {
  const { errors } = await openTricount(page);
  await openSaldos(page);
  const toggle = page.locator('#tricount-settlement-toggle');
  await expect(toggle).toHaveText('Ver reembolsos sugeridos');
  await expect(page.locator('#tricount-settlement-collapse')).toBeHidden();

  await toggle.click();
  await expect(page.locator('#tricount-settlement-collapse')).toBeVisible();
  await expect(toggle).toHaveText('Ocultar reembolsos sugeridos');
  await expect(toggle).toHaveClass(/open/);
  await expect(page.locator('.tricount-settlement-item .txt')).toHaveText([
    'Carla debe pagar 21,60 € a Rovi',
    'Paula debe pagar 18,00 € a Rovi',
    'Tanke debe pagar 2,40 € a Rovi',
    'Tanke debe pagar 13,80 € a Juls',
  ]);
  await expect(page.locator('.tricount-settlement-item').getByRole('button', { name: 'Marcar como pagado' })).toHaveCount(4);

  // Already settled payments
  await expect(page.locator('#tricount-settled-head')).toBeVisible();
  await expect(page.locator('#tricount-settled-head')).toHaveText('Pagos ya liquidados');
  await expect(page.locator('.tricount-settled-item .txt')).toHaveText(['Tanke pagó 18,00 € a Rovi']);
  await expect(page.locator('.tricount-settled-item').getByRole('button', { name: 'Deshacer' })).toBeVisible();

  await toggle.click();
  await expect(page.locator('#tricount-settlement-collapse')).toBeHidden();
  await expect(toggle).toHaveText('Ver reembolsos sugeridos');
  await expect(toggle).not.toHaveClass(/open/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('marking a suggested payment as paid saves a settlement and updates balances', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  await openSaldos(page);
  await openSettlements(page);

  await page.locator('.tricount-settlement-item').filter({ hasText: 'Tanke debe pagar 13,80 € a Juls' })
    .getByRole('button', { name: 'Marcar como pagado' }).click();

  await expect(page.locator('.tricount-settled-item .txt')).toHaveText(['Tanke pagó 13,80 € a Juls', 'Tanke pagó 18,00 € a Rovi']);
  await expect(page.locator('.tricount-settlement-item .txt')).toHaveText([
    'Carla debe pagar 21,60 € a Rovi',
    'Paula debe pagar 18,00 € a Rovi',
    'Tanke debe pagar 2,40 € a Rovi',
  ]);
  await expect(page.locator('#tricount-my-balance .amt')).toHaveText('0,00 €');
  await expect(page.locator('#tricount-my-balance .amt')).toHaveClass(/zero/);
  await expect(page.locator('#tricount-my-balance .hint')).toHaveText('Estás al día');
  await expect(balanceCard(page, 'Juls').locator('.hint')).toHaveText('al día');
  await expect(balanceCard(page, 'Tanke').locator('.amt')).toHaveText('2,40 €');

  const inserts = writesTo(backend, 'tricount_settlements');
  expect(inserts).toHaveLength(1);
  expect(inserts[0].method).toBe('INSERT');
  expect(inserts[0].body).toEqual([{ from_id: IDS.aina, to_id: IDS.player, amount: 13.8, iso: '2026-09-25' }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('undoing a settled payment deletes it and recalculates the plan', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  await openSaldos(page);
  await openSettlements(page);

  await page.locator('.tricount-settled-item').filter({ hasText: 'Tanke pagó 18,00 € a Rovi' })
    .getByRole('button', { name: 'Deshacer' }).click();

  await expect(page.locator('.tricount-settled-item')).toHaveCount(0);
  await expect(page.locator('#tricount-settled-head')).toBeHidden();
  await expect(page.locator('.tricount-settlement-item .txt')).toHaveText([
    'Tanke debe pagar 34,20 € a Rovi',
    'Carla debe pagar 21,60 € a Rovi',
    'Paula debe pagar 4,20 € a Rovi',
    'Paula debe pagar 13,80 € a Juls',
  ]);
  await expect(balanceCard(page, 'Rovi').locator('.amt')).toHaveText('60,00 €');
  await expect(balanceCard(page, 'Tanke').locator('.amt')).toHaveText('34,20 €');

  await expect.poll(() => writesTo(backend, 'tricount_settlements')).toHaveLength(1);
  const [del] = writesTo(backend, 'tricount_settlements');
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `eq.${SETTLEMENT_ID}`]]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('empty Tricount: empty states, then a first expense split with one person', async ({ page }) => {
  const { backend, errors } = await openTricount(page, { seed: { ...seed, tricount_expenses: [], tricount_settlements: [] } });
  await expect(page.locator('#tricount-expense-list')).toHaveText('Todavía no hay gastos apuntados. Añade el primero con el botón "+".');
  await expect(page.locator('#tricount-summary-mine')).toHaveText('0,00 €');
  await expect(page.locator('#tricount-summary-total')).toHaveText('0,00 €');

  await openSaldos(page);
  await expect(page.locator('#tricount-my-balance .amt')).toHaveText('0,00 €');
  await expect(page.locator('#tricount-my-balance .hint')).toHaveText('Estás al día');
  await expect(page.locator('.tricount-balance-card .hint')).toHaveText(PLAYERS.map(() => 'al día'));
  await openSettlements(page);
  await expect(page.locator('#tricount-settlement-list')).toHaveText('Todo el mundo está al día. No hay ningún pago pendiente 🎉');
  await expect(page.locator('#tricount-settled-head')).toBeHidden();

  await page.locator('#sec-tricount').getByRole('button', { name: 'Añadir gasto' }).click();
  await page.locator('#tricount-desc').fill('Cinta para los tobillos');
  await page.locator('#tricount-amount').fill('6.5');
  await page.locator('#tricount-participants-list').getByLabel('Juls', { exact: true }).check();
  await page.locator('#tricount-modal-save-btn').click();

  await expect(page.locator('#add-tricount-modal')).not.toHaveClass(/active/);
  await page.locator('.tricount-tabs').getByRole('button', { name: 'Gastos' }).click();
  await expect(page.locator('.tricount-date-heading')).toHaveText(['25 de septiembre de 2026']);
  await expect(page.locator('.tricount-expense-item .info span')).toHaveText(['Pagado por Juls · Entre 1 persona']);
  await expect(page.locator('#tricount-summary-mine')).toHaveText('6,50 €');
  await expect(page.locator('#tricount-summary-total')).toHaveText('6,50 €');
  expect(writesTo(backend, 'tricount_expenses')[0].body).toEqual([{
    label: 'Cinta para los tobillos', amount: 6.5, iso: '2026-09-25',
    paid_by: IDS.player, participants: [IDS.player], created_by: IDS.player,
  }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('add expense modal: defaults, validation messages and cancel', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  const modal = page.locator('#add-tricount-modal');

  await page.locator('#sec-tricount').getByRole('button', { name: 'Añadir gasto' }).click();
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#tricount-modal-title')).toHaveText('Nuevo gasto');
  await expect(page.locator('#tricount-modal-save-btn')).toHaveText('Guardar gasto');
  await expect(page.locator('#tricount-desc')).toHaveValue('');
  await expect(page.locator('#tricount-amount')).toHaveValue('');
  await expect(page.locator('#tricount-date')).toHaveValue('2026-09-25');
  await expect(page.locator('#tricount-paidby option')).toHaveText(PLAYERS);
  await expect(page.locator('#tricount-paidby option:checked')).toHaveText('Juls');
  await expect(page.locator('#tricount-participants-list label')).toHaveText(PLAYERS);
  await expect(page.locator('#tricount-participants-list input:checked')).toHaveCount(0);

  // Nothing filled in
  await page.locator('#tricount-modal-save-btn').click();
  await expect.poll(() => messages).toEqual(['Ponle un concepto y un importe válido al gasto.']);
  // Amount 0 is not valid either
  await page.locator('#tricount-desc').fill('Cena');
  await page.locator('#tricount-amount').fill('0');
  await page.locator('#tricount-modal-save-btn').click();
  await expect.poll(() => messages).toHaveLength(2);
  expect(messages[1]).toBe('Ponle un concepto y un importe válido al gasto.');
  // Valid amount but nobody to split it with
  await page.locator('#tricount-amount').fill('20');
  await page.locator('#tricount-modal-save-btn').click();
  await expect.poll(() => messages).toHaveLength(3);
  expect(messages[2]).toBe('Elige entre quién se reparte el gasto.');
  await expect(modal).toHaveClass(/active/);

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(writesTo(backend, 'tricount_expenses')).toEqual([]);

  // Reopening starts from scratch again
  await page.locator('#sec-tricount').getByRole('button', { name: 'Añadir gasto' }).click();
  await expect(page.locator('#tricount-desc')).toHaveValue('');
  await expect(page.locator('#tricount-amount')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('creating an expense paid by someone else saves it and updates list and balances', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  await page.locator('#sec-tricount').getByRole('button', { name: 'Añadir gasto' }).click();
  await page.locator('#tricount-desc').fill('Pizzas');
  await page.locator('#tricount-amount').fill('30');
  await page.locator('#tricount-date').fill('2026-09-24');
  await page.locator('#tricount-paidby').selectOption({ label: 'Rovi' });
  const participants = page.locator('#tricount-participants-list');
  for (const name of ['Juls', 'Rovi', 'Carla']) await participants.getByLabel(name, { exact: true }).check();
  await page.locator('#tricount-modal-save-btn').click();

  await expect(page.locator('#add-tricount-modal')).not.toHaveClass(/active/);
  await expect(page.locator('.tricount-date-heading')).toHaveText(['24 de septiembre de 2026', '19 de septiembre de 2026', '12 de septiembre de 2026']);
  await expect(page.locator('.tricount-expense-item .info b').first()).toHaveText('Pizzas');
  await expect(page.locator('.tricount-expense-item .info span').first()).toHaveText('Pagado por Rovi · Entre 3 personas');
  await expect(page.locator('.tricount-expense-item .amt').first()).toHaveText('30,00 €');
  // I created it, so I can edit it even though Rovi paid
  await expect(expenseItem(page, 'Pizzas').getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(page.locator('#tricount-summary-mine')).toHaveText('48,00 €');
  await expect(page.locator('#tricount-summary-total')).toHaveText('180,60 €');

  await openSaldos(page);
  await expect(page.locator('#tricount-my-balance .amt')).toHaveText('+3,80 €');
  await expect(balanceCard(page, 'Rovi').locator('.amt')).toHaveText('62,00 €');
  await expect(balanceCard(page, 'Carla').locator('.amt')).toHaveText('31,60 €');

  const writes = writesTo(backend, 'tricount_expenses');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('INSERT');
  expect(writes[0].body).toEqual([{
    label: 'Pizzas', amount: 30, iso: '2026-09-24',
    paid_by: IDS.marta, participants: [IDS.player, IDS.marta, IDS.carla], created_by: IDS.player,
  }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing my own expense pre-fills the modal and saves an UPDATE', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  await expenseItem(page, 'Gasolina viaje a Tarragona').getByRole('button', { name: 'Editar' }).click();

  const modal = page.locator('#add-tricount-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#tricount-modal-title')).toHaveText('Editar gasto');
  await expect(page.locator('#tricount-modal-save-btn')).toHaveText('Guardar cambios');
  await expect(page.locator('#tricount-desc')).toHaveValue('Gasolina viaje a Tarragona');
  await expect(page.locator('#tricount-amount')).toHaveValue('48');
  await expect(page.locator('#tricount-date')).toHaveValue('2026-09-12');
  await expect(page.locator('#tricount-paidby option:checked')).toHaveText('Juls');
  await expect(page.locator('#tricount-participants-list label').filter({ has: page.locator('input:checked') }))
    .toHaveText(['Juls', 'Rovi', 'Carla', 'Tanke']);

  await page.locator('#tricount-amount').fill('60');
  await page.locator('#tricount-participants-list').getByLabel('Tanke', { exact: true }).uncheck();
  await page.locator('#tricount-modal-save-btn').click();

  await expect(modal).not.toHaveClass(/active/);
  const item = expenseItem(page, 'Gasolina viaje a Tarragona');
  await expect(item.locator('.amt')).toHaveText('60,00 €');
  await expect(item.locator('.info span')).toHaveText('Pagado por Juls · Entre 3 personas');
  await expect(page.locator('.tricount-expense-item')).toHaveCount(3);
  await expect(page.locator('#tricount-summary-total')).toHaveText('162,60 €');

  const writes = writesTo(backend, 'tricount_expenses');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('UPDATE');
  expect(writes[0].filters).toEqual([['id', `eq.${EXPENSE_ID.gasolina}`]]);
  expect(writes[0].body).toEqual({
    label: 'Gasolina viaje a Tarragona', amount: 60, iso: '2026-09-12',
    paid_by: IDS.player, participants: [IDS.player, IDS.marta, IDS.carla],
  });

  // The next "add" is a new expense again, not an edit
  await page.locator('#sec-tricount').getByRole('button', { name: 'Añadir gasto' }).click();
  await expect(page.locator('#tricount-modal-title')).toHaveText('Nuevo gasto');
  await expect(page.locator('#tricount-desc')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting an expense removes it right away and deletes it in Supabase', async ({ page }) => {
  const { backend, errors } = await openTricount(page);
  // NOTE: any player can delete any expense (here one created by Rovi), without a
  // confirmation step; only editing is restricted to the creator.
  await expenseItem(page, 'Cena post-partido').getByRole('button', { name: 'Eliminar' }).click();

  await expect(page.locator('.tricount-expense-item .info b')).toHaveText(['Gasolina viaje a Tarragona', 'Peajes']);
  await expect(page.locator('.tricount-date-heading')).toHaveText(['12 de septiembre de 2026']);
  await expect(page.locator('#tricount-summary-total')).toHaveText('60,60 €');
  await openSaldos(page);
  await expect(page.locator('#tricount-my-balance .amt')).toHaveText('+31,80 €');

  await expect.poll(() => writesTo(backend, 'tricount_expenses')).toHaveLength(1);
  const [del] = writesTo(backend, 'tricount_expenses');
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `eq.${EXPENSE_ID.cena}`]]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner shows my Tricount balance and links to Tricount', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  const banner = page.locator('#inicio-tricount-banner');
  await expect(banner.locator('.txt b')).toHaveText('Tricount');
  // NOTE: expenses are only loaded when the Tricount section is opened, so right
  // after startup the Inicio banner says "al día" even though the player is owed money.
  await expect(banner.locator('.txt span')).toHaveText('Estás al día, ni debes ni te deben');
  await expect(banner.locator('.tt-personal')).toHaveClass(/tricount-zero/);

  await goToSection(page, 'tricount');
  await goToSection(page, 'inicio');
  await expect(banner.locator('.txt span')).toHaveText('Te deben 13,80 € 🤑');
  await expect(banner.locator('.tt-personal')).toHaveClass(/tricount-pos/);

  await banner.getByRole('button', { name: 'Tricount' }).click();
  await expect(page.locator('#sec-tricount')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner for someone who owes money', async ({ page }) => {
  const { errors } = await setupApp(page, { user: CARLA });
  await openApp(page);
  await goToSection(page, 'tricount');
  await expect(page.locator('#tricount-summary-mine')).toHaveText('12,60 €');
  // Carla created "Peajes", so that is the one she can edit
  await expect(expenseItem(page, 'Peajes').getByRole('button', { name: 'Editar' })).toBeVisible();
  await expect(expenseItem(page, 'Gasolina viaje a Tarragona').getByRole('button', { name: 'Editar' })).toHaveCount(0);

  await goToSection(page, 'inicio');
  const banner = page.locator('#inicio-tricount-banner');
  await expect(banner.locator('.txt span')).toHaveText('Debes 21,60 € 💸');
  await expect(banner.locator('.tt-personal')).toHaveClass(/tricount-neg/);
  await banner.click();
  await expect(page.locator('#sec-tricount')).toHaveClass(/active/);
  await openSaldos(page);
  await expect(page.locator('#tricount-my-balance .amt')).toHaveText('−21,60 €');
  await expect(page.locator('#tricount-my-balance .amt')).toHaveClass(/neg/);
  await expect(page.locator('#tricount-my-balance .hint')).toHaveText('Debes dinero');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan texts', async ({ page }) => {
  const { errors } = await openTricount(page, { seed: { ...seed, tricount_expenses: [
    ...seed.tricount_expenses,
    { id: 'b1000000-0000-4000-8000-000000000099', label: 'Samarretes', amount: 10, iso: '2026-08-23',
      paid_by: IDS.player, participants: [IDS.player], created_by: IDS.player },
  ] } });
  await page.evaluate(() => window.setLang('ca'));

  await expect(page.locator('.tricount-tabs button')).toHaveText(['Despeses', 'Saldos']);
  await expect(page.locator('#tricount-panel-gastos .stat-card .k')).toHaveText(['Despeses teves', 'Despeses totals']);
  await expect(page.locator('.tricount-date-heading')).toHaveText(['19 de setembre de 2026', '12 de setembre de 2026', "23 d'agost de 2026"]);
  await expect(expenseItem(page, 'Cena post-partido').locator('.info span')).toHaveText('Pagat per Rovi · Entre 5 persones');
  await expect(expenseItem(page, 'Samarretes').locator('.info span')).toHaveText('Pagat per Juls · Entre 1 persona');

  await page.locator('.tricount-tabs').getByRole('button', { name: 'Saldos' }).click();
  await expect(page.locator('#tricount-my-balance .label')).toHaveText('El teu saldo');
  await expect(page.locator('#tricount-my-balance .hint')).toHaveText('Et deuen diners');
  await expect(page.locator('.tricount-balance-card .hint').first()).toHaveText('li deuen');
  await expect(page.locator('#tricount-settlement-toggle')).toHaveText('Veure reemborsaments suggerits');
  await page.locator('#tricount-settlement-toggle').click();
  // NOTE: the toggle label is hardcoded in Spanish once it has been clicked.
  await expect(page.locator('#tricount-settlement-toggle')).toHaveText('Ocultar reembolsos sugeridos');
  await expect(page.locator('.tricount-settlement-item .txt').first()).toHaveText('Carla ha de pagar 21,60 € a Rovi');
  await expect(page.locator('.tricount-settlement-item button').first()).toHaveText('Marcar com a pagat');
  await expect(page.locator('#tricount-settled-head')).toHaveText('Pagaments ja liquidats');
  await expect(page.locator('.tricount-settled-item .txt')).toHaveText(['Tanke va pagar 18,00 € a Rovi']);
  await expect(page.locator('.tricount-settled-item button')).toHaveText('Desfer');

  await page.locator('#sec-tricount').getByRole('button', { name: 'Afegir despesa' }).click();
  await expect(page.locator('#tricount-modal-title')).toHaveText('Nova despesa');
  await expect(page.locator('#tricount-modal-save-btn')).toHaveText('Desar despesa');
  await page.locator('#add-tricount-modal').getByRole('button', { name: 'Cancel·lar' }).click();

  await goToSection(page, 'inicio');
  await expect(page.locator('#inicio-tricount-banner .txt span')).toHaveText('Et deuen 13,80 € 🤑');
  expect(relevantErrors(errors)).toEqual([]);
});

test('the admin account (treated as staff) cannot open Tricount', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openApp(page);
  await goToSection(page, 'tricount');
  await expect(page.locator('#sec-tricount')).not.toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(writesTo(backend, 'tricount_expenses')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});
