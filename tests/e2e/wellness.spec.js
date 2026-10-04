// Characterization tests for Wellness / RPE:
//   - the player's rating modal (#wellness-modal, table attendance_wellness), opened
//     from the Inicio reminder banner or from the 📊 button of an event detail;
//   - the Inicio "pending wellness" reminder banner (jugadora / Capitana only);
//   - the Cos Tècnic analysis panel (sec-wellness-staff): session tab (event select,
//     alerts + alert modal, per-player table) and history tab (evolution chart +
//     summary, weekly sRPE load table, per-player history modal), plus the 📊 quick
//     links from Asistencia.
//
// Seed (clock Fri 2026-09-25 10:00, trainings Mon/Wed/Fri 20:30-22:00 = 90 min):
//   auto-2026-09-23: Rovi 7 (7-8, mood 4), Tanke 9 (lt6, mood 2, "Molestia en el tobillo
//                    derecho"), Carla 5 (gt8, mood 5), Paula 6 (7-8, mood 3)
//   auto-2026-09-21: Juls 6 (7-8, mood 4), Rovi 8 (lt6, mood 3, "Sobrecarga en isquios")
//   match 2026-09-19 (17:30-19:00 = 90 min): Juls 9, Rovi 10 ("Golpe en el hombro")
// The player (Juls) has not rated 09-23, so the Inicio banner points there. The banner
// skips sessions the player said "No asistiré" to; unanswered ones still count.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

