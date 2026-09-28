// Characterization tests for events (eventos.js) and the monthly calendar
// (calendario.js): the "Añadir evento" type chooser, the add / edit modal with its
// per-type presets (training, match, meeting), the Lugar field linked to Google Maps
// (+ the 🏠 Casa shortcut), the training intensity picker, deleting an event (and
// everything hanging from it), the shared events table `att_events`, the calendar modal
// (month navigation, filters, birthdays) and the event popover.
//
// Test clock: Friday 2026-09-25 10:00 (Europe/Madrid). Events in September 2026:
//   auto trainings Mon/Wed/Fri 20:30-22:00 (convo 20:15h) except the 11th (holiday):
//   2, 4, 7, 9, 14, 16, 18, 21, 23, 25, 28, 30
//   matches 12 (Tarragona), 19 (Gòtics, has an acta), 26 (ce1, Santboi, hardcoded);
//   meeting 29 (Reunión de equipo, shown in the calendar as a "Plan");
//   birthday 5 (Aina "Tanke").
// October: away match 3 (Cornellà), home match 10 (Badalona).
// Event management (add button, edit pencils) is for entrenador/a, delegado/a,
// directiva, Capitana and the admin.
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
// Marta Rovira "Rovi": Capitana (can manage events).
const MARTA = authUser(IDS.marta, 'marta@cnpenas.test');
// Jordi Casals: entrenador/a (can manage events).
const JORDI = authUser(IDS.jordi, 'jordi@cnpenas.test');

const mapsUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const HOME_MAPS = mapsUrl('CEM Mar Bella, Av. del Litoral, Barcelona');

const writes = (backend) => backend.mutations.filter((m) => m.kind === 'rest');
const eventWrites = (backend) => writes(backend).filter((m) => m.table === 'att_events');

const addBtn = (page) => page.locator('#att-add-event-btn');
const typeModal = (page) => page.locator('#att-add-type-modal');
const eventModal = (page) => page.locator('#add-event-modal');
const deleteModal = (page) => page.locator('#delete-event-confirm-modal');
const calModal = (page) => page.locator('#calendar-modal');
const popover = (page) => page.locator('#event-info-modal');
const cards = (page) => page.locator('#att-event-list .att-event');
const cardOf = (page, title, when) => cards(page).filter({ has: page.locator('.info b', { hasText: title }) }).filter({ hasText: when });
const calDays = (page) => page.locator('#cal-grid .cal-day:not(.empty)');
const calDay = (page, d) => calDays(page).nth(d - 1);

async function openAsistencia(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.admin, ...opts });
  await openAppReady(page);
  await goToSection(page, 'asistencia');
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  return ctx;
}

async function openPreset(page, typeName) {
  await addBtn(page).click();
  await expect(typeModal(page)).toHaveClass(/active/);
  await typeModal(page).locator('.att-type-option', { hasText: typeName }).click();
  await expect(typeModal(page)).not.toHaveClass(/active/);
  await expect(eventModal(page)).toHaveClass(/active/);
}

async function openCalendar(page) {
  await page.locator('#sec-asistencia').getByRole('button', { name: 'Ver calendario' }).click();
  await expect(calModal(page)).toHaveClass(/active/);
}

async function calendarToSeptember(page) {
  await openCalendar(page);
  await calModal(page).locator('.cal-nav-btn', { hasText: '›' }).click();
  await expect(page.locator('#cal-month-label')).toHaveText('septiembre 2026');
}

const saveButton = (page) => eventModal(page).getByRole('button', { name: 'Guardar evento' });

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

