// The mobile bottom nav follows the app language (it used to stay in Spanish).
import { test, expect } from '@playwright/test';
import { setupApp, openApp, VIEWPORTS, relevantErrors } from './support/app.js';

const labels = (page) => page.locator('.bottom-nav button').allInnerTexts();

test('mobile bottom nav switches between Spanish and Catalan and remembers it', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await setupApp(page);
  await openApp(page);

  // Labels are uppercased by CSS, so compare case-insensitively.
  expect((await labels(page)).map((l) => l.trim().toLowerCase())).toEqual(['inicio', 'asistencia', 'vestuario', 'perfil']);

  await page.locator('#lang-toggle-mobile').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  expect((await labels(page)).map((l) => l.trim().toLowerCase())).toEqual(['inici', 'assistència', 'vestidor', 'perfil']);

  await page.reload();
  await page.waitForLoadState('networkidle');
  expect((await labels(page)).map((l) => l.trim().toLowerCase())).toEqual(['inici', 'assistència', 'vestidor', 'perfil']);

  await page.locator('#lang-toggle-mobile').click();
  expect((await labels(page)).map((l) => l.trim().toLowerCase())).toEqual(['inicio', 'asistencia', 'vestuario', 'perfil']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the active tab still works after switching language', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await setupApp(page);
  await openApp(page);
  await page.locator('#lang-toggle-mobile').click();
  await page.locator('.bottom-nav button[data-tab="vestuario"]').click();
  await expect(page.locator('.bottom-nav button[data-tab="vestuario"]')).toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
});
