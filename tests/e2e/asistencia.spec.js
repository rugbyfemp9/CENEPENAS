// Characterization tests for "Asistencia": the event list (upcoming / past, type
// filters), the event detail (header, roster tabs Asistirán / No asistirán / Sin
// contestar), RSVP (confirm / decline / undo, written to att_attendance), the
// justification comment modal, the heart burst, the training intensity reveal and
// who can manage events.
//
// Scenario (clock Fri 2026-09-25 10:00, see fixtures/seed.js):
//   - Upcoming list starts with: 25/09 Entreno (player confirmed), 26/09 Partido vs
//     Santboi (ce1, player has NOT answered), 28/09 Entreno, 29/09 Reunión de equipo,
//     30/09 Entreno, then October (away match 03/10 confirmed, home match 10/10...).
//   - ce1 answers in att_attendance: yes Rovi, Carla, Paula, Jordi; no Tanke (with a
//     comment). Everyone else is pending.
//   - Roster (player session): 'me' (Juls) + every non-admin profile but herself.
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
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test'); // jugadora
const JORDI = authUser(IDS.jordi, 'jordi@cnpenas.test'); // entrenador/a
const NURIA = authUser(IDS.nuria, 'nuria@cnpenas.test'); // fisio

const SANTBOI_MAPS = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('CEM Mar Bella, Av. del Litoral, Barcelona');

const attWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === 'att_attendance');
const list = (page) => page.locator('#att-event-list');
const cards = (page) => list(page).locator('.att-event');
const card = (page, text) => cards(page).filter({ hasText: text });
const detail = (page) => page.locator('#sec-asistencia-detalle');
const tab = (page, key) => page.locator(`.att-tabs button[data-att-tab="${key}"]`);
const roster = (page, key) => page.locator(`#att-roster-${key}`);
const rowNames = (page, key) => roster(page, key).locator('.att-roster-row .meta b');

async function openAsistencia(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openAppReady(page);
  await goToSection(page, 'asistencia');
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  return ctx;
}

async function openDetail(page, text) {
  await card(page, text).first().locator('.info b').click();
  await expect(detail(page)).toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
}

function seedWith(changes) {
  const s = structuredClone(seed);
  changes(s);
  return s;
}

// ---------------------------------------------------------------------------
// Event list
// ---------------------------------------------------------------------------

test('upcoming list: grouped by month, soonest first, with my saved answers', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);

  // Auto trainings (Mon/Wed/Fri, holidays skipped) until May 2027 + 4 shared events + ce1
  await expect(cards(page)).toHaveCount(104);
  await expect(list(page).locator('.att-month-heading > span:first-child')).toHaveText([
    'Septiembre 2026', 'Octubre 2026', 'Noviembre 2026', 'Diciembre 2026',
    'Enero 2027', 'Febrero 2027', 'Marzo 2027', 'Abril 2027', 'Mayo 2027',
  ]);
  // The "view past" toggle sits only in the first month heading
  await expect(list(page).locator('.att-history-toggle')).toHaveCount(1);
  await expect(list(page).locator('.att-month-heading').first().locator('.att-history-toggle')).toHaveText('Ver anteriores');
  await expect(list(page).locator('.att-history-toggle')).toHaveAttribute('aria-label', 'Ver eventos anteriores');

  const first = cards(page).locator('.info');
  await expect(first.locator('b').first()).toHaveText('Entreno');
  await expect(cards(page).locator('.cal-date .d').first()).toHaveText('25');
  await expect(cards(page).locator('.cal-date .m').first()).toHaveText('Sep');
  const firstSeven = await cards(page).evaluateAll((els) => els.slice(0, 7).map((e) => e.querySelector('.info b').textContent.trim() + ' | ' + e.querySelector('.info span').textContent.trim()));
  expect(firstSeven).toEqual([
    'Entreno | Viernes 25/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Partido vs Santboi | Sábado 26/09/26 · CEM Mar Bella · 17:30h',
    'Entreno | Lunes 28/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Reunión de equipo | Martes 29/09/26 · Local del club · 21:00 - 22:00h',
    'Entreno | Miércoles 30/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Entreno | Viernes 02/10/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Partido vs Cornellà | Sábado 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h',
  ]);
  // 12/10 (Fiesta Nacional, a Monday) has no training
  await expect(cards(page).filter({ hasText: '12/10/26' })).toHaveCount(0);

  // My answers (loaded from att_attendance): 25/09 training and the away match
  await expect(list(page).locator('.rsvp-state')).toHaveCount(2);
  await expect(cards(page).nth(0).locator('.rsvp-state')).toHaveText('Has confirmado');
  await expect(cards(page).nth(0).locator('.rsvp-state')).toHaveClass(/ok/);
  await expect(cards(page).nth(0).locator('.actions .confirm')).toHaveClass(/is-active/);
  await expect(cards(page).nth(0).locator('.actions .decline')).not.toHaveClass(/is-active/);
  await expect(card(page, 'Partido vs Cornellà').locator('.rsvp-state')).toHaveText('Has confirmado');
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveCount(0);

  // Matches are highlighted; the meeting has no RSVP buttons and (for a player) no pencil
  await expect(card(page, 'Partido vs Santboi')).toHaveClass(/att-event--match/);
  await expect(cards(page).nth(0)).not.toHaveClass(/att-event--match/);
  const meeting = card(page, 'Reunión de equipo');
  await expect(meeting.locator('.actions')).toHaveCount(0);
  await expect(meeting.locator('.att-event-edit-btn')).toHaveCount(0);
  await expect(cards(page).nth(1).locator('.actions button')).toHaveText(['Declinar', 'Dudosa', 'Confirmar']);

  expect(attWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Ver anteriores" shows past events newest first and "Ver futuros" goes back', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await list(page).locator('.att-history-toggle').click();

  await expect(list(page).locator('.att-month-heading > span:first-child')).toHaveText(['Septiembre 2026']);
  await expect(list(page).locator('.att-history-toggle')).toHaveText('Ver futuros');
  await expect(list(page).locator('.att-history-toggle')).toHaveAttribute('aria-label', 'Ver eventos futuros');
  // Today's training (25/09) is still "upcoming" until the day is over
  await expect(cards(page).locator('.info > span:not(.rsvp-state)')).toHaveText([
    'Miércoles 23/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Lunes 21/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Sábado 19/09/26 · CEM Mar Bella · 17:30 - 19:00h',
    'Viernes 18/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Miércoles 16/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Lunes 14/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Sábado 12/09/26 · CEM Mar Bella · 12:00 - 13:30h',
    'Miércoles 09/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Lunes 07/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Viernes 04/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    'Miércoles 02/09/26 · CEM Mar Bella · 20:30 - 22:00h',
  ]);
  await expect(card(page, 'Partido vs Gòtics').locator('.rsvp-state')).toHaveText('Has confirmado');
  await expect(list(page).locator('.rsvp-state')).toHaveCount(3); // 23/09, 21/09, Gòtics
  // Past events keep their RSVP buttons; players get no staff 📊 shortcut
  await expect(card(page, 'Partido vs Gòtics').locator('.actions button')).toHaveText(['Declinar', 'Dudosa', 'Confirmar']);
  await expect(list(page).locator('.wstaff-quicklink')).toHaveCount(0);

  await list(page).locator('.att-history-toggle').click();
  await expect(list(page).locator('.att-history-toggle')).toHaveText('Ver anteriores');
  await expect(cards(page)).toHaveCount(104);
  expect(relevantErrors(errors)).toEqual([]);
});

