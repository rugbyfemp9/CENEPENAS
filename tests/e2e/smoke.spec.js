// Recorre todas las secciones (como admin y como jugadora, escritorio y móvil) y
// falla si aparece cualquier error de JavaScript.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, SECTIONS, USERS, VIEWPORTS, relevantErrors } from './support/app.js';

test('logged out: shows the login screen without errors', async ({ page }) => {
  const { errors } = await setupApp(page, { user: null });
  await openApp(page);
  await expect(page.locator('#auth-overlay')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

for (const [who, user] of [['admin', USERS.admin], ['player', USERS.player]]) {
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    test(`${who} ${vpName}: every section renders without errors`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      const { errors } = await setupApp(page, { user });
      await openApp(page);
      await expect(page.locator('#auth-overlay')).toHaveClass(/hidden/);
      for (const id of SECTIONS) {
        await goToSection(page, id);
        expect(relevantErrors(errors), `errors after opening "${id}"`).toEqual([]);
      }
    });
  }
}
