// Characterization tests for "Comi Tercer Temps": the Lista / Saldo tabs, the shared
// shopping checklist (add / toggle / delete) and the third-time treasury (same
// pattern as Comi Tesoreria: balance, table, edit mode, add modal, breakdown).
//
// Seed tercer_shopping_items (creation order): Cervezas (4 packs), Refrescos sin azúcar,
// Servilletas (checked), Bolsas de basura.
// Seed tercer_treasury_entries (balance 102,80 €), newest first:
//   19/09 Barra tercer temps vs Gòtics     ingreso 64    Paula
//   18/09 Hielo y vasos                    gasto   38,90 —
//   12/09 Barra tercer temps vs Tarragona  ingreso 150   Paula
//   11/09 Compra bebidas Mercadona         gasto   72,30 Paula
// Only Comi Tercer Temps members (Paula) can write. The admin account is treated as
// staff and is redirected away from the commission pages.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Paula Vidal: jugadora, member of Comi Tercer Temps.
const PAULA = authUser(IDS.paula, 'paula@cnpenas.test');

const itemId = (n) => `a3000000-0000-4000-8000-00000000000${n}`;
const entryId = (n) => `a2000000-0000-4000-8000-00000000000${n}`;
const SHOPPING = ['Cervezas (4 packs)', 'Refrescos sin azúcar', 'Servilletas', 'Bolsas de basura'];

const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const shoppingItem = (page, label) => page.locator('.shopping-item').filter({ hasText: label });
const rows = (page) => page.locator('#tercer-treasury-table-body tr');

async function openComi(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'comi-tercer-temps');
  await expect(page.locator('#sec-comi-tercer-temps')).toHaveClass(/active/);
  return ctx;
}
async function openSaldo(page) {
  await page.locator('.comi-tercer-tabs').getByRole('button', { name: 'Saldo' }).click();
  await expect(page.locator('#comi-tercer-panel-saldo')).toBeVisible();
}

