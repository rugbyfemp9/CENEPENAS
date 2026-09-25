// Captures what every section looks like, so two builds can be compared with
// scripts/compare-snapshots.mjs. Only runs when SNAPSHOT_DIR is set:
//
//   SNAPSHOT_DIR=.snapshots/before npx playwright test snapshot
//   ...change code...
//   SNAPSHOT_DIR=.snapshots/after npx playwright test snapshot
//   node scripts/compare-snapshots.mjs .snapshots/before .snapshots/after
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { setupApp, openApp, goToSection, SECTIONS, USERS, VIEWPORTS, relevantErrors } from './support/app.js';

const dir = process.env.SNAPSHOT_DIR;
test.skip(!dir, 'SNAPSHOT_DIR not set');

const scenarios = [
  { name: 'loggedout-desktop', user: null, viewport: VIEWPORTS.desktop, sections: [] },
  { name: 'loggedout-mobile', user: null, viewport: VIEWPORTS.mobile, sections: [] },
  { name: 'admin-desktop', user: USERS.admin, viewport: VIEWPORTS.desktop, sections: SECTIONS },
  { name: 'admin-mobile', user: USERS.admin, viewport: VIEWPORTS.mobile, sections: SECTIONS },
  { name: 'player-desktop', user: USERS.player, viewport: VIEWPORTS.desktop, sections: SECTIONS },
  { name: 'admin-desktop-ca', user: USERS.admin, viewport: VIEWPORTS.desktop, sections: SECTIONS, lang: 'ca' },
];

for (const sc of scenarios) {
  test(sc.name, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(sc.viewport);
    const { backend, errors } = await setupApp(page, { user: sc.user });
    if (sc.lang) await page.addInitScript((lang) => localStorage.setItem('cnpenas:lang', lang), sc.lang);
    const out = path.join(dir, sc.name);
    fs.mkdirSync(out, { recursive: true });

    const capture = async (label) => {
      await page.screenshot({ path: path.join(out, `${label}.png`), fullPage: true, animations: 'disabled', caret: 'hide' });
      const text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(out, `${label}.txt`), text);
    };

    await openApp(page);
    await capture('00-initial');
    let i = 1;
    for (const id of sc.sections) {
      await goToSection(page, id);
      await capture(`${String(i++).padStart(2, '0')}-${id}`);
    }
    fs.writeFileSync(path.join(out, 'mutations.json'), JSON.stringify(backend.mutations, null, 2));
    fs.writeFileSync(path.join(out, 'errors.txt'), relevantErrors(errors).join('\n'));
  });
}