test('a plain player cannot add or edit events from Asistencia', async ({ page }) => {
  const { errors } = await openAsistencia(page, { user: USERS.player });
  await expect(cards(page).first()).toBeVisible();
  await expect(addBtn(page)).toBeHidden();
  // Meetings have no detail page; their card pencil is the only way to edit them.
  const meeting = cardOf(page, 'Reunión de equipo', 'Martes 29/09/26');
  await expect(meeting).toBeVisible();
  await expect(meeting.locator('.att-event-edit-btn')).toHaveCount(0);

  await cardOf(page, 'Partido vs Cornellà', 'Sábado 03/10/26').click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-edit-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

for (const [who, user] of [['the admin', USERS.admin], ['the Capitana', MARTA], ['a coach', JORDI]]) {
  test(`${who} gets the add button, the meeting pencil and the detail edit button`, async ({ page }) => {
    const { errors } = await openAsistencia(page, { user });
    await expect(addBtn(page)).toBeVisible();
    await expect(cardOf(page, 'Reunión de equipo', 'Martes 29/09/26').locator('.att-event-edit-btn')).toBeVisible();
    // Trainings and matches have no pencil on the card (they are edited from the detail).
    await expect(cardOf(page, 'Partido vs Cornellà', 'Sábado 03/10/26').locator('.att-event-edit-btn')).toHaveCount(0);
    await cardOf(page, 'Partido vs Cornellà', 'Sábado 03/10/26').click();
    await expect(page.locator('#att-detail-edit-btn')).toBeVisible();
    expect(relevantErrors(errors)).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// Type chooser and presets
// ---------------------------------------------------------------------------

test('the type chooser offers training, match and meeting and can be cancelled', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await addBtn(page).click();
  const modal = typeModal(page);
  await expect(modal).toHaveClass(/active/);
  await expect(modal.locator('h3')).toHaveText('Añadir evento');
  await expect(modal.locator('.modal-sub')).toHaveText('Elige qué tipo de evento quieres crear.');
  await expect(modal.locator('.att-type-option b')).toHaveText(['Entreno', 'Partido', 'Reunión']);
  await expect(modal.locator('.att-type-option .txt > span')).toHaveText([
    'CEM Mar Bella · hora de inicio',
    'Rival, campo y horario de convocatoria',
    'Directiva, delegados u otro plan del club',
  ]);
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  await expect(eventModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('training preset: Mar Bella at home, 20:30-22:00, no convocatoria, intensity picker', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openPreset(page, 'Entreno');
  const modal = eventModal(page);
  await expect(page.locator('#add-event-modal-title')).toHaveText('Nuevo entreno');
  await expect(page.locator('#event-delete-btn')).toBeHidden();
  await expect(page.locator('#new-event-title')).toHaveValue('Entreno');
  await expect(page.locator('#new-event-title')).toHaveAttribute('placeholder', 'Entreno');
  await expect(page.locator('#new-event-date')).toHaveValue('');
  await expect(page.locator('#field-meet-time')).toBeHidden();
  await expect(page.locator('#field-start-time-label')).toHaveText('Inicio');
  await expect(page.locator('#new-event-time')).toHaveValue('20:30');
  await expect(page.locator('#new-event-end-time')).toHaveValue('22:00');
  await expect(page.locator('#field-place-label-text')).toHaveText('Lugar (opcional)');
  await expect(page.locator('#new-event-place')).toHaveValue('CEM Mar Bella');
  await expect(page.locator('#place-home-btn')).toHaveClass(/selected/);
  await expect(page.locator('#field-place-hint')).toBeHidden();
  const link = page.locator('#place-maps-preview a.place-maps-link');
  await expect(link).toHaveText('📍 Ver "CEM Mar Bella, Av. del Litoral, Barcelona" en Google Maps');
  await expect(link).toHaveAttribute('href', HOME_MAPS);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.locator('#field-intensity')).toBeVisible();
  await expect(modal.locator('.intensity-picker button.selected')).toHaveCount(0);

  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('match preset: empty title, convocatoria shown, place required with the home hint', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openPreset(page, 'Partido');
  await expect(page.locator('#add-event-modal-title')).toHaveText('Nuevo partido');
  await expect(page.locator('#new-event-title')).toHaveValue('');
  await expect(page.locator('#new-event-title')).toHaveAttribute('placeholder', 'Partido vs CR Sagunt');
  await expect(page.locator('#field-meet-time')).toBeVisible();
  await expect(page.locator('#new-event-meet-time')).toHaveValue('');
  await expect(page.locator('#field-start-time-label')).toHaveText('Inicio');
  await expect(page.locator('#new-event-time')).toHaveValue('17:30');
  await expect(page.locator('#new-event-end-time')).toHaveValue('');
  await expect(page.locator('#field-place-label-text')).toHaveText('Lugar');
  await expect(page.locator('#new-event-place')).toHaveValue('');
  await expect(page.locator('#place-home-btn')).not.toHaveClass(/selected/);
  await expect(page.locator('#place-maps-preview')).toBeHidden();
  await expect(page.locator('#field-place-hint')).toHaveText('🏠 Si el partido es en casa, se creará automáticamente su pestaña de Tercer tiempo.');
  await expect(page.locator('#field-place-hint')).toBeVisible();
  await expect(page.locator('#field-intensity')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('meeting preset: Sala del club with a Maps link, optional time, no intensity', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openPreset(page, 'Reunión');
  await expect(page.locator('#add-event-modal-title')).toHaveText('Nueva reunión');
  await expect(page.locator('#new-event-title')).toHaveValue('');
  await expect(page.locator('#new-event-title')).toHaveAttribute('placeholder', 'Reunión de directiva');
  await expect(page.locator('#field-meet-time')).toBeHidden();
  await expect(page.locator('#field-start-time-label')).toHaveText('Hora (opcional)');
  await expect(page.locator('#new-event-time')).toHaveValue('');
  await expect(page.locator('#new-event-end-time')).toHaveValue('');
  await expect(page.locator('#field-place-label-text')).toHaveText('Lugar (opcional)');
  await expect(page.locator('#new-event-place')).toHaveValue('Sala del club');
  await expect(page.locator('#place-home-btn')).not.toHaveClass(/selected/);
  await expect(page.locator('#place-maps-preview a')).toHaveText('📍 Ver "Sala del club" en Google Maps');
  await expect(page.locator('#place-maps-preview a')).toHaveAttribute('href', mapsUrl('Sala del club'));
  await expect(page.locator('#field-place-hint')).toBeHidden();
  await expect(page.locator('#field-intensity')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Creating events
// ---------------------------------------------------------------------------

test('creating a training with intensity writes att_events and shows it in the list', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openPreset(page, 'Entreno');
  await page.locator('#new-event-date').fill('2026-10-08');
  await page.locator('#intensity-btn-high').click();
  await expect(page.locator('#intensity-btn-high')).toHaveClass(/selected/);
  await saveButton(page).click();
  await expect(eventModal(page)).not.toHaveClass(/active/);

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  const w = eventWrites(backend)[0];
  expect(w.method).toBe('UPSERT');
  expect(w.body).toHaveLength(1);
  const { id, ...rest } = w.body[0];
  expect(id).toMatch(/^ce[0-9a-z]+$/);
  expect(rest).toEqual({
    type: 'training', label: 'Entreno', date: 8, month: 'Oct', iso: '2026-10-08',
    when_text: 'Jueves 08/10/26 · CEM Mar Bella · 20:30 - 22:00h',
    place: 'CEM Mar Bella', place_maps_url: HOME_MAPS, is_home: true,
    meet_time: '', start_time: '20:30h', end_time: '22:00h', intensity: 'high',
  });
  expect(writes(backend).filter((m) => m.table !== 'att_events')).toEqual([]);

  const card = cardOf(page, 'Entreno', 'Jueves 08/10/26');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.info b')).toHaveText('Entreno 🔥');
  await expect(card.locator('.att-event-intensity')).toHaveText('🔥');
  await expect(card.locator('.info > span').first()).toHaveText('Jueves 08/10/26 · CEM Mar Bella · 20:30 - 22:00h');
  await expect(card.locator('.actions button')).toHaveText(['Declinar', 'Confirmar']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the intensity picker is single-choice and clicking the selected option clears it', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openPreset(page, 'Entreno');
  const picker = eventModal(page).locator('.intensity-picker button');
  await expect(picker).toHaveText(['✨', '💪', '🔥']);
  await expect(page.locator('#intensity-btn-low')).toHaveAttribute('title', 'Baja intensidad');
  await expect(page.locator('#intensity-btn-medium')).toHaveAttribute('title', 'Intensidad media');
  await expect(page.locator('#intensity-btn-high')).toHaveAttribute('title', 'Alta intensidad');

  await page.locator('#intensity-btn-low').click();
  await expect(eventModal(page).locator('.intensity-picker button.selected')).toHaveText(['✨']);
  await page.locator('#intensity-btn-medium').click();
  await expect(eventModal(page).locator('.intensity-picker button.selected')).toHaveText(['💪']);
  await page.locator('#intensity-btn-medium').click();
  await expect(eventModal(page).locator('.intensity-picker button.selected')).toHaveCount(0);

  await page.locator('#new-event-title').fill('Entreno de recuperación');
  await page.locator('#new-event-date').fill('2026-10-06');
  await saveButton(page).click();
  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({ label: 'Entreno de recuperación', type: 'training', intensity: null, when_text: 'Martes 06/10/26 · CEM Mar Bella · 20:30 - 22:00h' });
  const card = cardOf(page, 'Entreno de recuperación', 'Martes 06/10/26');
  await expect(card.locator('.info b')).toHaveText('Entreno de recuperación');
  await expect(card.locator('.att-event-intensity')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('saving without title or date, or a match without place, alerts and writes nothing', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  const msgs = [];
  page.on('dialog', (d) => msgs.push(d.message()));

  await openPreset(page, 'Reunión');
  await saveButton(page).click();
  await expect.poll(() => msgs).toEqual(['Ponle un título y una fecha al evento.']);
  await page.locator('#new-event-title').fill('Asamblea');
  await saveButton(page).click();
  await expect.poll(() => msgs.length).toBe(2);
  expect(msgs[1]).toBe('Ponle un título y una fecha al evento.');
  await expect(eventModal(page)).toHaveClass(/active/);
  await eventModal(page).getByRole('button', { name: 'Cancelar' }).click();

  await openPreset(page, 'Partido');
  await page.locator('#new-event-title').fill('Partido vs Sagunt');
  await page.locator('#new-event-date').fill('2026-10-17');
  await saveButton(page).click();
  await expect.poll(() => msgs.length).toBe(3);
  expect(msgs[2]).toBe('El lugar es obligatorio para un partido. Escribe dónde se juega o elige 🏠 Casa.');
  // Whitespace-only place does not count either.
  await page.locator('#new-event-place').fill('   ');
  await saveButton(page).click();
  await expect.poll(() => msgs.length).toBe(4);
  expect(msgs[3]).toBe('El lugar es obligatorio para un partido. Escribe dónde se juega o elige 🏠 Casa.');
  await expect(eventModal(page)).toHaveClass(/active/);
  expect(eventWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('typing a place builds the Maps preview; 🏠 Casa replaces it with Mar Bella', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openPreset(page, 'Partido');
  const place = page.locator('#new-event-place');
  const preview = page.locator('#place-maps-preview');
  await place.pressSequentially('Campo de rugby Sagunt');
  await expect(preview).toBeVisible();
  await expect(preview.locator('a')).toHaveText('📍 Ver "Campo de rugby Sagunt" en Google Maps');
  await expect(preview.locator('a')).toHaveAttribute('href', mapsUrl('Campo de rugby Sagunt'));
  await expect(page.locator('#place-home-btn')).not.toHaveClass(/selected/);

  await page.locator('#place-home-btn').click();
  await expect(place).toHaveValue('CEM Mar Bella');
  await expect(page.locator('#place-home-btn')).toHaveClass(/selected/);
  await expect(preview.locator('a')).toHaveText('📍 Ver "CEM Mar Bella, Av. del Litoral, Barcelona" en Google Maps');
  await expect(preview.locator('a')).toHaveAttribute('href', HOME_MAPS);

  // Typing again unselects Casa and uses the typed text as the search.
  await place.fill('CEM Mar Bella 2');
  await expect(page.locator('#place-home-btn')).not.toHaveClass(/selected/);
  await expect(preview.locator('a')).toHaveAttribute('href', mapsUrl('CEM Mar Bella 2'));

  await place.fill('');
  await expect(preview).toBeHidden();
  await expect(preview).toBeEmpty();
  expect(relevantErrors(errors)).toEqual([]);
});

test('creating a home match with 🏠 Casa stores is_home and the Mar Bella link', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openPreset(page, 'Partido');
  await page.locator('#new-event-title').fill('Partido vs Sagunt');
  await page.locator('#new-event-date').fill('2026-10-17');
  await page.locator('#new-event-meet-time').fill('16:15');
  await page.locator('#new-event-end-time').fill('19:00');
  await page.locator('#place-home-btn').click();
  await saveButton(page).click();
  await expect(eventModal(page)).not.toHaveClass(/active/);

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({
    type: 'match', label: 'Partido vs Sagunt', date: 17, month: 'Oct', iso: '2026-10-17',
    when_text: 'Sábado 17/10/26 · CEM Mar Bella · 17:30 - 19:00h',
    place: 'CEM Mar Bella', place_maps_url: HOME_MAPS, is_home: true,
    meet_time: '16:15h', start_time: '17:30h', end_time: '19:00h', intensity: null,
  });
  const card = cardOf(page, 'Partido vs Sagunt', 'Sábado 17/10/26');
  await expect(card).toHaveClass(/att-event--match/);
  await expect(card.locator('.info > span').first()).toHaveText('Sábado 17/10/26 · CEM Mar Bella · 17:30 - 19:00h');
  expect(relevantErrors(errors)).toEqual([]);
});

test('creating an away match stores the typed place and shows ✈️ in its detail', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openPreset(page, 'Partido');
  await page.locator('#new-event-title').fill('Partido vs Sagunt');
  await page.locator('#new-event-date').fill('2026-10-17');
  await page.locator('#new-event-place').fill('Estadio Municipal de Sagunto');
  await saveButton(page).click();

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({
    type: 'match', place: 'Estadio Municipal de Sagunto',
    place_maps_url: mapsUrl('Estadio Municipal de Sagunto'), is_home: false,
    meet_time: '', start_time: '17:30h', end_time: '',
    when_text: 'Sábado 17/10/26 · Estadio Municipal de Sagunto · 17:30h',
  });
  await cardOf(page, 'Partido vs Sagunt', 'Sábado 17/10/26').click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Sagunt');
  await expect(page.locator('#att-detail-location')).toHaveText('✈️ Estadio Municipal de Sagunto');
  await expect(page.locator('#att-detail-location a')).toHaveAttribute('href', mapsUrl('Estadio Municipal de Sagunto'));
  await expect(page.locator('#att-detail-start')).toHaveText('17:30h');
  await expect(page.locator('#att-detail-meet')).toHaveText('—');
  expect(relevantErrors(errors)).toEqual([]);
});

test('creating a meeting: no RSVP buttons on its card and no attendance tracking', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await openPreset(page, 'Reunión');
  await page.locator('#new-event-title').fill('Asamblea de socias');
  await page.locator('#new-event-date').fill('2026-10-01');
  await page.locator('#new-event-time').fill('19:00');
  await saveButton(page).click();

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({
    type: 'meeting', label: 'Asamblea de socias', date: 1, month: 'Oct', iso: '2026-10-01',
    when_text: 'Jueves 01/10/26 · Sala del club · 19:00h',
    place: 'Sala del club', place_maps_url: mapsUrl('Sala del club'), is_home: false,
    meet_time: '', start_time: '19:00h', end_time: '', intensity: null,
  });
  const card = cardOf(page, 'Asamblea de socias', 'Jueves 01/10/26');
  await expect(card.locator('.info span')).toHaveText('Jueves 01/10/26 · Sala del club · 19:00h');
  await expect(card.locator('.actions')).toHaveCount(0);
  await expect(card.locator('.att-event-edit-btn')).toBeVisible();
  expect(writes(backend).filter((m) => m.table === 'att_attendance')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Editing events
// ---------------------------------------------------------------------------

test('editing a match from its detail pre-fills the modal and upserts the same id', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cardOf(page, 'Partido vs Cornellà', 'Sábado 03/10/26').click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await page.locator('#att-detail-edit-btn').click();
  await expect(eventModal(page)).toHaveClass(/active/);
  await expect(page.locator('#add-event-modal-title')).toHaveText('Editar evento');
  await expect(page.locator('#event-delete-btn')).toBeVisible();
  await expect(page.locator('#new-event-title')).toHaveValue('Partido vs Cornellà');
  await expect(page.locator('#new-event-title')).toHaveAttribute('placeholder', 'Partido vs CR Sagunt');
  await expect(page.locator('#new-event-date')).toHaveValue('2026-10-03');
  await expect(page.locator('#field-meet-time')).toBeVisible();
  await expect(page.locator('#new-event-meet-time')).toHaveValue('15:15');
  await expect(page.locator('#new-event-time')).toHaveValue('16:30');
  await expect(page.locator('#new-event-end-time')).toHaveValue('');
  await expect(page.locator('#field-place-label-text')).toHaveText('Lugar');
  await expect(page.locator('#new-event-place')).toHaveValue('Camp Municipal de Rugby La Bòbila');
  await expect(page.locator('#place-home-btn')).not.toHaveClass(/selected/);
  await expect(page.locator('#field-place-hint')).toBeVisible();
  await expect(page.locator('#field-intensity')).toBeHidden();
  // NOTE: the preview (and the saved link) use the place text as the Maps query, so the
  // original, more precise query stored in place_maps_url ("..., Cornellà de Llobregat")
  // is lost when the event is saved again.
  await expect(page.locator('#place-maps-preview a')).toHaveAttribute('href', mapsUrl('Camp Municipal de Rugby La Bòbila'));

  await page.locator('#new-event-title').fill('Partido vs Cornellà RC');
  await page.locator('#new-event-time').fill('17:00');
  await saveButton(page).click();
  await expect(eventModal(page)).not.toHaveClass(/active/);

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  const w = eventWrites(backend)[0];
  expect(w.method).toBe('UPSERT');
  expect(w.body).toEqual([{
    id: EVENT_IDS.matchAway, type: 'match', label: 'Partido vs Cornellà RC', date: 3, month: 'Oct', iso: '2026-10-03',
    when_text: 'Sábado 03/10/26 · Camp Municipal de Rugby La Bòbila · 17:00h',
    place: 'Camp Municipal de Rugby La Bòbila', place_maps_url: mapsUrl('Camp Municipal de Rugby La Bòbila'),
    is_home: false, meet_time: '15:15h', start_time: '17:00h', end_time: '', intensity: null,
  }]);
  // Attendance is untouched.
  expect(writes(backend).filter((m) => m.table === 'att_attendance')).toEqual([]);

  // The detail and the list are refreshed.
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Cornellà RC');
  await expect(page.locator('#att-detail-start')).toHaveText('17:00h');
  await expect(page.locator('#att-detail-meet')).toHaveText('15:15h');
  await goToSection(page, 'asistencia');
  await expect(cardOf(page, 'Partido vs Cornellà RC', 'Sábado 03/10/26')).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('cancelling the edit modal writes nothing', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cardOf(page, 'Partido vs Badalona', 'Sábado 10/10/26').click();
  await page.locator('#att-detail-edit-btn').click();
  // Home match: the Casa button is highlighted.
  await expect(page.locator('#place-home-btn')).toHaveClass(/selected/);
  await page.locator('#new-event-title').fill('Otro título');
  await eventModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(eventModal(page)).not.toHaveClass(/active/);
  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Badalona');
  expect(eventWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing a meeting from the pencil on its card', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cardOf(page, 'Reunión de equipo', 'Martes 29/09/26').locator('.att-event-edit-btn').click();
  await expect(eventModal(page)).toHaveClass(/active/);
  // The card itself does not navigate.
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  await expect(page.locator('#add-event-modal-title')).toHaveText('Editar evento');
  await expect(page.locator('#new-event-title')).toHaveValue('Reunión de equipo');
  await expect(page.locator('#new-event-date')).toHaveValue('2026-09-29');
  await expect(page.locator('#field-meet-time')).toBeHidden();
  await expect(page.locator('#field-start-time-label')).toHaveText('Hora (opcional)');
  await expect(page.locator('#new-event-time')).toHaveValue('21:00');
  await expect(page.locator('#new-event-end-time')).toHaveValue('22:00');
  await expect(page.locator('#new-event-place')).toHaveValue('Local del club');
  await page.locator('#new-event-date').fill('2026-09-30');
  await saveButton(page).click();

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  // NOTE: the seeded meeting had no Maps link; saving it again adds one built from the place.
  expect(eventWrites(backend)[0].body).toEqual([{
    id: EVENT_IDS.meeting, type: 'meeting', label: 'Reunión de equipo', date: 30, month: 'Sep', iso: '2026-09-30',
    when_text: 'Miércoles 30/09/26 · Local del club · 21:00 - 22:00h',
    place: 'Local del club', place_maps_url: mapsUrl('Local del club'), is_home: true,
    meet_time: '', start_time: '21:00h', end_time: '22:00h', intensity: null,
  }]);
  await expect(cardOf(page, 'Reunión de equipo', 'Miércoles 30/09/26')).toHaveCount(1);
  await expect(cardOf(page, 'Reunión de equipo', 'Martes 29/09/26')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('editing an auto-generated training stores it in att_events with its intensity', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cardOf(page, 'Entreno', 'Lunes 28/09/26').click();
  await expect(page.locator('#att-detail-intensity-badge')).toHaveText('');
  await page.locator('#att-detail-edit-btn').click();
  await expect(page.locator('#new-event-title')).toHaveValue('Entreno');
  await expect(page.locator('#field-meet-time')).toBeHidden();
  await expect(page.locator('#new-event-time')).toHaveValue('20:30');
  await expect(page.locator('#new-event-end-time')).toHaveValue('22:00');
  await expect(page.locator('#place-home-btn')).toHaveClass(/selected/);
  await expect(page.locator('#field-intensity')).toBeVisible();
  await expect(eventModal(page).locator('.intensity-picker button.selected')).toHaveCount(0);
  await page.locator('#intensity-btn-medium').click();
  await saveButton(page).click();

  await expect.poll(() => eventWrites(backend).length).toBe(1);
  // NOTE: auto trainings have a 20:15h convocatoria, but trainings hide that field and
  // saving blanks it (meet_time ''); the Maps query also shrinks to the place text.
  expect(eventWrites(backend)[0].body).toEqual([{
    id: 'auto-2026-09-28', type: 'training', label: 'Entreno', date: 28, month: 'Sep', iso: '2026-09-28',
    when_text: 'Lunes 28/09/26 · CEM Mar Bella · 20:30 - 22:00h',
    place: 'CEM Mar Bella', place_maps_url: mapsUrl('CEM Mar Bella'), is_home: true,
    meet_time: '', start_time: '20:30h', end_time: '22:00h', intensity: 'medium',
  }]);
  await expect(page.locator('#att-detail-intensity-badge')).toHaveText('💪');
  await expect(page.locator('#att-detail-intensity-badge')).toHaveClass(/show/);
  await goToSection(page, 'asistencia');
  await expect(cardOf(page, 'Entreno', 'Lunes 28/09/26').locator('.att-event-intensity')).toHaveText('💪');

  // Re-opening the edit modal shows the stored intensity selected.
  await cardOf(page, 'Entreno', 'Lunes 28/09/26').click();
  await page.locator('#att-detail-edit-btn').click();
  await expect(eventModal(page).locator('.intensity-picker button.selected')).toHaveText(['💪']);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Deleting events
// ---------------------------------------------------------------------------

test('deleting an event from the edit modal asks first, then removes it and its data', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await cardOf(page, 'Partido vs Cornellà', 'Sábado 03/10/26').click();
  await page.locator('#att-detail-edit-btn').click();
  await page.locator('#event-delete-btn').click();
  const confirm = deleteModal(page);
  await expect(confirm).toHaveClass(/active/);
  await expect(confirm.locator('h3')).toHaveText('Eliminar evento');
  await expect(confirm.locator('.modal-sub')).toHaveText('¿Seguro que quieres eliminar este evento? Esta acción no se puede deshacer.');

  await confirm.getByRole('button', { name: 'No' }).click();
  await expect(confirm).not.toHaveClass(/active/);
  await expect(eventModal(page)).toHaveClass(/active/);
  expect(writes(backend)).toEqual([]);

  await page.locator('#event-delete-btn').click();
  await confirm.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(confirm).not.toHaveClass(/active/);
  await expect(eventModal(page)).not.toHaveClass(/active/);
  // Back to the list, which no longer has the match.
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  await expect(cards(page).filter({ hasText: 'Partido vs Cornellà' })).toHaveCount(0);

  const id = EVENT_IDS.matchAway;
  await expect.poll(() => writes(backend).length).toBe(5);
  expect(writes(backend).map(({ method, table, filters }) => ({ method, table, filters }))).toEqual([
    { method: 'DELETE', table: 'att_events', filters: [['id', `eq.${id}`]] },
    { method: 'DELETE', table: 'att_attendance', filters: [['event_id', `eq.${id}`]] },
    // No acta for this match, so no match_report_cards delete.
    { method: 'DELETE', table: 'match_report_players', filters: [['match_id', `eq.${id}`]] },
    { method: 'DELETE', table: 'match_reports', filters: [['id', `eq.${id}`]] },
    { method: 'DELETE', table: 'match_injuries', filters: [['event_id', `eq.${id}`]] },
  ]);
  expect(backend.db.att_events.map((e) => e.id)).not.toContain(id);
  expect(backend.db.att_attendance.filter((a) => a.event_id === id)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Calendar modal
// ---------------------------------------------------------------------------

test('the calendar opens on August 2026 and navigates month by month across years', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openCalendar(page);
  const modal = calModal(page);
  await expect(modal.locator('.cal-modal-head h3')).toHaveText('Calendario');
  await expect(modal.locator('.cal-weekdays span')).toHaveText(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  // NOTE: the calendar always starts on August 2026 (hardcoded), not on the current month.
  await expect(page.locator('#cal-month-label')).toHaveText('agosto 2026');
  // 1 Aug 2026 is a Saturday: 5 blanks before it (weeks start on Monday).
  await expect(page.locator('#cal-grid .cal-day.empty')).toHaveCount(5);
  await expect(calDays(page)).toHaveCount(31);
  await expect(page.locator('#cal-grid .cal-chip')).toHaveCount(0);

  const prev = modal.locator('.cal-nav-btn', { hasText: '‹' });
  const next = modal.locator('.cal-nav-btn', { hasText: '›' });
  await prev.click();
  await expect(page.locator('#cal-month-label')).toHaveText('julio 2026');
  await next.click();
  await next.click();
  await expect(page.locator('#cal-month-label')).toHaveText('septiembre 2026');
  await expect(page.locator('#cal-grid .cal-day.empty')).toHaveCount(1);
  await expect(calDays(page)).toHaveCount(30);
  for (let i = 0; i < 4; i++) await next.click();
  await expect(page.locator('#cal-month-label')).toHaveText('enero 2027');
  await prev.click();
  await expect(page.locator('#cal-month-label')).toHaveText('diciembre 2026');

  // The month is kept when the modal is closed and opened again.
  await modal.locator('.modal-close').click();
  await expect(modal).not.toHaveClass(/active/);
  await openCalendar(page);
  await expect(page.locator('#cal-month-label')).toHaveText('diciembre 2026');
  expect(relevantErrors(errors)).toEqual([]);
});

test('September shows trainings, matches, the meeting, a birthday and marks today', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  const chips = page.locator('#cal-grid .cal-chip');
  await expect(chips).toHaveCount(17);
  await expect(page.locator('#cal-grid .cal-chip.t-training')).toHaveCount(12);
  await expect(page.locator('#cal-grid .cal-chip.t-match')).toHaveText(['Partido', 'Partido', 'Partido']);
  await expect(page.locator('#cal-grid .cal-chip.t-plan')).toHaveText(['Reunión de equipo']);
  await expect(page.locator('#cal-grid .cal-chip.t-birthday')).toHaveText(['Tanke']);

  const trainingDays = [2, 4, 7, 9, 14, 16, 18, 21, 23, 25, 28, 30];
  for (const d of trainingDays) await expect(calDay(page, d).locator('.cal-chip')).toHaveText(['Entreno']);
  // 11 Sep (Diada) and 24 Sep (La Mercè) are holidays: no training.
  await expect(calDay(page, 11).locator('.cal-chip')).toHaveCount(0);
  await expect(calDay(page, 24).locator('.cal-chip')).toHaveCount(0);
  for (const d of [12, 19, 26]) await expect(calDay(page, d).locator('.cal-chip')).toHaveText(['Partido']);
  await expect(calDay(page, 29).locator('.cal-chip')).toHaveText(['Reunión de equipo']);
  await expect(calDay(page, 5).locator('.cal-chip')).toHaveText(['Tanke']);

  // NOTE: "today" is computed with toISOString() (UTC), unlike the rest of the app (local
  // date); between 00:00 and 02:00 Madrid time it would mark the previous day.
  await expect(page.locator('#cal-grid .cal-day.today')).toHaveCount(1);
  await expect(page.locator('#cal-grid .cal-day.today .num')).toHaveText('25');

  // October: the two seeded matches plus trainings; 12 Oct is a holiday.
  await calModal(page).locator('.cal-nav-btn', { hasText: '›' }).click();
  await expect(page.locator('#cal-month-label')).toHaveText('octubre 2026');
  await expect(calDay(page, 3).locator('.cal-chip')).toHaveText(['Partido']);
  await expect(calDay(page, 10).locator('.cal-chip')).toHaveText(['Partido']);
  await expect(calDay(page, 12).locator('.cal-chip')).toHaveCount(0);
  await expect(page.locator('#cal-grid .cal-day.today')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('birthdays come from the profiles birth dates every year, including the logged-in user', async ({ page }) => {
  const { errors } = await openAsistencia(page, { user: USERS.player });
  await openCalendar(page);
  const next = calModal(page).locator('.cal-nav-btn', { hasText: '›' });
  const prev = calModal(page).locator('.cal-nav-btn', { hasText: '‹' });
  // November: Rovi (02/11); December: Núria (09/12, fisio); January 2027: Paula (30/01).
  for (let i = 0; i < 3; i++) await next.click();
  await expect(page.locator('#cal-month-label')).toHaveText('noviembre 2026');
  await expect(calDay(page, 2).locator('.cal-chip.t-birthday')).toHaveText('Rovi');
  await next.click();
  await expect(calDay(page, 9).locator('.cal-chip.t-birthday')).toHaveText('Núria');
  await next.click();
  await expect(page.locator('#cal-month-label')).toHaveText('enero 2027');
  await expect(calDay(page, 30).locator('.cal-chip.t-birthday')).toHaveText('Paula');
  // Back to April 2026: the player's own birthday (12/04) with her nickname.
  for (let i = 0; i < 9; i++) await prev.click();
  await expect(page.locator('#cal-month-label')).toHaveText('abril 2026');
  await expect(page.locator('#cal-grid .cal-chip')).toHaveText(['Juls']);
  await expect(calDay(page, 12).locator('.cal-chip')).toHaveText(['Juls']);
  // March 2026: the admin (14/03) is hidden from the roster, so no birthday.
  await prev.click();
  await expect(page.locator('#cal-month-label')).toHaveText('marzo 2026');
  await expect(page.locator('#cal-grid .cal-chip')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('calendar filters hide each kind of chip and are dimmed while off', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  const sidebar = page.locator('#cal-sidebar');
  await expect(sidebar).not.toHaveClass(/open/);
  await page.locator('#cal-hamburger').click();
  await expect(sidebar).toHaveClass(/open/);
  await expect(page.locator('#cal-hamburger')).toHaveClass(/active/);
  await expect(sidebar.locator('.cal-filter-label')).toHaveText('Ver');
  await expect(sidebar.locator('.cal-filter-item')).toHaveText(['Entrenos', 'Partidos', 'Cumpleaños', 'Planes']);

  const chips = page.locator('#cal-grid .cal-chip');
  await page.locator('#cal-filter-training input').uncheck();
  await expect(page.locator('#cal-filter-training')).toHaveClass(/dim/);
  await expect(chips).toHaveCount(5);
  await expect(page.locator('#cal-grid .cal-chip.t-training')).toHaveCount(0);

  await page.locator('#cal-filter-match input').uncheck();
  await expect(chips).toHaveText(['Tanke', 'Reunión de equipo']);
  await page.locator('#cal-filter-birthday input').uncheck();
  await expect(chips).toHaveText(['Reunión de equipo']);
  await page.locator('#cal-filter-plan input').uncheck();
  await expect(chips).toHaveCount(0);
  await expect(sidebar.locator('.cal-filter-item.dim')).toHaveCount(4);

  await page.locator('#cal-filter-match input').check();
  await expect(page.locator('#cal-filter-match')).not.toHaveClass(/dim/);
  await expect(chips).toHaveText(['Partido', 'Partido', 'Partido']);

  // Filters survive closing the modal; reopening closes the sidebar.
  await calModal(page).locator('.modal-close').click();
  await openCalendar(page);
  await expect(sidebar).not.toHaveClass(/open/);
  await expect(page.locator('#cal-hamburger')).not.toHaveClass(/active/);
  await expect(chips).toHaveText(['Partido', 'Partido', 'Partido']);

  // The calendar filters do not affect the Asistencia list.
  await calModal(page).locator('.modal-close').click();
  await expect(cardOf(page, 'Entreno', 'Lunes 28/09/26')).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('clicking outside the calendar box closes it', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await openCalendar(page);
  await calModal(page).click({ position: { x: 5, y: 5 } });
  await expect(calModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Event popover
// ---------------------------------------------------------------------------

test('the popover of a match shows date, type, place link and kick-off', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  await calDay(page, 26).locator('.cal-chip').click();
  const pop = popover(page);
  await expect(pop).toHaveClass(/active/);
  await expect(page.locator('#eventpop-date')).toHaveText('Sábado 26 de septiembre');
  await expect(page.locator('#eventpop-type')).toHaveText('Partido');
  await expect(page.locator('#eventpop-type')).toHaveClass('eventpop-type t-match');
  await expect(page.locator('#eventpop-title')).toHaveText('Partido vs Santboi');
  const lines = page.locator('#eventpop-meta .eventpop-meta-line');
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toHaveText('📍 CEM Mar Bella');
  await expect(lines.nth(0).locator('a')).toHaveAttribute('href', HOME_MAPS);
  await expect(lines.nth(1).locator('span')).toHaveText(['🏁 KO 17:30h']);
  await expect(page.locator('#eventpop-actions')).toBeVisible();
  await expect(page.locator('#eventpop-actions button')).toHaveText(['Editar', 'Eliminar']);

  await pop.getByRole('button', { name: 'Cerrar' }).click();
  await expect(pop).not.toHaveClass(/active/);
  // The calendar stays open underneath.
  await expect(calModal(page)).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('popovers of a training, the meeting and a birthday', async ({ page }) => {
  const { errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  const pop = popover(page);
  const lines = page.locator('#eventpop-meta .eventpop-meta-line');

  await calDay(page, 25).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-date')).toHaveText('Viernes 25 de septiembre');
  await expect(page.locator('#eventpop-type')).toHaveText('Entreno');
  await expect(page.locator('#eventpop-type')).toHaveClass('eventpop-type t-training');
  await expect(page.locator('#eventpop-title')).toHaveText('Entreno');
  await expect(lines.nth(0)).toHaveText('📍 CEM Mar Bella');
  await expect(lines.nth(1).locator('span')).toHaveText(['⏰ Convo 20:15h', '🏁 KO 20:30h']);
  // Clicking the overlay closes it.
  await pop.click({ position: { x: 5, y: 5 } });
  await expect(pop).not.toHaveClass(/active/);

  await calDay(page, 29).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-date')).toHaveText('Martes 29 de septiembre');
  await expect(page.locator('#eventpop-type')).toHaveText('Plan');
  await expect(page.locator('#eventpop-type')).toHaveClass('eventpop-type t-plan');
  await expect(page.locator('#eventpop-title')).toHaveText('Reunión de equipo');
  // No Maps URL stored: plain text, no link.
  await expect(lines.nth(0)).toHaveText('📍 Local del club');
  await expect(lines.nth(0).locator('a')).toHaveCount(0);
  await expect(lines.nth(1).locator('span')).toHaveText(['🏁 KO 21:00h']);
  await expect(page.locator('#eventpop-actions')).toBeVisible();
  await pop.getByRole('button', { name: 'Cerrar' }).click();

  await calDay(page, 5).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-date')).toHaveText('Sábado 5 de septiembre');
  await expect(page.locator('#eventpop-type')).toHaveText('Cumpleaños');
  await expect(page.locator('#eventpop-type')).toHaveClass('eventpop-type t-birthday');
  await expect(page.locator('#eventpop-title')).toHaveText('Tanke');
  await expect(page.locator('#eventpop-meta')).toBeEmpty();
  // Birthdays cannot be edited or deleted.
  await expect(page.locator('#eventpop-actions')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('Editar in the popover opens the edit modal; saving refreshes the calendar', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  await calDay(page, 29).locator('.cal-chip').click();
  await popover(page).getByRole('button', { name: 'Editar' }).click();
  await expect(popover(page)).not.toHaveClass(/active/);
  await expect(eventModal(page)).toHaveClass(/active/);
  await expect(page.locator('#add-event-modal-title')).toHaveText('Editar evento');
  await expect(page.locator('#new-event-title')).toHaveValue('Reunión de equipo');
  await page.locator('#new-event-title').fill('Reunión de técnicas');
  await saveButton(page).click();
  await expect(eventModal(page)).not.toHaveClass(/active/);
  await expect(calModal(page)).toHaveClass(/active/);
  await expect(calDay(page, 29).locator('.cal-chip')).toHaveText(['Reunión de técnicas']);
  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({ id: EVENT_IDS.meeting, label: 'Reunión de técnicas' });
  expect(relevantErrors(errors)).toEqual([]);
});

test('Eliminar in the popover deletes a past match together with its acta', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  await calDay(page, 19).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-title')).toHaveText('Partido vs Gòtics');
  await popover(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(popover(page)).not.toHaveClass(/active/);
  await expect(deleteModal(page)).toHaveClass(/active/);
  await deleteModal(page).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(deleteModal(page)).not.toHaveClass(/active/);
  await expect(calDay(page, 19).locator('.cal-chip')).toHaveCount(0);

  const id = EVENT_IDS.matchPast2;
  await expect.poll(() => writes(backend).length).toBe(6);
  const summary = writes(backend).map(({ method, table, filters }) => ({ method, table, filters }));
  const playerIds = seed.match_report_players.filter((p) => p.match_id === id).map((p) => p.id);
  expect(summary).toEqual([
    { method: 'DELETE', table: 'att_events', filters: [['id', `eq.${id}`]] },
    { method: 'DELETE', table: 'att_attendance', filters: [['event_id', `eq.${id}`]] },
    { method: 'DELETE', table: 'match_report_cards', filters: [['match_report_player_id', `in.(${playerIds.join(',')})`]] },
    { method: 'DELETE', table: 'match_report_players', filters: [['match_id', `eq.${id}`]] },
    { method: 'DELETE', table: 'match_reports', filters: [['id', `eq.${id}`]] },
    { method: 'DELETE', table: 'match_injuries', filters: [['event_id', `eq.${id}`]] },
  ]);
  expect(backend.db.match_report_cards).toEqual([]);
  expect(backend.db.match_report_players).toEqual([]);
  expect(backend.db.match_reports).toEqual([]);

  // It is gone from the Asistencia history too.
  await calModal(page).locator('.modal-close').click();
  await page.locator('#att-event-list .att-history-toggle').click();
  await expect(page.locator('#att-history-toggle-label')).toHaveText('Ver futuros');
  await expect(cards(page).filter({ hasText: 'Partido vs Gòtics' })).toHaveCount(0);
  await expect(cards(page).filter({ hasText: 'Partido vs Tarragona' })).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the calendar + button opens the meeting preset and the new event shows up at once', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await calendarToSeptember(page);
  await calModal(page).getByRole('button', { name: 'Añadir evento' }).click();
  await expect(eventModal(page)).toHaveClass(/active/);
  await expect(page.locator('#add-event-modal-title')).toHaveText('Nueva reunión');
  await expect(page.locator('#new-event-place')).toHaveValue('Sala del club');
  await expect(page.locator('#event-delete-btn')).toBeHidden();
  await page.locator('#new-event-title').fill('Cena de equipo');
  await page.locator('#new-event-date').fill('2026-09-27');
  await page.locator('#new-event-place').fill('Restaurante La Barra');
  await saveButton(page).click();
  await expect(calModal(page)).toHaveClass(/active/);
  await expect(calDay(page, 27).locator('.cal-chip.t-plan')).toHaveText(['Cena de equipo']);
  await expect.poll(() => eventWrites(backend).length).toBe(1);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({
    type: 'meeting', label: 'Cena de equipo', iso: '2026-09-27', place: 'Restaurante La Barra',
    place_maps_url: mapsUrl('Restaurante La Barra'), is_home: false, start_time: '', end_time: '',
    when_text: 'Domingo 27/09/26 · Restaurante La Barra',
  });
  await calModal(page).locator('.modal-close').click();
  await expect(cardOf(page, 'Cena de equipo', 'Domingo 27/09/26')).toHaveCount(1);
  expect(relevantErrors(errors)).toEqual([]);
});

test('players can still add, edit and delete events from the calendar (no permission check)', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page, { user: USERS.player });
  await expect(addBtn(page)).toBeHidden();
  await calendarToSeptember(page);
  // NOTE: the calendar "+" button and the popover Editar/Eliminar buttons are shown to
  // everyone; only the Asistencia add button and pencils check canManageEvents().
  await calModal(page).getByRole('button', { name: 'Añadir evento' }).click();
  await expect(eventModal(page)).toHaveClass(/active/);
  await page.locator('#new-event-title').fill('Quedada playa');
  await page.locator('#new-event-date').fill('2026-09-27');
  await saveButton(page).click();
  await expect(calDay(page, 27).locator('.cal-chip')).toHaveText(['Quedada playa']);

  await calDay(page, 29).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-actions')).toBeVisible();
  await popover(page).getByRole('button', { name: 'Eliminar' }).click();
  await deleteModal(page).getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(calDay(page, 29).locator('.cal-chip')).toHaveCount(0);

  await expect.poll(() => eventWrites(backend).map((m) => m.method)).toEqual(['UPSERT', 'DELETE']);
  expect(eventWrites(backend)[0].body[0]).toMatchObject({ type: 'meeting', label: 'Quedada playa' });
  expect(eventWrites(backend)[1].filters).toEqual([['id', `eq.${EVENT_IDS.meeting}`]]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Shared events (att_events) and language
// ---------------------------------------------------------------------------

test('att_events rows override auto trainings and are reloaded when entering Asistencia', async ({ page }) => {
  const customSeed = structuredClone(seed);
  customSeed.att_events.push({
    id: 'auto-2026-09-28', type: 'training', label: 'Entreno táctico', date: 28, month: 'Sep', iso: '2026-09-28',
    when_text: 'x', place: 'CEM Mar Bella', place_maps_url: HOME_MAPS, is_home: true,
    meet_time: '', start_time: '19:00h', end_time: '20:30h', intensity: 'low',
  });
  const { backend, errors } = await openAsistencia(page, { seed: customSeed });
  const tactico = cardOf(page, 'Entreno táctico', 'Lunes 28/09/26');
  await expect(tactico.locator('.info b')).toHaveText('Entreno táctico ✨');
  await expect(tactico.locator('.info > span').first()).toHaveText('Lunes 28/09/26 · CEM Mar Bella · 19:00 - 20:30h');
  await expect(cardOf(page, 'Entreno', 'Lunes 28/09/26')).toHaveCount(1);

  // Someone else creates a match meanwhile: it shows up when coming back to Asistencia.
  backend.db.att_events.push({
    id: 'ce-other-device', type: 'match', label: 'Partido vs Sant Cugat', date: 24, month: 'Oct', iso: '2026-10-24',
    when_text: 'x', place: 'ZEM Sant Cugat', place_maps_url: mapsUrl('ZEM Sant Cugat'), is_home: false,
    meet_time: '15:00h', start_time: '16:00h', end_time: '', intensity: null,
  });
  await expect(cards(page).filter({ hasText: 'Partido vs Sant Cugat' })).toHaveCount(0);
  await goToSection(page, 'inicio');
  await goToSection(page, 'asistencia');
  await expect(cardOf(page, 'Partido vs Sant Cugat', 'Sábado 24/10/26')).toHaveCount(1);
  await openCalendar(page);
  for (let i = 0; i < 2; i++) await calModal(page).locator('.cal-nav-btn', { hasText: '›' }).click();
  await expect(calDay(page, 24).locator('.cal-chip')).toHaveText(['Partido']);
  expect(eventWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('in Catalan the presets, the calendar and the popover are translated', async ({ page }) => {
  const { backend, errors } = await openAsistencia(page);
  await page.evaluate(() => window.setLang('ca'));
  await addBtn(page).click();
  await typeModal(page).locator('.att-type-option').first().click();
  await expect(page.locator('#add-event-modal-title')).toHaveText('Nou entrenament');
  await expect(page.locator('#new-event-title')).toHaveValue('Entrenament');
  await expect(page.locator('#field-start-time-label')).toHaveText('Inici');
  await expect(page.locator('#field-place-label-text')).toHaveText('Lloc (opcional)');
  await expect(page.locator('#place-maps-preview a')).toHaveText('📍 Veure "CEM Mar Bella, Av. del Litoral, Barcelona" a Google Maps');
  await expect(page.locator('#new-event-place')).toHaveAttribute('placeholder', 'Sala del club');
  await page.locator('#new-event-date').fill('2026-10-08');
  await eventModal(page).locator('.modal-actions .btn').click();
  await expect.poll(() => eventWrites(backend).length).toBe(1);
  // NOTE: the stored label and when_text follow the active language (the training preset
  // title is a translated string), so the same kind of event is saved differently per language.
  expect(eventWrites(backend)[0].body[0]).toMatchObject({ label: 'Entrenament', month: 'Oct', when_text: 'Dijous 08/10/26 · CEM Mar Bella · 20:30 - 22:00h' });

  await page.locator('#sec-asistencia .cal-open-btn').nth(1).click();
  await expect(calModal(page)).toHaveClass(/active/);
  await calModal(page).locator('.cal-nav-btn').nth(1).click();
  await expect(page.locator('#cal-month-label')).toHaveText('setembre 2026');
  await expect(calDay(page, 26).locator('.cal-chip')).toHaveText(['Partit']);
  await calDay(page, 26).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-date')).toHaveText('Dissabte 26 de setembre');
  await expect(page.locator('#eventpop-type')).toHaveText('Partit');
  await popover(page).locator('.eventpop-close').click();
  await calDay(page, 5).locator('.cal-chip').click();
  await expect(page.locator('#eventpop-type')).toHaveText('Aniversari');
  expect(relevantErrors(errors)).toEqual([]);
});
