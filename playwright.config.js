import { defineConfig } from '@playwright/test';

// BASE_URL lets the same tests run against any server (e.g. an older checkout
// served with `python3 -m http.server`). Without it, the production build is
// served with `vite preview`.
// The tests build and serve their own copy on a dedicated port (never reusing a
// server that happens to be running, which could be serving an older build).
const TEST_PORT = 4317;
const baseURL = process.env.BASE_URL || `http://localhost:${TEST_PORT}/`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  // Some flows wait on several fake-Supabase round trips; on a loaded machine (or CI)
  // the default 5 s for expect() is occasionally too short.
  expect: { timeout: 10_000 },
  use: { baseURL, serviceWorkers: 'block', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: process.env.BASE_URL ? undefined : {
    command: `npm run build -- --outDir .e2e-dist && npx vite preview --outDir .e2e-dist --port ${TEST_PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
