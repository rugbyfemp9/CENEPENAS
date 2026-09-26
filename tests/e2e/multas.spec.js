// Characterization tests for "Multas" (fines): the team fines table (chips grouped by
// reason, edit mode), the personal summary ("Debes ..."), the "pay my fine" flow with
// the confirmation request to the Comi Tesoreria member, the add / edit / delete
// modals, the paid-fines history, the Inicio banner and the Vestuario card total.
//
// Fixed reasons: TA Tarjeta amarilla 5 €, TR Tarjeta roja 10 €, R Retraso 2 €,
// 3T Tercer tiempo 7 €.
// Seed fines (created_at order), pending ones in the team table:
//   f1 Juls  R  pendiente                 f6 Paula R  pendiente, paid to the admin (awaiting)
//   f7 Tanke 3T pendiente                 f2 Juls  TA pendiente, paid to Carla (awaiting)
//   f4 Rovi  TA pendiente                 f8 Tanke R  pendiente
// Paid (history): f3 Juls 3T 15/09, f5 Rovi TR 18/09, f9 Carla R 21/09.
// Team pending total: 7 + 2 + 9 + 5 = 23 €.
// Only Comi Tesoreria members (Carla) and the admin can add/edit/delete fines. Multas is
// NOT one of the sections hidden from staff, so the admin can open it too.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Carla Font: jugadora, member of Comi Tesoreria.
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test');
// Paula Vidal: jugadora (Comi Tercer Temps), 2 € pending.
const PAULA = authUser(IDS.paula, 'paula@cnpenas.test');

const fineId = (n) => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const fineWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === 'fines');
const treasuryWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === 'treasury_entries');

const tableRows = (page) => page.locator('#fines-table-body tr');
const rowOf = (page, name) => tableRows(page).filter({ has: page.locator('.meta b', { hasText: new RegExp(`^${name}$`) }) });
const myCard = (page) => page.locator('#my-fines-card');
const requests = (page) => page.locator('#fine-confirm-requests');
const fineModal = (page) => page.locator('#fine-modal');
const editModal = (page) => page.locator('#edit-fine-modal');
const payModal = (page) => page.locator('#pay-fine-modal');
const historyModal = (page) => page.locator('#fines-history-modal');
const addBtn = (page) => page.locator('#add-fine-btn');
const editToggle = (page) => page.locator('#edit-fines-toggle-btn');

async function openMultas(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'multas');
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
  return ctx;
}