// openApp + wait until the session is restored (the login overlay is gone), so a slow
// startup on a busy machine does not leave the overlay on top of the page.
async function openAppReady(page) {
  await openApp(page);
  await expect(page.locator('#auth-overlay')).toBeHidden({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
const MARTA = authUser(IDS.marta, 'marta@cnpenas.test'); // Capitana
const JORDI = authUser(IDS.jordi, 'jordi@cnpenas.test'); // entrenador/a
const NURIA = authUser(IDS.nuria, 'nuria@cnpenas.test'); // fisio
const SERGI = authUser(IDS.sergi, 'sergi@cnpenas.test'); // delegado/a

const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const clone = (v) => JSON.parse(JSON.stringify(v));

const banner = (page) => page.locator('#inicio-wellness-reminder-banner');
const modal = (page) => page.locator('#wellness-modal');
const sleepOpts = (page) => page.locator('#wellness-sleep-options .wellness-pill-opt');
const moodOpts = (page) => page.locator('#wellness-mood-options .wellness-mood-opt');
const discomfortOpts = (page) => page.locator('#wellness-modal .wellness-toggle-opt');

const PAST_EVENT_OPTIONS = [
  'Entreno · Miércoles 23/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Lunes 21/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Partido vs Gòtics · Sábado 19/09/26 · CEM Mar Bella · 17:30 - 19:00h',
  'Entreno · Viernes 18/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Miércoles 16/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Lunes 14/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Partido vs Tarragona · Sábado 12/09/26 · CEM Mar Bella · 12:00 - 13:30h',
  'Entreno · Miércoles 09/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Lunes 07/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Viernes 04/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  'Entreno · Miércoles 02/09/26 · CEM Mar Bella · 20:30 - 22:00h',
];

async function openAsPlayer(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openAppReady(page);
  return ctx;
}

// Opens Asistencia → "Ver anteriores" → the card whose text contains `when`.
async function openPastEventDetail(page, when) {
  await goToSection(page, 'asistencia');
  await page.locator('#att-event-list .att-history-toggle').click();
  await page.locator('#att-event-list .att-event', { hasText: when }).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
}

async function openStaffPanel(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.admin, ...opts });
  await openAppReady(page);
  await goToSection(page, 'wellness-staff');
  await expect(page.locator('#sec-wellness-staff')).toHaveClass(/active/);
  return ctx;
}

const staffRows = (page) => page.locator('#wstaff-table-body tr');

// ---------------------------------------------------------------------------
// Player: Inicio reminder banner + rating modal
// ---------------------------------------------------------------------------

test('Inicio reminder banner opens the rating modal of the latest unrated session with default values', async ({ page }) => {
  const { backend, errors } = await openAsPlayer(page);
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).locator('b')).toHaveText('¡Tienes algo pendiente de valorar!');
  await expect(banner(page).locator('.txt span')).toHaveText([
    'Valora la carga del último entreno o partido',
    'Entreno · Miércoles 23/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  ]);
  await expect(banner(page).getByRole('button')).toHaveCount(0);

  await banner(page).click();
  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('h3')).toHaveText('Wellness / RPE');
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Miércoles 23/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(modal(page).locator('.wellness-not-attended')).toHaveText('No he venido');
  await expect(page.locator('#wellness-rpe-slider')).toHaveValue('5');
  await expect(page.locator('#wellness-rpe-value')).toHaveText('5');
  await expect(page.locator('#wellness-rpe-emoji')).toHaveText('🏃‍♀️');
  await expect(page.locator('#wellness-rpe-desc')).toHaveText('Un poco duro');
  await expect(page.locator('#wellness-rpe-desc')).toHaveCSS('color', 'rgb(222, 159, 63)');
  await expect(sleepOpts(page)).toHaveText(['<6h', '6-8h', '>8h']);
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveCount(0);
  await expect(moodOpts(page)).toHaveText(['😞', '🙁', '😐', '🙂', '😄']);
  await expect(page.locator('#wellness-mood-options .selected')).toHaveCount(0);
  await expect(discomfortOpts(page)).toHaveText(['No', 'Sí']);
  await expect(discomfortOpts(page).nth(0)).toHaveClass(/selected/);
  await expect(discomfortOpts(page).nth(1)).not.toHaveClass(/selected/);
  await expect(page.locator('#wellness-discomfort-detail')).toBeHidden();
  expect(writesTo(backend, 'attendance_wellness')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the RPE slider updates the value, emoji and description of each level', async ({ page }) => {
  const { errors } = await openAsPlayer(page);
  await banner(page).click();
  const slider = page.locator('#wellness-rpe-slider');
  await slider.focus();

  await page.keyboard.press('Home');
  await expect(page.locator('#wellness-rpe-value')).toHaveText('1');
  await expect(page.locator('#wellness-rpe-emoji')).toHaveText('😌');
  await expect(page.locator('#wellness-rpe-desc')).toHaveText('Muy, muy suave');
  await expect(page.locator('#wellness-rpe-desc')).toHaveCSS('color', 'rgb(46, 158, 108)');

  const expected = [
    ['2', '🟢', 'Muy suave'], ['3', '🙂', 'Suave'], ['4', '🟡', 'Moderado'], ['5', '🏃‍♀️', 'Un poco duro'],
    ['6', '🟠', 'Duro'], ['7', '🥵', 'Muy duro'], ['8', '🔴', 'Muy, muy duro'], ['9', '🔥', 'Casi máximo'],
    ['10', '💀', 'Máximo / Agotamiento'],
  ];
  for (const [value, emoji, desc] of expected) {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#wellness-rpe-value')).toHaveText(value);
    await expect(page.locator('#wellness-rpe-emoji')).toHaveText(emoji);
    await expect(page.locator('#wellness-rpe-desc')).toHaveText(desc);
  }
  await expect(page.locator('#wellness-rpe-desc')).toHaveCSS('color', 'rgb(122, 30, 30)');
  // Already at the maximum
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('10');
  expect(relevantErrors(errors)).toEqual([]);
});

test('sleep and mood are single-choice pills that deselect on a second tap; discomfort toggles the detail box', async ({ page }) => {
  const { errors } = await openAsPlayer(page);
  await banner(page).click();

  await sleepOpts(page).nth(0).click();
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveText(['<6h']);
  await sleepOpts(page).nth(2).click();
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveText(['>8h']);
  await sleepOpts(page).nth(2).click();
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveCount(0);

  await moodOpts(page).nth(3).click();
  await expect(page.locator('#wellness-mood-options .selected')).toHaveText(['🙂']);
  await moodOpts(page).nth(0).click();
  await expect(page.locator('#wellness-mood-options .selected')).toHaveText(['😞']);
  await moodOpts(page).nth(0).click();
  await expect(page.locator('#wellness-mood-options .selected')).toHaveCount(0);

  await modal(page).getByRole('button', { name: 'Sí' }).click();
  await expect(discomfortOpts(page).nth(1)).toHaveClass(/selected/);
  await expect(discomfortOpts(page).nth(0)).not.toHaveClass(/selected/);
  await expect(page.locator('#wellness-discomfort-textarea')).toBeVisible();
  await expect(page.locator('#wellness-discomfort-textarea')).toHaveAttribute('placeholder', 'Describe la zona (ej. rodilla derecha)...');
  await expect(page.locator('#wellness-discomfort-textarea')).toHaveAttribute('maxlength', '200');
  await modal(page).getByRole('button', { name: 'No', exact: true }).click();
  await expect(page.locator('#wellness-discomfort-detail')).toBeHidden();
  await expect(discomfortOpts(page).nth(0)).toHaveClass(/selected/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('saving upserts one attendance_wellness row and the banner moves to the next unrated session', async ({ page }) => {
  const { backend, errors } = await openAsPlayer(page);
  await banner(page).click();
  await page.locator('#wellness-rpe-slider').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // 8
  await sleepOpts(page).nth(0).click(); // <6h
  await moodOpts(page).nth(1).click(); // 🙁 (2)
  await modal(page).getByRole('button', { name: 'Sí' }).click();
  await page.locator('#wellness-discomfort-textarea').fill('  Rodilla izquierda  ');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();

  await expect(modal(page)).not.toHaveClass(/active/);
  const writes = writesTo(backend, 'attendance_wellness');
  expect(writes).toHaveLength(1);
  expect(writes[0].method).toBe('UPSERT');
  expect(writes[0].onConflict).toEqual(['event_id', 'user_id']);
  expect(writes[0].body).toHaveLength(1);
  const { updated_at, ...body } = writes[0].body[0];
  expect(body).toEqual({
    event_id: EVENT_IDS.trWed, user_id: IDS.player, rpe: 8, sleep_hours: 'lt6', mood: 2,
    has_discomfort: true, discomfort_detail: 'Rodilla izquierda',
  });
  expect(updated_at).toBe('2026-09-25T08:00:00.000Z');

  // 09-21 and the 09-19 match are already rated, so the banner now points to Fri 09-18
  // (not answered, so it still counts).
  await expect(banner(page)).toBeVisible();
  await banner(page).click();
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Viernes 18/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(page.locator('#wellness-rpe-value')).toHaveText('5');
  expect(relevantErrors(errors)).toEqual([]);
});

test('untouched fields are saved as null and a discomfort text is dropped when "No" is chosen', async ({ page }) => {
  const { backend, errors } = await openAsPlayer(page);
  await banner(page).click();
  await modal(page).getByRole('button', { name: 'Sí' }).click();
  await page.locator('#wellness-discomfort-textarea').fill('Hombro');
  await modal(page).getByRole('button', { name: 'No', exact: true }).click();
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  const writes = writesTo(backend, 'attendance_wellness');
  expect(writes).toHaveLength(1);
  expect(writes[0].body[0]).toMatchObject({
    event_id: EVENT_IDS.trWed, user_id: IDS.player, rpe: 5, sleep_hours: null, mood: null,
    has_discomfort: false, discomfort_detail: '',
  });
  expect(relevantErrors(errors)).toEqual([]);
});

test('cancel, or a click on the overlay, closes the modal without writing', async ({ page }) => {
  const { backend, errors } = await openAsPlayer(page);
  await banner(page).click();
  await sleepOpts(page).nth(1).click();
  await modal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  // Reopening starts from the defaults again
  await banner(page).click();
  await expect(modal(page)).toHaveClass(/active/);
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveCount(0);
  await modal(page).click({ position: { x: 5, y: 5 } });
  await expect(modal(page)).not.toHaveClass(/active/);
  expect(writesTo(backend, 'attendance_wellness')).toEqual([]);
  await expect(banner(page)).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('a failed save shows an alert and keeps the modal open', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await page.route('**/rest/v1/attendance_wellness**', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: 'boom' }) });
  });
  await openAppReady(page);
  const msgs = [];
  page.on('dialog', (d) => msgs.push(d.message()));
  await banner(page).click();
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => msgs).toEqual(['No se ha podido guardar el wellness. Inténtalo de nuevo.']);
  await expect(modal(page)).toHaveClass(/active/);
  expect(relevantErrors(errors).some((e) => e.includes('No se ha podido guardar el wellness'))).toBe(true);
});

