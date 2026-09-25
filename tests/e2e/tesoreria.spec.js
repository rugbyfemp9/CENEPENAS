// Characterization tests for "Comi Tesoreria" (club treasury): balance banner,
// movements table, edit mode (inline editing + delete with confirmation), the
// "add movement" modal, the per-member breakdown modal and permissions.
//
// Seed treasury_entries (balance 938,50 €), newest first:
//   18/09 Balones y conos de entreno          gasto   185,50  Jordi
//   15/09 Multas cobradas                     ingreso  14     Carla
//   10/09 Cuotas de temporada (3 jugadoras)   ingreso 360     Carla
//   05/09 Inscripción federación              gasto   450     —
//   01/09 Subvención municipal temporada 26/27 ingreso 1200   —
// Only Comi Tesoreria members (Carla) can write. The admin account is treated as staff
// and is redirected away from the commission pages.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Carla Font: jugadora, member of Comi Tesoreria.
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test');

const entryId = (n) => `a1000000-0000-4000-8000-00000000000${n}`;
const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const rows = (page) => page.locator('#treasury-table-body tr');

async function openTreasury(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'comi-tesoreria');
  await expect(page.locator('#sec-comi-tesoreria')).toHaveClass(/active/);
  return ctx;
}

test('shows the balance and the movements newest first; read-only for players outside the commission', async ({ page }) => {
  const { backend, errors } = await openTreasury(page);
  await expect(page.locator('#treasury-balance')).toHaveText('938,50 €');
  await expect(page.locator('#treasury-balance')).not.toHaveClass(/neg/);

  await expect(page.locator('#treasury-table-head th')).toHaveText(['Fecha', 'Concepto', 'Tipo', 'Importe']);
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).locator('.col-date')).toHaveText(['18/09/26', '15/09/26', '10/09/26', '05/09/26', '01/09/26']);
  await expect(rows(page).locator('.type-pill')).toHaveText(['Gasto', 'Ingreso', 'Ingreso', 'Gasto', 'Ingreso']);
  await expect(rows(page).locator('.col-amount')).toHaveText(['−185,50 €', '+14,00 €', '+360,00 €', '−450,00 €', '+1200,00 €']);
  await expect(rows(page).nth(0).locator('.col-concept')).toContainText('Balones y conos de entreno');
  await expect(rows(page).nth(4).locator('.col-concept')).toContainText('Subvención municipal temporada 26/27');
  // Responsible person tag
  await expect(rows(page).nth(0).locator('.tv-responsible')).toHaveText('Jordi');
  await expect(rows(page).nth(1).locator('.tv-responsible')).toHaveText('Carla');
  await expect(rows(page).nth(2).locator('.tv-responsible')).toHaveText('Carla');
  await expect(rows(page).nth(3).locator('.tv-responsible')).toHaveCount(0);

  await expect(page.locator('#treasury-add-btn')).toBeHidden();
  await expect(page.locator('#treasury-edit-btn')).toBeHidden();
  await expect(rows(page).locator('input')).toHaveCount(0);
  expect(backend.mutations.filter((m) => m.kind === 'rest')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('breakdown modal groups the movements by Comi Tesoreria member', async ({ page }) => {
  const { errors } = await openTreasury(page);
  await page.locator('#sec-comi-tesoreria .treasury-banner').click();
  const modal = page.locator('#treasury-breakdown-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Desglose por integrante');
  await expect(modal.locator('.modal-sub')).toHaveText('Lo que ha movido cada persona de Comi Tesoreria');

  const bRows = modal.locator('.tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Carla', 'Sin responsable asignado']);
  await expect(bRows.locator('.meta span')).toHaveText(['2 movimientos', '2 movimientos']);
  // NOTE: the 185,50 € expense whose responsible is Jordi (not a Comi Tesoreria member)
  // appears in no row, so the breakdown (+374 +750) does not add up to the balance.
  await expect(bRows.locator('.net')).toHaveText(['+374,00 €', '+750,00 €']);
  await expect(bRows.nth(0).locator('.net')).toHaveClass(/pos/);
  await expect(bRows.nth(1)).toHaveClass(/unassigned/);

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('empty treasury shows the empty table and a zero breakdown', async ({ page }) => {
  const { errors } = await openTreasury(page, { seed: { ...seed, treasury_entries: [] } });
  await expect(page.locator('#treasury-balance')).toHaveText('0,00 €');
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('#treasury-table-body')).toHaveText('Todavía no hay movimientos registrados.');

  await page.locator('#sec-comi-tesoreria .treasury-banner').click();
  const bRows = page.locator('#treasury-breakdown-modal .tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Carla']);
  await expect(bRows.locator('.meta span')).toHaveText(['0 movimientos']);
  await expect(bRows.locator('.net')).toHaveText(['0,00 €']);
  await expect(bRows.locator('.net')).toHaveClass(/zero/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('negative balance and HTML in a concept is shown as text', async ({ page }) => {
  const { errors } = await openTreasury(page, { seed: { ...seed, treasury_entries: [
    { id: entryId(9), iso: '2026-09-20', concept: '<img src=x onerror="window.pwned=1">', type: 'gasto', amount: 50, responsible_id: null },
  ] } });
  // NOTE: the banner uses an ASCII hyphen for negatives while the rows use "−".
  await expect(page.locator('#treasury-balance')).toHaveText('-50,00 €');
  await expect(page.locator('#treasury-balance')).toHaveClass(/neg/);
  await expect(rows(page).locator('.col-amount')).toHaveText(['−50,00 €']);
  await expect(rows(page).locator('.col-concept')).toHaveText('<img src=x onerror="window.pwned=1">');

  await page.locator('#sec-comi-tesoreria .treasury-banner').click();
  const bRows = page.locator('#treasury-breakdown-modal .tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Carla', 'Sin responsable asignado']);
  await expect(bRows.locator('.meta span')).toHaveText(['0 movimientos', '1 movimiento']);
  await expect(bRows.locator('.net')).toHaveText(['0,00 €', '−50,00 €']);
  await expect(bRows.nth(1).locator('.net')).toHaveClass(/neg/);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tesoreria member: add movement modal defaults, validation and cancel', async ({ page }) => {
  const { backend, errors } = await openTreasury(page, { user: CARLA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await expect(page.locator('#treasury-add-btn')).toBeVisible();
  await expect(page.locator('#treasury-edit-btn')).toBeVisible();

  await page.locator('#treasury-add-btn').click();
  const modal = page.locator('#add-treasury-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#treasury-date-input')).toHaveValue('2026-09-25');
  await expect(page.locator('#treasury-concept-input')).toHaveValue('');
  await expect(page.locator('#treasury-amount-input')).toHaveValue('');
  await expect(page.locator('#tx-type-ingreso')).toHaveClass(/active/);
  await expect(page.locator('#tx-type-gasto')).not.toHaveClass(/active/);
  await expect(page.locator('#treasury-responsible-input option')).toHaveText(['Carla']);
  await expect(page.locator('#treasury-responsible-empty')).toBeHidden();

  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => messages).toEqual(['Rellena la fecha, el concepto y un importe válido.']);
  await page.locator('#treasury-concept-input').fill('Material médico');
  await page.locator('#treasury-amount-input').fill('0');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => messages).toHaveLength(2);
  await page.locator('#treasury-amount-input').fill('10');
  await page.locator('#treasury-date-input').fill('');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => messages).toHaveLength(3);
  expect(messages[2]).toBe('Rellena la fecha, el concepto y un importe válido.');
  await expect(modal).toHaveClass(/active/);

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(writesTo(backend, 'treasury_entries')).toEqual([]);
  await expect(rows(page)).toHaveCount(5);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tesoreria member: adding an expense saves it and updates balance and table', async ({ page }) => {
  const { backend, errors } = await openTreasury(page, { user: CARLA });
  await page.locator('#treasury-add-btn').click();
  const modal = page.locator('#add-treasury-modal');
  await page.locator('#treasury-date-input').fill('2026-09-20');
  await page.locator('#treasury-concept-input').fill('Material médico');
  // (the type buttons sit inside the "Tipo" <label>, so they are addressed by id)
  await page.locator('#tx-type-gasto').click();
  await expect(page.locator('#tx-type-gasto')).toHaveClass(/active/);
  await expect(page.locator('#tx-type-ingreso')).not.toHaveClass(/active/);
  await page.locator('#treasury-amount-input').fill('40.25');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(modal).not.toHaveClass(/active/);
  await expect(page.locator('#treasury-balance')).toHaveText('898,25 €');
  await expect(rows(page)).toHaveCount(6);
  const first = rows(page).nth(0);
  await expect(first.locator('.col-date')).toHaveText('20/09/26');
  await expect(first.locator('.col-concept')).toContainText('Material médico');
  await expect(first.locator('.tv-responsible')).toHaveText('Carla');
  await expect(first.locator('.type-pill')).toHaveText('Gasto');
  await expect(first.locator('.col-amount')).toHaveText('−40,25 €');

  const writes = writesTo(backend, 'treasury_entries');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('INSERT');
  expect(writes[0].body).toHaveLength(1);
  expect(writes[0].body[0]).toMatchObject({ iso: '2026-09-20', concept: 'Material médico', type: 'gasto', amount: 40.25 });
  // NOTE: when the logged-in member picks herself as responsible, the local id 'me' is
  // written as responsible_id instead of her auth user id (not a valid profile id).
  expect(writes[0].body[0].responsible_id).toBe('me');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tesoreria member: edit mode edits cells inline and saves everything on "Hecho"', async ({ page }) => {
  const { backend, errors } = await openTreasury(page, { user: CARLA });
  await page.locator('#treasury-edit-btn').click();
  await expect(page.locator('#treasury-edit-btn')).toHaveClass(/active/);
  await expect(page.locator('#treasury-edit-btn-label')).toHaveText('Hecho');
  await expect(page.locator('#treasury-table-head th')).toHaveCount(5);

  const r = rows(page);
  await expect(r).toHaveCount(5);
  await expect(r.nth(0).locator('input[type="date"]')).toHaveValue('2026-09-18');
  await expect(r.nth(0).locator('input[type="text"]')).toHaveValue('Balones y conos de entreno');
  await expect(r.nth(0).locator('input[type="number"]')).toHaveValue('185.5');
  await expect(r.locator('.type-pill')).toHaveText(['Gasto', 'Ingreso', 'Ingreso', 'Gasto', 'Ingreso']);
  await expect(r.getByRole('button', { name: 'Eliminar movimiento' })).toHaveCount(5);

  await r.nth(1).locator('input[type="text"]').fill('Multas cobradas septiembre');
  await r.nth(3).locator('input[type="number"]').fill('500');
  // The balance follows the amount while typing
  await expect(page.locator('#treasury-balance')).toHaveText('888,50 €');
  await r.nth(0).locator('.type-pill').click();
  await expect(r.nth(0).locator('.type-pill')).toHaveText('Ingreso');
  await expect(page.locator('#treasury-balance')).toHaveText('1259,50 €');
  await r.nth(4).locator('input[type="date"]').fill('2026-09-30');
  expect(writesTo(backend, 'treasury_entries')).toEqual([]);

  await page.locator('#treasury-edit-btn').click();
  await expect(page.locator('#treasury-edit-btn-label')).toHaveText('Editar');
  await expect(page.locator('#treasury-edit-btn')).not.toHaveClass(/active/);
  await expect(r.locator('input')).toHaveCount(0);
  await expect(r.locator('.col-date')).toHaveText(['30/09/26', '18/09/26', '15/09/26', '10/09/26', '05/09/26']);
  await expect(r.locator('.col-amount')).toHaveText(['+1200,00 €', '+185,50 €', '+14,00 €', '+360,00 €', '−500,00 €']);
  await expect(r.nth(2).locator('.col-concept')).toContainText('Multas cobradas septiembre');

  await expect.poll(() => writesTo(backend, 'treasury_entries')).toHaveLength(1);
  const [upsert] = writesTo(backend, 'treasury_entries');
  expect(upsert.method).toBe('UPSERT');
  expect([...upsert.body].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
    { id: entryId(1), iso: '2026-09-30', concept: 'Subvención municipal temporada 26/27', type: 'ingreso', amount: 1200, responsible_id: null },
    { id: entryId(2), iso: '2026-09-10', concept: 'Cuotas de temporada (3 jugadoras)', type: 'ingreso', amount: 360, responsible_id: IDS.carla },
    { id: entryId(3), iso: '2026-09-15', concept: 'Multas cobradas septiembre', type: 'ingreso', amount: 14, responsible_id: IDS.carla },
    { id: entryId(4), iso: '2026-09-05', concept: 'Inscripción federación', type: 'gasto', amount: 500, responsible_id: null },
    { id: entryId(5), iso: '2026-09-18', concept: 'Balones y conos de entreno', type: 'ingreso', amount: 185.5, responsible_id: IDS.jordi },
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tesoreria member: deleting a movement asks for confirmation', async ({ page }) => {
  const { backend, errors } = await openTreasury(page, { user: CARLA });
  await page.locator('#treasury-edit-btn').click();
  const confirmModal = page.locator('#delete-treasury-confirm-modal');

  await rows(page).nth(3).getByRole('button', { name: 'Eliminar movimiento' }).click();
  await expect(confirmModal).toHaveClass(/active/);
  await expect(confirmModal.locator('h3')).toHaveText('Eliminar movimiento');
  await expect(confirmModal.locator('p')).toHaveText('¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.');
  await confirmModal.getByRole('button', { name: 'No' }).click();
  await expect(confirmModal).not.toHaveClass(/active/);
  await expect(rows(page)).toHaveCount(5);
  expect(writesTo(backend, 'treasury_entries')).toEqual([]);

  await rows(page).nth(3).getByRole('button', { name: 'Eliminar movimiento' }).click();
  await confirmModal.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(confirmModal).not.toHaveClass(/active/);
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).nth(3).locator('input[type="text"]')).toHaveValue('Subvención municipal temporada 26/27');
  await expect(page.locator('#treasury-balance')).toHaveText('1388,50 €');
  // Still in edit mode
  await expect(page.locator('#treasury-edit-btn-label')).toHaveText('Hecho');

  await expect.poll(() => writesTo(backend, 'treasury_entries')).toHaveLength(1);
  const [del] = writesTo(backend, 'treasury_entries');
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `eq.${entryId(4)}`]]);
  expect(backend.db.treasury_entries.map((e) => e.id)).not.toContain(entryId(4));
  expect(relevantErrors(errors)).toEqual([]);
});