test('type filters hide trainings, matches and meetings; an empty result shows a message', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  const modal = page.locator('#att-filter-modal');
  await page.getByRole('button', { name: 'Filtrar eventos' }).click();
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Filtrar eventos');
  await expect(modal.locator('.modal-sub')).toHaveText('Elige qué tipos de evento quieres ver.');
  const boxes = modal.locator('input[type="checkbox"]');
  await expect(modal.locator('.cal-filter-item')).toHaveText(['Entrenos', 'Partidos', 'Reuniones']);
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).toBeChecked();
  await expect(boxes.nth(2)).toBeChecked();

  await boxes.nth(0).uncheck();
  await expect(cards(page).locator('.info b')).toHaveText(['Partido vs Santboi', 'Reunión de equipo', 'Partido vs Cornellà', 'Partido vs Badalona']);

  await boxes.nth(1).uncheck();
  await expect(cards(page).locator('.info b')).toHaveText(['Reunión de equipo']);

  await boxes.nth(2).uncheck();
  await expect(cards(page)).toHaveCount(0);
  await expect(list(page).locator('.att-roster-empty')).toHaveText('No hay próximos eventos.');
  await expect(list(page).locator('.att-history-toggle')).toHaveText('Ver anteriores');

  // The filter also applies to the past events
  await boxes.nth(1).check();
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  await list(page).locator('.att-history-toggle').click();
  await expect(cards(page).locator('.info b')).toHaveText(['Partido vs Gòtics', 'Partido vs Tarragona']);

  // Clicking the overlay also closes the modal
  await page.getByRole('button', { name: 'Filtrar eventos' }).click();
  await expect(modal).toHaveClass(/active/);
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('no past events: the history view shows its empty message', async ({ page }) => {
  const s = seedWith((d) => { d.att_events = d.att_events.filter((e) => e.iso >= '2026-09-25'); });
  const { errors } = await openAsistencia(page, { seed: s });
  const modal = page.locator('#att-filter-modal');
  await page.getByRole('button', { name: 'Filtrar eventos' }).click();
  await modal.locator('input[type="checkbox"]').nth(0).uncheck();
  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await list(page).locator('.att-history-toggle').click();
  await expect(cards(page)).toHaveCount(0);
  await expect(list(page).locator('.att-roster-empty')).toHaveText('Todavía no hay eventos pasados.');
  await expect(list(page).locator('.att-history-toggle')).toHaveText('Ver futuros');
  expect(relevantErrors(errors)).toEqual([]);
});

