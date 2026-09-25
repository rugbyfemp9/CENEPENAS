import { defineConfig } from '@playwright/test';

// BASE_URL lets the same tests run against any server (e.g. an older checkout
// served with `python3 -m http.server`). Without it, the production build is
// served with `vite preview`.
const baseURL = process.env.BASE_URL || 'http://localhost:4173/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL, serviceWorkers: 'block', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
