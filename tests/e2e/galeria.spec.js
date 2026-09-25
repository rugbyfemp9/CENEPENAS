import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed } from './fixtures/seed.js';

const withGallery = (seasons) => ({ ...seed, gallery_data: [{ id: 'current', seasons }] });

test('lists seasons newest first and opens a season', async ({ page }) => {
  const { errors } = await setupApp(page, {
    seed: withGallery([
      { id: '2024-2025', label: 'Temporada 2024/2025', cover: 'assets/img/p3.jpg', albums: [] },
      { id: '2025-2026', label: 'Temporada 2025/2026', current: true, cover: 'assets/img/rugby.jpg', albums: [
        { id: 'a1', title: 'CNPN vs Barça', url: 'https://photos.app.goo.gl/abc', cover: 'assets/img/gipsy.jpg' },
      ] },
    ]),
  });
  await openApp(page);
  await goToSection(page, 'galeria');
  await expect(page.locator('.season-card-title')).toHaveText(['Temporada 2025/2026', 'Temporada 2024/2025']);
  await expect(page.locator('.season-card-current')).toHaveCount(1);

  await page.locator('.season-card').first().click();
  await expect(page.locator('#galeria-title')).toHaveText('Temporada 2025/2026');
  await expect(page.locator('.album-card')).toHaveAttribute('href', 'https://photos.app.goo.gl/abc');

  await page.locator('#galeria-back-link').click();
  await expect(page.locator('#galeria-title')).toHaveText('Galería');
  await page.locator('#galeria-back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('covers saved with the old foto/ path still load', async ({ page }) => {
  await setupApp(page, {
    seed: withGallery([{ id: '2025-2026', label: 'T', cover: 'foto/gipsy.JPG', albums: [
      { id: 'a1', title: 'A', url: 'https://example.com', cover: 'foto/ceu.JPG' },
    ] }]),
  });
  await openApp(page);
  await goToSection(page, 'galeria');
  await expect(page.locator('.season-card-cover')).toHaveAttribute('style', /assets\/img\/gipsy\.jpg/);
  await page.locator('.season-card').click();
  await expect(page.locator('.album-card img')).toHaveAttribute('src', 'assets/img/ceu.jpg');
});

test('album data from Supabase cannot inject HTML or javascript: links', async ({ page }) => {
  await setupApp(page, {
    seed: withGallery([{ id: 'x', label: '<img src=x onerror=window.pwned=1>', cover: "x');background:red;('", albums: [
      { id: 'a1', title: '<b>bold</b>', url: 'javascript:window.pwned=1', cover: '" onerror="window.pwned=1' },
    ] }]),
  });
  await openApp(page);
  await goToSection(page, 'galeria');
  await expect(page.locator('.season-card-title')).toHaveText('<img src=x onerror=window.pwned=1>');
  await page.locator('.season-card').click();
  await expect(page.locator('.album-card b')).toHaveText('<b>bold</b>');
  await expect(page.locator('.album-card')).not.toHaveAttribute('href', /.*/);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});

test('Comi Xarxes adds an album; it is saved to Supabase', async ({ page }) => {
  const { backend } = await setupApp(page, { seed: withGallery([
    { id: '2025-2026', label: 'Temporada 2025/2026', cover: 'assets/img/rugby.jpg', albums: [] },
  ]) });
  await openApp(page);
  await goToSection(page, 'galeria');
  await page.locator('#add-album-btn').click();
  const modal = page.locator('#add-album-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#album-season-input')).toHaveValue('2025-2026');
  await expect(page.locator('#album-new-season-wrap')).toBeHidden();

  await page.locator('#album-season-input').selectOption('__new__');
  await expect(page.locator('#album-new-season-wrap')).toBeVisible();
  await page.locator('#album-new-season-input').fill('Temporada 2027/2028');
  await page.locator('#album-title-input').fill('Pretemporada');
  await page.locator('#album-url-input').fill('https://photos.app.goo.gl/new');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(modal).not.toHaveClass(/active/);
  await expect(page.locator('#galeria-title')).toHaveText('Temporada 2027/2028');
  await expect(page.locator('.album-card b')).toHaveText('Pretemporada');

  const upserts = backend.mutations.filter((m) => m.table === 'gallery_data');
  expect(upserts).toHaveLength(1);
  const saved = upserts[0].body[0].seasons;
  expect(saved.map((s) => s.id)).toEqual(['2025-2026', 'temporada-2027-2028']);
  expect(saved[1].albums[0]).toMatchObject({ id: 'temporada-2027-2028-pretemporada', title: 'Pretemporada', url: 'https://photos.app.goo.gl/new' });
});

test('players who are not Comi Xarxes cannot add albums', async ({ page }) => {
  await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'galeria');
  await expect(page.locator('#add-album-btn')).toBeHidden();
});

test('the phone back button closes the modal and it can be reopened', async ({ page }) => {
  await setupApp(page);
  await openApp(page);
  await goToSection(page, 'galeria');
  await page.locator('#add-album-btn').click();
  await expect(page.locator('#add-album-modal')).toHaveClass(/active/);
  await page.goBack();
  await expect(page.locator('#add-album-modal')).not.toHaveClass(/active/);
  await expect(page.locator('#sec-galeria')).toHaveClass(/active/);
  await page.locator('#add-album-btn').click();
  await expect(page.locator('#add-album-modal')).toHaveClass(/active/);
});

test('switching language re-renders the gallery', async ({ page }) => {
  await setupApp(page);
  await openApp(page);
  await goToSection(page, 'galeria');
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#galeria-title')).toHaveText('Galeria');
});