test('clicking a meeting card does not open any detail', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await card(page, 'Reunión de equipo').click();
  await page.waitForTimeout(200);
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  await expect(detail(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Event detail
// ---------------------------------------------------------------------------

test('match detail: header, meeting/kick-off times and the three roster tabs', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Santboi');

  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Santboi');
  await expect(page.locator('#att-detail-daynum')).toHaveText('26');
  await expect(page.locator('#att-detail-monthabbr')).toHaveText('Sep');
  await expect(page.locator('#att-detail-when')).toHaveText('Sábado 26/09/26');
  const link = page.locator('#att-detail-location a.att-detail-location-link');
  await expect(page.locator('#att-detail-location')).toHaveText('CEM Mar Bella'); // home: no ✈️
  await expect(link).toHaveAttribute('href', SANTBOI_MAPS);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator('#att-detail-meet-item')).toBeVisible();
  await expect(page.locator('#att-detail-meet')).toHaveText('—');
  await expect(page.locator('#att-detail-start-label')).toBeVisible();
  await expect(page.locator('#att-detail-start-item')).toHaveText(/KO\s+17:30h/);
  await expect(page.locator('#att-detail-intensity-badge')).toHaveText('');
  await expect(page.locator('#att-detail-confirm-btn')).not.toHaveClass(/is-active/);
  await expect(page.locator('#att-detail-decline-btn')).not.toHaveClass(/is-active/);

  // Player on a match: Tullidas + her own Wellness button; no edit, no staff shortcut
  await expect(page.locator('#att-detail-edit-btn')).toBeHidden();
  await expect(page.locator('#att-detail-tullides-btn')).toBeVisible();
  await expect(page.locator('#att-detail-wellness-btn')).toBeVisible();
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeHidden();

  await expect(page.locator('.att-tabs button')).toHaveText([/^Sí\s+4/, /Dudosas\s+0/, /^No\s+1/, /Sin contestar\s+3/]);
  await expect(tab(page, 'yes')).toHaveClass(/active/);
  await expect(page.locator('.att-roster[data-att-roster="yes"]')).toHaveClass(/active/);
  await expect(page.locator('.att-roster[data-att-roster="no"]')).not.toHaveClass(/active/);

  // "Asistirán" grouped: Jugadoras → Delanteras / 3/4, then one group per other role
  const yes = roster(page, 'yes');
  await expect(yes.locator('> .att-roster-group > .att-roster-group-title')).toHaveText([/Jugadoras\s+3/, /entrenador\/a\s+1/]);
  await expect(yes.locator('.att-roster-group.is-subgroup > .att-roster-group-title')).toHaveText([/Delanteras\s+2/, /3\/4\s+1/]);
  await expect(yes.locator('.is-subgroup').nth(0).locator('.meta b')).toHaveText(['Rovi', 'Carla']);
  await expect(yes.locator('.is-subgroup').nth(1).locator('.meta b')).toHaveText(['Paula']);
  await expect(rowNames(page, 'yes')).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);
  await expect(yes.locator('.att-comment-btn')).toHaveCount(0);

  await tab(page, 'no').click();
  await expect(tab(page, 'no')).toHaveClass(/active/);
  await expect(tab(page, 'yes')).not.toHaveClass(/active/);
  await expect(page.locator('.att-roster[data-att-roster="no"]')).toHaveClass(/active/);
  await expect(roster(page, 'no')).toBeVisible();
  await expect(roster(page, 'yes')).toBeHidden();
  await expect(rowNames(page, 'no')).toHaveText(['Tanke']);
  await expect(roster(page, 'no').locator('.comment')).toHaveText(['Estoy de viaje con la familia']);
  // Nobody can comment on someone else's answer
  await expect(roster(page, 'no').locator('.att-comment-btn')).toHaveCount(0);

  await tab(page, 'pending').click();
  await expect(rowNames(page, 'pending')).toHaveText(['Juls', 'Núria', 'Sergi']);
  await expect(roster(page, 'pending').locator('.att-comment-btn')).toHaveText(['+ Comentario']);
  await expect(roster(page, 'pending').locator('.att-roster-row').first().locator('.avatar')).toHaveText('J');

  expect(attWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('training detail hides the meeting time and KO label; empty tabs say nobody yet', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openDetail(page, 'Lunes 28/09/26');

  await expect(page.locator('#att-detail-title')).toHaveText('Entreno');
  await expect(page.locator('#att-detail-when')).toHaveText('Lunes 28/09/26');
  await expect(page.locator('#att-detail-meet-item')).toBeHidden();
  await expect(page.locator('#att-detail-start-label')).toBeHidden();
  await expect(page.locator('#att-detail-start')).toHaveText('20:30h');
  await expect(page.locator('#att-detail-tullides-btn')).toBeHidden();
  await expect(page.locator('#att-detail-intensity-badge')).toHaveText('');

  await expect(page.locator('.att-tabs .count')).toHaveText(['0', '0', '0', '8']);
  await expect(roster(page, 'yes').locator('.att-roster-empty')).toHaveText('Nadie en esta lista todavía.');
  await tab(page, 'no').click();
  await expect(roster(page, 'no').locator('.att-roster-empty')).toHaveText('Nadie en esta lista todavía.');
  await tab(page, 'pending').click();
  await expect(rowNames(page, 'pending')).toHaveText(['Juls', 'Rovi', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  // Back link returns to the list
  await detail(page).locator('.back-link').click();
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('today\'s training detail shows my saved answer and my teammates\' comments', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openDetail(page, 'Viernes 25/09/26');

  await expect(page.locator('#att-detail-confirm-btn')).toHaveClass(/is-active/);
  await expect(page.locator('.att-tabs .count')).toHaveText(['2', '0', '1', '5']);
  await expect(rowNames(page, 'yes')).toHaveText(['Rovi', 'Juls']);
  // Juls (3/4) and Rovi (delantera)
  await expect(roster(page, 'yes').locator('.is-subgroup > .att-roster-group-title')).toHaveText([/Delanteras\s+1/, /3\/4\s+1/]);
  await expect(roster(page, 'yes').locator('.att-comment-btn')).toHaveText(['+ Comentario']);
  await tab(page, 'no').click();
  await expect(rowNames(page, 'no')).toHaveText(['Carla']);
  await expect(roster(page, 'no').locator('.comment')).toHaveText(['Salgo tarde de trabajar']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('away match detail marks the place with ✈️ and shows the meeting time', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Cornellà');
  await expect(page.locator('#att-detail-location')).toHaveText('✈️ Camp Municipal de Rugby La Bòbila');
  await expect(page.locator('#att-detail-location a')).toHaveAttribute('href',
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Camp Municipal de Rugby La Bòbila, Cornellà de Llobregat'));
  await expect(page.locator('#att-detail-meet')).toHaveText('15:15h');
  await expect(page.locator('#att-detail-start')).toHaveText('16:30h');
  await expect(page.locator('#att-detail-confirm-btn')).toHaveClass(/is-active/);
  await expect(rowNames(page, 'yes')).toHaveText(['Juls']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a place without a maps link is plain text', async ({ page }) => {
  const s = seedWith((d) => {
    d.att_events.push({
      id: 'ce-test-friendly', type: 'match', label: 'Amistoso', date: 1, month: 'Oct', iso: '2026-10-01',
      when_text: '', place: 'Campo por confirmar', place_maps_url: '', is_home: false,
      meet_time: '', start_time: '', end_time: '', intensity: null,
    });
  });
  const { errors } = await openAsistencia(page, { seed: s });
  await expect(card(page, 'Amistoso').locator('.info > span')).toHaveText('Jueves 01/10/26 · Campo por confirmar');
  await openDetail(page, 'Amistoso');
  await expect(page.locator('#att-detail-location')).toHaveText('✈️ Campo por confirmar');
  await expect(page.locator('#att-detail-location a')).toHaveCount(0);
  await expect(page.locator('#att-detail-meet')).toHaveText('—');
  await expect(page.locator('#att-detail-start')).toHaveText('—');
  expect(relevantErrors(errors)).toEqual([]);
});

test('answers from people without a profile appear as "Alguien" with no role', async ({ page }) => {
  const stranger = '99999999-0000-4000-8000-000000000001';
  const s = seedWith((d) => {
    d.att_attendance.push({ event_id: EVENT_IDS.matchNext, user_id: stranger, status: 'yes', comment: '', updated_at: '2026-09-22T10:00:00Z' });
  });
  const { errors } = await openAsistencia(page, { seed: s });
  await openDetail(page, 'Partido vs Santboi');
  await expect(tab(page, 'yes').locator('.count')).toHaveText('5');
  await expect(roster(page, 'yes').locator('> .att-roster-group > .att-roster-group-title')).toHaveText([/Jugadoras\s+3/, /entrenador\/a\s+1/, /Sin rol asignado\s+1/]);
  await expect(rowNames(page, 'yes')).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi', 'Alguien']);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

test('confirming from the detail saves "yes", moves me to Asistirán and bursts blue hearts', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Santboi');

  await page.locator('#att-detail-confirm-btn').click();
  await expect(page.locator('body > .rsvp-heart-burst')).toHaveCount(5);
  await expect(page.locator('body > .rsvp-heart-burst').first()).toHaveText('💙');
  await expect(page.locator('#att-detail-confirm-btn')).toHaveClass(/is-active/);
  await expect(page.locator('.att-tabs .count')).toHaveText(['5', '0', '1', '2']);
  await expect(roster(page, 'yes').locator('.is-subgroup').nth(1).locator('.meta b')).toHaveText(['Juls', 'Paula']);
  await expect(roster(page, 'yes').locator('.att-comment-btn')).toHaveText(['+ Comentario']);
  await expect(page.locator('#comment-modal')).not.toHaveClass(/active/);

  await expect.poll(() => attWrites(backend).length).toBe(1);
  const [w] = attWrites(backend);
  expect(w.method).toBe('UPSERT');
  expect(w.body).toHaveLength(1);
  expect(w.body[0]).toMatchObject({ event_id: 'ce1', user_id: IDS.player, status: 'yes', comment: '' });
  expect(w.body[0].updated_at).toBe('2026-09-25T08:00:00.000Z');

  // The hearts disappear on their own
  await expect(page.locator('.rsvp-heart-burst')).toHaveCount(0, { timeout: 3000 });

  // The list card reflects it too
  await detail(page).locator('.back-link').click();
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveText('Has confirmado');
  await expect(card(page, 'Partido vs Santboi').locator('.confirm')).toHaveClass(/is-active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('pressing my current answer again undoes it (row deleted, back to pending, no hearts)', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  const today = cards(page).nth(0);
  await expect(today.locator('.rsvp-state')).toHaveText('Has confirmado');

  await today.locator('.actions .confirm').click();
  await expect(cards(page).nth(0).locator('.rsvp-state')).toHaveCount(0);
  await expect(cards(page).nth(0).locator('.actions .confirm')).not.toHaveClass(/is-active/);
  await expect(page.locator('.rsvp-heart-burst')).toHaveCount(0);

  await expect.poll(() => attWrites(backend).length).toBe(1);
  const [w] = attWrites(backend);
  expect(w.method).toBe('DELETE');
  expect(w.filters).toEqual([['event_id', 'eq.auto-2026-09-25'], ['user_id', `eq.${IDS.player}`]]);
  expect(backend.db.att_attendance.find((r) => r.event_id === 'auto-2026-09-25' && r.user_id === IDS.player)).toBeUndefined();

  await openDetail(page, 'Viernes 25/09/26');
  await expect(page.locator('.att-tabs .count')).toHaveText(['1', '0', '1', '6']);
  await tab(page, 'pending').click();
  await expect(rowNames(page, 'pending').first()).toHaveText('Juls');
  expect(relevantErrors(errors)).toEqual([]);
});

test('declining from a list card saves "no", bursts broken hearts and asks for a justification', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await card(page, 'Partido vs Santboi').locator('.actions .decline').click();

  await expect(page.locator('body > .rsvp-heart-burst')).toHaveCount(5);
  await expect(page.locator('body > .rsvp-heart-burst').first()).toHaveText('💔');
  const modal = page.locator('#comment-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#comment-modal-title')).toHaveText('Justifica tu ausencia');
  await expect(page.locator('#comment-modal-sub')).toHaveText('Partido vs Santboi · Sábado 26/09/26 · CEM Mar Bella · 17:30h');
  await expect(page.locator('#comment-modal-textarea')).toHaveValue('');
  await expect(page.locator('#comment-modal-textarea')).toHaveAttribute('placeholder', 'Escribe aquí el motivo o un comentario...');
  await expect(page.locator('#comment-modal-textarea')).toBeFocused();
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveText('Has declinado');
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveClass(/bad/);

  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'ce1', user_id: IDS.player, status: 'no', comment: '' }] });

  await page.locator('#comment-modal-textarea').fill('  Tengo una boda  ');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  await expect.poll(() => attWrites(backend).length).toBe(2);
  expect(attWrites(backend)[1]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'ce1', user_id: IDS.player, status: 'no', comment: 'Tengo una boda' }] });

  // In the detail I'm in "No asistirán" with my comment and an "Editar" button
  await openDetail(page, 'Partido vs Santboi');
  await expect(page.locator('#att-detail-decline-btn')).toHaveClass(/is-active/);
  await expect(page.locator('.att-tabs .count')).toHaveText(['4', '0', '2', '2']);
  await tab(page, 'no').click();
  await expect(rowNames(page, 'no')).toHaveText(['Juls', 'Tanke']);
  await expect(roster(page, 'no').locator('.comment')).toHaveText(['Tengo una boda', 'Estoy de viaje con la familia']);
  await expect(roster(page, 'no').locator('.att-comment-btn')).toHaveText(['Editar']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Dudosa" saves "maybe", moves me to Dudosas and asks what it depends on', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await card(page, 'Partido vs Santboi').locator('.actions .maybe').click();

  await expect(page.locator('body > .rsvp-heart-burst').first()).toHaveText('🤞');
  const modal = page.locator('#comment-modal');
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#comment-modal-title')).toHaveText('¿De qué depende que puedas venir?');
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveText('Estás en duda');
  await expect(card(page, 'Partido vs Santboi').locator('.rsvp-state')).toHaveClass(/warn/);
  await expect(card(page, 'Partido vs Santboi').locator('.maybe')).toHaveClass(/is-active/);

  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'ce1', user_id: IDS.player, status: 'maybe', comment: '' }] });

  await page.locator('#comment-modal-textarea').fill('Depende del turno del trabajo');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => attWrites(backend).length).toBe(2);
  expect(attWrites(backend)[1]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'ce1', user_id: IDS.player, status: 'maybe', comment: 'Depende del turno del trabajo' }] });

  await openDetail(page, 'Partido vs Santboi');
  await expect(page.locator('#att-detail-maybe-btn')).toHaveClass(/is-active/);
  await expect(page.locator('.att-tabs .count')).toHaveText(['4', '1', '1', '2']);
  await tab(page, 'maybe').click();
  await expect(rowNames(page, 'maybe')).toHaveText(['Juls']);
  await expect(roster(page, 'maybe').locator('.comment')).toHaveText(['Depende del turno del trabajo']);
  await expect(roster(page, 'maybe').locator('.att-comment-btn')).toHaveText(['Editar']);

  // Pressing it again undoes it
  await page.locator('#att-detail-maybe-btn').click();
  await expect(page.locator('.att-tabs .count')).toHaveText(['4', '0', '1', '3']);
  await expect.poll(() => attWrites(backend).length).toBe(3);
  expect(attWrites(backend)[2].method).toBe('DELETE');
  expect(relevantErrors(errors)).toEqual([]);
});