test('opens on the Lista tab and switches between Lista and Saldo', async ({ page }) => {
  const { errors } = await openComi(page);
  const tabs = page.locator('.comi-tercer-tabs button');
  await expect(tabs).toHaveText(['Lista', 'Saldo']);
  await expect(tabs.nth(0)).toHaveClass(/active/);
  await expect(page.locator('#comi-tercer-panel-lista')).toBeVisible();
  await expect(page.locator('#comi-tercer-panel-saldo')).toBeHidden();

  await openSaldo(page);
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await expect(tabs.nth(0)).not.toHaveClass(/active/);
  await expect(page.locator('#comi-tercer-panel-lista')).toBeHidden();

  await tabs.nth(0).click();
  await expect(page.locator('#comi-tercer-panel-lista')).toBeVisible();
  await expect(page.locator('#comi-tercer-panel-saldo')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('shopping list shows the items in creation order; read-only for players outside the commission', async ({ page }) => {
  const { backend, errors } = await openComi(page);
  await expect(page.locator('.shopping-item .shopping-item-label')).toHaveText(SHOPPING);
  await expect(shoppingItem(page, 'Servilletas')).toHaveClass(/checked/);
  await expect(shoppingItem(page, 'Servilletas').getByRole('checkbox')).toBeChecked();
  await expect(shoppingItem(page, 'Cervezas (4 packs)')).not.toHaveClass(/checked/);
  await expect(shoppingItem(page, 'Cervezas (4 packs)').getByRole('checkbox')).not.toBeChecked();

  await expect(page.locator('#tercer-shopping-add-row')).toBeHidden();
  for (const cb of await page.locator('.shopping-item').getByRole('checkbox').all()) await expect(cb).toBeDisabled();
  await expect(page.locator('.shopping-item').getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  expect(backend.mutations.filter((m) => m.kind === 'rest')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

const emptyShopping = { ...seed, tercer_shopping_items: [] };

test('empty shopping list message for a viewer', async ({ page }) => {
  const { errors } = await openComi(page, { seed: emptyShopping });
  await expect(page.locator('#tercer-shopping-list')).toHaveText('La lista está vacía.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('empty shopping list message for a commission member', async ({ page }) => {
  const { errors } = await openComi(page, { user: PAULA, seed: emptyShopping });
  await expect(page.locator('#tercer-shopping-list')).toHaveText('La lista está vacía. Añade lo que haga falta comprar 👆');
  await expect(page.locator('#tercer-shopping-add-row')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tercer Temps member adds items with the + button and with Enter', async ({ page }) => {
  const { backend, errors } = await openComi(page, { user: PAULA });
  const input = page.locator('#tercer-shopping-input');
  await expect(input).toHaveAttribute('placeholder', 'Añadir algo a la lista…');

  // Blank input does nothing
  await input.fill('   ');
  await page.locator('#tercer-shopping-add-row').getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.shopping-item')).toHaveCount(4);

  await input.fill('Hielo');
  await page.locator('#tercer-shopping-add-row').getByRole('button', { name: 'Añadir' }).click();
  await expect(page.locator('.shopping-item .shopping-item-label')).toHaveText([...SHOPPING, 'Hielo']);
  await expect(input).toHaveValue('');

  await input.fill('  Limones  ');
  await input.press('Enter');
  await expect(page.locator('.shopping-item .shopping-item-label')).toHaveText([...SHOPPING, 'Hielo', 'Limones']);
  await expect(shoppingItem(page, 'Limones')).not.toHaveClass(/checked/);

  const writes = writesTo(backend, 'tercer_shopping_items');
  expect(writes.map((w) => w.method)).toEqual(['INSERT', 'INSERT']);
  expect(writes.map((w) => w.body)).toEqual([[{ label: 'Hielo', checked: false }], [{ label: 'Limones', checked: false }]]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tercer Temps member ticks and unticks items', async ({ page }) => {
  const { backend, errors } = await openComi(page, { user: PAULA });
  await shoppingItem(page, 'Cervezas (4 packs)').getByRole('checkbox').click();
  await expect(shoppingItem(page, 'Cervezas (4 packs)')).toHaveClass(/checked/);
  await expect(shoppingItem(page, 'Cervezas (4 packs)').getByRole('checkbox')).toBeChecked();

  await shoppingItem(page, 'Servilletas').getByRole('checkbox').click();
  await expect(shoppingItem(page, 'Servilletas')).not.toHaveClass(/checked/);
  await expect(shoppingItem(page, 'Servilletas').getByRole('checkbox')).not.toBeChecked();

  await expect.poll(() => writesTo(backend, 'tercer_shopping_items')).toHaveLength(2);
  const writes = writesTo(backend, 'tercer_shopping_items');
  expect(writes.map((w) => w.method)).toEqual(['UPDATE', 'UPDATE']);
  expect(writes[0]).toMatchObject({ body: { checked: true }, filters: [['id', `eq.${itemId(1)}`]] });
  expect(writes[1]).toMatchObject({ body: { checked: false }, filters: [['id', `eq.${itemId(3)}`]] });
  // The order does not change when ticking
  await expect(page.locator('.shopping-item .shopping-item-label')).toHaveText(SHOPPING);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tercer Temps member deletes an item (without ticking it)', async ({ page }) => {
  const { backend, errors } = await openComi(page, { user: PAULA });
  await shoppingItem(page, 'Refrescos sin azúcar').getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('.shopping-item .shopping-item-label')).toHaveText(['Cervezas (4 packs)', 'Servilletas', 'Bolsas de basura']);

  await expect.poll(() => writesTo(backend, 'tercer_shopping_items')).toHaveLength(1);
  const [del] = writesTo(backend, 'tercer_shopping_items');
  expect(del.method).toBe('DELETE');
  expect(del.filters).toEqual([['id', `eq.${itemId(2)}`]]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Saldo shows the balance and the movements newest first; read-only for players', async ({ page }) => {
  const { errors } = await openComi(page);
  await openSaldo(page);
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('102,80 €');
  await expect(page.locator('#tercer-treasury-balance')).not.toHaveClass(/neg/);
  await expect(page.locator('#tercer-treasury-table-head th')).toHaveText(['Fecha', 'Concepto', 'Tipo', 'Importe']);
  await expect(rows(page).locator('.col-date')).toHaveText(['19/09/26', '18/09/26', '12/09/26', '11/09/26']);
  await expect(rows(page).locator('.type-pill')).toHaveText(['Ingreso', 'Gasto', 'Ingreso', 'Gasto']);
  await expect(rows(page).locator('.col-amount')).toHaveText(['+64,00 €', '−38,90 €', '+150,00 €', '−72,30 €']);
  await expect(rows(page).nth(0).locator('.col-concept')).toContainText('Barra tercer temps vs Gòtics');
  await expect(rows(page).nth(0).locator('.tv-responsible')).toHaveText('Paula');
  await expect(rows(page).nth(1).locator('.tv-responsible')).toHaveCount(0);

  await expect(page.locator('#tercer-treasury-add-btn')).toBeHidden();
  await expect(page.locator('#tercer-treasury-edit-btn')).toBeHidden();

  // Breakdown per Comi Tercer Temps member
  await page.locator('#comi-tercer-panel-saldo .treasury-banner').click();
  const modal = page.locator('#tercer-treasury-breakdown-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('.modal-sub')).toHaveText('Lo que ha movido cada persona de Comi Tercer Temps');
  const bRows = modal.locator('.tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Paula', 'Sin responsable asignado']);
  await expect(bRows.locator('.meta span')).toHaveText(['3 movimientos', '1 movimiento']);
  await expect(bRows.locator('.net')).toHaveText(['+141,70 €', '−38,90 €']);
  await expect(bRows.nth(1).locator('.net')).toHaveClass(/neg/);
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Saldo empty state', async ({ page }) => {
  const { errors } = await openComi(page, { seed: { ...seed, tercer_treasury_entries: [] } });
  await openSaldo(page);
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('0,00 €');
  await expect(page.locator('#tercer-treasury-table-body')).toHaveText('Todavía no hay movimientos registrados.');
  await page.locator('#comi-tercer-panel-saldo .treasury-banner').click();
  const bRows = page.locator('#tercer-treasury-breakdown-modal .tv-breakdown-row');
  await expect(bRows.locator('.meta b')).toHaveText(['Paula']);
  await expect(bRows.locator('.meta span')).toHaveText(['0 movimientos']);
  await expect(bRows.locator('.net')).toHaveText(['0,00 €']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tercer Temps member adds a movement (defaults, validation, save)', async ({ page }) => {
  const { backend, errors } = await openComi(page, { user: PAULA });
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  await openSaldo(page);
  await expect(page.locator('#tercer-treasury-edit-btn')).toBeVisible();
  await page.locator('#tercer-treasury-add-btn').click();

  const modal = page.locator('#add-tercer-treasury-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#tercer-treasury-date-input')).toHaveValue('2026-09-25');
  await expect(page.locator('#tercer-treasury-concept-input')).toHaveValue('');
  await expect(page.locator('#tercer-treasury-amount-input')).toHaveValue('');
  await expect(page.locator('#tx-tercer-type-ingreso')).toHaveClass(/active/);
  await expect(page.locator('#tercer-treasury-responsible-input option')).toHaveText(['Paula']);
  await expect(page.locator('#tercer-treasury-responsible-empty')).toBeHidden();

  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => messages).toEqual(['Rellena la fecha, el concepto y un importe válido.']);
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await page.locator('#tercer-treasury-add-btn').click();
  await page.locator('#tercer-treasury-concept-input').fill('Venta de camisetas');
  await page.locator('#tercer-treasury-amount-input').fill('25');
  // Switch to gasto and back to ingreso
  await page.locator('#tx-tercer-type-gasto').click();
  await expect(page.locator('#tx-tercer-type-gasto')).toHaveClass(/active/);
  await page.locator('#tx-tercer-type-ingreso').click();
  await expect(page.locator('#tx-tercer-type-gasto')).not.toHaveClass(/active/);
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(modal).not.toHaveClass(/active/);
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('127,80 €');
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(0).locator('.col-date')).toHaveText('25/09/26');
  await expect(rows(page).nth(0).locator('.col-concept')).toContainText('Venta de camisetas');
  await expect(rows(page).nth(0).locator('.col-amount')).toHaveText('+25,00 €');

  const writes = writesTo(backend, 'tercer_treasury_entries');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('INSERT');
  expect(writes[0].body[0]).toMatchObject({ iso: '2026-09-25', concept: 'Venta de camisetas', type: 'ingreso', amount: 25 });
  // NOTE: same as Comi Tesoreria: picking yourself as responsible writes the local id
  // 'me' instead of your auth user id.
  expect(writes[0].body[0].responsible_id).toBe('me');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tercer Temps member edits the table inline, deletes a movement and saves on "Hecho"', async ({ page }) => {
  const { backend, errors } = await openComi(page, { user: PAULA });
  await openSaldo(page);
  // NOTE: her own movements (stored with her auth id) show no responsible tag for her.
  await expect(rows(page).nth(0).locator('.tv-responsible')).toHaveCount(0);

  await page.locator('#tercer-treasury-edit-btn').click();
  await expect(page.locator('#tercer-treasury-edit-btn-label')).toHaveText('Hecho');
  await expect(page.locator('#tercer-treasury-edit-btn')).toHaveClass(/active/);
  await expect(page.locator('#tercer-treasury-table-head th')).toHaveCount(5);
  const r = rows(page);
  await expect(r.nth(1).locator('input[type="text"]')).toHaveValue('Hielo y vasos');
  await expect(r.nth(1).locator('input[type="number"]')).toHaveValue('38.9');

  await r.nth(1).locator('input[type="number"]').fill('40');
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('101,70 €');
  await r.nth(2).locator('input[type="text"]').fill('Barra vs Tarragona');
  await r.nth(3).locator('.type-pill').click();
  await expect(r.nth(3).locator('.type-pill')).toHaveText('Ingreso');
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('246,30 €');

  // Delete "Barra tercer temps vs Gòtics": "No" keeps it, "Sí, eliminar" removes it
  const confirmModal = page.locator('#delete-tercer-treasury-confirm-modal');
  await r.nth(0).getByRole('button', { name: 'Eliminar movimiento' }).click();
  await expect(confirmModal).toHaveClass(/active/);
  await confirmModal.getByRole('button', { name: 'No' }).click();
  await expect(confirmModal).not.toHaveClass(/active/);
  await expect(r).toHaveCount(4);
  await r.nth(0).getByRole('button', { name: 'Eliminar movimiento' }).click();
  await confirmModal.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(confirmModal).not.toHaveClass(/active/);
  await expect(r).toHaveCount(3);
  await expect(page.locator('#tercer-treasury-balance')).toHaveText('182,30 €');
  await expect.poll(() => writesTo(backend, 'tercer_treasury_entries')).toHaveLength(1);
  expect(writesTo(backend, 'tercer_treasury_entries')[0]).toMatchObject({ method: 'DELETE', filters: [['id', `eq.${entryId(2)}`]] });

  await page.locator('#tercer-treasury-edit-btn').click();
  await expect(page.locator('#tercer-treasury-edit-btn-label')).toHaveText('Editar');
  await expect(r.locator('input')).toHaveCount(0);
  await expect(r.locator('.col-amount')).toHaveText(['−40,00 €', '+150,00 €', '+72,30 €']);

  await expect.poll(() => writesTo(backend, 'tercer_treasury_entries')).toHaveLength(2);
  const upsert = writesTo(backend, 'tercer_treasury_entries')[1];
  expect(upsert.method).toBe('UPSERT');
  expect([...upsert.body].sort((a, b) => a.id.localeCompare(b.id))).toEqual([
    { id: entryId(1), iso: '2026-09-12', concept: 'Barra vs Tarragona', type: 'ingreso', amount: 150, responsible_id: IDS.paula },
    { id: entryId(3), iso: '2026-09-11', concept: 'Compra bebidas Mercadona', type: 'ingreso', amount: 72.3, responsible_id: IDS.paula },
    { id: entryId(4), iso: '2026-09-18', concept: 'Hielo y vasos', type: 'gasto', amount: 40, responsible_id: null },
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('breakdown seen by a Comi Tercer Temps member herself', async ({ page }) => {
  const { errors } = await openComi(page, { user: PAULA });
  await openSaldo(page);
  await page.locator('#comi-tercer-panel-saldo .treasury-banner').click();
  const bRows = page.locator('#tercer-treasury-breakdown-modal .tv-breakdown-row');
  // NOTE: her own movements count as "Sin responsable asignado" in her own breakdown.
  await expect(bRows.locator('.meta b')).toHaveText(['Paula', 'Sin responsable asignado']);
  await expect(bRows.locator('.meta span')).toHaveText(['0 movimientos', '4 movimientos']);
  await expect(bRows.locator('.net')).toHaveText(['0,00 €', '+102,80 €']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan texts', async ({ page }) => {
  const { errors } = await openComi(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('.comi-tercer-tabs button')).toHaveText(['Llista', 'Saldo']);
  await expect(page.locator('#tercer-shopping-input')).toHaveAttribute('placeholder', 'Afegir alguna cosa a la llista…');
  await expect(page.locator('#sec-comi-tercer-temps .back-link')).toHaveText('Comissions');

  await page.locator('.comi-tercer-tabs').getByRole('button', { name: 'Saldo' }).click();
  await expect(page.locator('#comi-tercer-panel-saldo .treasury-banner-label')).toHaveText("Saldo total de l'equip");
  await expect(page.locator('#comi-tercer-panel-saldo .treasury-banner-hint')).toHaveText('Veure desglossament per integrant ›');
  await expect(page.locator('#comi-tercer-panel-saldo .treasury-table-toolbar-label')).toHaveText('Moviments');
  // NOTE: the table header and the type pills are rendered by JS in Spanish only.
  await expect(page.locator('#tercer-treasury-table-head th')).toHaveText(['Fecha', 'Concepto', 'Tipo', 'Importe']);

  await page.locator('#comi-tercer-panel-saldo .treasury-banner').click();
  const modal = page.locator('#tercer-treasury-breakdown-modal');
  await expect(modal.locator('h3')).toHaveText('Desglossament per integrant');
  await expect(modal.locator('.modal-sub')).toHaveText('El que ha mogut cada persona de la Comi Tercer Temps');
  await modal.getByRole('button', { name: 'Tancar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the admin account (treated as staff) is redirected away from Comi Tercer Temps', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openApp(page);
  await goToSection(page, 'comi-tercer-temps');
  await expect(page.locator('#sec-comi-tercer-temps')).not.toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(writesTo(backend, 'tercer_shopping_items')).toEqual([]);
  expect(writesTo(backend, 'tercer_treasury_entries')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});
