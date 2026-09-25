// Characterization tests for "Avisos" (notices) on Inicio: the pinned list, the
// banner notices at the top, the add-notice modal and dismiss/delete.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const SEED_BANNER = 'Mañana partido en casa contra Santboi: convocatoria a las 16:30h en Mar Bella. ¡Todas de azul!';
const SEED_CUOTA = 'Recordad pagar la cuota de temporada antes del 30 de septiembre (120 €).';
const SEED_COCHE = 'Busco coche compartido para ir a Cornellà el 3 de octubre, ¿alguien?';

const withNotices = (notices) => ({ ...seed, notices });
const list = (page) => page.locator('#notices-list');
const cards = (page) => page.locator('#notices-list .notice-card');
const banners = (page) => page.locator('#inicio-top-notices .inicio-top-notice-banner');
const modal = (page) => page.locator('#add-notice-modal');
// NOTE: the type buttons sit inside a <label>, so their accessible name also includes
// the label text ("Tipo de aviso ..."), and clicking the label/hint text activates the
// first button (switches back to "pinned"). Hence the buttons are found by their text.
const typeBtn = (page, text) => page.locator('#notice-type-quick button', { hasText: text });
const noticeWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === 'notices');

async function openAddModal(page, name = 'Añadir aviso') {
  await page.locator('#inicio-notices-card').getByRole('button', { name }).click();
  await expect(modal(page)).toHaveClass(/active/);
}

test('Inicio lists pinned notices newest first and banner notices at the top', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);

  await expect(page.locator('#inicio-notices-card h3')).toHaveText('Avisos');
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).locator('.notice-text')).toHaveText([SEED_COCHE, SEED_CUOTA]);
  await expect(cards(page).locator('.notice-date')).toHaveText(['Juls · 22 Sep · 21:45', 'Jordi · 20 Sep · 10:30']);
  // The banner notice is not in the pinned list.
  await expect(list(page)).not.toContainText(SEED_BANNER);

  await expect(banners(page)).toHaveCount(1);
  await expect(banners(page).locator('.txt')).toHaveText(SEED_BANNER);
  await expect(banners(page)).toContainText('📢');
  expect(relevantErrors(errors)).toEqual([]);
});

test('only the author of a notice gets its delete button', async ({ page }) => {
  // Admin wrote the banner; Juls (player) wrote one pinned notice; Jordi the other.
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);

  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(0).getByRole('button', { name: 'Eliminar aviso' })).toBeVisible();
  await expect(cards(page).nth(1).getByRole('button')).toHaveCount(0);
  // Player can only close the admin's banner, not delete it.
  await expect(banners(page).getByRole('button', { name: 'Cerrar aviso' })).toBeVisible();
  await expect(banners(page).getByRole('button', { name: 'Eliminar aviso' })).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin sees delete + close on their own banner and no delete on others\' notices', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await expect(list(page).getByRole('button', { name: 'Eliminar aviso' })).toHaveCount(0);
  await expect(banners(page).getByRole('button', { name: 'Eliminar aviso' })).toBeVisible();
  await expect(banners(page).getByRole('button', { name: 'Cerrar aviso' })).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('the author deletes a pinned notice; it is deleted in Supabase', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await cards(page).nth(0).getByRole('button', { name: 'Eliminar aviso' }).click();

  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('.notice-text')).toHaveText([SEED_CUOTA]);
  const writes = noticeWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'DELETE', filters: [['id', 'eq.n-seed-3']] });
  expect(backend.db.notices.map((n) => n.id)).toEqual(['n-seed-1', 'n-seed-2']);
  // The banner is untouched.
  await expect(banners(page)).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('closing a banner hides it only on this device and it stays closed', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: withNotices([
    ...seed.notices,
    { id: 'n-extra-banner', text: 'Entreno cancelado el lunes', type: 'banner', created_by: IDS.marta,
      created_by_name: 'Rovi', created_at: '2026-09-25T06:00:00Z', date_label: '25 Sep · 08:00' },
  ]) });
  await openApp(page);
  // Newest banner first.
  await expect(banners(page).locator('.txt')).toHaveText(['Entreno cancelado el lunes', SEED_BANNER]);

  await banners(page).nth(1).getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(banners(page).locator('.txt')).toHaveText(['Entreno cancelado el lunes']);
  expect(noticeWrites(backend)).toEqual([]);
  expect(backend.db.notices).toHaveLength(4);

  // Still closed when coming back to Inicio and after reloading the app.
  await goToSection(page, 'vestuario');
  await goToSection(page, 'inicio');
  await expect(banners(page).locator('.txt')).toHaveText(['Entreno cancelado el lunes']);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(cards(page)).toHaveCount(2);
  await expect(banners(page).locator('.txt')).toHaveText(['Entreno cancelado el lunes']);

  await banners(page).getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(banners(page)).toHaveCount(0);
  expect(noticeWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the author deletes a banner for everyone', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await banners(page).getByRole('button', { name: 'Eliminar aviso' }).click();

  await expect(banners(page)).toHaveCount(0);
  const writes = noticeWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'DELETE', filters: [['id', 'eq.n-seed-1']] });
  expect(backend.db.notices.map((n) => n.id)).toEqual(['n-seed-2', 'n-seed-3']);
  await expect(cards(page)).toHaveCount(2);
  expect(relevantErrors(errors)).toEqual([]);
});