test('cancelling the justification keeps the "no" without a comment', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Santboi');
  await page.locator('#att-detail-decline-btn').click();
  const modal = page.locator('#comment-modal');
  await expect(modal).toHaveClass(/active/);
  await page.locator('#comment-modal-textarea').fill('No lo guardo');
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await page.waitForLoadState('networkidle');
  expect(attWrites(backend)).toHaveLength(1);
  expect(attWrites(backend)[0].body[0]).toMatchObject({ status: 'no', comment: '' });
  await expect(page.locator('#att-detail-decline-btn')).toHaveClass(/is-active/);
  await tab(page, 'no').click();
  await expect(roster(page, 'no').locator('.att-roster-row').first().locator('.comment')).toHaveCount(0);
  await expect(roster(page, 'no').locator('.att-comment-btn')).toHaveText(['+ Comentario']);

  // Clicking outside the box closes it as well
  await roster(page, 'no').locator('.att-comment-btn').click();
  await expect(modal).toHaveClass(/active/);
  await modal.click({ position: { x: 5, y: 5 } });
  await expect(modal).not.toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
  expect(attWrites(backend)).toHaveLength(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing my comment on a confirmed event re-saves the answer with the comment', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Viernes 25/09/26');
  await roster(page, 'yes').locator('.att-comment-btn').click();
  const modal = page.locator('#comment-modal');
  await expect(modal).toHaveClass(/active/);
  // NOTE: the title always says "Justifica tu ausencia", even for a confirmed event.
  await expect(page.locator('#comment-modal-title')).toHaveText('Justifica tu ausencia');
  await expect(page.locator('#comment-modal-sub')).toHaveText('Entreno · Viernes 25/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await page.locator('#comment-modal-textarea').fill('Llego 10 min tarde');
  await modal.getByRole('button', { name: 'Guardar' }).click();

  await expect(roster(page, 'yes').locator('.comment')).toHaveText(['Llego 10 min tarde']);
  await expect(roster(page, 'yes').locator('.att-comment-btn')).toHaveText(['Editar']);
  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'auto-2026-09-25', user_id: IDS.player, status: 'yes', comment: 'Llego 10 min tarde' }] });

  // Reopening shows the saved text
  await roster(page, 'yes').locator('.att-comment-btn').click();
  await expect(page.locator('#comment-modal-textarea')).toHaveValue('Llego 10 min tarde');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a comment on an unanswered event is only kept on screen (the row is deleted)', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Santboi');
  await tab(page, 'pending').click();
  await roster(page, 'pending').locator('.att-comment-btn').click();
  await page.locator('#comment-modal-textarea').fill('Aún no lo sé');
  await page.locator('#comment-modal').getByRole('button', { name: 'Guardar' }).click();

  await expect(roster(page, 'pending').locator('.att-roster-row').first().locator('.comment')).toHaveText('Aún no lo sé');
  // NOTE: saving a comment while "Sin contestar" goes through the "undo" path, so the
  // comment is never stored: a DELETE of my (non-existent) row is sent instead.
  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0]).toMatchObject({ method: 'DELETE', filters: [['event_id', 'eq.ce1'], ['user_id', `eq.${IDS.player}`]] });
  expect(relevantErrors(errors)).toEqual([]);
});