async function expectTeamTable(page, expected) {
  await expect(tableRows(page)).toHaveCount(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const [name, chips, total] = expected[i];
    const row = tableRows(page).nth(i);
    await expect(row.locator('.meta b')).toHaveText(name);
    await expect(row.locator('.fine-chip')).toHaveText(chips);
    await expect(row.locator('td').nth(2)).toHaveText(total);
    await expect(row.locator('td').nth(3)).toHaveText('Pendiente');
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test('team table lists every player with pending fines, grouped by reason; read-only for players', async ({ page }) => {
  const { backend, errors } = await openMultas(page);
  await expect(page.locator('#sec-multas h2')).toHaveText('Multas del equipo');
  await expect(page.locator('#sec-multas .fines-table th')).toHaveText(['Jugadora', 'Motivo', 'Importe', 'Estado']);
  // Order: first pending fine of each player, by created_at.
  await expectTeamTable(page, [
    ['Juls', ['R', 'TA ⏳'], '7 €'],
    ['Paula', ['R ⏳'], '2 €'],
    ['Tanke', ['3T', 'R'], '9 €'],
    ['Rovi', ['TA'], '5 €'],
  ]);
  await expect(tableRows(page).locator('.badge.bad')).toHaveCount(4);
  const julsChips = rowOf(page, 'Juls').locator('.fine-chip');
  await expect(julsChips.nth(0)).toHaveAttribute('data-reason', 'retraso');
  await expect(julsChips.nth(0)).toHaveAttribute('title', 'Retraso · 2 € · Clic para marcar como pagada');
  await expect(julsChips.nth(1)).toHaveAttribute('data-reason', 'amarilla');
  await expect(julsChips.nth(1)).toHaveAttribute('title', 'Tarjeta amarilla · 5 € · Clic para marcar como pagada (alguna a la espera de confirmación)');

  await expect(addBtn(page)).toBeHidden();
  await expect(editToggle(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Histórico de multas pagadas' })).toBeVisible();
  await expect(requests(page)).toBeHidden();
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('several fines of the same reason collapse into one chip with a count', async ({ page }) => {
  const extra = [
    { id: fineId(10), player_id: IDS.marta, reason_id: 'amarilla', status: 'pendiente', paid_to_id: null, auto_match_iso: null, paid_at: null, created_at: '2026-09-23T10:00:00Z' },
    { id: fineId(11), player_id: IDS.marta, reason_id: 'amarilla', status: 'pendiente', paid_to_id: IDS.carla, auto_match_iso: null, paid_at: null, created_at: '2026-09-23T10:01:00Z' },
    { id: fineId(12), player_id: IDS.marta, reason_id: 'roja', status: 'pendiente', paid_to_id: null, auto_match_iso: null, paid_at: null, created_at: '2026-09-23T10:02:00Z' },
  ];
  const { errors } = await openMultas(page, { seed: { ...seed, fines: [...seed.fines, ...extra] } });
  const rovi = rowOf(page, 'Rovi');
  await expect(rovi.locator('.fine-chip')).toHaveText(['3TA ⏳', 'TR']);
  await expect(rovi.locator('td').nth(2)).toHaveText('25 €');
  await expect(rovi.locator('.fine-chip').nth(0)).toHaveAttribute('title',
    '3 × Tarjeta amarilla · 5 € cada una · Clic para marcar una como pagada (alguna a la espera de confirmación)');
  expect(relevantErrors(errors)).toEqual([]);
});

test('personal summary for a player who owes money', async ({ page }) => {
  const { errors } = await openMultas(page);
  await expect(myCard(page).locator('.my-fines-head')).toHaveClass(/owing/);
  await expect(myCard(page).locator('.my-fines-head .label')).toHaveText('Debes');
  await expect(myCard(page).locator('.my-fines-head .amount')).toHaveText('7 €');
  const myRows = myCard(page).locator('.my-fine-row');
  await expect(myRows).toHaveCount(2);
  await expect(myRows.locator('.reason')).toHaveText(['Retraso', 'Tarjeta amarilla']);
  await expect(myRows.locator('.amt')).toHaveText(['2 €', '5 €']);
  await expect(myRows.nth(0).getByRole('button', { name: 'Pagar multa' })).toBeVisible();
  await expect(myRows.nth(1).locator('.fine-awaiting-badge')).toHaveText('Esperando confirmación…');
  await expect(myRows.nth(1).getByRole('button')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner and Vestuario total for a player who owes 5 € or more', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  const banner = page.locator('#inicio-fines-banner');
  await expect(banner.locator('.tt-personal')).toHaveClass(/fines-danger/);
  await expect(banner.locator('.txt b')).toHaveText('Multas');
  await expect(banner.locator('.txt span')).toHaveText('Paga la coca, primer aviso · Debes 7 € 🔪');

  await banner.getByRole('button', { name: 'Multas' }).click();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);

  await goToSection(page, 'vestuario');
  // Team-wide total of pending fines (not the player's own).
  await expect(page.locator('#vest-multas-total')).toHaveText('23 € pendientes');
  await page.locator('.vest-card.i-multas').click();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
  await page.locator('#sec-multas .back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner warns under 5 € and congratulates when nothing is owed', async ({ page }) => {
  // Paula owes 2 € (a fine already marked as paid to the admin, still pending).
  const { errors } = await setupApp(page, { user: PAULA });
  await openApp(page);
  const banner = page.locator('#inicio-fines-banner');
  await expect(banner.locator('.tt-personal')).toHaveClass(/fines-warn/);
  await expect(banner.locator('.txt span')).toHaveText('Venga, espabila y paga · Debes 2 € 💸');
  await expect(banner.getByRole('button', { name: 'Multas' })).toBeVisible();

  await goToSection(page, 'multas');
  await expect(myCard(page).locator('.my-fines-head .amount')).toHaveText('2 €');
  await expect(myCard(page).locator('.my-fine-row .fine-awaiting-badge')).toHaveText('Esperando confirmación…');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a Comi Tesoreria member with nothing owed: ok banner, "Estás al día" and the confirm request', async ({ page }) => {
  const { errors } = await setupApp(page, { user: CARLA });
  await openApp(page);
  const banner = page.locator('#inicio-fines-banner');
  await expect(banner.locator('.tt-personal')).toHaveClass(/fines-ok/);
  await expect(banner.locator('.txt b')).toHaveText('Multas');
  await expect(banner.locator('.txt span')).toHaveText('¡Enhorabuena, no debes nada! 🥳');
  await expect(banner.getByRole('button')).toHaveCount(0);

  await goToSection(page, 'multas');
  await expect(myCard(page).locator('.my-fines-head')).toHaveClass(/clear/);
  await expect(myCard(page).locator('.label')).toHaveText('Tu situación');
  await expect(myCard(page).locator('.amount')).toHaveText('Estás al día');

  // Juls marked her yellow card as paid to Carla.
  await expect(requests(page)).toBeVisible();
  const reqRows = requests(page).locator('.fine-confirm-row');
  await expect(reqRows).toHaveCount(1);
  await expect(reqRows.locator('.fine-confirm-msg')).toContainText('Juls te ha pagado su multa');
  await expect(reqRows.locator('.fine-confirm-msg b')).toHaveText('Juls');
  await expect(reqRows.locator('.fine-confirm-sub')).toHaveText('Tarjeta amarilla · 5 €');
  await expect(reqRows.getByRole('button', { name: 'Confirmar pago' })).toBeVisible();
  await expect(reqRows.getByRole('button', { name: 'No es cierto' })).toBeVisible();

  await expect(addBtn(page)).toBeVisible();
  await expect(editToggle(page)).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('the admin can open Multas, manage fines and gets the requests addressed to her', async ({ page }) => {
  const { errors } = await openMultas(page, { user: USERS.admin });
  await expect(addBtn(page)).toBeVisible();
  await expect(editToggle(page)).toBeVisible();
  const reqRows = requests(page).locator('.fine-confirm-row');
  await expect(reqRows).toHaveCount(1);
  await expect(reqRows.locator('.fine-confirm-msg')).toContainText('Paula te ha pagado su multa');
  await expect(reqRows.locator('.fine-confirm-sub')).toHaveText('Retraso · 2 €');
  await expect(myCard(page).locator('.amount')).toHaveText('Estás al día');
  await expectTeamTable(page, [
    ['Juls', ['R', 'TA ⏳'], '7 €'],
    ['Paula', ['R ⏳'], '2 €'],
    ['Tanke', ['3T', 'R'], '9 €'],
    ['Rovi', ['TA'], '5 €'],
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('empty states without any fine', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: { ...seed, fines: [] } });
  await openApp(page);
  await expect(page.locator('#inicio-fines-banner .txt span')).toHaveText('¡Enhorabuena, no debes nada! 🥳');
  await goToSection(page, 'vestuario');
  await expect(page.locator('#vest-multas-total')).toHaveText('0 € pendientes');

  await goToSection(page, 'multas');
  await expect(tableRows(page)).toHaveCount(1);
  await expect(page.locator('#fines-table-body')).toHaveText('Nadie tiene multas pendientes. 🎉');
  await expect(myCard(page).locator('.amount')).toHaveText('Estás al día');
  await expect(requests(page)).toBeHidden();

  await page.getByRole('button', { name: 'Histórico de multas pagadas' }).click();
  await expect(historyModal(page)).toHaveClass(/active/);
  await expect(page.locator('#fines-history-list')).toHaveText('Todavía no hay ninguna multa pagada.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('history modal lists paid fines, most recently paid first', async ({ page }) => {
  const { errors } = await openMultas(page);
  await page.getByRole('button', { name: 'Histórico de multas pagadas' }).click();
  const modal = historyModal(page);
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Histórico de multas pagadas');
  await expect(modal.locator('.modal-sub')).toHaveText('Cada multa se archiva aquí en cuanto se marca como pagada.');
  const items = page.locator('#fines-history-list > div');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Carla');
  await expect(items.nth(0)).toContainText('Retraso · 2 €');
  await expect(items.nth(0)).toContainText('21/09/2026');
  await expect(items.nth(1)).toContainText('Rovi');
  await expect(items.nth(1)).toContainText('Tarjeta roja · 10 €');
  await expect(items.nth(1)).toContainText('18/09/2026');
  await expect(items.nth(2)).toContainText('Juls');
  await expect(items.nth(2)).toContainText('Tercer tiempo · 7 €');
  await expect(items.nth(2)).toContainText('15/09/2026');

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Paying a fine
// ---------------------------------------------------------------------------

test('player pays her own fine: it waits for the treasurer\'s confirmation', async ({ page }) => {
  const { backend, errors } = await openMultas(page);
  await myCard(page).getByRole('button', { name: 'Pagar multa' }).click();
  const modal = payModal(page);
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Pagar multa');
  await expect(modal.locator('.modal-sub')).toHaveText('¿A quién de Comi Tesoreria se le ha pagado? El ingreso se añadirá solo a su tabla de movimientos.');
  // The admin account is not part of the roster, so only Carla is offered.
  await expect(page.locator('#pay-fine-responsible-input option')).toHaveText(['Carla']);
  await expect(page.locator('#pay-fine-responsible-empty')).toBeHidden();

  // Cancel does nothing
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(fineWrites(backend)).toEqual([]);

  await myCard(page).getByRole('button', { name: 'Pagar multa' }).click();
  await modal.getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await expect(myCard(page).locator('.my-fines-head .amount')).toHaveText('7 €');
  await expect(myCard(page).locator('.fine-awaiting-badge')).toHaveCount(2);
  await expect(myCard(page).getByRole('button', { name: 'Pagar multa' })).toHaveCount(0);
  await expect(rowOf(page, 'Juls').locator('.fine-chip')).toHaveText(['R ⏳', 'TA ⏳']);
  await expect(page.locator('#inicio-fines-banner .txt span')).toHaveText('Paga la coca, primer aviso · Debes 7 € 🔪');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  expect(upd.method).toBe('UPDATE');
  expect(upd.body).toEqual({ paid_to_id: IDS.carla });
  expect(upd.filters).toEqual([['id', `eq.${fineId(1)}`]]);
  expect(treasuryWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('clicking a chip already awaiting confirmation only shows a message', async ({ page }) => {
  const { backend, errors } = await openMultas(page);
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await rowOf(page, 'Juls').locator('.fine-chip', { hasText: 'TA' }).click();
  await expect.poll(() => messages).toEqual(['Ya está marcada como pagada a Carla, a la espera de que lo confirme.']);
  await expect(payModal(page)).not.toHaveClass(/active/);

  // Paula's fine is awaiting the admin, who is not in the roster.
  await rowOf(page, 'Paula').locator('.fine-chip').click();
  await expect.poll(() => messages).toHaveLength(2);
  expect(messages[1]).toBe('Ya está marcada como pagada a Alguien, a la espera de que lo confirme.');
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('any player can mark someone else\'s fine as paid from the team table', async ({ page }) => {
  const { backend, errors } = await openMultas(page);
  // NOTE: there is no permission check here: a regular player can mark another
  // player's fine as paid to a treasurer (it still needs the treasurer's confirmation).
  await rowOf(page, 'Rovi').locator('.fine-chip').click();
  await expect(payModal(page)).toHaveClass(/active/);
  await payModal(page).getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(payModal(page)).not.toHaveClass(/active/);
  await expect(rowOf(page, 'Rovi').locator('.fine-chip')).toHaveText(['TA ⏳']);

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  expect(upd).toMatchObject({ method: 'UPDATE', body: { paid_to_id: IDS.carla }, filters: [['id', `eq.${fineId(4)}`]] });
  expect(relevantErrors(errors)).toEqual([]);
});

test('without any Comi Tesoreria member, paying marks the fine as paid at once', async ({ page }) => {
  const profiles = seed.profiles.map((p) => (p.id === IDS.carla ? { ...p, comision: null } : p));
  const { backend, errors } = await openMultas(page, { seed: { ...seed, profiles } });
  await myCard(page).getByRole('button', { name: 'Pagar multa' }).click();
  await expect(payModal(page)).toHaveClass(/active/);
  await expect(page.locator('#pay-fine-responsible-input')).toBeHidden();
  await expect(page.locator('#pay-fine-responsible-empty')).toBeVisible();
  await expect(page.locator('#pay-fine-responsible-empty')).toHaveText('Todavía nadie tiene marcado "Comi Tesoreria" en su perfil.');
  await payModal(page).getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(payModal(page)).not.toHaveClass(/active/);

  await expect(myCard(page).locator('.my-fines-head .amount')).toHaveText('5 €');
  await expect(myCard(page).locator('.my-fine-row .reason')).toHaveText(['Tarjeta amarilla']);
  await expect(rowOf(page, 'Juls').locator('.fine-chip')).toHaveText(['TA ⏳']);
  await expect(rowOf(page, 'Juls').locator('td').nth(2)).toHaveText('5 €');

  await page.getByRole('button', { name: 'Histórico de multas pagadas' }).click();
  const first = page.locator('#fines-history-list > div').first();
  await expect(first).toContainText('Juls');
  await expect(first).toContainText('Retraso · 2 €');
  await expect(first).toContainText('25/09/2026');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  // NOTE: paid_at is set locally but never sent to Supabase (persistFineUpdate ignores
  // it), so after a reload the history shows "—" instead of the payment date.
  expect(upd).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${fineId(1)}`]] });
  expect(upd.body).toEqual({ status: 'pagada', paid_to_id: null });

  await expect.poll(() => treasuryWrites(backend)).toHaveLength(1);
  const [ins] = treasuryWrites(backend);
  expect(ins.method).toBe('INSERT');
  expect(ins.body).toEqual([{ iso: '2026-09-25', concept: 'Multa (Retraso) — Juls', type: 'ingreso', amount: 2, responsible_id: null }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('treasurer confirms a payment: the fine is paid and the income goes to the treasury', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await requests(page).getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(requests(page)).toBeHidden();
  await expect(requests(page).locator('.fine-confirm-row')).toHaveCount(0);
  await expect(rowOf(page, 'Juls').locator('.fine-chip')).toHaveText(['R']);
  await expect(rowOf(page, 'Juls').locator('td').nth(2)).toHaveText('2 €');

  await page.getByRole('button', { name: 'Histórico de multas pagadas' }).click();
  const first = page.locator('#fines-history-list > div').first();
  await expect(first).toContainText('Juls');
  await expect(first).toContainText('Tarjeta amarilla · 5 €');
  await expect(first).toContainText('pagado a Carla');
  await expect(first).toContainText('25/09/2026');
  await historyModal(page).getByRole('button', { name: 'Cerrar' }).click();

  await goToSection(page, 'vestuario');
  await expect(page.locator('#vest-multas-total')).toHaveText('18 € pendientes');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  // NOTE: paid_at is not persisted (only the status is sent).
  expect(upd).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${fineId(2)}`]] });
  expect(upd.body).toEqual({ status: 'pagada' });

  await expect.poll(() => treasuryWrites(backend)).toHaveLength(1);
  const [ins] = treasuryWrites(backend);
  expect(ins.method).toBe('INSERT');
  // NOTE: the confirming treasurer is 'me' locally, so 'me' is written as
  // responsible_id instead of her auth user id.
  expect(ins.body).toEqual([{ iso: '2026-09-25', concept: 'Multa (Tarjeta amarilla) — Juls', type: 'ingreso', amount: 5, responsible_id: 'me' }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('treasurer rejects a payment: the fine goes back to pending without anyone assigned', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await requests(page).getByRole('button', { name: 'No es cierto' }).click();
  await expect(requests(page)).toBeHidden();
  await expect(rowOf(page, 'Juls').locator('.fine-chip')).toHaveText(['R', 'TA']);
  await expect(rowOf(page, 'Juls').locator('td').nth(2)).toHaveText('7 €');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  expect(upd).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${fineId(2)}`]] });
  expect(upd.body).toEqual({ paid_to_id: null });
  expect(treasuryWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Adding fines
// ---------------------------------------------------------------------------

test('add-fine modal: defaults, reason grid, running total, validation and cancel', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await addBtn(page).click();
  const modal = fineModal(page);
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Añadir multa');
  await expect(modal.locator('.modal-sub')).toHaveText('Elige la jugadora y uno o varios motivos');
  await expect(page.locator('#fine-player-search-input')).toHaveValue('');
  await expect(page.locator('#fine-player-search-input')).toHaveAttribute('placeholder', 'Busca por nombre o mote…');
  const boxes = page.locator('#fine-reason-grid .fine-reason-box');
  await expect(boxes.locator('b')).toHaveText(['TA', 'TR', 'R', '3T']);
  await expect(boxes.locator('span')).toHaveText(['5 €', '10 €', '2 €', '7 €']);
  await expect(page.locator('#fine-reason-grid .fine-reason-box.selected')).toHaveCount(0);
  await expect(page.locator('#fine-total-amount')).toHaveText('0 €');

  await modal.getByRole('button', { name: 'Guardar multa' }).click();
  await expect.poll(() => messages).toEqual(['Elige una jugadora y al menos un motivo.']);

  await boxes.nth(1).click();
  await boxes.nth(3).click();
  await expect(page.locator('#fine-total-amount')).toHaveText('17 €');
  await expect(boxes.nth(1)).toHaveClass(/selected/);
  await expect(boxes.nth(3)).toHaveClass(/selected/);
  await boxes.nth(1).click();
  await expect(boxes.nth(1)).not.toHaveClass(/selected/);
  await expect(page.locator('#fine-total-amount')).toHaveText('7 €');

  // A reason without a player is still rejected
  await modal.getByRole('button', { name: 'Guardar multa' }).click();
  await expect.poll(() => messages).toHaveLength(2);
  expect(messages[1]).toBe('Elige una jugadora y al menos un motivo.');

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  // Reopening resets everything
  await addBtn(page).click();
  await expect(page.locator('#fine-reason-grid .fine-reason-box.selected')).toHaveCount(0);
  await expect(page.locator('#fine-total-amount')).toHaveText('0 €');
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('add-fine player search: accent-insensitive, by name or nickname, no matches', async ({ page }) => {
  const { errors } = await openMultas(page, { user: CARLA });
  await addBtn(page).click();
  const input = page.locator('#fine-player-search-input');
  const results = page.locator('#fine-player-search-results');

  await input.fill('nu');
  await expect(results).toHaveClass(/open/);
  await expect(results.locator('.fine-player-search-result > span:last-child')).toHaveText(['Núria']);
  await input.fill('ROVIRA');
  await expect(results.locator('.fine-player-search-result > span:last-child')).toHaveText(['Rovi']);
  await input.fill('tank');
  await expect(results.locator('.fine-player-search-result > span:last-child')).toHaveText(['Tanke']);
  await input.fill('zzz');
  await expect(results.locator('.fine-player-search-result')).toHaveCount(0);
  await expect(results.locator('.fine-player-search-empty')).toHaveText('Sin coincidencias');
  await input.fill('');
  await expect(results).not.toHaveClass(/open/);

  await input.fill('juli');
  await results.getByRole('button', { name: 'Juls' }).click();
  await expect(input).toHaveValue('Juls');
  await expect(input).toHaveClass(/has-selection/);
  await expect(results).not.toHaveClass(/open/);
  // Typing again drops the selection
  await input.fill('Jul');
  await expect(input).not.toHaveClass(/has-selection/);
  await expect(results.locator('.fine-player-search-result > span:last-child')).toHaveText(['Juls']);
  // Clicking outside the search box closes the results
  await fineModal(page).locator('h3').click();
  await expect(results).not.toHaveClass(/open/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('adding a fine with several reasons creates one fine per reason', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await addBtn(page).click();
  await page.locator('#fine-player-search-input').fill('juli');
  await page.locator('#fine-player-search-results').getByRole('button', { name: 'Juls' }).click();
  const boxes = page.locator('#fine-reason-grid .fine-reason-box');
  await boxes.nth(3).click(); // 3T
  await boxes.nth(0).click(); // TA
  await expect(page.locator('#fine-total-amount')).toHaveText('12 €');
  await fineModal(page).getByRole('button', { name: 'Guardar multa' }).click();
  await expect(fineModal(page)).not.toHaveClass(/active/);

  await expect(rowOf(page, 'Juls').locator('.fine-chip')).toHaveText(['R', '2TA ⏳', '3T']);
  await expect(rowOf(page, 'Juls').locator('td').nth(2)).toHaveText('19 €');
  await expect(tableRows(page)).toHaveCount(4);

  await expect.poll(() => fineWrites(backend)).toHaveLength(2);
  const writes = fineWrites(backend);
  expect(writes.map((w) => w.method)).toEqual(['INSERT', 'INSERT']);
  expect(writes.map((w) => w.body)).toEqual([
    [{ player_id: IDS.player, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: null }],
    [{ player_id: IDS.player, reason_id: 'amarilla', status: 'pendiente', paid_to_id: null, auto_match_iso: null }],
  ]);
  expect(backend.db.fines).toHaveLength(11);

  await goToSection(page, 'vestuario');
  await expect(page.locator('#vest-multas-total')).toHaveText('35 € pendientes');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a treasurer can fine herself and a new player row appears', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await addBtn(page).click();
  await page.locator('#fine-player-search-input').fill('carla');
  await page.locator('#fine-player-search-results').getByRole('button', { name: 'Carla' }).click();
  await page.locator('#fine-reason-grid .fine-reason-box').nth(1).click(); // TR
  await fineModal(page).getByRole('button', { name: 'Guardar multa' }).click();
  await expect(fineModal(page)).not.toHaveClass(/active/);

  await expect(tableRows(page)).toHaveCount(5);
  await expect(tableRows(page).nth(4).locator('.meta b')).toHaveText('Carla');
  await expect(tableRows(page).nth(4).locator('.fine-chip')).toHaveText(['TR']);
  await expect(myCard(page).locator('.my-fines-head .amount')).toHaveText('10 €');
  await expect(myCard(page).locator('.my-fine-row .reason')).toHaveText(['Tarjeta roja']);

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  expect(fineWrites(backend)[0].body).toEqual([{ player_id: IDS.carla, reason_id: 'roja', status: 'pendiente', paid_to_id: null, auto_match_iso: null }]);

  await goToSection(page, 'inicio');
  await expect(page.locator('#inicio-fines-banner .tt-personal')).toHaveClass(/fines-danger/);
  await expect(page.locator('#inicio-fines-banner .txt span')).toHaveText('Paga la coca, primer aviso · Debes 10 € 🔪');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Edit mode, editing and deleting
// ---------------------------------------------------------------------------

test('edit mode: chips open the edit modal with all pending reasons of that player', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await editToggle(page).click();
  await expect(editToggle(page)).toHaveClass(/active/);
  const tankeChip = rowOf(page, 'Tanke').locator('.fine-chip').nth(0);
  await expect(tankeChip).toHaveAttribute('title', 'Tercer tiempo · 7 € · Clic para editar');
  await tankeChip.click();

  const modal = editModal(page);
  await expect(modal).toHaveClass(/active/);
  await expect(payModal(page)).not.toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Editar multa');
  await expect(modal.locator('.modal-sub')).toHaveText('Marca los motivos y elimínalos, o deja solo uno para cambiar jugadora/motivo');
  await expect(page.locator('#edit-fine-player-search-input')).toHaveValue('Tanke');
  await expect(page.locator('#edit-fine-player-search-input')).toHaveClass(/has-selection/);
  await expect(page.locator('#edit-fine-reason-grid .fine-reason-box.selected b')).toHaveText(['R', '3T']);
  await expect(page.locator('#edit-fine-total-amount')).toHaveText('9 €');

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  // Leaving edit mode: chips go back to "mark as paid"
  await editToggle(page).click();
  await expect(editToggle(page)).not.toHaveClass(/active/);
  await rowOf(page, 'Tanke').locator('.fine-chip').nth(0).click();
  await expect(payModal(page)).toHaveClass(/active/);
  await expect(editModal(page)).not.toHaveClass(/active/);
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing a fine: needs exactly one reason, then changes its reason', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await editToggle(page).click();
  await rowOf(page, 'Tanke').locator('.fine-chip', { hasText: '3T' }).click();
  const modal = editModal(page);
  await modal.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(() => messages).toEqual([
    'Para guardar cambios elige una jugadora y exactamente un motivo. Para eliminar varias multas a la vez, marca los motivos que quieras y usa "Eliminar multa".',
  ]);
  await expect(modal).toHaveClass(/active/);

  // Leave only "R": the clicked 3T fine becomes a second Retraso.
  await page.locator('#edit-fine-reason-grid .fine-reason-box', { hasText: '3T' }).click();
  await expect(page.locator('#edit-fine-total-amount')).toHaveText('2 €');
  await modal.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(modal).not.toHaveClass(/active/);
  await expect(rowOf(page, 'Tanke').locator('.fine-chip')).toHaveText(['2R']);
  await expect(rowOf(page, 'Tanke').locator('td').nth(2)).toHaveText('4 €');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  expect(upd).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${fineId(7)}`]] });
  expect(upd.body).toEqual({ player_id: IDS.aina, reason_id: 'retraso' });
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing a fine: moving it to another player', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await editToggle(page).click();
  await rowOf(page, 'Rovi').locator('.fine-chip').click();
  const input = page.locator('#edit-fine-player-search-input');
  await expect(input).toHaveValue('Rovi');
  await input.fill('pau');
  await expect(input).not.toHaveClass(/has-selection/);
  const results = page.locator('#edit-fine-player-search-results');
  await expect(results.locator('.fine-player-search-result > span:last-child')).toHaveText(['Paula']);
  await results.getByRole('button', { name: 'Paula' }).click();
  await expect(input).toHaveValue('Paula');
  await expect(input).toHaveClass(/has-selection/);
  await editModal(page).getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(editModal(page)).not.toHaveClass(/active/);

  await expect(rowOf(page, 'Rovi')).toHaveCount(0);
  await expect(rowOf(page, 'Paula').locator('.fine-chip')).toHaveText(['R ⏳', 'TA']);
  await expect(rowOf(page, 'Paula').locator('td').nth(2)).toHaveText('7 €');

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [upd] = fineWrites(backend);
  expect(upd).toMatchObject({ method: 'UPDATE', filters: [['id', `eq.${fineId(4)}`]] });
  expect(upd.body).toEqual({ player_id: IDS.paula, reason_id: 'amarilla' });
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting from the edit modal: validation and dismissed confirmation', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await editToggle(page).click();
  await rowOf(page, 'Tanke').locator('.fine-chip').nth(0).click();
  const modal = editModal(page);
  const box = (short) => page.locator('#edit-fine-reason-grid .fine-reason-box', { has: page.locator('b', { hasText: new RegExp(`^${short}$`) }) });

  // Confirm is dismissed by default: nothing happens
  await modal.getByRole('button', { name: 'Eliminar multa' }).click();
  await expect.poll(() => messages).toEqual(['¿Eliminar estas 2 multas? Se eliminarán por completo.']);
  await expect(modal).toHaveClass(/active/);

  await box('R').click();
  await box('3T').click();
  await modal.getByRole('button', { name: 'Eliminar multa' }).click();
  await expect.poll(() => messages).toHaveLength(2);
  expect(messages[1]).toBe('Marca al menos un motivo a eliminar.');

  await page.locator('#edit-fine-player-search-input').fill('x');
  await box('TR').click();
  await modal.getByRole('button', { name: 'Eliminar multa' }).click();
  await expect.poll(() => messages).toHaveLength(3);
  expect(messages[2]).toBe('Elige una jugadora.');
  await expect(modal).toHaveClass(/active/);

  await expect(rowOf(page, 'Tanke').locator('.fine-chip')).toHaveText(['3T', 'R']);
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting from the edit modal with a reason she does not have just closes it', async ({ page }) => {
  const { backend, errors } = await openMultas(page, { user: CARLA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await editToggle(page).click();
  await rowOf(page, 'Rovi').locator('.fine-chip').click();
  const grid = page.locator('#edit-fine-reason-grid .fine-reason-box');
  await grid.nth(0).click(); // unselect TA
  await grid.nth(1).click(); // select TR (Rovi's red card is already paid)
  await editModal(page).getByRole('button', { name: 'Eliminar multa' }).click();
  await expect(editModal(page)).not.toHaveClass(/active/);
  await expect(rowOf(page, 'Rovi').locator('.fine-chip')).toHaveText(['TA']);
  expect(messages).toEqual([]);
  expect(fineWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting from the edit modal with the confirmation accepted', async ({ page }) => {
  const messages = [];
  page.on('dialog', (d) => { messages.push(d.message()); d.accept(); });
  const { backend, errors } = await openMultas(page, { user: CARLA });
  await editToggle(page).click();
  await rowOf(page, 'Tanke').locator('.fine-chip').nth(0).click();
  await editModal(page).getByRole('button', { name: 'Eliminar multa' }).click();
  await expect(editModal(page)).not.toHaveClass(/active/);
  expect(messages).toEqual(['¿Eliminar estas 2 multas? Se eliminarán por completo.']);

  await expect(rowOf(page, 'Tanke')).toHaveCount(0);
  await expect(tableRows(page)).toHaveCount(3);
  // Still in edit mode
  await expect(editToggle(page)).toHaveClass(/active/);

  await expect.poll(() => fineWrites(backend)).toHaveLength(1);
  const [del] = fineWrites(backend);
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `in.(${fineId(7)},${fineId(8)})`]]);
  expect(backend.db.fines.map((f) => f.id)).not.toContain(fineId(7));
  expect(backend.db.fines.map((f) => f.id)).not.toContain(fineId(8));

  // Only one fine: singular message
  await rowOf(page, 'Rovi').locator('.fine-chip').click();
  await editModal(page).getByRole('button', { name: 'Eliminar multa' }).click();
  await expect(editModal(page)).not.toHaveClass(/active/);
  expect(messages[1]).toBe('¿Eliminar esta multa? Se eliminará por completo.');
  await expect(rowOf(page, 'Rovi')).toHaveCount(0);
  await expect.poll(() => fineWrites(backend)).toHaveLength(2);
  expect(fineWrites(backend)[1].filters).toEqual([['id', `in.(${fineId(4)})`]]);

  await goToSection(page, 'vestuario');
  await expect(page.locator('#vest-multas-total')).toHaveText('9 € pendientes');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Catalan
// ---------------------------------------------------------------------------

test('Catalan texts', async ({ page }) => {
  const { errors } = await openMultas(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#sec-multas h2')).toHaveText("Multes de l'equip");
  await expect(page.locator('#sec-multas .back-link')).toHaveText('Vestidor');
  await expect(page.locator('#sec-multas .fines-table th')).toHaveText(['Jugadora', 'Motiu', 'Import', 'Estat']);
  await expect(tableRows(page).first().locator('.badge')).toHaveText('Pendent');
  await expect(rowOf(page, 'Juls').locator('.fine-chip').nth(0)).toHaveAttribute('title', 'Retraso · 2 € · Clic per marcar com a pagada');

  await expect(myCard(page).locator('.my-fines-head .label')).toHaveText('Deus');
  // NOTE: the reason labels are not translated.
  await expect(myCard(page).locator('.my-fine-row .reason')).toHaveText(['Retraso', 'Tarjeta amarilla']);
  await expect(myCard(page).locator('.fine-awaiting-badge')).toHaveText('Esperant confirmació…');

  await myCard(page).getByRole('button', { name: 'Pagar multa' }).click();
  await expect(payModal(page).locator('.modal-sub')).toHaveText("A qui de la Comi Tresoreria se li ha pagat? L'ingrés només s'afegirà a la seva taula de moviments.");
  await payModal(page).getByRole('button', { name: "Cancel·la" }).click();
  await expect(payModal(page)).not.toHaveClass(/active/);

  await page.getByRole('button', { name: 'Històric de multes pagades' }).click();
  await expect(historyModal(page).locator('h3')).toHaveText('Històric de multes pagades');
  await expect(historyModal(page).locator('.modal-sub')).toHaveText('Cada multa es guarda aquí en el moment que es marca com a pagada.');
  await historyModal(page).getByRole('button', { name: 'Tancar' }).click();

  await goToSection(page, 'inicio');
  await expect(page.locator('#inicio-fines-banner .txt b')).toHaveText('Multes');
  await expect(page.locator('#inicio-fines-banner .txt span')).toHaveText('Paga la coca, primer avís · Deus 7 € 🔪');
  await goToSection(page, 'vestuario');
  // NOTE: the Vestuario card total is always in Spanish.
  await expect(page.locator('#vest-multas-total')).toHaveText('23 € pendientes');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan texts for a treasurer (confirm request, add and edit modals)', async ({ page }) => {
  const { errors } = await openMultas(page, { user: CARLA });
  await page.evaluate(() => window.setLang('ca'));
  await expect(addBtn(page)).toHaveText('Afegir multa');
  await expect(myCard(page).locator('.label')).toHaveText('La teva situació');
  await expect(myCard(page).locator('.amount')).toHaveText('Estàs al dia');
  // (setLang re-renders the personal summary, which also re-renders the requests)
  await expect(requests(page).locator('.fine-confirm-msg')).toContainText("Juls t'ha pagat la seva multa");
  await expect(requests(page).getByRole('button', { name: 'Confirma el pagament' })).toBeVisible();
  await expect(requests(page).getByRole('button', { name: 'No és cert' })).toBeVisible();

  await addBtn(page).click();
  await expect(fineModal(page).locator('h3')).toHaveText('Afegir multa');
  await expect(fineModal(page).locator('.modal-sub')).toHaveText('Tria la jugadora i un o diversos motius');
  await expect(page.locator('#fine-player-search-input')).toHaveAttribute('placeholder', 'Cerca per nom o malnom…');
  await expect(fineModal(page).getByRole('button', { name: 'Desa la multa' })).toBeVisible();
  // NOTE: the "no matches" text is hardcoded in Spanish.
  await page.locator('#fine-player-search-input').fill('zzz');
  await expect(page.locator('#fine-player-search-results .fine-player-search-empty')).toHaveText('Sin coincidencias');
  await fineModal(page).getByRole('button', { name: "Cancel·la" }).click();

  await editToggle(page).click();
  await rowOf(page, 'Rovi').locator('.fine-chip').click();
  await expect(editModal(page).locator('h3')).toHaveText('Editar multa');
  await expect(editModal(page).getByRole('button', { name: 'Desa els canvis' })).toBeVisible();
  await expect(editModal(page).getByRole('button', { name: 'Eliminar multa' })).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});