test('breakdown seen by a Comi Tesoreria member herself', async ({ page }) => {
  const { errors } = await openTreasury(page, { user: CARLA });
  // NOTE: Carla's own movements are stored with her auth id, but locally she is 'me',
  // so they show no responsible tag and count as "Sin responsable asignado" in her
  // own breakdown (while other players see them under "Carla").
  await expect(rows(page).nth(1).locator('.tv-responsible')).toHaveCount(0);
  await page.locator('#sec-comi-tesoreria .treasury-banner').click();
  const bRows = page.locator('#treasury-breakdown-modal .tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Carla', 'Sin responsable asignado']);
  await expect(bRows.locator('.meta span')).toHaveText(['0 movimientos', '4 movimientos']);
  await expect(bRows.locator('.net')).toHaveText(['0,00 €', '+1124,00 €']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan texts', async ({ page }) => {
  const { errors } = await openTreasury(page, { user: CARLA });
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#sec-comi-tesoreria .treasury-banner-label')).toHaveText('Guardiola');
  await expect(page.locator('#sec-comi-tesoreria .treasury-banner-hint')).toHaveText('Veure desglossament per integrant ›');
  await expect(page.locator('#sec-comi-tesoreria .treasury-table-toolbar-label')).toHaveText('Moviments');
  await expect(page.locator('#sec-comi-tesoreria .back-link')).toHaveText('Comissions');
  // NOTE: the table header and the type pills are rendered by JS in Spanish only.
  await expect(page.locator('#treasury-table-head th')).toHaveText(['Fecha', 'Concepto', 'Tipo', 'Importe']);
  await expect(rows(page).locator('.type-pill').first()).toHaveText('Gasto');

  await page.locator('#sec-comi-tesoreria .treasury-banner').click();
  const breakdown = page.locator('#treasury-breakdown-modal');
  await expect(breakdown.locator('h3')).toHaveText('Desglossament per integrant');
  await expect(breakdown.locator('.modal-sub')).toHaveText('El que ha mogut cada persona de la Comi Tresoreria');
  await breakdown.getByRole('button', { name: 'Tancar' }).click();
  await expect(breakdown).not.toHaveClass(/active/);

  await page.locator('#treasury-edit-btn').click();
  await rows(page).nth(0).getByRole('button', { name: 'Eliminar movimiento' }).click();
  const confirmModal = page.locator('#delete-treasury-confirm-modal');
  await expect(confirmModal.locator('h3')).toHaveText('Eliminar moviment');
  await expect(confirmModal.locator('p')).toHaveText('Segur que vols eliminar aquest moviment? Aquesta acció no es pot desfer.');
  await confirmModal.getByRole('button', { name: 'No' }).click();
  await expect(confirmModal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the admin account (treated as staff) is redirected away from Comi Tesoreria', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openApp(page);
  await goToSection(page, 'comi-tesoreria');
  await expect(page.locator('#sec-comi-tesoreria')).not.toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(writesTo(backend, 'treasury_entries')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});
