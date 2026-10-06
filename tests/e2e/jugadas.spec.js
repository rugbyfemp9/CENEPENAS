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

// The fake video can't really play, so play() is replaced: it records each call (and
// whether the video was muted) and, with blockSound, rejects unmuted calls the way a
// phone that blocks autoplay with sound does.
async function spyOnPlay(page, { blockSound = false } = {}) {
  await page.addInitScript((block) => {
    window.__playCalls = [];
    HTMLMediaElement.prototype.play = function () {
      window.__playCalls.push({ src: this.getAttribute('src'), muted: this.muted });
      if (block && !this.muted) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      return Promise.resolve();
    };
  }, blockSound);
}
const playCalls = (page) => page.evaluate(() => window.__playCalls);
const VIDEO = 'https://videos.cnpenas.test/bucle-10.mp4';

test('opening a play with a video starts it straight away, with sound', async ({ page }) => {
  await spyOnPlay(page);
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Bucle del 10').click();
  await expect(modal(page).locator('video')).toHaveAttribute('src', VIDEO);
  await expect.poll(() => playCalls(page)).toEqual([{ src: VIDEO, muted: false }]);

  // Closing removes the player; opening it again starts it again.
  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await card(page, 'Bucle del 10').click();
  await expect.poll(() => playCalls(page)).toEqual([{ src: VIDEO, muted: false }, { src: VIDEO, muted: false }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('if the browser blocks autoplay with sound, the video starts muted', async ({ page }) => {
  await spyOnPlay(page, { blockSound: true });
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Bucle del 10').click();
  await expect.poll(() => playCalls(page)).toEqual([{ src: VIDEO, muted: false }, { src: VIDEO, muted: true }]);
  await expect.poll(() => modal(page).locator('video').evaluate((v) => v.muted)).toBe(true);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a play without a video does not try to play anything', async ({ page }) => {
  await spyOnPlay(page);
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await expect(modal(page)).toHaveClass(/active/);
  await page.waitForTimeout(200);
  expect(await playCalls(page)).toEqual([]);
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

// ---------------------------------------------------------------------------
// Animated plays (board): "Salida del 8" in the seed, 3 steps, ~3 s in total
// ---------------------------------------------------------------------------

const anim = (page) => modal(page).locator('.play-anim');
const tokenAt = (scope, id) => scope.locator(`[data-token="${id}"]`);

test('an animated play shows its first step as the card thumbnail and an "Animación" badge', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');

  const thumb = card(page, 'Salida del 8').locator('.play-thumb-board svg');
  await expect(thumb).toHaveCount(1);
  await expect(thumb.locator('[data-token]')).toHaveCount(4);
  await expect(tokenAt(thumb, 'a8')).toHaveAttribute('transform', 'translate(30 70)');
  await expect(tokenAt(thumb, 'a8')).toContainText('8');
  await expect(card(page, 'Salida del 8').locator('.play-soon')).toHaveText('Animación');

  // Video + animation: the video wins, so no board and no badge.
  await expect(card(page, 'Bucle del 10').locator('.play-thumb-board')).toHaveCount(0);
  await expect(card(page, 'Bucle del 10').locator('.play-soon')).toHaveCount(0);
  // Unusable animation data: treated as a play with nothing to show.
  await expect(card(page, 'Cruce en el centro').locator('.play-thumb-board')).toHaveCount(0);
  await expect(card(page, 'Cruce en el centro').locator('.play-soon')).toHaveText('Vídeo no disponible');
  expect(relevantErrors(errors)).toEqual([]);
});

test('opening an animated play plays it by itself and stops on the last step', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();

  await expect(anim(page)).toBeVisible();
  await expect(modal(page).locator('video, .play-frame-empty')).toHaveCount(0);
  await expect(anim(page).locator('.play-anim-dot')).toHaveText(['1', '2', '3']);
  await expect(anim(page)).toHaveAttribute('data-state', 'playing');
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await expect(anim(page)).toHaveAttribute('data-step', '2');
  await expect(anim(page).locator('.play-anim-dot.active')).toHaveText('3');
  await expect(tokenAt(anim(page), 'a9')).toHaveAttribute('transform', 'translate(20 58)');
  await expect(tokenAt(anim(page), 'ball')).toHaveAttribute('transform', 'translate(21 57.5)');
  expect(relevantErrors(errors)).toEqual([]);
});

test('step buttons jump to a step and pause; play after the end starts again', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();

  await anim(page).locator('.play-anim-dot', { hasText: '2' }).click();
  await expect(anim(page)).toHaveAttribute('data-state', 'paused');
  await expect(anim(page)).toHaveAttribute('data-step', '1');
  await expect(anim(page).locator('.play-anim-dot.active')).toHaveText('2');
  await expect(tokenAt(anim(page), 'a8')).toHaveAttribute('transform', 'translate(33 66)');

  await anim(page).locator('.play-anim-dot', { hasText: '1' }).click();
  await expect(tokenAt(anim(page), 'a8')).toHaveAttribute('transform', 'translate(30 70)');

  // Play from step 1 to the end, then play again: it starts over.
  await anim(page).getByRole('button', { name: 'Reproducir' }).click();
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await expect(anim(page).getByRole('button', { name: 'Reproducir' })).toBeVisible();
  await anim(page).getByRole('button', { name: 'Reproducir' }).click();
  await expect(anim(page)).toHaveAttribute('data-state', 'playing');
  await expect(anim(page).getByRole('button', { name: 'Pausa' })).toBeVisible();
  await anim(page).getByRole('button', { name: 'Pausa' }).click();
  await expect(anim(page)).toHaveAttribute('data-state', 'paused');

  await anim(page).getByRole('button', { name: 'Volver a empezar' }).click();
  await expect(anim(page)).toHaveAttribute('data-state', 'playing');
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  expect(relevantErrors(errors)).toEqual([]);
});

test('speed button cycles 1× → 2× → 0.5× and the play still reaches the end', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  const speedBtn = anim(page).getByRole('button', { name: 'Velocidad' });
  await expect(speedBtn).toHaveText('1×');
  await speedBtn.click();
  await expect(speedBtn).toHaveText('2×');
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await speedBtn.click();
  await expect(speedBtn).toHaveText('0.5×');
  await speedBtn.click();
  await expect(speedBtn).toHaveText('1×');
  expect(relevantErrors(errors)).toEqual([]);
});

test('video + animation opens the video; unusable animation data shows the placeholder', async ({ page }) => {
  await spyOnPlay(page);
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Bucle del 10').click();
  await expect(modal(page).locator('video')).toHaveCount(1);
  await expect(anim(page)).toHaveCount(0);
  await modal(page).getByRole('button', { name: 'Cerrar' }).click();

  await card(page, 'Cruce en el centro').click();
  await expect(modal(page).locator('.play-frame-empty')).toContainText('El vídeo de esta jugada llegará pronto.');
  await expect(anim(page)).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('closing the modal removes the player; reopening starts from the first step', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(anim(page)).toHaveCount(0);

  await card(page, 'Salida del 8').click();
  await expect(anim(page)).toHaveAttribute('data-state', 'playing');
  await expect(anim(page)).toHaveAttribute('data-step', '0');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: animated play badge and player controls', async ({ page }) => {
  const { errors } = await open(page);
  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'jugadas');
  await expect(card(page, 'Salida del 8').locator('.play-soon')).toHaveText('Animació');
  await card(page, 'Salida del 8').click();
  await expect(anim(page).getByRole('button', { name: 'Tornar a començar' })).toBeVisible();
  await expect(anim(page).getByRole('button', { name: 'Velocitat' })).toBeVisible();
  await expect(anim(page).getByRole('group', { name: 'Passos de la jugada' })).toBeVisible();
  await expect(anim(page).getByRole('button', { name: 'Pas 3' })).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Board editor (admins): section "jugada-editor" + full-screen board (#play-board-full)
// ---------------------------------------------------------------------------

const ed = (page) => page.locator('#sec-jugada-editor');
const bf = (page) => page.locator('#play-board-full');
const edToken = (page, id) => bf(page).locator(`.play-board [data-token="${id}"]`);
const tool = (page, name) => bf(page).locator('.play-editor-tools').getByRole('button', { name, exact: true });
const chips = (page) => bf(page).locator('.play-editor-chips .play-anim-dot');
const bench = (page, n) => bf(page).locator(`.bench-chip[data-num="${n}"]`);
const near = (n) => expect.closeTo(n, 0);

// Pitch metres → screen pixels of the full-screen board.
const toScreen = (page, [x, y]) => page.evaluate(([px, py]) => {
  const svg = document.querySelector('#play-board-full .play-board');
  const pt = svg.createSVGPoint();
  pt.x = px; pt.y = py;
  const s = pt.matrixTransform(svg.getScreenCTM());
  return [s.x, s.y];
}, [x, y]);

async function drag(page, id, to) {
  const box = await edToken(page, id).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const [sx, sy] = await toScreen(page, to);
  await page.mouse.move(sx, sy, { steps: 6 });
  await page.mouse.up();
}

const tokenPos = async (page, id) => {
  const tr = await edToken(page, id).getAttribute('transform');
  return tr.match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
};

// A new animation goes straight to the full-screen board.
async function openNewAnimation(page, { title = 'Lineout 5', category = 'touch' } = {}) {
  await goToSection(page, 'jugadas');
  await addBtn(page).click();
  await addModal(page).locator('[data-kind="animation"]').click();
  await page.locator('#play-category-input').selectOption(category);
  await page.locator('#play-title-input').fill(title);
  await page.locator('#play-continue-btn').click();
  await expect(ed(page)).toHaveClass(/active/);
  await expect(bf(page)).toHaveClass(/active/);
}

test('players (and admins with nothing loaded) cannot open the editor', async ({ page }) => {
  const { errors } = await open(page, { user: USERS.player });
  await page.evaluate(() => window.setSection('jugada-editor'));
  await expect(sec(page)).toHaveClass(/active/);
  await expect(ed(page)).not.toHaveClass(/active/);
  await expect(bf(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin: the add form switches between video and animation', async ({ page }) => {
  const { errors } = await open(page);
  const seen = dialogs(page);
  await goToSection(page, 'jugadas');
  await addBtn(page).click();
  await expect(addModal(page).locator('[data-kind="video"]')).toHaveClass(/active/);
  await expect(page.locator('#play-video-input')).toBeVisible();

  await addModal(page).locator('[data-kind="animation"]').click();
  await expect(page.locator('#play-video-input')).toHaveCount(0);
  await expect(page.locator('#play-save-btn')).toHaveCount(0);
  await expect(addModal(page)).toContainText('colocas a las jugadoras y el balón en el campo');
  await page.locator('#play-continue-btn').click();
  await expect.poll(() => seen).toEqual(['Elige una categoría y ponle un nombre a la jugada.']);
  await expect(ed(page)).not.toHaveClass(/active/);

  // Reopening starts on "Vídeo" again.
  await addModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await addBtn(page).click();
  await expect(addModal(page).locator('[data-kind="video"]')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the board is full screen and the page cannot scroll while it is open', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await open(page);
  await openNewAnimation(page);

  // Covers the whole screen, bottom nav included.
  const box = await bf(page).boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: VIEWPORTS.mobile.width, height: VIEWPORTS.mobile.height });
  await expect(page.locator('.bottom-nav')).toBeVisible();
  expect(await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
    return document.elementFromPoint(nav.x + 10, nav.y + 10).closest('#play-board-full') !== null;
  })).toBe(true);

  // Page scroll locked, no browser gestures on the board, touchmove cancelled.
  await expect(page.locator('html')).toHaveClass(/board-open/);
  await expect(bf(page)).toHaveCSS('touch-action', 'none');
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  const cancelled = await page.evaluate(() => {
    const el = document.querySelector('#play-board-full .pbf-board');
    const ev = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [] });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(cancelled).toBe(true);
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // "Listo" closes it and gives the page its scroll back.
  await page.locator('#board-done-btn').click();
  await expect(bf(page)).not.toHaveClass(/active/);
  await expect(page.locator('html')).not.toHaveClass(/board-open/);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await expect(ed(page)).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the phone back button closes the board but stays in the editor', async ({ page }) => {
  const { errors } = await open(page);
  await openNewAnimation(page);
  await bench(page, 1).click();
  await page.goBack();
  await expect(bf(page)).not.toHaveClass(/active/);
  await expect(ed(page)).toHaveClass(/active/);
  await expect(page.locator('html')).not.toHaveClass(/board-open/);
  // The draft is still there.
  await expect(ed(page).locator('.play-editor-open')).toContainText('1 fichas · 1 pasos');
  await page.locator('#editor-open-board').click();
  await expect(bf(page)).toHaveClass(/active/);
  await expect(edToken(page, 'a1')).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin draws a new play step by step and saves it', async ({ page }) => {
  const { backend, errors } = await open(page);
  await openNewAnimation(page);

  await expect(bf(page).locator('.pbf-title')).toContainText('Lineout 5');
  await expect(bf(page).locator('.pbf-title')).toContainText('Paso 1 de 1');
  await expect(bf(page)).toContainText('Toca un dorsal para sacar a esa jugadora al campo');
  await expect(page.locator('#editor-preview-btn')).toBeDisabled();

  await bench(page, 1).click();
  await bench(page, 2).click();
  await tool(page, 'Defensa').click();
  await tool(page, 'Balón').click();
  await expect(tool(page, 'Balón')).toBeDisabled();
  await expect(bf(page).locator('.play-board [data-token]')).toHaveCount(4);
  await expect(edToken(page, 'a1')).toContainText('1');
  await expect(edToken(page, 'a2')).toContainText('2');
  await expect(edToken(page, 'ball')).toHaveClass(/selected/);

  // Step 1: starting positions.
  await drag(page, 'a1', [20, 40]);
  await expect(edToken(page, 'a1')).toHaveClass(/selected/);
  await drag(page, 'ball', [21, 41]);
  await expect(edToken(page, 'ball')).toHaveClass(/selected/);
  await expect(edToken(page, 'a1')).not.toHaveClass(/selected/);
  expect(await tokenPos(page, 'a1')).toEqual([near(20), near(40)]);
  // The ball now sits 1.4 m from the 1: grabbing the 1 still moves the 1, not the ball.
  await drag(page, 'a1', [20, 40]);
  await expect(edToken(page, 'a1')).toHaveClass(/selected/);
  expect(await tokenPos(page, 'ball')).toEqual([near(21), near(41)]);

  // Step 2: copies step 1; moving a token draws an arrow from where it was.
  await page.locator('#editor-add-step').click();
  await expect(chips(page)).toHaveText(['1', '2']);
  await expect(bf(page).locator('.play-editor-chips .play-anim-dot.active')).toHaveText('2');
  await expect(bf(page).locator('.pbf-title')).toContainText('Paso 2 de 2');
  expect(await tokenPos(page, 'a1')).toEqual([near(20), near(40)]);
  await expect(bf(page).locator('.board-arrow')).toHaveCount(0);
  await drag(page, 'a1', [30, 30]);
  await expect(bf(page).locator('.board-arrow')).toHaveCount(1);
  await bf(page).locator('[data-speed="fast"]').click();
  await expect(bf(page).locator('[data-speed="fast"]')).toHaveClass(/active/);

  // Going back to step 1 shows the old position.
  await chips(page).filter({ hasText: '1' }).click();
  expect(await tokenPos(page, 'a1')).toEqual([near(20), near(40)]);
  await expect(bf(page).locator('[data-speed]')).toHaveCount(0);

  // Try it before saving.
  await page.locator('#editor-preview-btn').click();
  await expect(bf(page).locator('.play-anim')).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await bf(page).getByRole('button', { name: 'Volver a editar' }).click();
  await expect(bf(page).locator('.pbf-board .play-board')).toBeVisible();

  // Save straight from the board.
  await page.locator('#board-save-btn').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(bf(page)).not.toHaveClass(/active/);
  await expect(page.locator('html')).not.toHaveClass(/board-open/);
  const inserts = restWrites(backend, 'plays');
  expect(inserts).toHaveLength(1);
  expect(inserts[0].method).toBe('INSERT');
  const body = inserts[0].body[0];
  expect(body).toMatchObject({ category_id: 'touch', title: 'Lineout 5', description: null, video_url: null, sort_order: 30 });
  expect(body.animation.tokens).toEqual([
    { id: 'a1', team: 'attack', label: '1' }, { id: 'a2', team: 'attack', label: '2' },
    { id: 'd1', team: 'defense', label: '' }, { id: 'ball', team: 'ball', label: '' },
  ]);
  expect(body.animation.steps).toHaveLength(2);
  expect(body.animation.steps[0].pos.a1).toEqual([near(20), near(40)]);
  expect(body.animation.steps[1].pos.a1).toEqual([near(30), near(30)]);
  expect(body.animation.steps[1].ms).toBe(700);
  expect(body.animation.steps[1].pos.d1).toEqual(body.animation.steps[0].pos.d1);

  // The new play shows up as an animation, and plays.
  await expect(card(page, 'Lineout 5').locator('.play-soon')).toHaveText('Animación');
  await card(page, 'Lineout 5').click();
  await expect(anim(page)).toHaveAttribute('data-state', 'ended', { timeout: 10_000 });
  await expect(anim(page).locator('.play-anim-dot')).toHaveText(['1', '2']);

  // Back from Jugadas does not reopen an editor that has already been saved.
  await modal(page).getByRole('button', { name: 'Cerrar' }).click();
  await page.goBack();
  await expect(ed(page)).not.toHaveClass(/active/);
  await expect(bf(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin removes a token from every step and deletes a step', async ({ page }) => {
  const { errors } = await open(page);
  await openNewAnimation(page);
  await bench(page, 1).click();
  await tool(page, 'Defensa').click();
  await page.locator('#editor-add-step').click();
  await page.locator('#editor-add-step').click();
  await expect(chips(page)).toHaveText(['1', '2', '3']);

  await expect(tool(page, 'Quitar')).toBeEnabled();
  await tool(page, 'Quitar').click(); // the defender (last added, still selected)
  await expect(edToken(page, 'd1')).toHaveCount(0);
  await expect(tool(page, 'Quitar')).toBeDisabled();
  await chips(page).filter({ hasText: '1' }).click();
  await expect(edToken(page, 'd1')).toHaveCount(0);

  await page.locator('#editor-delete-step').click();
  await expect(chips(page)).toHaveText(['1', '2']);
  await page.locator('#editor-delete-step').click();
  await expect(chips(page)).toHaveText(['1']);
  await expect(page.locator('#editor-delete-step')).toBeDisabled();

  // The whole team: every number from the bench.
  for (let n = 2; n <= 15; n++) await bench(page, n).click();
  await expect(bf(page).locator('.play-board [data-token^="a"]')).toHaveCount(15);
  await expect(bf(page).locator('.bench-chip[aria-pressed="true"]')).toHaveCount(15);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin edits an existing animated play (UPDATE, not INSERT)', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  await modal(page).getByRole('button', { name: 'Editar animación' }).click();

  // Editing opens the page first (name, category...), with a preview of the board.
  await expect(ed(page)).toHaveClass(/active/);
  await expect(bf(page)).not.toHaveClass(/active/);
  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(ed(page).locator('h2')).toHaveText('Editar jugada');
  await expect(page.locator('#editor-title-input')).toHaveValue('Salida del 8');
  await expect(ed(page).locator('.play-editor-open')).toContainText('4 fichas · 3 pasos');
  await page.locator('#editor-title-input').fill('Salida del 8 por el ciego');

  await page.locator('#editor-open-board').click();
  await expect(bf(page)).toHaveClass(/active/);
  await expect(chips(page)).toHaveText(['1', '2', '3']);
  await chips(page).filter({ hasText: '3' }).click();
  expect(await tokenPos(page, 'a9')).toEqual([20, 58]);
  await drag(page, 'a9', [15, 50]);
  await page.locator('#board-done-btn').click();
  await page.locator('#editor-save-btn').click();

  await expect(sec(page)).toHaveClass(/active/);
  const writes = restWrites(backend, 'plays');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('UPDATE');
  expect(writes[0].body).toMatchObject({ category_id: 'mele', title: 'Salida del 8 por el ciego', description: null });
  expect(writes[0].body.animation.steps[2].pos.a9).toEqual([near(15), near(50)]);
  expect(writes[0].body.animation.steps[1]).toEqual({ ms: 1000, pos: { a8: [33, 66], a9: [26, 66], d7: [35, 64], ball: [33, 67.5] } });
  await expect(card(page, 'Salida del 8 por el ciego')).toHaveCount(1);
  await expect(card(page, 'Salida del 8 por el ciego').locator('.play-soon')).toHaveText('Animación');
  expect(relevantErrors(errors)).toEqual([]);
});

test('leaving the editor with unsaved changes asks first', async ({ page }) => {
  const { backend, errors } = await open(page);
  const seen = dialogs(page);
  await openNewAnimation(page);

  // Nothing changed yet: leaves without asking.
  await page.locator('#board-done-btn').click();
  await ed(page).locator('.back-link').click();
  await expect(sec(page)).toHaveClass(/active/);
  expect(seen).toEqual([]);

  await openNewAnimation(page);
  await bench(page, 1).click();
  await page.locator('#board-done-btn').click();
  // setupApp dismisses dialogs, so "Cancel": it stays in the editor.
  await ed(page).locator('.back-link').click();
  await expect.poll(() => seen).toEqual(['Tienes cambios sin guardar. ¿Salir igualmente?']);
  await expect(ed(page)).toHaveClass(/active/);
  expect(restWrites(backend, 'plays')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the editor needs a name and at least one token to save', async ({ page }) => {
  const { backend, errors } = await open(page);
  const seen = dialogs(page);
  await openNewAnimation(page);
  await page.locator('#board-save-btn').click();
  await expect.poll(() => seen).toEqual(['Añade al menos una ficha a la pizarra.']);
  await expect(bf(page)).toHaveClass(/active/);
  await tool(page, 'Balón').click();
  await page.locator('#board-done-btn').click();
  await page.locator('#editor-title-input').fill(' ');
  await page.locator('#editor-save-btn').click();
  await expect.poll(() => seen).toEqual(['Añade al menos una ficha a la pizarra.', 'Elige una categoría y ponle un nombre a la jugada.']);
  expect(restWrites(backend, 'plays')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Editar animación" is only for admins', async ({ page }) => {
  const { errors } = await open(page, { user: USERS.player });
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  await expect(anim(page)).toBeVisible();
  await expect(page.locator('#play-edit-anim-btn')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: dragging on the full-screen board, with and without zoom', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { backend, errors } = await open(page);
  await openNewAnimation(page);
  await bench(page, 1).click();
  await drag(page, 'a1', [50, 64]);
  expect(await tokenPos(page, 'a1')).toEqual([near(50), near(64)]);

  // Zoom: the token gets bigger on screen and dragging still lands in pitch metres.
  const small = (await edToken(page, 'a1').boundingBox()).width;
  await page.getByRole('button', { name: 'Acercar' }).click();
  await expect(page.locator('#editor-zoom-btn')).toHaveAttribute('aria-pressed', 'true');
  expect((await edToken(page, 'a1').boundingBox()).width).toBeGreaterThan(small * 1.6);
  await drag(page, 'a1', [45, 70]);
  expect(await tokenPos(page, 'a1')).toEqual([near(45), near(70)]);
  await page.getByRole('button', { name: 'Ver el campo entero' }).click();
  await drag(page, 'a1', [50, 64]);
  expect(await tokenPos(page, 'a1')).toEqual([near(50), near(64)]);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.locator('#board-save-btn').click();
  await expect(sec(page)).toHaveClass(/active/);
  expect(restWrites(backend, 'plays')[0].body[0].animation.steps[0].pos.a1).toEqual([near(50), near(64)]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: editor texts', async ({ page }) => {
  const { errors } = await open(page);
  await page.evaluate(() => window.setLang('ca'));
  await openNewAnimation(page);
  await expect(bf(page).locator('.play-editor-tools button')).toHaveText(['Defensa', 'Pilota', 'Treure']);
  await expect(bf(page).locator('.pbf-bench-label')).toHaveText('Jugadores');
  await expect(bench(page, 9)).toHaveAttribute('aria-label', 'Jugadora 9');
  await expect(page.locator('#editor-add-step')).toHaveText('+ Pas');
  await expect(page.locator('#editor-preview-btn')).toHaveText('▶ Provar');
  await expect(page.locator('#board-done-btn')).toHaveText('Fet');
  await expect(bf(page).locator('.pbf-title')).toContainText('Pas 1 de 1');
  await page.locator('#board-done-btn').click();
  await expect(ed(page).locator('h2')).toHaveText('Nova jugada');
  await expect(ed(page).locator('.play-editor-open')).toContainText('Obrir la pissarra');
  await expect(page.locator('#editor-save-btn')).toHaveText('Desa');
  expect(relevantErrors(errors)).toEqual([]);
});

test('the 1–15 bench puts exactly the numbers you tap on the pitch, in their usual spots', async ({ page }) => {
  const { backend, errors } = await open(page);
  const seen = dialogs(page);
  await openNewAnimation(page);
  await expect(bf(page).locator('.bench-chip')).toHaveText(Array.from({ length: 15 }, (_, i) => String(i + 1)));
  await expect(bf(page).locator('.bench-chip[aria-pressed="true"]')).toHaveCount(0);

  await bench(page, 9).click();
  await bench(page, 12).click();
  await expect(bf(page).locator('.play-board [data-token]')).toHaveCount(2);
  await expect(edToken(page, 'a9')).toContainText('9');
  await expect(edToken(page, 'a12')).toContainText('12');
  expect(await tokenPos(page, 'a9')).toEqual([32, 65]);
  expect(await tokenPos(page, 'a12')).toEqual([21, 71]);
  await expect(bench(page, 9)).toHaveAttribute('aria-pressed', 'true');
  await expect(bench(page, 12)).toHaveAttribute('aria-pressed', 'true');
  await expect(bench(page, 10)).toHaveAttribute('aria-pressed', 'false');
  await expect(edToken(page, 'a12')).toHaveClass(/selected/);

  // No moves yet: tapping again takes her off without asking.
  await bench(page, 9).click();
  await expect(edToken(page, 'a9')).toHaveCount(0);
  await expect(bench(page, 9)).toHaveAttribute('aria-pressed', 'false');
  expect(seen).toEqual([]);

  // Back on, and she moves in step 2: now taking her off asks first.
  await bench(page, 9).click();
  await page.locator('#editor-add-step').click();
  await drag(page, 'a9', [40, 70]);
  await bench(page, 9).click();
  await expect.poll(() => seen).toEqual(['La 9 ya tiene movimientos en la jugada. ¿Quitarla igualmente?']);
  // setupApp dismisses dialogs ("Cancel"): she stays, moves included.
  await expect(edToken(page, 'a9')).toHaveCount(1);
  expect(await tokenPos(page, 'a9')).toEqual([near(40), near(70)]);

  await page.locator('#board-save-btn').click();
  await expect(sec(page)).toHaveClass(/active/);
  const body = restWrites(backend, 'plays')[0].body[0];
  expect(body.animation.tokens).toEqual([
    { id: 'a12', team: 'attack', label: '12' }, { id: 'a9', team: 'attack', label: '9' },
  ]);
  expect(body.animation.steps[0].pos).toEqual({ a12: [21, 71], a9: [32, 65] });
  expect(body.animation.steps[1].pos.a9).toEqual([near(40), near(70)]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing a saved play: the bench shows who is already on the pitch', async ({ page }) => {
  const { errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  await modal(page).getByRole('button', { name: 'Editar animación' }).click();
  await page.locator('#editor-open-board').click();
  await expect(bf(page).locator('.bench-chip[aria-pressed="true"]')).toHaveText(['8', '9']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: the bench fits in two rows and the board keeps most of the screen', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await open(page);
  await openNewAnimation(page);
  const tops = await bf(page).locator('.bench-chip').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))]);
  expect(tops).toHaveLength(2);
  const board = await bf(page).locator('.pbf-board').boundingBox();
  expect(board.height).toBeGreaterThan(VIEWPORTS.mobile.height * 0.45);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Deleting a play (admins): button in the play modal + confirmation modal
// ---------------------------------------------------------------------------

const delModal = (page) => page.locator('#delete-play-modal');
const TOUCH_CORTA = '95000000-0000-4000-8000-000000000003';

test('players get no delete button', async ({ page }) => {
  const { errors } = await open(page, { user: USERS.player });
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await expect(modal(page)).toHaveClass(/active/);
  await expect(page.locator('#play-delete-btn')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin deletes a play after confirming; "No" goes back to the play', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await modal(page).getByRole('button', { name: 'Eliminar' }).click();

  // The play modal makes way for the confirmation.
  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(delModal(page)).toHaveClass(/active/);
  await expect(delModal(page).locator('h3')).toHaveText('¿Eliminar la jugada?');
  await expect(delModal(page)).toContainText('Touch corta');
  await expect(delModal(page)).toContainText('Desaparecerá para todo el equipo. No se puede deshacer.');

  await delModal(page).getByRole('button', { name: 'No' }).click();
  await expect(delModal(page)).not.toHaveClass(/active/);
  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('h3')).toHaveText('Touch corta');
  expect(restWrites(backend, 'plays')).toEqual([]);

  await modal(page).getByRole('button', { name: 'Eliminar' }).click();
  await delModal(page).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(delModal(page)).not.toHaveClass(/active/);
  await expect(modal(page)).not.toHaveClass(/active/);

  const writes = restWrites(backend, 'plays');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('DELETE');
  expect(writes[0].filters).toContainEqual(['id', `eq.${TOUCH_CORTA}`]);
  // External video link (or none): nothing to remove from Storage.
  expect(storageWrites(backend)).toEqual([]);
  await expect(card(page, 'Touch corta')).toHaveCount(0);
  await expect(filter(page, 'Todas')).toHaveText('Todas 4');
  await expect(filter(page, 'Touch')).toHaveText('Touch 1');

  // Still gone after coming back (the cache was updated too).
  await goToSection(page, 'vestuario');
  await goToSection(page, 'jugadas');
  await expect(card(page, 'Touch corta')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting a play with an uploaded video removes the video from the bucket', async ({ page }) => {
  const uploaded = 'https://proj.supabase.test/storage/v1/object/public/plays/0b1c2d3e-video.mp4';
  const plays = seed.plays.map((p) => (p.title === 'Touch corta' ? { ...p, video_url: uploaded } : p));
  const { backend, errors } = await open(page, { seed: { ...seed, plays } });
  await page.route(/proj\.supabase\.test/, (route) => route.fulfill({ contentType: 'video/mp4', body: '' }));
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await modal(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(delModal(page)).toContainText('y su vídeo también');
  await delModal(page).getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect(card(page, 'Touch corta')).toHaveCount(0);
  await expect.poll(() => storageWrites(backend)).toEqual([{ kind: 'storage', method: 'DELETE', path: '/storage/v1/object/plays' }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('if Supabase does not delete anything (no permission), the play stays and it says so', async ({ page }) => {
  const { errors } = await open(page);
  const seen = dialogs(page);
  // RLS without a delete policy: no error, just nothing deleted.
  await page.route(/\/rest\/v1\/plays\b/, (route) => (route.request().method() === 'DELETE'
    ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '[]' })
    : route.fallback()));
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await modal(page).getByRole('button', { name: 'Eliminar' }).click();
  await delModal(page).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect.poll(() => seen).toEqual(['No se ha podido eliminar la jugada: no tienes permiso']);
  await expect(delModal(page)).toHaveClass(/active/);
  await expect(card(page, 'Touch corta')).toHaveCount(1);
  expect(relevantErrors(errors).filter((e) => !e.includes('No se ha podido eliminar la jugada'))).toEqual([]);
});

test('the phone back button on the confirmation goes back to the play', async ({ page }) => {
  const { backend, errors } = await open(page);
  await goToSection(page, 'jugadas');
  await card(page, 'Salida del 8').click();
  await modal(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(delModal(page)).toHaveClass(/active/);
  await page.goBack();
  await expect(delModal(page)).not.toHaveClass(/active/);
  await expect(modal(page)).toHaveClass(/active/);
  await expect(sec(page)).toHaveClass(/active/);
  expect(restWrites(backend, 'plays')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: delete button and confirmation', async ({ page }) => {
  const { errors } = await open(page);
  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'jugadas');
  await card(page, 'Touch corta').click();
  await modal(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(delModal(page).locator('h3')).toHaveText('Vols eliminar la jugada?');
  await expect(delModal(page)).toContainText("Desapareixerà per a tot l'equip. No es pot desfer.");
  await expect(delModal(page).getByRole('button', { name: 'Sí, eliminar' })).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});