test('undoing a decline clears my comment; declining again asks with an empty box', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openDetail(page, 'Partido vs Santboi');
  const modal = page.locator('#comment-modal');
  await page.locator('#att-detail-decline-btn').click();
  await page.locator('#comment-modal-textarea').fill('Trabajo');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(modal).not.toHaveClass(/active/);

  await page.locator('#att-detail-decline-btn').click(); // undo
  await expect(modal).not.toHaveClass(/active/);
  await expect(page.locator('#att-detail-decline-btn')).not.toHaveClass(/is-active/);
  await expect(page.locator('.att-tabs .count')).toHaveText(['4', '0', '1', '3']);
  await tab(page, 'pending').click();
  await expect(roster(page, 'pending').locator('.comment')).toHaveCount(0);

  await page.locator('#att-detail-decline-btn').click();
  await expect(modal).toHaveClass(/active/);
  await expect(page.locator('#comment-modal-textarea')).toHaveValue('');

  await expect.poll(() => attWrites(backend).length).toBe(4);
  expect(attWrites(backend).map((w) => [w.method, w.body?.[0]?.status ?? null, w.body?.[0]?.comment ?? null])).toEqual([
    ['UPSERT', 'no', ''],
    ['UPSERT', 'no', 'Trabajo'],
    ['DELETE', null, null],
    ['UPSERT', 'no', ''],
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('switching from "yes" to "no" on a card replaces the answer and opens the modal', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cards(page).nth(0).locator('.actions .decline').click();
  await expect(page.locator('#comment-modal')).toHaveClass(/active/);
  await expect(cards(page).nth(0).locator('.rsvp-state')).toHaveText('Has declinado');
  await expect(cards(page).nth(0).locator('.actions .decline')).toHaveClass(/is-active/);
  await expect(cards(page).nth(0).locator('.actions .confirm')).not.toHaveClass(/is-active/);
  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0]).toMatchObject({ method: 'UPSERT', body: [{ event_id: 'auto-2026-09-25', user_id: IDS.player, status: 'no', comment: '' }] });
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Training intensity
// ---------------------------------------------------------------------------

test('a training with intensity shows its emoji, rains it on open and then settles the badge', async ({ page }) => {
  // A shared att_events row for an auto training overrides it (here: high intensity)
  const s = seedWith((d) => {
    d.att_events.push({
      id: 'auto-2026-09-28', type: 'training', label: 'Entreno', date: 28, month: 'Sep', iso: '2026-09-28',
      when_text: '', place: 'CEM Mar Bella', place_maps_url: SANTBOI_MAPS, is_home: true,
      meet_time: '20:15h', start_time: '20:30h', end_time: '22:00h', intensity: 'high',
    });
  });
  const { errors } = await openAsistencia(page, { seed: s });
  await expect(card(page, 'Lunes 28/09/26').locator('.att-event-intensity')).toHaveText('🔥');
  await expect(list(page).locator('.att-event-intensity')).toHaveCount(1);

  // Not using openDetail(): the animation is short, so check it right after the click.
  await card(page, 'Lunes 28/09/26').locator('.info b').click();
  const badge = page.locator('#att-detail-intensity-badge');
  const burst = page.locator('body > .intensity-burst-emoji');
  // 46 floating emojis (each removes itself when its own animation ends)
  await expect(burst.first()).toHaveText('🔥');
  await expect(badge).toHaveText('🔥');
  await expect(badge).not.toHaveClass(/show/);
  await expect(badge).toHaveClass(/show/, { timeout: 4000 });
  await expect(page.locator('.intensity-burst-emoji')).toHaveCount(0, { timeout: 4000 });

  // Matches never show an intensity badge
  await detail(page).locator('.back-link').click();
  await openDetail(page, 'Partido vs Santboi');
  await expect(badge).toHaveText('');
  await expect(badge).not.toHaveClass(/show/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

test('admin: add/edit buttons, staff 📊 shortcut on ended events, no wellness button', async ({ page }) => {
  const { errors } = await openAsistencia(page, { user: USERS.admin });
  await expect(page.locator('#att-add-event-btn')).toBeVisible();
  await expect(card(page, 'Reunión de equipo').locator('.att-event-edit-btn')).toBeVisible();
  await expect(card(page, 'Reunión de equipo').locator('.att-event-edit-btn')).toHaveAttribute('aria-label', 'Editar evento');
  // Today's training has not ended yet at 10:00 → no shortcut in the upcoming list
  await expect(list(page).locator('.wstaff-quicklink')).toHaveCount(0);

  await list(page).locator('.att-history-toggle').click();
  await expect(list(page).locator('.wstaff-quicklink')).toHaveCount(11);
  await expect(list(page).locator('.wstaff-quicklink').first()).toHaveText('📊');
  await expect(list(page).locator('.wstaff-quicklink').first()).toHaveAttribute('aria-label', 'Ver análisis Wellness / RPE');

  await openDetail(page, 'Partido vs Gòtics');
  await expect(page.locator('#att-detail-edit-btn')).toBeVisible();
  await expect(page.locator('#att-detail-tullides-btn')).toBeVisible();
  await expect(page.locator('#att-detail-wellness-btn')).toBeHidden();
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeVisible();
  // Admin's own row (directiva) is "me" under its role name; the admin profile itself
  // is excluded from the roster loaded from profiles.
  await expect(page.locator('.att-tabs .count')).toHaveText(['3', '0', '0', '6']);
  await expect(rowNames(page, 'yes')).toHaveText(['Rovi', 'Juls', 'Paula']);
  await tab(page, 'pending').click();
  await expect(rowNames(page, 'pending')).toHaveText(['Montse', 'Carla', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  await detail(page).locator('.back-link').click();
  await list(page).locator('.att-history-toggle').click();
  await openDetail(page, 'Partido vs Santboi');
  await expect(page.locator('#att-detail-wellness-staff-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin who confirms appears in a group named after her role', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page, { user: USERS.admin });
  await openDetail(page, 'Partido vs Santboi');
  await page.locator('#att-detail-confirm-btn').click();
  await expect(roster(page, 'yes').locator('> .att-roster-group > .att-roster-group-title')).toHaveText([/Jugadoras\s+3/, /directiva\s+1/, /entrenador\/a\s+1/]);
  await expect(rowNames(page, 'yes')).toHaveText(['Rovi', 'Carla', 'Paula', 'Montse', 'Jordi']);
  await expect.poll(() => attWrites(backend).length).toBe(1);
  expect(attWrites(backend)[0].body[0]).toMatchObject({ event_id: 'ce1', user_id: IDS.admin, status: 'yes' });
  expect(relevantErrors(errors)).toEqual([]);
});

const ROLE_CASES = [
  { who: 'Capitana (Marta)', user: MARTA, manage: true, wellness: true, staff: false },
  { who: 'coach (Jordi)', user: JORDI, manage: true, wellness: false, staff: true },
  { who: 'fisio (Núria)', user: NURIA, manage: false, wellness: false, staff: true },
  { who: 'jugadora (Carla)', user: CARLA, manage: false, wellness: true, staff: false },
];

for (const c of ROLE_CASES) {
  test(`permissions for ${c.who}: manage=${c.manage}, wellness=${c.wellness}, staff=${c.staff}`, async ({ page }) => {
    const { errors } = await openAsistencia(page, { user: c.user });
    await expect(page.locator('#att-add-event-btn')).toBeVisible({ visible: c.manage });
    await expect(card(page, 'Reunión de equipo').locator('.att-event-edit-btn')).toHaveCount(c.manage ? 1 : 0);

    await list(page).locator('.att-history-toggle').click();
    await expect(list(page).locator('.wstaff-quicklink')).toHaveCount(c.staff ? 11 : 0);

    await openDetail(page, 'Partido vs Gòtics');
    await expect(page.locator('#att-detail-edit-btn')).toBeVisible({ visible: c.manage });
    await expect(page.locator('#att-detail-wellness-btn')).toBeVisible({ visible: c.wellness });
    await expect(page.locator('#att-detail-wellness-staff-btn')).toBeVisible({ visible: c.staff });
    await expect(page.locator('#att-detail-tullides-btn')).toBeVisible();
    expect(relevantErrors(errors)).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

test('Catalan: list, detail and comment modal are translated', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await page.evaluate(() => window.setLang('ca'));

  await expect(list(page).locator('.att-month-heading > span:first-child').first()).toHaveText('Setembre 2026');
  await expect(list(page).locator('.att-history-toggle')).toHaveText('Veure anteriors');
  await expect(cards(page).nth(0).locator('.info > span').first()).toHaveText('Divendres 25/09/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(cards(page).nth(0).locator('.rsvp-state')).toHaveText('Has confirmat');
  await expect(cards(page).nth(1).locator('.actions button')).toHaveText(['Declina', 'Dubtant', 'Confirma']);
  await expect(card(page, 'Partido vs Cornellà').locator('.cal-date .m')).toHaveText('Oct');
  await expect(card(page, 'Partido vs Cornellà').locator('.info > span').first()).toHaveText('Dissabte 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h');

  await openDetail(page, 'Partido vs Santboi');
  await expect(page.locator('#att-detail-when')).toHaveText('Dissabte 26/09/26');
  await expect(page.locator('.att-tabs button')).toHaveText([/^Sí\s+4/, /Dubtants\s+0/, /^No\s+1/, /Sense contestar\s+3/]);
  await expect(roster(page, 'yes').locator('> .att-roster-group > .att-roster-group-title').first()).toHaveText(/Jugadores\s+3/);
  await expect(roster(page, 'yes').locator('.is-subgroup > .att-roster-group-title').first()).toHaveText(/Davanteres\s+2/);
  await tab(page, 'pending').click();
  await expect(roster(page, 'pending').locator('.att-comment-btn')).toHaveText(['+ Comentari']);

  await page.locator('#att-detail-decline-btn').click();
  await expect(page.locator('#comment-modal-title')).toHaveText('Justifica la teva absència');
  await expect(page.locator('#comment-modal-sub')).toHaveText('Partido vs Santboi · Dissabte 26/09/26 · CEM Mar Bella · 17:30h');
  await expect(page.locator('#comment-modal').getByRole('button')).toHaveText(['Cancel·la', 'Desa']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('switching language with the comment modal open retitles it with the generic label', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await card(page, 'Partido vs Santboi').locator('.actions .decline').click();
  await expect(page.locator('#comment-modal-title')).toHaveText('Justifica tu ausencia');
  await page.evaluate(() => window.setLang('ca'));
  // NOTE: the sub-title is refreshed, but the title falls back to the static
  // "Comentari" instead of "Justifica la teva absència".
  await expect(page.locator('#comment-modal-sub')).toHaveText('Partido vs Santboi · Dissabte 26/09/26 · CEM Mar Bella · 17:30h');
  await expect(page.locator('#comment-modal-title')).toHaveText('Comentari');
  expect(relevantErrors(errors)).toEqual([]);
});
