// Shared page setup for the e2e tests: deterministic clock and randomness, the
// fake Supabase backend, an optional logged-in session, and no external network.
import { FakeSupabase, PROJECT_REF, SUPABASE_ORIGIN, mockRealtime, sessionFor } from './fake-supabase.js';
import { seed as defaultSeed, USERS } from '../fixtures/seed.js';

export const NOW = new Date('2026-09-25T10:00:00+02:00');

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};

// Every section of the app (the <section id="sec-..."> elements in index.html).
export const SECTIONS = [
  'inicio', 'asistencia', 'asistencia-detalle', 'vestuario', 'wellness-staff', 'test',
  'partidos', 'partido-detalle', 'gym', 'gym-entrenamiento', 'gym-entrenamiento-dia',
  'gym-equipo', 'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps',
  'comi-tesoreria', 'comi-gira', 'multas', 'tricount', 'liga', 'tercer', 'tercer-historial',
  'tercer-detalle', 'plantilla', 'fantasy', 'galeria', 'perfil',
];

export { USERS };

/**
 * Prepares `page` before the app is loaded.
 * @param {import('@playwright/test').Page} page
 * @param {{ user?: object|null, seed?: object }} options  user: one of USERS, or null for logged out
 */
export async function setupApp(page, { user = USERS.admin, seed = defaultSeed } = {}) {
  const backend = new FakeSupabase({ seed, users: USERS, now: NOW });
  backend.currentUser = user;
  const errors = [];

  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([storageKey, session]) => {
    let s = 42;
    Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  }, [`sb-${PROJECT_REF}-auth-token`, user ? sessionFor(user, NOW) : null]);

  await page.route(`${SUPABASE_ORIGIN}/**`, (route) => backend.handle(route));
  await mockRealtime(page);
  // Fonts, Firebase and any other third party: blocked so runs are deterministic.
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com\/firebasejs|picsum\.photos/, (route) => route.abort());

  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  return { backend, errors };
}

// Errors that also happen on the untouched app (blocked third-party requests).
export const IGNORED_ERRORS = [/Failed to load resource/, /net::ERR_FAILED/];

export function relevantErrors(errors) {
  return errors.filter((e) => !IGNORED_ERRORS.some((re) => re.test(e)));
}

export async function openApp(page) {
  await page.goto('./index.html');
  // Startup does several async Supabase reads; wait until the network settles.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

export async function goToSection(page, id) {
  await page.evaluate((sectionId) => window.setSection(sectionId), id);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
}