test('the 📊 button of an event detail pre-fills a previous rating and saving replaces it', async ({ page }) => {
  const { backend, errors } = await openAsPlayer(page);
  await openPastEventDetail(page, 'Lunes 21/09/26');
  await expect(page.locator('#att-detail-wellness-btn')).toBeVisible();
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeHidden();
  await page.locator('#att-detail-wellness-btn').click();

  await expect(modal(page)).toHaveClass(/active/);
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Lunes 21/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(page.locator('#wellness-rpe-value')).toHaveText('6');
  await expect(page.locator('#wellness-rpe-slider')).toHaveValue('6');
  await expect(page.locator('#wellness-rpe-desc')).toHaveText('Duro');
  await expect(page.locator('#wellness-sleep-options .selected')).toHaveText(['6-8h']);
  await expect(page.locator('#wellness-mood-options .selected')).toHaveText(['🙂']);
  await expect(discomfortOpts(page).nth(0)).toHaveClass(/selected/);

  await page.locator('#wellness-rpe-slider').focus();
  await page.keyboard.press('ArrowLeft');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);
  const writes = writesTo(backend, 'attendance_wellness');
  expect(writes).toHaveLength(1);
  expect(writes[0].body[0]).toMatchObject({ event_id: EVENT_IDS.trMon, user_id: IDS.player, rpe: 5, sleep_hours: '7-8', mood: 4, has_discomfort: false });
  const mine = backend.db.attendance_wellness.filter((r) => r.event_id === EVENT_IDS.trMon && r.user_id === IDS.player);
  expect(mine).toHaveLength(1);
  expect(mine[0].rpe).toBe(5);
  expect(relevantErrors(errors)).toEqual([]);
});

test('players also get the 📊 wellness button on upcoming events', async ({ page }) => {
  const { errors } = await openAsPlayer(page);
  await goToSection(page, 'asistencia');
  await page.locator('#att-event-list .att-event', { hasText: 'Viernes 25/09/26' }).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  // NOTE: the button is shown for any event (even one that has not happened yet).
  await expect(page.locator('#att-detail-wellness-btn')).toBeVisible();
  await page.locator('#att-detail-wellness-btn').click();
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Viernes 25/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  expect(relevantErrors(errors)).toEqual([]);
});

test('the Capitana also gets the reminder banner', async ({ page }) => {
  const { errors } = await setupApp(page, { user: MARTA });
  await openAppReady(page);
  await expect(banner(page)).toBeVisible();
  await banner(page).click();
  // Rovi rated 09-23, 09-21 and the 09-19 match
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Viernes 18/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  expect(relevantErrors(errors)).toEqual([]);
});

