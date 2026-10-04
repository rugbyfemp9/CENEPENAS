// Push notifications on the web: the "turn notifications on" banner on Inicio (the
// permission is only asked from a tap, never on load), and the service worker that
// shows a push when the app is closed and opens Asistencia when it is tapped.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, USERS, relevantErrors } from './support/app.js';

// Replaces the browser's Notification permission (headless Chromium always says
// 'denied') and records every requestPermission() call in window.__permissionRequests.
async function fakeNotificationPermission(page, initial, { onRequest = 'granted' } = {}) {
  await page.addInitScript(([initialPermission, answer]) => {
    let permission = initialPermission;
    window.__permissionRequests = 0;
    Object.defineProperty(Notification, 'permission', { get: () => permission, configurable: true });
    Notification.requestPermission = async () => {
      window.__permissionRequests += 1;
      permission = answer;
      return permission;
    };
  }, [initial, onRequest]);
}

const banner = (page) => page.locator('#inicio-push-banner');

test('the banner asks for notifications only when tapped', async ({ page }) => {
  await fakeNotificationPermission(page, 'default');
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText('¿Te avisamos de los entrenos?');
  expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);

  await banner(page).getByRole('button', { name: 'Activar' }).click();
  await expect(banner(page)).toBeHidden();
  expect(await page.evaluate(() => window.__permissionRequests)).toBe(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Ahora no" hides the banner on this device for good', async ({ page }) => {
  await fakeNotificationPermission(page, 'default');
  await setupApp(page, { user: USERS.player });
  await openApp(page);

  await banner(page).getByRole('button', { name: 'Ahora no' }).click();
  await expect(banner(page)).toBeHidden();

  await page.reload();
  await openApp(page);
  await expect(banner(page)).toBeHidden();
  expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
});

test('the banner is in Catalan when the app is', async ({ page }) => {
  await fakeNotificationPermission(page, 'default');
  await page.addInitScript(() => localStorage.setItem('cnpenas:lang', 'ca'));
  await setupApp(page, { user: USERS.player });
  await openApp(page);

  await expect(banner(page)).toContainText("T'avisem dels entrenos?");
  await expect(banner(page).getByRole('button', { name: 'Activa' })).toBeVisible();
  await expect(banner(page).getByRole('button', { name: 'Ara no' })).toBeVisible();
});

for (const permission of ['granted', 'denied']) {
  test(`no banner once notifications are ${permission}`, async ({ page }) => {
    await fakeNotificationPermission(page, permission);
    await setupApp(page, { user: USERS.player });
    await openApp(page);

    await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
    await expect(banner(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.__permissionRequests)).toBe(0);
  });
}

test('opening the app at #asistencia (a tapped notification) goes straight to Asistencia', async ({ page }) => {
  await setupApp(page, { user: USERS.player });
  await page.goto('./index.html#asistencia');

  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  expect(new URL(page.url()).hash).toBe('');
});

// With the app already open, sw.js navigates the window to ./#asistencia: only the
// hash changes, so the page doesn't reload (and the "back" handler gets a popstate).
test('a tapped notification with the app already open goes to Asistencia', async ({ page }) => {
  await setupApp(page, { user: USERS.player });
  await openApp(page);
  await page.evaluate(() => window.setSection('multas'));

  await page.evaluate(() => { location.hash = 'asistencia'; });

  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  expect(new URL(page.url()).hash).toBe('');

  // "Back" returns to where you were before the notification
  await page.goBack();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('shows a push that arrives while the app is closed', async ({ page, context }) => {
    await setupApp(page, { user: USERS.player });
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Headless Chromium never lets a page show notifications, so record what the
    // worker asks to show instead.
    const [worker] = context.serviceWorkers();
    await worker.evaluate(() => {
      self.__shown = [];
      self.registration.showNotification = async (title, options) => { self.__shown.push({ title, ...options }); };
    });

    // What FCM delivers for a data-only message: the fields sit under "data".
    const payload = { data: { title: 'Entreno demà a les 20:30', body: 'Encara no has respost', url: './#asistencia', tag: 'att-auto-2026-09-28' } };
    const cdp = await context.newCDPSession(page);
    const registrationId = new Promise((resolve) => {
      cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
        if (registrations[0]) resolve(registrations[0].registrationId);
      });
    });
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: new URL(page.url()).origin,
      registrationId: await registrationId,
      data: JSON.stringify(payload),
    });

    await expect.poll(() => worker.evaluate(() => self.__shown)).toEqual([{
      title: payload.data.title,
      body: payload.data.body,
      icon: 'assets/img/applogo.png',
      badge: 'assets/img/applogo.png',
      tag: payload.data.tag,
      data: { url: payload.data.url },
    }]);
  });
});
