// Characterization tests for "Gym": the weekly routine (day cards, day detail with the
// Forwards/Backs tables), the automatic archive of last week's routine, the "more
// options" menu (load last routine / old routines in a new tab), the routine PDF upload
// (Edge Function process-gym-routine-pdf), the quick calculator and the %RM table,
// "Mis Marcas" (1RM, custom exercises, history), today's gym attendance and the team
// ranking.
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { seed, IDS } from './fixtures/seed.js';

const NOW_ISO = '2026-09-25T08:00:00.000Z';
const FIXED_EXERCISES = ['Sentadilla', 'Peso muerto', 'Press banca', 'Press militar', 'Dominadas lastradas'];
const ALL_EXERCISES = [...FIXED_EXERCISES, 'Hip thrust', 'Remo con barra'];

const withSeed = (patch) => ({ ...seed, ...patch });
const routineFrom = (patch) => [{ ...seed.gym_weekly_routine[0], ...patch }];
const withProfile = (id, patch) => seed.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));

const gymWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table.startsWith('gym'));
const writesTo = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);

const dayCards = (page) => page.locator('#gym-routine-days .gym-tab-card');
const dayRows = (page) => page.locator('#gym-routine-day-detalle-exercises tr');
const groupTab = (page, name) => page.locator('#sec-gym-entrenamiento-dia .gym-day-group-tab', { hasText: name });
const marksRows = (page) => page.locator('#gym-marks-table-body tr:not(.gym-add-exercise-row)');
const markRow = (page, name) => marksRows(page).filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${name}$`) }) });
const rankingRows = (page) => page.locator('#gym-ranking-table-body tr');
const attendees = (page) => page.locator('#gym-attendance-today .gym-attendee-row');
const quickResult = (page) => page.locator('#gym-quick-calc-result');
const moreMenu = (page) => page.locator('#gym-routine-more-menu');

// Cell texts of every row of a table body, e.g. [['Sentadilla', '5', ...], ...]
const cells = (rows) => rows.evaluateAll((trs) => trs.map((tr) => [...tr.cells].map((td) => td.textContent.trim())));

async function openTraining(page) {
  await goToSection(page, 'gym');
  await page.locator('#sec-gym .gym-tab-card', { hasText: 'Mi Entrenamiento' }).click();
  await expect(page.locator('#sec-gym-entrenamiento')).toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
}

async function openTeam(page) {
  await goToSection(page, 'gym');
  await page.locator('#sec-gym .gym-tab-card', { hasText: 'Equipo' }).click();
  await expect(page.locator('#sec-gym-equipo')).toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
}

async function openDay(page, n) {
  await dayCards(page).nth(n - 1).click();
  await expect(page.locator('#sec-gym-entrenamiento-dia')).toHaveClass(/active/);
}

async function openMoreMenu(page) {
  await page.locator('#gym-routine-more-btn').click();
  await expect(moreMenu(page)).toBeVisible();
}

// Accepts every dialog (confirm → true) and records its message. Must be registered
// before setupApp so it runs before the default "dismiss" handler.
function acceptDialogs(page) {
  const messages = [];
  page.on('dialog', (d) => { messages.push(d.message()); d.accept().catch(() => {}); });
  return messages;
}
function recordDialogs(page) {
  const messages = [];
  page.on('dialog', (d) => messages.push(d.message()));
  return messages;
}

// ---------------------------------------------------------------------------
// Routine: rendering and day detail
// ---------------------------------------------------------------------------

test('Gym hub opens "Mi Entrenamiento" with the week routine as one card per day', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'gym');
  await expect(page.locator('#sec-gym .gym-tab-card b')).toHaveText(['Mi Entrenamiento', 'Equipo']);
  await expect(page.locator('#sec-gym .gym-tab-card span')).toHaveText(['Rutina de esta semana y tus marcas', 'Asistencia y ranking']);

  await openTraining(page);
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 21/09 – 27/09');
  await expect(dayCards(page).locator('b')).toHaveText(['Día 1', 'Día 2', 'Día 3']);
  await expect(dayCards(page).locator('span')).toHaveText(['Fuerza tren inferior', 'Tren superior', 'Potencia y core']);
  // A jugadora can upload the PDF and use the "more options" menu.
  await expect(page.locator('#gym-routine-upload-btn')).toBeVisible();
  await expect(page.locator('#gym-routine-more-btn')).toBeVisible();
  await expect(moreMenu(page)).toBeHidden();
  // The routine is from this week: nothing is archived on load.
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('day detail of a split day shows the Forwards table first and switches to Backs', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 1);

  await expect(page.locator('#gym-routine-day-detalle-title')).toHaveText('Día 1');
  await expect(page.locator('#gym-routine-day-detalle-focus')).toHaveText('Fuerza tren inferior');
  await expect(page.locator('#gym-routine-day-detalle-split-note')).toBeVisible();
  await expect(page.locator('#gym-routine-day-detalle-split-note-text')).toHaveText('Rutina distinta para Forwards y Backs');
  await expect(groupTab(page, 'Forwards')).toHaveClass(/active/);
  await expect(groupTab(page, 'Backs')).not.toHaveClass(/active/);
  await expect.poll(() => cells(dayRows(page))).toEqual([
    ['Sentadilla', '5', '5', '80% RM', '2 min'],
    ['Peso muerto', '4', '4', '85% RM', '3 min'],
    ['Hip thrust', '3', '10', '60 kg', '90 s'],
  ]);

  await groupTab(page, 'Backs').click();
  await expect(groupTab(page, 'Backs')).toHaveClass(/active/);
  await expect(groupTab(page, 'Forwards')).not.toHaveClass(/active/);
  await expect.poll(() => cells(dayRows(page))).toEqual([
    ['Sentadilla', '4', '6', '70% RM', '2 min'],
    ['Zancadas', '3', '10 por pierna', 'Mancuernas 12 kg', '90 s'],
    ['Saltos al cajón', '4', '5', 'Peso corporal', '60 s'],
  ]);

  // Back to the routine and into another day: always starts again on Forwards.
  await page.locator('#sec-gym-entrenamiento-dia .back-link').click();
  await expect(page.locator('#sec-gym-entrenamiento')).toHaveClass(/active/);
  await openDay(page, 1);
  await expect(groupTab(page, 'Forwards')).toHaveClass(/active/);
  await expect(dayRows(page).first()).toContainText('80% RM');
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a day with the same routine for everyone shows the same table in both groups', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 2);

  await expect(page.locator('#gym-routine-day-detalle-title')).toHaveText('Día 2');
  await expect(page.locator('#gym-routine-day-detalle-focus')).toHaveText('Tren superior');
  await expect(page.locator('#gym-routine-day-detalle-split-note-text')).toHaveText('Misma rutina para todo el equipo');
  const expected = [
    ['Press banca', '5', '5', '75% RM', '2 min'],
    ['Remo con barra', '4', '8', '65% RM', '90 s'],
    ['Press militar', '3', '8', '60% RM', '90 s'],
  ];
  await expect.poll(() => cells(dayRows(page))).toEqual(expected);
  await groupTab(page, 'Backs').click();
  await expect(groupTab(page, 'Backs')).toHaveClass(/active/);
  await expect.poll(() => cells(dayRows(page))).toEqual(expected);
  expect(relevantErrors(errors)).toEqual([]);
});

test('days without group_split, focus or rest, and a group without exercises', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: withSeed({
    gym_weekly_routine: routineFrom({
      week_label: 'Semana de prueba',
      days: [
        { day: 'Martes', focus: '', exercises: [{ name: 'Burpees', sets: '3', reps: '15', load: '—' }] },
        { day: 'Jueves', focus: 'Pliometría', group_split: true,
          exercises_forwards: [{ name: 'Saltos', sets: '4', reps: '6', load: 'Peso corporal', rest: '60 s' }] },
      ],
    }),
  }) });
  await openApp(page);
  await openTraining(page);
  await expect(page.locator('#gym-week-label')).toHaveText('Semana de prueba');
  // No focus: the card shows the day name instead.
  await expect(dayCards(page).locator('span')).toHaveText(['Martes', 'Pliometría']);

  await openDay(page, 1);
  await expect(page.locator('#gym-routine-day-detalle-focus')).toHaveText('Martes');
  await expect(page.locator('#gym-routine-day-detalle-split-note')).toBeHidden();
  await expect.poll(() => cells(dayRows(page))).toEqual([['Burpees', '3', '15', '—', '—']]);

  await page.locator('#sec-gym-entrenamiento-dia .back-link').click();
  await openDay(page, 2);
  await expect(page.locator('#gym-routine-day-detalle-split-note-text')).toHaveText('Rutina distinta para Forwards y Backs');
  await expect.poll(() => cells(dayRows(page))).toEqual([['Saltos', '4', '6', 'Peso corporal', '60 s']]);
  await groupTab(page, 'Backs').click();
  await expect(dayRows(page)).toHaveText(['No hay ejercicios registrados para este grupo en este día.']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('without a routine this week an editor gets the "Subir la rutina" button', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: withSeed({ gym_weekly_routine: [] }) });
  await openApp(page);
  await openTraining(page);
  await expect(page.locator('#gym-week-label')).toHaveText('');
  await expect(page.locator('#gym-routine-days .gym-routine-empty p')).toHaveText('Todavía no se ha subido la rutina de esta semana.');
  await expect(dayCards(page)).toHaveCount(0);

  await page.locator('#gym-routine-days').getByRole('button', { name: 'Subir la rutina' }).click();
  await expect(page.locator('#gym-routine-upload-modal')).toHaveClass(/active/);
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a role that cannot edit the routine (fisio) gets no upload or options buttons', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: withSeed({
    profiles: withProfile(IDS.player, { rol: 'fisio' }),
    gym_weekly_routine: [],
  }) });
  await openApp(page);
  await openTraining(page);
  await expect(page.locator('#gym-routine-days .gym-routine-empty p')).toHaveText('Todavía no se ha subido la rutina de esta semana.');
  await expect(page.locator('#gym-routine-days').getByRole('button')).toHaveCount(0);
  await expect(page.locator('#gym-routine-upload-btn')).toBeHidden();
  await expect(page.locator('#gym-routine-more')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Automatic archive + "more options" menu
// ---------------------------------------------------------------------------

test('a routine from a previous week is archived on load and cleared', async ({ page }) => {
  const oldRoutine = routineFrom({ updated_at: '2026-09-14T07:00:00Z' });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: withSeed({ gym_weekly_routine: oldRoutine }) });
  await openApp(page);
  await openTraining(page);

  await expect(page.locator('#gym-routine-days .gym-routine-empty p')).toHaveText('Todavía no se ha subido la rutina de esta semana.');
  await expect(page.locator('#gym-week-label')).toHaveText('');
  const writes = gymWrites(backend);
  expect(writes.map((w) => [w.method, w.table])).toEqual([
    ['INSERT', 'gym_weekly_routine_archive'],
    ['UPDATE', 'gym_weekly_routine'],
  ]);
  expect(writes[0].body).toEqual([{ week_label: 'Semana 21/09 – 27/09', days: seed.gym_weekly_routine[0].days, archived_at: NOW_ISO }]);
  expect(writes[1]).toMatchObject({ filters: [['id', 'eq.current']], body: { week_label: null, days: [] } });
  expect(backend.db.gym_weekly_routine_archive).toHaveLength(2);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a routine updated last Sunday is archived, one updated this Monday is not', async ({ page }) => {
  // Sunday 20/09 22:00 Madrid time → its week ended on Sunday 23:59, so it is expired.
  const { backend } = await setupApp(page, { user: USERS.player, seed: withSeed({
    gym_weekly_routine: routineFrom({ updated_at: '2026-09-20T20:00:00Z' }),
  }) });
  await openApp(page);
  await expect.poll(() => writesTo(backend, 'gym_weekly_routine_archive').length).toBe(1);
});

test('"Cargar la última rutina" puts the newest archived routine back as current', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openMoreMenu(page);
  await expect(moreMenu(page).getByRole('button')).toHaveText(['Cargar la última rutina', 'Ver antiguas rutinas']);
  await moreMenu(page).getByRole('button', { name: 'Cargar la última rutina' }).click();

  await expect(moreMenu(page)).toBeHidden();
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 14/09 – 20/09');
  await expect(dayCards(page).locator('b')).toHaveText(['Día 1']);
  await expect(dayCards(page).locator('span')).toHaveText(['Fuerza general']);
  // NOTE: the current week's routine is overwritten without being archived first.
  const writes = gymWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: 'UPDATE', table: 'gym_weekly_routine', filters: [['id', 'eq.current']],
    body: { week_label: 'Semana 14/09 – 20/09', days: seed.gym_weekly_routine_archive[0].days },
  });
  await openDay(page, 1);
  await expect.poll(() => cells(dayRows(page))).toEqual([
    ['Sentadilla', '4', '6', '75% RM', '2 min'],
    ['Press banca', '4', '6', '70% RM', '2 min'],
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a restored routine is archived again the next time the routine is loaded', async ({ page }) => {
  const oldRoutine = routineFrom({ updated_at: '2026-09-14T07:00:00Z' });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: withSeed({ gym_weekly_routine: oldRoutine }) });
  await openApp(page);
  await openTraining(page);
  await expect(page.locator('#gym-routine-days .gym-routine-empty')).toBeVisible();

  // Load the routine that was just archived.
  await openMoreMenu(page);
  await moreMenu(page).getByRole('button', { name: 'Cargar la última rutina' }).click();
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 21/09 – 27/09');
  await expect(dayCards(page)).toHaveCount(3);

  // NOTE: "Cargar la última rutina" does not update updated_at, so the restored routine
  // still looks like last week's one: re-entering the screen archives it again (a
  // duplicate archive row) and clears it.
  await goToSection(page, 'gym');
  await page.locator('#sec-gym .gym-tab-card', { hasText: 'Mi Entrenamiento' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#gym-routine-days .gym-routine-empty')).toBeVisible();
  expect(gymWrites(backend).map((w) => [w.method, w.table])).toEqual([
    ['INSERT', 'gym_weekly_routine_archive'],
    ['UPDATE', 'gym_weekly_routine'],
    ['UPDATE', 'gym_weekly_routine'],
    ['INSERT', 'gym_weekly_routine_archive'],
    ['UPDATE', 'gym_weekly_routine'],
  ]);
  expect(backend.db.gym_weekly_routine_archive.map((r) => r.week_label)).toEqual([
    'Semana 14/09 – 20/09', 'Semana 21/09 – 27/09', 'Semana 21/09 – 27/09',
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Ver antiguas rutinas" opens a new tab with every archived week, newest first', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: withSeed({
    gym_weekly_routine_archive: [
      ...seed.gym_weekly_routine_archive,
      {
        id: '93000000-0000-4000-8000-000000000002', week_label: 'Semana 07/09 – 13/09', archived_at: '2026-09-14T06:00:00Z',
        days: [{ day: 'Lunes', focus: 'Fuerza', group_split: true,
          exercises_forwards: [{ name: 'Sentadilla', sets: '5', reps: '3', load: '85% RM' }], exercises_backs: [] }],
      },
      { id: '93000000-0000-4000-8000-000000000003', week_label: null, archived_at: '2026-09-07T06:00:00Z', days: [] },
    ],
  }) });
  await openApp(page);
  await openTraining(page);
  await openMoreMenu(page);
  const popupPromise = page.waitForEvent('popup');
  await moreMenu(page).getByRole('button', { name: 'Ver antiguas rutinas' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();

  await expect(popup).toHaveTitle('Rutinas antiguas — CN Peñas');
  await expect(popup.locator('h1')).toHaveText('Rutinas antiguas');
  await expect(popup.locator('.week h2')).toHaveText(['Semana 14/09 – 20/09', 'Semana 07/09 – 13/09', 'Semana sin etiqueta']);
  await expect(popup.locator('.week-meta')).toHaveText([
    'Archivada el 21 de septiembre de 2026', 'Archivada el 14 de septiembre de 2026', 'Archivada el 07 de septiembre de 2026',
  ]);
  const [w1, w2, w3] = [0, 1, 2].map((i) => popup.locator('.week').nth(i));
  await expect(w1.locator('.day h3')).toHaveText(['Día 1 · Fuerza general']);
  await expect(w1.locator('.group-label')).toHaveCount(0);
  await expect.poll(() => cells(w1.locator('tbody tr'))).toEqual([
    ['Sentadilla', '4', '6', '75% RM', '2 min'],
    ['Press banca', '4', '6', '70% RM', '2 min'],
  ]);
  await expect(w1.locator('thead th')).toHaveText(['Ejercicio', 'Series', 'Repeticiones', 'Carga', 'Descanso']);
  await expect(w2.locator('.day h3')).toHaveText(['Día 1 · Fuerza']);
  await expect(w2.locator('.group-label')).toHaveText(['Forwards', 'Backs']);
  await expect.poll(() => cells(w2.locator('tbody tr'))).toEqual([
    ['Sentadilla', '5', '3', '85% RM', '—'],
    ['Sin ejercicios registrados.'],
  ]);
  await expect(w3).toContainText('Sin días registrados.');
  // The app itself stays where it was.
  await expect(page.locator('#sec-gym-entrenamiento')).toHaveClass(/active/);
  await expect(moreMenu(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('with an empty archive both menu options just alert', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: withSeed({ gym_weekly_routine_archive: [] }) });
  const dialogs = recordDialogs(page);
  let popups = 0;
  page.on('popup', () => popups++);
  await openApp(page);
  await openTraining(page);

  await openMoreMenu(page);
  await moreMenu(page).getByRole('button', { name: 'Cargar la última rutina' }).click();
  await expect.poll(() => dialogs).toEqual(['Todavía no hay ninguna rutina archivada.']);
  await openMoreMenu(page);
  await moreMenu(page).getByRole('button', { name: 'Ver antiguas rutinas' }).click();
  await expect.poll(() => dialogs).toEqual(['Todavía no hay ninguna rutina archivada.', 'Todavía no hay ninguna rutina archivada.']);
  expect(popups).toBe(0);
  // The current routine is untouched.
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 21/09 – 27/09');
  await expect(dayCards(page)).toHaveCount(3);
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the options menu closes when clicking outside it', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openMoreMenu(page);
  await page.locator('#sec-gym-entrenamiento .section-head h2').click();
  await expect(moreMenu(page)).toBeHidden();
  // The same button toggles it open and closed.
  await openMoreMenu(page);
  await page.locator('#gym-routine-more-btn').click();
  await expect(moreMenu(page)).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// PDF upload (Edge Function)
// ---------------------------------------------------------------------------

const PDF = { name: 'rutina.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% rutina de prueba\n') };
const FUNCTION_URL = '**/functions/v1/process-gym-routine-pdf';

test('uploading a PDF calls the Edge Function and shows the returned routine', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  const calls = [];
  let release;
  const held = new Promise((r) => { release = r; });
  // Registered after setupApp, so it wins over the fake backend's stub.
  await page.route(FUNCTION_URL, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    calls.push({ method: req.method(), auth: req.headers().authorization, body: req.postDataBuffer().toString('latin1') });
    await held;
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ routine: {
        week_label: 'Semana 28/09 – 04/10',
        days: [
          { day: 'Lunes', focus: 'Fuerza máxima', group_split: false, exercises: [{ name: 'Sentadilla', sets: '5', reps: '3', load: '85% RM', rest: '3 min' }] },
          { day: 'Jueves', focus: 'Velocidad', group_split: false, exercises: [] },
        ],
      } }),
    });
  });
  await openApp(page);
  await openTraining(page);

  await page.locator('#gym-routine-upload-btn').click();
  const modal = page.locator('#gym-routine-upload-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#gym-routine-upload-status')).toHaveText('');
  await page.locator('#gym-routine-pdf-input').setInputFiles(PDF);
  await modal.getByRole('button', { name: 'Subir y procesar' }).click();

  await expect(page.locator('#gym-routine-upload-status')).toHaveText('Subiendo y leyendo el PDF con Gemini… puede tardar unos segundos.');
  await expect(page.locator('#gym-routine-upload-submit-btn')).toBeDisabled();
  await expect(page.locator('#gym-routine-upload-cancel-btn')).toBeDisabled();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].auth).toMatch(/^Bearer \S+\.\S+\.signature$/);
  expect(calls[0].body).toContain('name="pdf"; filename="rutina.pdf"');
  expect(calls[0].body).toContain('%PDF-1.4');

  release();
  await expect(page.locator('#gym-routine-upload-status')).toHaveText('¡Rutina actualizada! Cerrando…');
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 28/09 – 04/10');
  await expect(dayCards(page).locator('span')).toHaveText(['Fuerza máxima', 'Velocidad']);
  await expect(page.locator('#gym-routine-upload-submit-btn')).toBeEnabled();
  await expect(modal).not.toHaveClass(/active/);
  // The app writes nothing itself: the Edge Function stores the routine.
  expect(gymWrites(backend)).toEqual([]);

  // Reopening the modal starts clean.
  await page.locator('#gym-routine-upload-btn').click();
  await expect(page.locator('#gym-routine-upload-status')).toHaveText('');
  await expect(page.locator('#gym-routine-pdf-input')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('an error from the Edge Function is shown and the routine stays as it was', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  let calls = 0;
  await page.route(FUNCTION_URL, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
    calls++;
    return route.fulfill({
      status: 422, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'El PDF no contiene ninguna rutina.' }),
    });
  });
  await openApp(page);
  await openTraining(page);
  await page.locator('#gym-routine-upload-btn').click();
  await page.locator('#gym-routine-pdf-input').setInputFiles(PDF);
  await page.locator('#gym-routine-upload-modal').getByRole('button', { name: 'Subir y procesar' }).click();

  await expect(page.locator('#gym-routine-upload-status')).toHaveText('El PDF no contiene ninguna rutina.');
  expect(calls).toBe(1);
  await expect(page.locator('#gym-routine-upload-modal')).toHaveClass(/active/);
  await expect(page.locator('#gym-routine-upload-submit-btn')).toBeEnabled();
  await expect(page.locator('#gym-routine-upload-cancel-btn')).toBeEnabled();
  await expect(page.locator('#gym-week-label')).toHaveText('Semana 21/09 – 27/09');

  await page.locator('#gym-routine-upload-modal').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#gym-routine-upload-modal')).not.toHaveClass(/active/);
  // Only the 422 response itself is logged by the browser.
  expect(relevantErrors(errors).filter((e) => !/status of 422/.test(e))).toEqual([]);
});

test('submitting without a file asks for one and calls nothing', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await page.locator('#gym-routine-upload-btn').click();
  await page.locator('#gym-routine-upload-modal').getByRole('button', { name: 'Subir y procesar' }).click();
  await expect(page.locator('#gym-routine-upload-status')).toHaveText('Elige primero un archivo PDF.');
  await page.waitForTimeout(200);
  expect(backend.mutations.filter((m) => m.kind === 'function')).toEqual([]);
  await expect(page.locator('#gym-routine-upload-modal')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

test('quick calculator: weight from my 1RM rounded to half a kilo', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 1);

  const exercise = page.locator('#gym-quick-calc-exercise');
  const pct = page.locator('#gym-quick-calc-pct');
  await expect(exercise.locator('option')).toHaveText(['Elige un ejercicio', ...ALL_EXERCISES]);
  await expect(pct.locator('option')).toHaveText(['%', '100%', '95%', '90%', '85%', '80%', '75%', '70%', '65%', '60%', '55%', '50%']);
  await expect(quickResult(page)).toHaveText('Elige un ejercicio y un % para calcular.');

  await exercise.selectOption('Sentadilla');
  await expect(quickResult(page)).toHaveText('Elige un ejercicio y un % para calcular.');
  await pct.selectOption('80');
  await expect(quickResult(page).locator('.pct')).toHaveText('80% de tu Sentadilla');
  await expect(quickResult(page).locator('.kg')).toHaveText('68 kg');
  await expect(quickResult(page).locator('.raw')).toHaveText('Exacto: 68.0 kg · tu marca: 85 kg');

  await exercise.selectOption('Press banca');
  await pct.selectOption('85');
  await expect(quickResult(page).locator('.kg')).toHaveText('38.5 kg');
  await expect(quickResult(page).locator('.raw')).toHaveText('Exacto: 38.3 kg · tu marca: 45 kg');

  await exercise.selectOption('Press militar');
  await expect(quickResult(page)).toHaveText(/^\s*Todavía no tienes una marca \(1RM\) registrada para Press militar\.\s*Regístrala en Mis Marcas ›\s*$/);
  // The link goes to "Mis Marcas" and leaving the day resets the calculator.
  await quickResult(page).getByText('Regístrala en Mis Marcas ›').click();
  await expect(page.locator('#sec-gym-entrenamiento')).toHaveClass(/active/);
  await openDay(page, 2);
  await expect(exercise).toHaveValue('');
  await expect(pct).toHaveValue('');
  await expect(quickResult(page)).toHaveText('Elige un ejercicio y un % para calcular.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('quick calculator can use a teammate\'s 1RM and go back to mine', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 1);
  await page.locator('#gym-quick-calc-exercise').selectOption('Sentadilla');
  await page.locator('#gym-quick-calc-pct').selectOption('80');

  const menu = page.locator('#gym-quick-calc-player-menu');
  await page.locator('#gym-quick-calc-player-btn').click();
  await expect(menu).toBeVisible();
  // Everyone in the roster, staff included (the admin account is not in it).
  await expect(menu.locator('.gym-quick-calc-player-option')).toHaveText(['Juls', 'Rovi', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);
  await expect(menu.locator('.gym-quick-calc-player-option.selected')).toHaveText('Juls');
  await menu.getByRole('button', { name: 'Rovi' }).click();
  await expect(menu).toBeHidden();

  const badge = page.locator('#gym-quick-calc-player-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('Calculando la marca de Rovi');
  await expect(quickResult(page).locator('.pct')).toHaveText('80% de la de Rovi Sentadilla');
  await expect(quickResult(page).locator('.kg')).toHaveText('88 kg');
  await expect(quickResult(page).locator('.raw')).toHaveText('Exacto: 88.0 kg · su marca: 110 kg');

  await page.locator('#gym-quick-calc-exercise').selectOption('Press banca');
  await expect(quickResult(page)).toHaveText(/^\s*Rovi todavía no tiene una marca \(1RM\) registrada para Press banca\.\s*$/);

  await badge.getByRole('button', { name: 'Volver a tu calculadora' }).click();
  await expect(badge).toBeHidden();
  await expect(quickResult(page).locator('.pct')).toHaveText('80% de tu Press banca');
  await expect(quickResult(page).locator('.kg')).toHaveText('36 kg');

  // Opening a day again always starts with my own marks.
  await page.locator('#gym-quick-calc-player-btn').click();
  await menu.getByRole('button', { name: 'Carla' }).click();
  await expect(badge).toHaveText('Calculando la marca de Carla');
  await page.locator('#sec-gym-entrenamiento-dia .back-link').click();
  await openDay(page, 1);
  await expect(badge).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('%RM calculator: table from a known 1RM or estimated with Epley', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 1);

  const banner = page.locator('#gym-rm-calc-banner');
  const result = page.locator('#gym-rm-calc-result');
  await expect(banner).toBeHidden();
  await page.locator('#gym-rm-calc-toggle-btn').click();
  await expect(banner).toBeVisible();

  await banner.getByRole('button', { name: 'Calcular' }).click();
  await expect(result).toHaveText('Escribe tu 1RM, o un peso y unas repeticiones, para calcularlo.');

  await page.locator('#gym-calc-1rm').fill('100');
  await banner.getByRole('button', { name: 'Calcular' }).click();
  const rows = result.locator('table.gym-rm-calc-table tr');
  await expect.poll(() => cells(rows)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map((p) => [`${p}%`, `${p}.0 kg`]));
  await expect(rows.first()).toHaveClass(/gym-rm-100/);
  await expect(result.locator('tr.gym-rm-100')).toHaveCount(1);

  // A known 1RM wins over weight + reps.
  await page.locator('#gym-calc-weight').fill('80');
  await page.locator('#gym-calc-reps').fill('5');
  await banner.getByRole('button', { name: 'Calcular' }).click();
  await expect(rows.first()).toHaveText(/100\.0 kg/);

  // Without it: 80 × (1 + 5/30) = 93.33
  await page.locator('#gym-calc-1rm').fill('');
  await banner.getByRole('button', { name: 'Calcular' }).click();
  await expect.poll(async () => (await cells(rows)).slice(0, 3)).toEqual([['100%', '93.3 kg'], ['95%', '88.7 kg'], ['90%', '84.0 kg']]);
  await expect(rows.last()).toHaveText(/50%\s*46\.7 kg/);

  // The ✕ closes it; the toggle button reopens it with the values kept.
  await banner.getByRole('button', { name: 'Cerrar' }).click();
  await expect(banner).toBeHidden();
  await page.locator('#gym-rm-calc-toggle-btn').click();
  await expect(banner).toBeVisible();
  await expect(page.locator('#gym-calc-weight')).toHaveValue('80');
  await page.locator('#gym-rm-calc-toggle-btn').click();
  await expect(banner).toBeHidden();

  // Leaving the day detail empties and closes it.
  await page.locator('#gym-rm-calc-toggle-btn').click();
  await page.locator('#sec-gym-entrenamiento-dia .back-link').click();
  await openDay(page, 2);
  await expect(banner).toBeHidden();
  await page.locator('#gym-rm-calc-toggle-btn').click();
  await expect(page.locator('#gym-calc-1rm')).toHaveValue('');
  await expect(page.locator('#gym-calc-weight')).toHaveValue('');
  await expect(page.locator('#gym-calc-reps')).toHaveValue('');
  await expect(result).toBeEmpty();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Mis Marcas
// ---------------------------------------------------------------------------

test('"Mis Marcas" lists fixed + general exercises with my 1RM', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await expect.poll(() => cells(marksRows(page))).toEqual([
    ['Sentadilla', '85 kg', '18/09/26', ''],
    ['Peso muerto', '100 kg', '18/09/26', ''],
    ['Press banca', '45 kg', '16/09/26', ''],
    ['Press militar', 'Sin registrar', '—', ''],
    ['Dominadas lastradas', 'Sin registrar', '—', ''],
    ['Hip thrust', 'Sin registrar', '—', ''],
    ['Remo con barra', 'Sin registrar', '—', ''],
  ]);
  // A jugadora can see the history and register a mark, but not delete team exercises.
  await expect(marksRows(page).locator('.history-btn')).toHaveCount(7);
  await expect(marksRows(page).locator('.edit-btn')).toHaveCount(7);
  await expect(marksRows(page).locator('.del-btn')).toHaveCount(0);
  await expect(page.locator('#gym-new-exercise-weight')).toHaveAttribute('placeholder', 'Kg');
  expect(relevantErrors(errors)).toEqual([]);
});

test('registering a 1RM updates the table, the ranking and both gym_rm tables', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);

  // Existing mark: the modal is prefilled.
  await markRow(page, 'Sentadilla').locator('.edit-btn').click();
  const modal = page.locator('#gym-rm-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#gym-rm-modal-title')).toHaveText('Sentadilla');
  await expect(page.locator('#gym-rm-input')).toHaveValue('85');
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await markRow(page, 'Press militar').locator('.edit-btn').click();
  await expect(page.locator('#gym-rm-modal-title')).toHaveText('Press militar');
  await expect(page.locator('#gym-rm-input')).toHaveValue('');
  await page.locator('#gym-rm-input').fill('42.5');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(modal).not.toHaveClass(/active/);
  await expect.poll(() => cells(markRow(page, 'Press militar'))).toEqual([['Press militar', '42.5 kg', '25/09/26', '']]);
  await expect.poll(() => gymWrites(backend).length).toBe(2);
  const [upsert, history] = gymWrites(backend);
  expect(upsert).toMatchObject({
    method: 'UPSERT', table: 'gym_rm', onConflict: ['profile_id', 'exercise'],
    body: [{ profile_id: IDS.player, exercise: 'Press militar', weight: 42.5, updated_at: NOW_ISO }],
  });
  expect(history).toMatchObject({
    method: 'INSERT', table: 'gym_rm_history',
    body: [{ profile_id: IDS.player, exercise: 'Press militar', weight: 42.5, recorded_at: NOW_ISO }],
  });

  // The new mark is at the top of the history.
  await markRow(page, 'Press militar').locator('.history-btn').click();
  await expect(page.locator('#gym-rm-history-list .gym-rm-history-row')).toHaveText([/42\.5 kg\s*25\/09\/26/]);
  await page.locator('#gym-rm-history-modal').getByRole('button', { name: 'Cerrar' }).click();

  // Updating Sentadilla puts me first in the team ranking.
  await markRow(page, 'Sentadilla').locator('.edit-btn').click();
  await page.locator('#gym-rm-input').fill('120');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(markRow(page, 'Sentadilla').locator('td').nth(1)).toHaveText('120 kg');
  await openTeam(page);
  await expect(rankingRows(page).first()).toHaveText(/^\s*1\s*Juls\s*120 kg\s*25\/09\/26\s*$/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('an empty 1RM is rejected; 0 is accepted', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  const dialogs = recordDialogs(page);
  await openApp(page);
  await openTraining(page);
  await markRow(page, 'Dominadas lastradas').locator('.edit-btn').click();
  await page.locator('#gym-rm-modal').getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => dialogs).toEqual(['Escribe un peso válido (puede ser 0).']);
  await expect(page.locator('#gym-rm-modal')).toHaveClass(/active/);
  expect(gymWrites(backend)).toEqual([]);

  await page.locator('#gym-rm-input').fill('0');
  await page.locator('#gym-rm-modal').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('#gym-rm-modal')).not.toHaveClass(/active/);
  await expect(markRow(page, 'Dominadas lastradas').locator('td').nth(1)).toHaveText('0 kg');
  await expect.poll(() => writesTo(backend, 'gym_rm').length).toBe(1);
  expect(writesTo(backend, 'gym_rm')[0].body[0]).toMatchObject({ exercise: 'Dominadas lastradas', weight: 0 });
  expect(relevantErrors(errors)).toEqual([]);
});

test('the history modal lists my marks newest first', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  const modal = page.locator('#gym-rm-history-modal');
  const rows = page.locator('#gym-rm-history-list .gym-rm-history-row');

  await markRow(page, 'Sentadilla').locator('.history-btn').click();
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#gym-rm-history-modal-title')).toHaveText('Histórico — Sentadilla');
  await expect(rows.locator('.w')).toHaveText(['85 kg', '80 kg', '75 kg']);
  await expect(rows.locator('.d')).toHaveText(['18/09/26', '04/09/26', '10/06/26']);
  await expect(rows.first()).toHaveClass(/latest/);
  await expect(page.locator('#gym-rm-history-list .gym-rm-history-row.latest')).toHaveCount(1);
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  // Nothing registered: empty message.
  await markRow(page, 'Hip thrust').locator('.history-btn').click();
  await expect(page.locator('#gym-rm-history-modal-title')).toHaveText('Histórico — Hip thrust');
  await expect(page.locator('#gym-rm-history-list')).toHaveText('Todavía no hay marcas registradas para este ejercicio.');
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a jugadora adds a private exercise (weight required) and can delete it', async ({ page }) => {
  const dialogs = acceptDialogs(page);
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  const name = page.locator('#gym-new-exercise-name');
  const weight = page.locator('#gym-new-exercise-weight');
  const addBtn = page.locator('#gym-marks-table-body').getByRole('button', { name: 'Añadir ejercicio' });

  await addBtn.click();
  await expect.poll(() => dialogs).toEqual(['Escribe el nombre del ejercicio.']);
  await name.fill('Curl bíceps');
  await addBtn.click();
  await expect.poll(() => dialogs.length).toBe(2);
  expect(dialogs[1]).toBe('Escribe un peso válido (puede ser 0).');
  expect(gymWrites(backend)).toEqual([]);

  await weight.fill('12');
  await weight.press('Enter');
  await expect.poll(() => cells(markRow(page, 'Curl bíceps'))).toEqual([['Curl bíceps', '12 kg', '25/09/26', '']]);
  await expect(marksRows(page)).toHaveCount(8);
  await expect(page.locator('#gym-new-exercise-name')).toHaveValue('');
  // Private: no gym_exercises row, only my mark.
  await expect.poll(() => gymWrites(backend).length).toBe(2);
  expect(gymWrites(backend).map((w) => [w.method, w.table])).toEqual([['UPSERT', 'gym_rm'], ['INSERT', 'gym_rm_history']]);
  expect(writesTo(backend, 'gym_rm')[0].body[0]).toMatchObject({ profile_id: IDS.player, exercise: 'Curl bíceps', weight: 12 });
  // Only my own exercise can be deleted by me; it is not in the team ranking.
  await expect(marksRows(page).locator('.del-btn')).toHaveCount(1);
  await expect(markRow(page, 'Curl bíceps').locator('.del-btn')).toHaveCount(1);

  await openTeam(page);
  await expect(page.locator('#gym-ranking-exercise option')).toHaveText(ALL_EXERCISES);

  await openTraining(page);
  await markRow(page, 'Curl bíceps').locator('.del-btn').click();
  await expect(markRow(page, 'Curl bíceps')).toHaveCount(0);
  expect(dialogs[2]).toBe('¿Eliminar "Curl bíceps" de tus marcas?');
  await expect.poll(() => gymWrites(backend).length).toBe(4);
  expect(gymWrites(backend).slice(2)).toEqual([
    { kind: 'rest', method: 'DELETE', table: 'gym_rm', filters: [['profile_id', `eq.${IDS.player}`], ['exercise', 'eq.Curl bíceps']] },
    { kind: 'rest', method: 'DELETE', table: 'gym_rm_history', filters: [['profile_id', `eq.${IDS.player}`], ['exercise', 'eq.Curl bíceps']] },
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('adding an exercise that already exists (any case) just updates its mark', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openTraining(page);
  await page.locator('#gym-new-exercise-name').fill('hip THRUST');
  await page.locator('#gym-new-exercise-weight').fill('90');
  await page.locator('#gym-marks-table-body').getByRole('button', { name: 'Añadir ejercicio' }).click();

  await expect(markRow(page, 'Hip thrust').locator('td').nth(1)).toHaveText('90 kg');
  await expect(marksRows(page)).toHaveCount(7);
  await expect.poll(() => gymWrites(backend).length).toBe(2);
  expect(writesTo(backend, 'gym_exercises')).toEqual([]);
  expect(writesTo(backend, 'gym_rm')[0].body[0]).toMatchObject({ profile_id: IDS.admin, exercise: 'Hip thrust', weight: 90 });
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin adds a general exercise without a mark; it reaches the calculator and the ranking', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openTraining(page);
  // Managers get delete buttons on every exercise and an optional weight.
  await expect(marksRows(page).locator('.del-btn')).toHaveCount(7);
  await expect(page.locator('#gym-new-exercise-weight')).toHaveAttribute('placeholder', 'Kg (opcional)');

  await page.locator('#gym-new-exercise-name').fill('Press inclinado');
  await page.locator('#gym-new-exercise-name').press('Enter');
  await expect(page.locator('#gym-new-exercise-weight')).toBeFocused();
  await page.locator('#gym-new-exercise-weight').press('Enter');

  await expect.poll(() => cells(markRow(page, 'Press inclinado'))).toEqual([['Press inclinado', 'Sin registrar', '—', '']]);
  const writes = gymWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'INSERT', table: 'gym_exercises', body: [{ name: 'Press inclinado', created_by: IDS.admin }] });

  await openDay(page, 1);
  await expect(page.locator('#gym-quick-calc-exercise option')).toHaveText(['Elige un ejercicio', ...ALL_EXERCISES, 'Press inclinado']);
  await openTeam(page);
  await expect(page.locator('#gym-ranking-exercise option')).toHaveText([...ALL_EXERCISES, 'Press inclinado']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin deletes a fixed exercise and a general one for the whole team', async ({ page }) => {
  const dialogs = acceptDialogs(page);
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openTraining(page);

  await markRow(page, 'Press militar').locator('.del-btn').click();
  await expect(markRow(page, 'Press militar')).toHaveCount(0);
  expect(dialogs).toEqual(['¿Eliminar "Press militar" para todo el equipo? Dejará de verse en Mis Marcas, la calculadora rápida y el ránking.']);
  await expect.poll(() => gymWrites(backend).length).toBe(3);
  expect(gymWrites(backend)).toEqual([
    { kind: 'rest', method: 'INSERT', table: 'gym_removed_default_exercises', body: [{ name: 'Press militar', removed_by: IDS.admin }], onConflict: undefined },
    { kind: 'rest', method: 'DELETE', table: 'gym_rm', filters: [['profile_id', `eq.${IDS.admin}`], ['exercise', 'eq.Press militar']] },
    { kind: 'rest', method: 'DELETE', table: 'gym_rm_history', filters: [['profile_id', `eq.${IDS.admin}`], ['exercise', 'eq.Press militar']] },
  ]);

  await markRow(page, 'Hip thrust').locator('.del-btn').click();
  await expect(markRow(page, 'Hip thrust')).toHaveCount(0);
  expect(dialogs[1]).toBe('¿Eliminar "Hip thrust" para todo el equipo? Dejará de verse en Mis Marcas, la calculadora rápida y el ránking.');
  await expect.poll(() => gymWrites(backend).length).toBe(6);
  expect(gymWrites(backend)[3]).toEqual({ kind: 'rest', method: 'DELETE', table: 'gym_exercises', filters: [['id', 'eq.91000000-0000-4000-8000-000000000001']] });
  expect(gymWrites(backend).slice(4).map((w) => [w.method, w.table])).toEqual([['DELETE', 'gym_rm'], ['DELETE', 'gym_rm_history']]);

  const remaining = ['Sentadilla', 'Peso muerto', 'Press banca', 'Dominadas lastradas', 'Remo con barra'];
  await expect(marksRows(page).locator('td:first-child')).toHaveText(remaining);
  await openDay(page, 1);
  await expect(page.locator('#gym-quick-calc-exercise option')).toHaveText(['Elige un ejercicio', ...remaining]);
  await openTeam(page);
  await expect(page.locator('#gym-ranking-exercise option')).toHaveText(remaining);
  expect(relevantErrors(errors)).toEqual([]);
});

test('dismissing the delete confirmation keeps the exercise', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  const dialogs = recordDialogs(page);
  await openApp(page);
  await openTraining(page);
  await markRow(page, 'Sentadilla').locator('.del-btn').click();
  await expect.poll(() => dialogs.length).toBe(1);
  await page.waitForTimeout(200);
  await expect(markRow(page, 'Sentadilla')).toHaveCount(1);
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('exercises removed for the team are hidden for everyone', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: withSeed({
    gym_removed_default_exercises: [{ name: 'Press militar', removed_by: IDS.jordi }, { name: 'dominadas lastradas', removed_by: IDS.jordi }],
  }) });
  await openApp(page);
  await openTraining(page);
  const visible = ['Sentadilla', 'Peso muerto', 'Press banca', 'Hip thrust', 'Remo con barra'];
  await expect(marksRows(page).locator('td:first-child')).toHaveText(visible);
  await openTeam(page);
  await expect(page.locator('#gym-ranking-exercise option')).toHaveText(visible);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Equipo: attendance today + ranking
// ---------------------------------------------------------------------------

test('check in to the gym today and cancel it', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTeam(page);

  // Only today's entries, sorted by time.
  await expect(attendees(page).locator('.meta b')).toHaveText(['Rovi', 'Carla', 'Tanke']);
  await expect(attendees(page).locator('.time')).toHaveText(['18:00', '18:30', '19:15']);
  await expect(attendees(page).locator('.cancel-btn')).toHaveCount(0);
  await expect(page.locator('#gym-checkin-btn')).toBeVisible();

  await page.locator('#gym-checkin-btn').click();
  const modal = page.locator('#gym-checkin-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#gym-checkin-time-input')).toHaveValue('10:00');
  await page.locator('#gym-checkin-time-input').fill('18:45');
  await modal.getByRole('button', { name: 'Apuntarme' }).click();

  await expect(modal).not.toHaveClass(/active/);
  await expect(attendees(page).locator('.meta b')).toHaveText(['Rovi', 'Carla', 'Juls', 'Tanke']);
  await expect(attendees(page).nth(2).locator('.time')).toHaveText('18:45');
  await expect(attendees(page).nth(2).getByRole('button', { name: 'Quitarme de hoy' })).toBeVisible();
  await expect(page.locator('#gym-checkin-btn')).toBeHidden();
  await expect.poll(() => gymWrites(backend).length).toBe(1);
  expect(gymWrites(backend)[0]).toMatchObject({
    method: 'UPSERT', table: 'gym_attendance', onConflict: ['profile_id', 'attendance_date'],
    body: [{ profile_id: IDS.player, attendance_date: '2026-09-25', time: '18:45' }],
  });

  await attendees(page).nth(2).getByRole('button', { name: 'Quitarme de hoy' }).click();
  await expect(attendees(page).locator('.meta b')).toHaveText(['Rovi', 'Carla', 'Tanke']);
  await expect(page.locator('#gym-checkin-btn')).toBeVisible();
  await expect.poll(() => gymWrites(backend).length).toBe(2);
  expect(gymWrites(backend)[1]).toEqual({
    kind: 'rest', method: 'DELETE', table: 'gym_attendance',
    filters: [['profile_id', `eq.${IDS.player}`], ['attendance_date', 'eq.2026-09-25']],
  });
  expect(relevantErrors(errors)).toEqual([]);
});

test('check-in needs a time; cancelling the modal writes nothing', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  const dialogs = recordDialogs(page);
  await openApp(page);
  await openTeam(page);
  await page.locator('#gym-checkin-btn').click();
  await page.locator('#gym-checkin-time-input').fill('');
  await page.locator('#gym-checkin-modal').getByRole('button', { name: 'Apuntarme' }).click();
  await expect.poll(() => dialogs).toEqual(['Elige una hora.']);
  await expect(page.locator('#gym-checkin-modal')).toHaveClass(/active/);
  await page.locator('#gym-checkin-modal').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#gym-checkin-modal')).not.toHaveClass(/active/);
  await expect(attendees(page)).toHaveCount(3);
  expect(gymWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('already checked in: no check-in button; nobody today: empty message', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: withSeed({
    gym_attendance: [
      { profile_id: IDS.player, attendance_date: '2026-09-25', time: '07:30' },
      { profile_id: IDS.marta, attendance_date: '2026-09-24', time: '18:00' },
    ],
  }) });
  await openApp(page);
  await openTeam(page);
  await expect(attendees(page).locator('.meta b')).toHaveText(['Juls']);
  await expect(attendees(page).locator('.time')).toHaveText(['07:30']);
  await expect(page.locator('#gym-checkin-btn')).toBeHidden();

  // After cancelling, nobody is left today.
  await attendees(page).getByRole('button', { name: 'Quitarme de hoy' }).click();
  await expect(page.locator('#gym-attendance-today')).toHaveText('Todavía no se ha apuntado nadie hoy.');
  await expect(page.locator('#gym-checkin-btn')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('team ranking per exercise: heaviest first, then everyone without a mark', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTeam(page);
  const select = page.locator('#gym-ranking-exercise');
  await expect(select.locator('option')).toHaveText(ALL_EXERCISES);
  await expect(select).toHaveValue('Sentadilla');
  await expect.poll(() => cells(rankingRows(page))).toEqual([
    ['1', 'Rovi', '110 kg', '17/09/26'],
    ['2', 'Carla', '95 kg', '15/09/26'],
    ['3', 'Juls', '85 kg', '18/09/26'],
    ['4', 'Tanke', '75 kg', '22/09/26'],
    ['5', 'Paula', '70 kg', '14/09/26'],
    ['—', 'Jordi', 'Sin registrar', '—'],
    ['—', 'Núria', 'Sin registrar', '—'],
    ['—', 'Sergi', 'Sin registrar', '—'],
  ]);
  await expect(rankingRows(page).first()).toHaveClass(/gym-rank-top/);
  await expect(page.locator('#gym-ranking-table-body tr.gym-rank-top')).toHaveCount(1);

  await select.selectOption('Peso muerto');
  await expect.poll(() => cells(rankingRows(page))).toEqual([
    ['1', 'Rovi', '130 kg', '17/09/26'],
    ['2', 'Juls', '100 kg', '18/09/26'],
    ...['Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi'].map((n) => ['—', n, 'Sin registrar', '—']),
  ]);

  await select.selectOption('Hip thrust');
  await expect(rankingRows(page).first()).toHaveText(/^\s*1\s*Tanke\s*120 kg\s*22\/09\/26\s*$/);
  await expect(rankingRows(page)).toHaveCount(8);

  await select.selectOption('Press militar');
  await expect(page.locator('#gym-ranking-table-body tr.gym-rank-top')).toHaveCount(0);
  await expect(rankingRows(page).locator('.rank-cell')).toHaveText(Array(8).fill('—'));
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin view: the admin account appears in the ranking and the attendance as "Montse"', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openTeam(page);
  // NOTE: the admin account is hidden from every other list (applyPlantillaRows), but in
  // Gym it is the "me" roster entry, so it shows up in the ranking and can check in.
  await expect(rankingRows(page).locator('.player-row')).toHaveText(['Rovi', 'Carla', 'Juls', 'Tanke', 'Paula', 'Montse', 'Jordi', 'Núria', 'Sergi']);
  await page.locator('#gym-checkin-btn').click();
  await page.locator('#gym-checkin-time-input').fill('20:00');
  await page.locator('#gym-checkin-modal').getByRole('button', { name: 'Apuntarme' }).click();
  await expect(attendees(page).locator('.meta b')).toHaveText(['Rovi', 'Carla', 'Tanke', 'Montse']);
  await expect.poll(() => gymWrites(backend).length).toBe(1);
  expect(gymWrites(backend)[0].body[0]).toEqual({ profile_id: IDS.admin, attendance_date: '2026-09-25', time: '20:00' });
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Catalan + mobile
// ---------------------------------------------------------------------------

test('Catalan: static labels are translated, texts generated by gym.js stay in Spanish', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await openTraining(page);
  await openDay(page, 1);
  await page.evaluate(() => window.setLang('ca'));

  // The open day detail is re-rendered in Catalan.
  await expect(page.locator('#gym-routine-day-detalle-title')).toHaveText('Dia 1');
  await expect(page.locator('#gym-routine-day-detalle-split-note-text')).toHaveText('Rutina diferent per a Forwards i Backs');
  await expect(page.locator('#sec-gym-entrenamiento-dia thead th')).toHaveText(['Exercici', 'Sèries', 'Repeticions', 'Càrrega', 'Descans']);
  await expect(page.locator('#sec-gym-entrenamiento-dia .gym-quick-calc-head h3')).toHaveText('Calculadora ràpida');
  // NOTE: dynamic texts of gym.js are hardcoded in Spanish.
  await expect(quickResult(page)).toHaveText('Elige un ejercicio y un % para calcular.');
  await expect(page.locator('#gym-quick-calc-exercise option').first()).toHaveText('Elige un ejercicio');

  await page.locator('#sec-gym-entrenamiento-dia .back-link').click();
  await expect(page.locator('#sec-gym-entrenamiento .section-head h2')).toHaveText('El meu entrenament');
  await expect(page.locator('#gym-marks-section h3')).toHaveText('Les meves marques');
  await expect(page.locator('#gym-marks-table thead th')).toHaveText(['Exercici', 'La teva marca (1RM)', 'Actualitzat', '']);
  await expect(dayCards(page).locator('b')).toHaveText(['Día 1', 'Día 2', 'Día 3']);
  await expect(markRow(page, 'Press militar').locator('td').nth(1)).toHaveText('Sin registrar');

  await openDay(page, 2);
  await expect(page.locator('#gym-routine-day-detalle-title')).toHaveText('Dia 2');
  await expect(page.locator('#gym-routine-day-detalle-split-note-text')).toHaveText("Mateixa rutina per a tot l'equip");

  await goToSection(page, 'gym');
  await expect(page.locator('#sec-gym .gym-tab-card b')).toHaveText(['El meu entrenament', 'Equip']);
  await page.locator('#sec-gym .gym-tab-card', { hasText: 'Equip' }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#sec-gym-equipo h3')).toHaveText(["Assistència al gimnàs avui", 'Rànquing']);
  await expect(rankingRows(page).last().locator('.weight-cell')).toHaveText('Sin registrar');
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: Gym is reached from Vestuario and the day detail works the same', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Vestuario' }).click();
  await page.locator('#sec-vestuario .vest-card.i-gym').click();
  await expect(page.locator('#sec-gym')).toHaveClass(/active/);
  await page.locator('#sec-gym .gym-tab-card', { hasText: 'Mi Entrenamiento' }).click();
  await page.waitForLoadState('networkidle');
  await expect(dayCards(page)).toHaveCount(3);
  await openDay(page, 1);
  await expect(page.locator('#gym-routine-day-detalle-title')).toBeVisible();
  await groupTab(page, 'Backs').click();
  await expect(dayRows(page).first()).toContainText('Sentadilla');
  await expect(dayRows(page).first()).toContainText('70% RM');
  await page.locator('#gym-quick-calc-exercise').selectOption('Peso muerto');
  await page.locator('#gym-quick-calc-pct').selectOption('75');
  await expect(quickResult(page).locator('.kg')).toHaveText('75 kg');
  expect(relevantErrors(errors)).toEqual([]);
});