test('no reminder banner when the player has rated every ended training and match', async ({ page }) => {
  const s = clone(seed);
  const ended = ['2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09', '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-23']
    .map((iso) => `auto-${iso}`).concat([EVENT_IDS.matchPast1]);
  for (const event_id of ended) {
    s.attendance_wellness.push({ event_id, user_id: IDS.player, rpe: 4, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-24T10:00:00Z' });
  }
  const { errors } = await openAsPlayer(page, { seed: s });
  // Meetings do not count (the 29/09 meeting is in the future anyway) and today's
  // training has not ended at 10:00.
  await expect(banner(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('the reminder skips sessions answered "No asistiré" but not unanswered ones', async ({ page }) => {
  const s = clone(seed);
  // 09-23: "No asistiré" → skipped. 09-21 and the 09-19 match are rated, so the banner
  // falls through to Fri 09-18, which she never answered.
  s.att_attendance.find((r) => r.event_id === EVENT_IDS.trWed && r.user_id === IDS.player).status = 'no';
  const { errors } = await openAsPlayer(page, { seed: s });
  await expect(banner(page).locator('.txt .ev')).toHaveText('Entreno · Viernes 18/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  expect(relevantErrors(errors)).toEqual([]);
});

test('"No he venido" changes the answer to "No asistiré", asks for a reason and moves the banner on', async ({ page }) => {
  const s = clone(seed);
  // Every other ended session is rated, so after 09-23 there is nothing left to remind.
  for (const iso of ['2026-09-02', '2026-09-04', '2026-09-07', '2026-09-09', '2026-09-14', '2026-09-16', '2026-09-18']) {
    s.attendance_wellness.push({ event_id: `auto-${iso}`, user_id: IDS.player, rpe: 4, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-24T10:00:00Z' });
  }
  s.attendance_wellness.push({ event_id: EVENT_IDS.matchPast1, user_id: IDS.player, rpe: 4, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-24T10:00:00Z' });
  const { backend, errors } = await openAsPlayer(page, { seed: s });
  await banner(page).click();
  await expect(modal(page)).toHaveClass(/active/);
  await modal(page).getByRole('button', { name: 'No he venido' }).click();

  // The rating modal closes and the usual "No asistiré" justification modal opens.
  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(page.locator('#comment-modal')).toHaveClass(/active/);
  await expect(banner(page)).toBeHidden();

  const writes = writesTo(backend, 'att_attendance');
  expect(writes).toHaveLength(1);
  expect(writes[0].body[0]).toMatchObject({ event_id: EVENT_IDS.trWed, user_id: IDS.player, status: 'no' });
  expect(writesTo(backend, 'attendance_wellness')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('no "No he venido" button when the rating modal is opened for an event answered "No asistiré"', async ({ page }) => {
  const s = clone(seed);
  s.att_attendance.find((r) => r.event_id === EVENT_IDS.trWed && r.user_id === IDS.player).status = 'no';
  const { errors } = await openAsPlayer(page, { seed: s });
  await openPastEventDetail(page, 'Miércoles 23/09/26');
  await page.locator('#att-detail-wellness-btn').click();
  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('.wellness-not-attended')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff roles never get the reminder banner nor the player wellness button', async ({ page }) => {
  const { errors } = await setupApp(page, { user: JORDI });
  await openAppReady(page);
  await expect(banner(page)).toBeHidden();
  await openPastEventDetail(page, 'Lunes 21/09/26');
  await expect(page.locator('#att-detail-wellness-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('reminder and rating modal in Catalan', async ({ page }) => {
  const { errors } = await openAsPlayer(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(banner(page).locator('b')).toHaveText('Tens alguna cosa pendent de valorar!');
  await expect(banner(page).locator('.txt span').first()).toHaveText("Valora la càrrega de l'últim entrenament o partit");
  await banner(page).click();
  await expect(modal(page).getByRole('button', { name: 'No he vingut' })).toBeVisible();
  await expect(modal(page).locator('.wellness-phase-sleep .wellness-field-label')).toHaveText('Hores de son');
  // NOTE: the middle sleep option is "7-8h" in Catalan but "6-8h" in Spanish (value '7-8').
  await expect(sleepOpts(page)).toHaveText(['<6h', '7-8h', '>8h']);
  await expect(modal(page).locator('.wellness-phase-mood .wellness-field-label')).toHaveText("Estat d'ànim");
  await expect(modal(page).locator('.wellness-toggle-label')).toHaveText('Tens alguna molèstia física?');
  await expect(page.locator('#wellness-rpe-desc')).toHaveText('Un poc dur');
  // The subtitle's date follows a language change while the modal is open.
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Dimecres 23/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await page.evaluate(() => window.setLang('es'));
  await expect(page.locator('#wellness-modal-sub')).toHaveText('Entreno · Miércoles 23/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Cos Tècnic panel: access
// ---------------------------------------------------------------------------

test('players cannot see the staff panel and are redirected to Vestuario', async ({ page }) => {
  const { errors } = await openAsPlayer(page);
  await expect(page.locator('#sidebar-wellness-staff')).toBeHidden();
  await goToSection(page, 'vestuario');
  await expect(page.locator('#vest-card-wellness-staff')).toBeHidden();
  await goToSection(page, 'wellness-staff');
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  await expect(page.locator('#sec-wellness-staff')).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

for (const [who, user] of [['admin', USERS.admin], ['coach', JORDI], ['fisio', NURIA], ['delegado', SERGI]]) {
  test(`${who} opens the staff panel from Vestuario`, async ({ page }) => {
    const { backend, errors } = await setupApp(page, { user });
    await openAppReady(page);
    await expect(page.locator('#sidebar-wellness-staff')).toBeVisible();
    await goToSection(page, 'vestuario');
    await page.locator('#vest-card-wellness-staff').click();
    await expect(page.locator('#sec-wellness-staff')).toHaveClass(/active/);
    await expect(page.locator('#sec-wellness-staff .section-head h2')).toHaveText('Percepción del esfuerzo');
    await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trWed);
    await expect(staffRows(page)).toHaveCount(4);
    expect(writesTo(backend, 'attendance_wellness')).toEqual([]);
    expect(relevantErrors(errors)).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// Cos Tècnic panel: session tab
// ---------------------------------------------------------------------------

test('session tab lists ended trainings and matches and shows the latest one by default', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  await expect(page.locator('#wstaff-subtab-btn-session')).toHaveClass(/active/);
  await expect(page.locator('#wstaff-tab-session')).toBeVisible();
  await expect(page.locator('#wstaff-tab-history')).toBeHidden();
  // No meetings, nothing from today (not ended yet) or the future.
  await expect(page.locator('#wstaff-event-select option')).toHaveText(PAST_EVENT_OPTIONS);
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trWed);

  await expect(page.locator('#wstaff-alert-discomfort-count')).toHaveText('1');
  await expect(page.locator('#wstaff-alert-sleep-count')).toHaveText('1');
  await expect(page.locator('#wstaff-alert-load-count')).toHaveText('1');

  await expect(page.locator('#wstaff-tab-session .wstaff-table thead th')).toHaveText(['Jugadora', 'Horas de sueño', 'Estado de ánimo', 'RPE', 'Carga (sRPE)', 'Molestias']);
  // Sorted by display name; load = RPE × 90 minutes
  await expect(staffRows(page).locator('.col-player')).toHaveText(['Carla', 'Paula', 'Rovi', 'Tanke']);
  await expect(staffRows(page).locator('.wstaff-sleep-pill')).toHaveText(['>8h', '6-8h', '6-8h', '<6h']);
  await expect(staffRows(page).locator('.wstaff-sleep-pill').nth(0)).toHaveClass(/gt8/);
  await expect(staffRows(page).locator('.wstaff-sleep-pill').nth(1)).toHaveClass(/mid/);
  await expect(staffRows(page).locator('.wstaff-sleep-pill').nth(3)).toHaveClass(/lt6/);
  await expect(staffRows(page).locator('td:nth-child(3)')).toHaveText(['😄', '😐', '🙂', '🙁']);
  await expect(staffRows(page).locator('.wstaff-rpe-pill')).toHaveText(['5', '6', '7', '9']);
  await expect(staffRows(page).locator('.wstaff-rpe-pill').nth(3)).toHaveCSS('background-color', 'rgb(179, 58, 46)');
  await expect(staffRows(page).locator('td:nth-child(5)')).toHaveText(['450', '540', '630', '810']);
  await expect(staffRows(page).locator('td:nth-child(6)')).toHaveText(['Sin molestias', 'Sin molestias', 'Sin molestias', 'Molestia en el tobillo derecho']);
  await expect(staffRows(page).nth(3).locator('.discomfort-yes')).toHaveCount(1);
  await expect(page.locator('#wstaff-empty-state')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('alert cards open a modal with the players in that situation', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  const alertModal = page.locator('#wstaff-alert-modal');

  await page.locator('.wstaff-alert-card.discomfort').click();
  await expect(alertModal).toHaveClass(/active/);
  await expect(page.locator('#wstaff-alert-modal-icon')).toHaveText('🔴');
  await expect(page.locator('#wstaff-alert-modal-title')).toHaveText('Molestias');
  await expect(page.locator('#wstaff-alert-modal-count')).toHaveText('1 jugadora');
  await expect(page.locator('#wstaff-alert-modal-list .row')).toHaveText(['Tanke — Molestia en el tobillo derecho']);
  await alertModal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(alertModal).not.toHaveClass(/active/);

  await page.locator('.wstaff-alert-card.sleep').click();
  await expect(page.locator('#wstaff-alert-modal-icon')).toHaveText('🟡');
  await expect(page.locator('#wstaff-alert-modal-title')).toHaveText('Mal descanso');
  await expect(page.locator('#wstaff-alert-modal-list .row')).toHaveText(['Tanke']);
  await alertModal.click({ position: { x: 5, y: 5 } });
  await expect(alertModal).not.toHaveClass(/active/);

  await page.locator('.wstaff-alert-card.load').click();
  await expect(page.locator('#wstaff-alert-modal-icon')).toHaveText('🔥');
  await expect(page.locator('#wstaff-alert-modal-title')).toHaveText('Carga alta');
  await expect(page.locator('#wstaff-alert-modal-list .row')).toHaveText(['Tanke RPE 9']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('changing the event reloads the table and alerts; a session without ratings shows the empty state', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  const select = page.locator('#wstaff-event-select');

  await select.selectOption(EVENT_IDS.trMon);
  await expect(staffRows(page).locator('.col-player')).toHaveText(['Juls', 'Rovi']);
  await expect(staffRows(page).locator('td:nth-child(5)')).toHaveText(['540', '720']);
  await expect(page.locator('#wstaff-alert-discomfort-count')).toHaveText('1');
  await expect(page.locator('#wstaff-alert-sleep-count')).toHaveText('1');
  await expect(page.locator('#wstaff-alert-load-count')).toHaveText('1');
  await page.locator('.wstaff-alert-card.discomfort').click();
  await expect(page.locator('#wstaff-alert-modal-list .row')).toHaveText(['Rovi — Sobrecarga en isquios']);
  await page.locator('#wstaff-alert-modal').getByRole('button', { name: 'Cerrar' }).click();

  // The 19/09 match (17:30-19:00)
  await select.selectOption(EVENT_IDS.matchPast2);
  await expect(staffRows(page).locator('.col-player')).toHaveText(['Juls', 'Rovi']);
  await expect(staffRows(page).locator('.wstaff-rpe-pill')).toHaveText(['9', '10']);
  await expect(staffRows(page).locator('td:nth-child(5)')).toHaveText(['810', '900']);
  await expect(page.locator('#wstaff-alert-load-count')).toHaveText('2');
  await expect(page.locator('#wstaff-alert-sleep-count')).toHaveText('0');

  await select.selectOption('auto-2026-09-18');
  await expect(staffRows(page)).toHaveCount(0);
  await expect(page.locator('#wstaff-empty-state')).toBeVisible();
  await expect(page.locator('#wstaff-empty-state')).toHaveText('Todavía no hay ninguna jugadora que haya valorado este entrenamiento.');
  await expect(page.locator('#wstaff-alert-discomfort-count')).toHaveText('0');
  await expect(page.locator('#wstaff-alert-sleep-count')).toHaveText('0');
  await expect(page.locator('#wstaff-alert-load-count')).toHaveText('0');
  await page.locator('.wstaff-alert-card.load').click();
  await expect(page.locator('#wstaff-alert-modal-count')).toHaveText('0 jugadoras');
  await expect(page.locator('#wstaff-alert-modal-list .row')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('rows fall back to 60 minutes when a session has no end time, and to "—" for missing values', async ({ page }) => {
  const s = clone(seed);
  const ev = s.att_events.find((e) => e.id === EVENT_IDS.matchPast1);
  ev.end_time = '';
  s.attendance_wellness.push(
    { event_id: EVENT_IDS.matchPast1, user_id: IDS.carla, rpe: 7, sleep_hours: null, mood: null, has_discomfort: true, discomfort_detail: '', updated_at: '2026-09-12T15:00:00Z' },
    { event_id: EVENT_IDS.matchPast1, user_id: IDS.paula, rpe: null, sleep_hours: 'gt8', mood: 1, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-12T15:00:00Z' },
  );
  const { errors } = await openStaffPanel(page, { seed: s });
  await expect(page.locator('#wstaff-event-select option', { hasText: 'Tarragona' })).toHaveText('Partido vs Tarragona · Sábado 12/09/26 · CEM Mar Bella · 12:00h');
  await page.locator('#wstaff-event-select').selectOption(EVENT_IDS.matchPast1);
  await expect(staffRows(page).locator('.col-player')).toHaveText(['Carla', 'Paula']);
  await expect(staffRows(page).nth(0).locator('.wstaff-sleep-pill')).toHaveText('Sin datos');
  await expect(staffRows(page).nth(0).locator('.wstaff-sleep-pill')).toHaveClass(/none/);
  await expect(staffRows(page).locator('td:nth-child(3)')).toHaveText(['—', '😞']);
  await expect(staffRows(page).locator('td:nth-child(4)')).toHaveText(['7', '—']);
  await expect(staffRows(page).locator('td:nth-child(5)')).toHaveText(['420', '—']);
  // Discomfort without detail shows "Sí"
  await expect(staffRows(page).locator('td:nth-child(6)')).toHaveText(['Sí', 'Sin molestias']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('📊 quick links from Asistencia open the panel on that event (only for ended events)', async ({ page }) => {
  const { errors } = await setupApp(page, { user: JORDI });
  await openAppReady(page);
  await goToSection(page, 'asistencia');
  // Upcoming list: nothing has ended yet (today's training is at 20:30)
  await expect(page.locator('#att-event-list .wstaff-quicklink')).toHaveCount(0);
  await page.locator('#att-event-list .att-history-toggle').click();
  const card = page.locator('#att-event-list .att-event', { hasText: 'Lunes 21/09/26' });
  await expect(card.locator('.wstaff-quicklink')).toHaveAttribute('title', 'Ver análisis Wellness / RPE');
  await card.locator('.wstaff-quicklink').click();
  await expect(page.locator('#sec-wellness-staff')).toHaveClass(/active/);
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trMon);
  await expect(staffRows(page).locator('.col-player')).toHaveText(['Juls', 'Rovi']);

  // From an event detail header (the list stays in "past events" mode)
  await goToSection(page, 'asistencia');
  await expect(page.locator('#att-history-toggle-label')).toHaveText('Ver futuros');
  await page.locator('#att-event-list .att-event', { hasText: 'Sábado 19/09/26' }).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeVisible();
  await page.locator('#att-detail-wellness-staff-btn').click();
  await expect(page.locator('#sec-wellness-staff')).toHaveClass(/active/);
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.matchPast2);

  // Entering again from Vestuario goes back to the latest event
  await goToSection(page, 'vestuario');
  await page.locator('#vest-card-wellness-staff').click();
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trWed);

  // Today's training has not ended: no staff button on its detail
  await goToSection(page, 'asistencia');
  await page.locator('#att-event-list .att-history-toggle').click();
  await page.locator('#att-event-list .att-event', { hasText: 'Viernes 25/09/26' }).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Cos Tècnic panel: history tab
// ---------------------------------------------------------------------------

test('history tab: weekly sRPE load table with spikes, and per-player history modal', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  await page.locator('#wstaff-subtab-btn-history').click();
  await expect(page.locator('#wstaff-subtab-btn-history')).toHaveClass(/active/);
  await expect(page.locator('#wstaff-subtab-btn-session')).not.toHaveClass(/active/);
  await expect(page.locator('#wstaff-tab-history')).toBeVisible();
  await expect(page.locator('#wstaff-tab-session')).toBeHidden();

  await expect(page.locator('.wstaff-week-head h3')).toHaveText('Carga acumulada semanal (sRPE)');
  await expect(page.locator('#wstaff-week-thead th')).toHaveText(['Jugadora', 'Total', '21/09–27/09', '14/09–20/09', '07/09–13/09', 'Historial']);
  const rows = page.locator('#wstaff-week-tbody tr');
  // Only jugadora/Capitana with some load in the 6-week window, sorted by name
  await expect(rows.locator('.col-player')).toHaveText(['Carla', 'Juls', 'Paula', 'Rovi', 'Tanke']);
  await expect(rows.locator('td:nth-child(2)')).toHaveText(['450', '1350', '540', '2250', '810']);
  await expect(rows.nth(1).locator('.wstaff-week-cell')).toHaveText(['540', '810', '—']);
  await expect(rows.nth(3).locator('.wstaff-week-cell')).toHaveText(['1350', '900', '—']);
  // Rovi 1350 vs 900 the week before (×1.5): spike
  await expect(rows.nth(3).locator('.wstaff-week-cell').nth(0)).toHaveClass(/spike/);
  await expect(rows.nth(1).locator('.wstaff-week-cell').nth(0)).not.toHaveClass(/spike|rising/);
  await expect(page.locator('#wstaff-week-empty')).toBeHidden();

  await rows.nth(3).getByRole('button', { name: 'Ver historial completo' }).click();
  const hModal = page.locator('#wstaff-player-history-modal');
  await expect(hModal).toHaveClass(/active/);
  await expect(page.locator('#wstaff-player-history-name')).toHaveText('Rovi');
  await expect(hModal.locator('.modal-sub')).toHaveText('Carga (sRPE) por semana, desde el primer registro');
  await expect(page.locator('#wstaff-player-history-list .row')).toHaveText(['21/09–27/09 1350', '14/09–20/09 900']);
  await hModal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(hModal).not.toHaveClass(/active/);

  // Back to the session tab
  await page.locator('#wstaff-subtab-btn-session').click();
  await expect(page.locator('#wstaff-tab-session')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('history tab: rising load between weeks and a history modal older than the window', async ({ page }) => {
  const s = clone(seed);
  s.attendance_wellness.push(
    { event_id: 'auto-2026-09-16', user_id: IDS.carla, rpe: 4, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-16T22:00:00Z' },
    // An event id that is not in the calendar (before the season starts): ignored everywhere
    { event_id: 'auto-2026-08-03', user_id: IDS.carla, rpe: 6, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-08-03T22:00:00Z' },
  );
  const { errors } = await openStaffPanel(page, { seed: s });
  await page.locator('#wstaff-subtab-btn-history').click();
  const carla = page.locator('#wstaff-week-tbody tr', { hasText: 'Carla' });
  // 450 (5×90) vs 360 (4×90) = ×1.25 → rising
  await expect(carla.locator('.wstaff-week-cell')).toHaveText(['450', '360', '—']);
  await expect(carla.locator('.wstaff-week-cell').nth(0)).toHaveClass(/rising/);
  await expect(carla.locator('td:nth-child(2)')).toHaveText('810');
  await carla.getByRole('button', { name: 'Ver historial completo' }).click();
  await expect(page.locator('#wstaff-player-history-list .row')).toHaveText(['21/09–27/09 450', '14/09–20/09 360']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('history tab: team evolution chart and summary, and a single player', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  await page.locator('#wstaff-subtab-btn-history').click();
  await expect(page.locator('.wstaff-evo-head h3')).toHaveText('Evolución (últimos 30 días)');
  const select = page.locator('#wstaff-evo-player-select');
  await expect(select.locator('option')).toHaveText(['Equipo (media)', 'Carla', 'Juls', 'Paula', 'Rovi', 'Tanke']);
  await expect(select).toHaveValue('team');

  // Team average per rated day: 19/09 (9+10)/2, 21/09 (6+8)/2, 23/09 (7+9+5+6)/4
  await expect(page.locator('#wstaff-evo-sum-sessions')).toHaveText('3');
  await expect(page.locator('#wstaff-evo-sum-avgrpe')).toHaveText('7.8');
  await expect(page.locator('#wstaff-evo-sum-load')).toHaveText('5400');
  await expect(page.locator('#wstaff-evo-sum-sleep')).toHaveText('2');
  await expect(page.locator('#wstaff-evo-sum-discomfort')).toHaveText('3');
  const chart = page.locator('#wstaff-evo-chart svg');
  await expect(chart).toBeVisible();
  await expect(chart.locator('circle[r="4"] title')).toHaveText(['19/09 · RPE 9.5', '21/09 · RPE 7.0', '23/09 · RPE 6.8']);
  await expect(chart.locator('circle[r="3"] title')).toHaveText(['Día con molestias', 'Día con molestias', 'Día con molestias']);
  await expect(chart.locator('text[text-anchor="middle"]')).toHaveText(['19/09', '21/09', '23/09']);
  await expect(page.locator('#wstaff-evo-chart-empty')).toBeHidden();

  await select.selectOption({ label: 'Juls' });
  await expect(page.locator('#wstaff-evo-sum-sessions')).toHaveText('2');
  await expect(page.locator('#wstaff-evo-sum-avgrpe')).toHaveText('7.5');
  await expect(page.locator('#wstaff-evo-sum-load')).toHaveText('1350');
  await expect(page.locator('#wstaff-evo-sum-sleep')).toHaveText('0');
  await expect(page.locator('#wstaff-evo-sum-discomfort')).toHaveText('0');
  await expect(chart.locator('circle[r="4"] title')).toHaveText(['19/09 · RPE 9.0', '21/09 · RPE 6.0']);
  await expect(chart.locator('circle[r="3"]')).toHaveCount(0);

  await select.selectOption({ label: 'Carla' });
  await expect(page.locator('#wstaff-evo-sum-sessions')).toHaveText('1');
  await expect(page.locator('#wstaff-evo-sum-avgrpe')).toHaveText('5.0');
  await expect(chart.locator('circle[r="4"] title')).toHaveText(['23/09 · RPE 5.0']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('with no ratings at all every block of the panel shows its empty state', async ({ page }) => {
  const { errors } = await openStaffPanel(page, { seed: { ...clone(seed), attendance_wellness: [] } });
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trWed);
  await expect(staffRows(page)).toHaveCount(0);
  await expect(page.locator('#wstaff-empty-state')).toBeVisible();
  await expect(page.locator('#wstaff-alert-discomfort-count')).toHaveText('0');

  await page.locator('#wstaff-subtab-btn-history').click();
  await expect(page.locator('#wstaff-week-tbody tr')).toHaveCount(0);
  await expect(page.locator('#wstaff-week-empty')).toHaveText('Todavía no hay cargas registradas en las últimas semanas.');
  await expect(page.locator('#wstaff-week-empty')).toBeVisible();
  await expect(page.locator('#wstaff-evo-chart svg')).toHaveCount(0);
  await expect(page.locator('#wstaff-evo-chart-empty')).toHaveText('Todavía no hay valoraciones en este periodo.');
  await expect(page.locator('#wstaff-evo-chart-empty')).toBeVisible();
  await expect(page.locator('#wstaff-evo-sum-sessions')).toHaveText('0');
  await expect(page.locator('#wstaff-evo-sum-avgrpe')).toHaveText('—');
  await expect(page.locator('#wstaff-evo-sum-load')).toHaveText('0');
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff panel headings in Catalan', async ({ page }) => {
  const { errors } = await openStaffPanel(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#wstaff-subtab-btn-session')).toHaveText('📋 Sessió');
  await expect(page.locator('#wstaff-subtab-btn-history')).toHaveText('📈 Històric i tendències');
  await expect(page.locator('.wstaff-alert-card .wstaff-alert-title')).toHaveText(['Molèsties', 'Mal descans', 'Càrrega alta']);
  await expect(page.locator('#wstaff-tab-session .wstaff-table thead th')).toHaveText(['Jugadora', 'Hores de son', "Estat d'ànim", 'RPE', 'Càrrega (sRPE)', 'Molèsties']);
  await page.locator('.wstaff-alert-card.discomfort').click();
  await expect(page.locator('#wstaff-alert-modal-title')).toHaveText('Molèsties');
  await expect(page.locator('#wstaff-alert-modal-count')).toHaveText('1 jugadora');
  // The event picker's dates follow the language too (same selection).
  await expect(page.locator('#wstaff-event-select option').first()).toHaveText('Entreno · Dimecres 23/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(page.locator('#wstaff-event-select')).toHaveValue(EVENT_IDS.trWed);
  expect(relevantErrors(errors)).toEqual([]);
});