test('with no notices the list shows the empty message and no banners', async ({ page }) => {
  const { errors } = await setupApp(page, { seed: withNotices([]) });
  await openApp(page);
  await expect(list(page)).toHaveText('Todavía no hay avisos.');
  await expect(cards(page)).toHaveCount(0);
  await expect(banners(page)).toHaveCount(0);

  await page.evaluate(() => window.setLang('ca'));
  await expect(list(page)).toHaveText('Encara no hi ha avisos.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('only banner notices: the pinned list is empty', async ({ page }) => {
  const { errors } = await setupApp(page, { seed: withNotices([seed.notices[0]]) });
  await openApp(page);
  await expect(list(page)).toHaveText('Todavía no hay avisos.');
  await expect(banners(page)).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('old notices without type count as pinned; missing fields and HTML are shown safely', async ({ page }) => {
  const { errors } = await setupApp(page, { seed: withNotices([
    { id: 'n-old', text: 'Aviso antiguo sin tipo', type: null, created_by: IDS.jordi, created_by_name: 'Jordi',
      created_at: '2026-09-10T08:00:00Z', date_label: '10 Sep · 10:00' },
    { id: 'n-undef', text: 'Sin autor', type: 'pinned', created_by: IDS.jordi, created_by_name: 'undefined',
      created_at: '2026-09-11T08:00:00Z', date_label: 'undefined' },
    { id: 'n-html', text: '<img src=x onerror="window.pwned=1"><b>negrita</b>', type: 'pinned', created_by: IDS.jordi,
      created_by_name: '<i>Jordi</i>', created_at: '2026-09-12T08:00:00Z', date_label: '12 Sep · 10:00' },
    { id: 'n-html-banner', text: '<b>banner</b>', type: 'banner', created_by: IDS.jordi,
      created_by_name: 'Jordi', created_at: '2026-09-12T09:00:00Z', date_label: '12 Sep · 11:00' },
  ]) });
  await openApp(page);
  await expect(cards(page).locator('.notice-text')).toHaveText([
    '<img src=x onerror="window.pwned=1"><b>negrita</b>', 'Sin autor', 'Aviso antiguo sin tipo',
  ]);
  // "undefined" values are not printed: no author and no date.
  await expect(cards(page).locator('.notice-date')).toHaveText(['<i>Jordi</i> · 12 Sep · 10:00', '', 'Jordi · 10 Sep · 10:00']);
  await expect(page.locator('#notices-list b, #notices-list i, #notices-list img')).toHaveCount(0);
  await expect(banners(page).locator('.txt')).toHaveText('<b>banner</b>');
  await expect(page.locator('#inicio-top-notices .txt b')).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(relevantErrors(errors)).toEqual([]);
});

test('add-notice modal: defaults, type selector and closing', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await expect(modal(page)).not.toHaveClass(/active/);
  await openAddModal(page);

  const pinnedBtn = typeBtn(page, '📌 Fijado en Avisos');
  const bannerBtn = typeBtn(page, '📢 Notificación arriba');
  await expect(modal(page).locator('h3')).toHaveText('Añadir aviso');
  await expect(page.locator('#notice-text-input')).toHaveValue('');
  await expect(page.locator('#notice-text-input')).toHaveAttribute('placeholder', 'Escribe aquí el aviso...');
  await expect(pinnedBtn).toHaveClass(/active/);
  await expect(bannerBtn).not.toHaveClass(/active/);
  await expect(page.locator('#notice-type-hint')).toHaveText('Se queda fijado en "Avisos" hasta que tú lo borres.');

  await bannerBtn.click();
  await expect(bannerBtn).toHaveClass(/active/);
  await expect(pinnedBtn).not.toHaveClass(/active/);
  await expect(page.locator('#notice-type-hint')).toHaveText('Aparece arriba del todo para todo el mundo, con una "x" para cerrarla.');
  await pinnedBtn.click();
  await expect(pinnedBtn).toHaveClass(/active/);
  await expect(page.locator('#notice-type-hint')).toHaveText('Se queda fijado en "Avisos" hasta que tú lo borres.');

  // Cancel closes it; reopening resets the text and the type.
  await bannerBtn.click();
  await page.locator('#notice-text-input').fill('borrador');
  await modal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);
  await openAddModal(page);
  await expect(page.locator('#notice-text-input')).toHaveValue('');
  await expect(pinnedBtn).toHaveClass(/active/);
  await expect(bannerBtn).not.toHaveClass(/active/);

  // Clicking the overlay outside the box also closes it.
  await modal(page).click({ position: { x: 5, y: 5 } });
  await expect(modal(page)).not.toHaveClass(/active/);
  expect(noticeWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('publishing needs some text', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await openApp(page);
  await openAddModal(page);

  await modal(page).getByRole('button', { name: 'Publicar' }).click();
  await expect.poll(() => dialogs).toEqual(['Escribe el texto del aviso.']);
  await page.locator('#notice-text-input').fill('   \n  ');
  await modal(page).getByRole('button', { name: 'Publicar' }).click();
  await expect.poll(() => dialogs).toEqual(['Escribe el texto del aviso.', 'Escribe el texto del aviso.']);

  await expect(modal(page)).toHaveClass(/active/);
  expect(noticeWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('publishing a pinned notice saves it and shows it first in the list', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openAddModal(page);
  await page.locator('#notice-text-input').fill('  Cena de equipo el sábado  ');
  await modal(page).getByRole('button', { name: 'Publicar' }).click();

  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first().locator('.notice-text')).toHaveText('Cena de equipo el sábado');
  await expect(cards(page).first().locator('.notice-date')).toHaveText('Montse · 25 Sep · 10:00');
  // The author can delete it right away.
  await expect(cards(page).first().getByRole('button', { name: 'Eliminar aviso' })).toBeVisible();
  await expect(banners(page)).toHaveCount(1);

  const writes = noticeWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('INSERT');
  expect(writes[0].body).toHaveLength(1);
  expect(writes[0].body[0]).toMatchObject({
    text: 'Cena de equipo el sábado', type: 'pinned', created_by: USERS.admin.id,
    created_by_name: 'Montse', date_label: '25 Sep · 10:00',
  });
  expect(writes[0].body[0].id).toMatch(/^n\d+/);
  expect(Object.keys(writes[0].body[0]).sort()).toEqual(['created_by', 'created_by_name', 'date_label', 'id', 'text', 'type']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('publishing a banner notice shows it at the top of Inicio', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openAddModal(page);
  await typeBtn(page, '📢 Notificación arriba').click();
  await page.locator('#notice-text-input').fill('Hoy entreno en el campo 2');
  await modal(page).getByRole('button', { name: 'Publicar' }).click();

  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(banners(page).locator('.txt')).toHaveText(['Hoy entreno en el campo 2', SEED_BANNER]);
  // Own banner: delete + close; someone else's: only close.
  await expect(banners(page).nth(0).getByRole('button', { name: 'Eliminar aviso' })).toBeVisible();
  await expect(banners(page).nth(1).getByRole('button', { name: 'Eliminar aviso' })).toHaveCount(0);
  await expect(cards(page)).toHaveCount(2);

  const [write] = noticeWrites(backend);
  expect(write.method).toBe('INSERT');
  expect(write.body[0]).toMatchObject({
    text: 'Hoy entreno en el campo 2', type: 'banner', created_by: USERS.player.id,
    created_by_name: 'Juls', date_label: '25 Sep · 10:00',
  });
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: title, add button and the date of a new notice are translated', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#inicio-notices-card h3')).toHaveText('Avisos');
  await openAddModal(page, 'Afegir avís');
  // NOTE: the add-notice modal (title, type buttons, hint, Cancelar/Publicar) and its
  // alerts are hardcoded in Spanish; they are not translated to Catalan.
  await page.locator('#notice-text-input').fill('Sopar d\'equip');
  await modal(page).locator('.modal-actions .btn').click();

  await expect(cards(page).first().locator('.notice-text')).toHaveText('Sopar d\'equip');
  await expect(cards(page).first().locator('.notice-date')).toHaveText('Montse · 25 Set · 10:00');
  await expect(cards(page).first().getByRole('button', { name: 'Eliminar avís' })).toBeVisible();
  await expect(banners(page).getByRole('button', { name: 'Eliminar avís' })).toBeVisible();
  // NOTE: date_label is stored already formatted in the author's language, so other
  // people see "Set" even when their app is in Spanish.
  expect(noticeWrites(backend)[0].body[0].date_label).toBe('25 Set · 10:00');
  // Seed notices keep the label they were saved with.
  await expect(cards(page).nth(1).locator('.notice-date')).toHaveText('Juls · 22 Sep · 21:45');
  expect(relevantErrors(errors)).toEqual([]);
});
