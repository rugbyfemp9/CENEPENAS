// The service worker: pages go to the network first (so a new deploy is picked up on
// the next load instead of serving a cached index.html that points at files which no
// longer exist) and fall back to the cache when offline.
import { test, expect } from '@playwright/test';
import { setupApp, openApp } from './support/app.js';

test.use({ serviceWorkers: 'allow' });

async function waitForControllingWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
}

test('a new version of the page is served on the next load, not the cached one', async ({ page, context }) => {
  await setupApp(page);
  await openApp(page);
  await waitForControllingWorker(page);

  // Simulate a deploy: the server now returns a different index.html.
  await context.route(/\/index\.html$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<body>', '<body data-new-deploy="yes">');
    await route.fulfill({ response, body });
  });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-new-deploy', 'yes');
});

test('offline, the app still opens from the cache', async ({ page, context }) => {
  await setupApp(page);
  await openApp(page);
  await waitForControllingWorker(page);
  await page.reload(); // make sure the page and its assets went through the worker
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.app')).toBeAttached();
  await expect(page.locator('.bottom-nav button')).toHaveCount(4);
  await context.setOffline(false);
});
