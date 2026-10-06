// Tests for the "Jugadas" section: the team's playbook, one animation/video per play,
// organised by category. Categories and plays are read from Supabase
// ("play_categories" and "plays", see the seed); the app never writes them.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { seed } from './fixtures/seed.js';

const sec = (page) => page.locator('#sec-jugadas');
const filter = (page, name) => sec(page).locator('.jugadas-filter').filter({ hasText: name });
const card = (page, title) => sec(page).locator('.play-card').filter({ hasText: title });
const modal = (page) => page.locator('#play-modal');
const restWrites = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);

async function open(page, opts = {}) {
  const ctx = await setupApp(page, opts);
  // The seeded video is never really downloaded.
  await page.route(/videos\.cnpenas\.test/, (route) => route.fulfill({ contentType: 'video/mp4', body: '' }));
  await openApp(page);
  return ctx;
}

test('Vestuario card opens Jugadas and the back link returns to Vestuario', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await open(page, { user: USERS.player });
  await goToSection(page, 'vestuario');
  await page.locator('#sec-vestuario .vest-card.i-jugadas').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(sec(page).locator('h2')).toHaveText('Jugadas');
  await expect(sec(page).locator('.play-card')).toHaveCount(5);

  await sec(page).locator('.back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('reads the plays from Supabase, grouped by category in sort_order', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');

  await expect(sec(page).locator('.jugadas-filter')).toHaveText(['Todas 5', 'Touch 2', 'Melé 1', 'Ataque 2', 'Defensa 0']);
  await expect(filter(page, 'Todas')).toHaveClass(/active/);
  // "Defensa" has no plays, so it has no group under "Todas".
  await expect(sec(page).locator('.jugadas-group-title')).toHaveText([/Touch/, /Melé/, /Ataque/]);
  await expect(sec(page).locator('.jugadas-group[data-category="touch"] .play-cap b')).toHaveText(['Touch corta', 'Touch al fondo']);
  await expect(card(page, 'Touch corta').locator('.play-cap span')).toHaveText('Saltadora delantera, 3 jugadoras');
  // Only plays without a video say "Vídeo no disponible".
  await expect(card(page, 'Touch corta').locator('.play-soon')).toHaveText('Vídeo no disponible');
  await expect(card(page, 'Bucle del 10').locator('.play-soon')).toHaveCount(0);
  expect(restWrites(backend, 'plays')).toEqual([]);
  expect(restWrites(backend, 'play_categories')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('filters by category, and an empty category says so', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');

  await filter(page, 'Ataque').click();
  await expect(filter(page, 'Ataque')).toHaveClass(/active/);
  await expect(filter(page, 'Todas')).not.toHaveClass(/active/);
  await expect(sec(page).locator('.jugadas-group-title')).toHaveText([/Ataque/]);
  await expect(sec(page).locator('.play-cap b')).toHaveText(['Bucle del 10', 'Cruce en el centro']);

  await filter(page, 'Defensa').click();
  await expect(sec(page).locator('.jugadas-group-title')).toHaveText([/Defensa/]);
  await expect(sec(page).locator('.jugadas-group')).toContainText('Todavía no hay jugadas en esta categoría.');

  await filter(page, 'Todas').click();
  await expect(sec(page).locator('.play-card')).toHaveCount(5);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a play without a video opens the "coming soon" placeholder', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();

  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('h3')).toHaveText('Touch corta');
  await expect(modal(page).locator('.modal-sub')).toHaveText('Touch');
  await expect(modal(page).locator('.play-description')).toHaveText('Saltadora delantera, 3 jugadoras');
  await expect(modal(page).locator('.play-frame')).toContainText('El vídeo de esta jugada llegará pronto.');
  await expect(modal(page).locator('video')).toHaveCount(0);

  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a play with a video plays it in the modal, and closing removes the player', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Bucle del 10').click();

  await expect(modal(page).locator('h3')).toHaveText('Bucle del 10');
  await expect(modal(page).locator('video')).toHaveAttribute('src', 'https://videos.cnpenas.test/bucle-10.mp4');
  await expect(modal(page).locator('video')).toHaveAttribute('controls', '');
  await expect(modal(page).locator('.play-frame-empty')).toHaveCount(0);

  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal(page).locator('video')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('no plays yet: the section says so', async ({ page }) => {
  const { errors } = await open(page, { seed: { ...seed, plays: [] } });
  await goToSection(page, 'jugadas');
  await expect(sec(page)).toContainText('Todavía no hay jugadas.');
  await expect(sec(page).locator('.jugadas-filter, .play-card')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('plays added since the last visit show up when coming back', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await expect(sec(page).locator('.play-card')).toHaveCount(5);

  backend.table('plays').push({
    id: '95000000-0000-4000-8000-000000000099', category_id: 'defensa', title: 'Defensa en línea',
    description: null, video_url: null, poster_url: null, sort_order: 10, created_at: '2026-10-05T10:00:00Z', created_by: null,
  });
  // Skip the 5-minute cache so the reload goes to Supabase.
  await page.evaluate(() => window.storage.set('cache:plays', 'null'));
  await goToSection(page, 'vestuario');
  await goToSection(page, 'jugadas');
  await expect(sec(page).locator('.play-card')).toHaveCount(6);
  await expect(filter(page, 'Defensa')).toHaveText('Defensa 1');
  expect(relevantErrors(errors)).toEqual([]);
});

test('players see the same plays from the desktop sidebar', async ({ page }) => {
  const { errors } = await open(page, { user: USERS.player });
  await page.locator('.sidebar .nav button[data-section="jugadas"]').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(sec(page).locator('.play-card')).toHaveCount(5);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: section texts and category names (name_ca, or name_es when empty)', async ({ page }) => {
  const { errors } = await open(page);
  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'jugadas');
  await expect(sec(page).locator('h2')).toHaveText('Jugades');
  await expect(sec(page).locator('.back-link')).toHaveText(/Vestidor/);
  await expect(sec(page).locator('.jugadas-filter')).toHaveText(['Totes 5', 'Touch 2', 'Melé 1', 'Atac 2', 'Defensa 0']);
  await expect(card(page, 'Touch corta').locator('.play-soon')).toHaveText('Vídeo no disponible');

  await card(page, 'Cruce en el centro').click();
  await expect(modal(page).locator('.modal-sub')).toHaveText('Atac');
  await expect(modal(page).locator('.play-frame')).toContainText("El vídeo d'aquesta jugada arribarà aviat.");
  await modal(page).getByRole('button', { name: 'Tancar' }).click();

  // Switching language with the section open renames the categories too.
  await page.evaluate(() => window.setLang('es'));
  await expect(filter(page, 'Ataque')).toHaveText('Ataque 2');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Adding plays (admins only)
// ---------------------------------------------------------------------------

const addBtn = (page) => page.locator('#add-play-btn');
const addModal = (page) => page.locator('#add-play-modal');
const storageWrites = (backend) => backend.mutations.filter((m) => m.kind === 'storage');
const dialogs = (page) => {
  const seen = [];
  page.on('dialog', (d) => seen.push(d.message()));
  return seen;
};

test('players do not see the + button', async ({ page }) => {
  const { errors } = await open(page, { user: USERS.player });
  await goToSection(page, 'jugadas');
  await expect(sec(page).locator('.play-card')).toHaveCount(5);
  await expect(addBtn(page)).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin + button floats in the bottom-right corner, above the mobile bottom nav', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await expect(addBtn(page)).toBeVisible();
  await expect(addBtn(page)).toHaveCSS('position', 'fixed');
  const vp = page.viewportSize();
  let box = await addBtn(page).boundingBox();
  expect(vp.width - (box.x + box.width)).toBeLessThanOrEqual(40);
  expect(vp.height - (box.y + box.height)).toBeLessThanOrEqual(40);

  await page.setViewportSize(VIEWPORTS.mobile);
  box = await addBtn(page).boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
  expect(VIEWPORTS.mobile.width - (box.x + box.width)).toBeLessThanOrEqual(24);

  // It only exists inside Jugadas.
  await goToSection(page, 'vestuario');
  await expect(addBtn(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin adds a play with a video: uploads it to the "plays" bucket and saves its URL', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await filter(page, 'Touch').click();
  await addBtn(page).click();

  await expect(addModal(page)).toHaveClass(/active/);
  await expect(addModal(page).locator('h3')).toHaveText('Añadir jugada');
  // The current filter is the default category.
  await expect(page.locator('#play-category-input')).toHaveValue('touch');
  await expect(page.locator('#play-category-input option')).toHaveText(['Touch', 'Melé', 'Ataque', 'Defensa']);
  await page.locator('#play-category-input').selectOption('defensa');
  await page.locator('#play-title-input').fill('  Defensa en línea  ');
  await page.locator('#play-description-input').fill('Subimos todas a la vez');
  await page.locator('#play-video-input').setInputFiles({ name: 'Defensa.MOV', mimeType: 'video/quicktime', buffer: Buffer.from('fake video') });
  await page.locator('#play-save-btn').click();

  await expect(addModal(page)).not.toHaveClass(/active/);
  const uploads = storageWrites(backend);
  expect(uploads).toHaveLength(1);
  expect(uploads[0].method).toBe('POST');
  expect(uploads[0].path).toMatch(/^\/storage\/v1\/object\/plays\/[0-9a-f-]{36}\.mov$/);
  const file = uploads[0].path.split('/').pop();

  const inserts = restWrites(backend, 'plays');
  expect(inserts).toHaveLength(1);
  expect(inserts[0].method).toBe('INSERT');
  expect(inserts[0].body).toEqual([{
    category_id: 'defensa', title: 'Defensa en línea', description: 'Subimos todas a la vez',
    video_url: expect.stringMatching(new RegExp(`/storage/v1/object/public/plays/${file}$`)), sort_order: 10,
  }]);

  // It shows up straight away, with its video.
  await filter(page, 'Defensa').click();
  await expect(sec(page).locator('.play-cap b')).toHaveText(['Defensa en línea']);
  await expect(card(page, 'Defensa en línea').locator('.play-soon')).toHaveCount(0);
  await expect(filter(page, 'Todas')).toHaveText('Todas 6');
  await page.route(/\/storage\/v1\/object\/public\/plays\//, (route) => route.fulfill({ contentType: 'video/mp4', body: '' }));
  await card(page, 'Defensa en línea').click();
  await expect(modal(page).locator('video')).toHaveAttribute('src', inserts[0].body[0].video_url);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin adds a play without a video: nothing is uploaded and it says "Vídeo no disponible"', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await addBtn(page).click();
  // From "Todas", the first category is preselected.
  await expect(page.locator('#play-category-input')).toHaveValue('touch');
  await page.locator('#play-title-input').fill('Touch en dos tiempos');
  await page.locator('#play-save-btn').click();

  await expect(addModal(page)).not.toHaveClass(/active/);
  expect(storageWrites(backend)).toEqual([]);
  // Touch already has sort_order 10 and 20: the new one goes last.
  expect(restWrites(backend, 'plays')[0].body).toEqual([{ category_id: 'touch', title: 'Touch en dos tiempos', description: null, video_url: null, sort_order: 30 }]);
  await expect(sec(page).locator('.jugadas-group[data-category="touch"] .play-cap b')).toHaveText(['Touch corta', 'Touch al fondo', 'Touch en dos tiempos']);
  await expect(card(page, 'Touch en dos tiempos').locator('.play-soon')).toHaveText('Vídeo no disponible');
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin form: a name is required, only videos are accepted, and it starts empty each time', async ({ page }) => {
  const { backend, errors } = await open(page);
  const seen = dialogs(page);
  await goToSection(page, 'jugadas');
  await addBtn(page).click();

  await page.locator('#play-title-input').fill('   ');
  await page.locator('#play-save-btn').click();
  await expect.poll(() => seen).toEqual(['Elige una categoría y ponle un nombre a la jugada.']);

  await page.locator('#play-title-input').fill('Con foto');
  await page.locator('#play-video-input').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') });
  await page.locator('#play-save-btn').click();
  await expect.poll(() => seen).toEqual(['Elige una categoría y ponle un nombre a la jugada.', 'El archivo tiene que ser un vídeo.']);
  await expect(addModal(page)).toHaveClass(/active/);
  expect(storageWrites(backend)).toEqual([]);
  expect(restWrites(backend, 'plays')).toEqual([]);

  await addModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await addBtn(page).click();
  await expect(page.locator('#play-title-input')).toHaveValue('');
  await expect(page.locator('#play-video-input')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: the add-play form is translated', async ({ page }) => {
  const { errors } = await open(page);
  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'jugadas');
  await expect(addBtn(page)).toHaveAttribute('aria-label', 'Afegir jugada');
  await addBtn(page).click();
  await expect(addModal(page).locator('h3')).toHaveText('Afegir jugada');
  await expect(page.locator('#play-category-input option')).toHaveText(['Touch', 'Melé', 'Atac', 'Defensa']);
  await expect(addModal(page)).toContainText('Vídeo (opcional, màx. 50 MB)');
  await expect(addModal(page).getByRole('button', { name: 'Desa', exact: true })).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});
