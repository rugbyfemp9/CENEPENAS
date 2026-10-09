// Characterization tests for everything around matches: the "Próximo partido" banner
// on Inicio (and its match-day actions "Recuerda" = personal checklist and "Lista" =
// roll call), Vestuario → Partidos (list + match detail), the match report ("acta":
// view, manual builder, PDF upload through the Edge Function
// process-match-report-pdf, delete) and "Tullidas" (bandage list per match).
//
// Seed scenario (clock: Fri 2026-09-25 10:00): matches on 12/09 and 19/09 (past, the
// 19th has an acta), ce1 "Partido vs Santboi" tomorrow 26/09 (hardcoded in main.js),
// away match 03/10 (Cornellà) and home match 10/10 (Badalona). The player has not
// answered ce1. "Game day" needs a match today: the tests override ce1 with an
// att_events row dated today (shared events are merged over the hardcoded one).
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, relevantErrors, NOW } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

// openApp + wait until the session is restored (the login overlay is gone), so a slow
// startup on a busy machine does not leave the overlay on top of the page.
async function openAppReady(page) {
  await openApp(page);
  await expect(page.locator('#auth-overlay')).toBeHidden({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Carla Font: jugadora, Comi Tesoreria (can reopen a saved roll call).
const CARLA = authUser(IDS.carla, 'carla@cnpenas.test');
// Marta Rovira "Rovi": Capitana, has no checklist rows in the seed.
const MARTA = authUser(IDS.marta, 'marta@cnpenas.test');

const clone = (v) => JSON.parse(JSON.stringify(v));
const restWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest');
const writesTo = (backend, table) => restWrites(backend).filter((m) => m.table === table);

// ce1 moved to today (Friday 25/09) so the banner switches to "game day".
function gameDaySeed(mutate = (s) => s) {
  const s = clone(seed);
  s.att_events.push({
    id: EVENT_IDS.matchNext, type: 'match', label: 'Partido vs Santboi', date: 25, month: 'Sep', iso: '2026-09-25',
    when_text: 'Viernes 25/09/26 · CEM Mar Bella · 17:30h', place: 'CEM Mar Bella', place_maps_url: '',
    is_home: true, meet_time: '16:30h', start_time: '17:30h', end_time: '', intensity: null,
  });
  return mutate(s) || s;
}

const banner = (page) => page.locator('#next-match-banner');

// ---------------------------------------------------------------------------
// "Próximo partido" banner (Inicio)
// ---------------------------------------------------------------------------

test('banner shows the next match with a "Confirmar" call to action when the player has not answered', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);

  await expect(page.locator('#next-match-title')).toHaveText('Próximo partido');
  await expect(page.locator('#next-match-title')).not.toHaveClass(/game-day/);
  await expect(page.locator('#next-match-subtitle')).toHaveText('Partido vs Santboi · Sábado 26/09/26 · CEM Mar Bella · 17:30h');
  // NOTE: 4 people already said "yes" to ce1 in att_attendance, but the banner only
  // counts answers already loaded in memory (the player's own + events whose detail
  // was opened), so right after startup it shows 0.
  await expect(page.locator('#next-match-confirmed')).toHaveText('0');
  await expect(page.locator('#next-match-chips')).toBeVisible();
  await expect(page.locator('#next-match-cta')).toBeVisible();
  await expect(page.locator('#next-match-cta')).toHaveText('Confirmar');
  await expect(page.locator('#next-match-status')).toBeHidden();
  await expect(page.locator('#game-day-actions')).toBeHidden();
  await expect(page.locator('#next-match-tullides-btn')).toBeVisible();

  // The CTA opens the match in Asistencia.
  await page.locator('#next-match-cta').click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Santboi');
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('clicking the banner opens the match; confirming there updates the banner count and status', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);

  await banner(page).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-title')).toHaveText('Partido vs Santboi');
  await expect(page.locator('#att-count-yes')).toHaveText('4');

  await page.locator('#att-detail-confirm-btn').click();
  await expect(page.locator('#att-count-yes')).toHaveText('5');
  await expect.poll(() => writesTo(backend, 'att_attendance').length).toBe(1);
  expect(writesTo(backend, 'att_attendance')[0]).toMatchObject({
    method: 'UPSERT', body: [{ event_id: 'ce1', user_id: IDS.player, status: 'yes', comment: '' }],
  });

  await goToSection(page, 'inicio');
  // Now the attendance of the whole team is in memory: me + Rovi, Carla, Paula, Jordi.
  await expect(page.locator('#next-match-confirmed')).toHaveText('5');
  await expect(page.locator('#next-match-cta')).toBeHidden();
  await expect(page.locator('#next-match-status')).toBeVisible();
  await expect(page.locator('#next-match-status')).toHaveText('Confirmada');
  await expect(page.locator('#next-match-status')).toHaveClass('scoreboard-status ok');
  expect(relevantErrors(errors)).toEqual([]);
});

test('banner shows "Confirmada" / "Rechazada" from the stored answer of the player', async ({ page }) => {
  const s = clone(seed);
  s.att_attendance.push({ event_id: 'ce1', user_id: IDS.player, status: 'no', comment: 'Tengo una boda', updated_at: '2026-09-24T10:00:00Z' });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);

  await expect(page.locator('#next-match-status')).toBeVisible();
  await expect(page.locator('#next-match-status')).toHaveText('Rechazada');
  await expect(page.locator('#next-match-status')).toHaveClass('scoreboard-status bad');
  await expect(page.locator('#next-match-cta')).toBeHidden();
  await expect(page.locator('#next-match-confirmed')).toHaveText('0');
  expect(relevantErrors(errors)).toEqual([]);
});

test('banner shows "Confirmada" and counts the player when she already said yes', async ({ page }) => {
  const s = clone(seed);
  s.att_attendance.push({ event_id: 'ce1', user_id: IDS.player, status: 'yes', comment: '', updated_at: '2026-09-24T10:00:00Z' });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);

  await expect(page.locator('#next-match-status')).toHaveText('Confirmada');
  await expect(page.locator('#next-match-status')).toHaveClass('scoreboard-status ok');
  await expect(page.locator('#next-match-confirmed')).toHaveText('1');
  await expect(page.locator('#next-match-cta')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('banner shows "En duda" (not counted as confirmed) when the player is unsure', async ({ page }) => {
  const s = clone(seed);
  s.att_attendance.push({ event_id: 'ce1', user_id: IDS.player, status: 'maybe', comment: 'Depende del trabajo', updated_at: '2026-09-24T10:00:00Z' });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);

  await expect(page.locator('#next-match-status')).toHaveText('En duda');
  await expect(page.locator('#next-match-status')).toHaveClass('scoreboard-status warn');
  await expect(page.locator('#next-match-confirmed')).toHaveText('0');
  await expect(page.locator('#next-match-cta')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('without upcoming matches the banner shows the empty message and no actions', async ({ page }) => {
  const s = clone(seed);
  s.att_events = s.att_events.filter((e) => e.iso < '2026-09-25');
  // The hardcoded ce1 is moved to the past through a shared att_events row.
  s.att_events.push({
    id: 'ce1', type: 'match', label: 'Partido vs Santboi', date: 20, month: 'Sep', iso: '2026-09-20',
    when_text: '', place: 'CEM Mar Bella', place_maps_url: '', is_home: true, meet_time: '', start_time: '17:30h', end_time: '', intensity: null,
  });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);

  await expect(page.locator('#next-match-title')).toHaveText('Próximo partido');
  await expect(page.locator('#next-match-subtitle')).toHaveText('Todavía no hay ningún partido programado');
  await expect(page.locator('#next-match-confirmed')).toHaveText('—');
  await expect(page.locator('#next-match-cta')).toBeHidden();
  await expect(page.locator('#next-match-status')).toBeHidden();
  await expect(page.locator('#game-day-actions')).toBeHidden();
  await expect(page.locator('#next-match-tullides-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('on game day the banner shows the match itself with the "Recuerda" and "Lista" actions', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: gameDaySeed() });
  await openAppReady(page);

  await expect(page.locator('#next-match-title')).toHaveText('Partido vs Santboi');
  await expect(page.locator('#next-match-title')).toHaveClass(/game-day/);
  // NOTE: on game day the subtitle is the stored when_text as is (not recomputed from
  // the event data like everywhere else), so it does not follow the language.
  await expect(page.locator('#next-match-subtitle')).toHaveText('Viernes 25/09/26 · CEM Mar Bella · 17:30h');
  await expect(page.locator('#next-match-chips')).toBeHidden();
  await expect(page.locator('#next-match-cta')).toBeHidden();
  await expect(page.locator('#next-match-status')).toBeHidden();
  const actions = page.locator('#game-day-actions');
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button')).toHaveText(['Recuerda', 'Lista']);
  await expect(page.locator('#next-match-tullides-btn')).toBeVisible();

  await page.evaluate(() => window.setLang('ca'));
  await expect(actions.getByRole('button')).toHaveText(['Recorda', 'Llista']);
  await expect(page.locator('#next-match-title')).toHaveText('Partido vs Santboi');
  await expect(page.locator('#next-match-subtitle')).toHaveText('Viernes 25/09/26 · CEM Mar Bella · 17:30h');
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// "Recuerda": personal matchday checklist
// ---------------------------------------------------------------------------

const checklistModal = (page) => page.locator('#matchday-checklist-modal');
const checklistItems = (page) => page.locator('#matchday-checklist-list .shopping-item');

async function openChecklist(page) {
  await page.locator('#game-day-actions').getByRole('button', { name: 'Recuerda' }).click();
  await expect(checklistModal(page)).toHaveClass(/active/);
  await expect(page.locator('#matchday-checklist-list .shopping-item-add')).toBeVisible();
}

test('opening "Recuerda" for a new match unchecks every item once and remembers the match', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: gameDaySeed() });
  await openAppReady(page);
  await openChecklist(page);

  await expect(checklistModal(page).locator('h3')).toHaveText('Qué llevar al partido');
  await expect(checklistModal(page).locator('.modal-sub')).toHaveText('Márcalo con la casilla cuando ya lo tengas listo');
  await expect(checklistItems(page).locator('.shopping-item-label')).toHaveText(['Botes tacos', 'Bucal', 'Toalla', 'Hawaiana']);
  // "Botes tacos" was checked for the previous match (last_match_id = 19/09).
  await expect(checklistItems(page).locator('input[type=checkbox]:checked')).toHaveCount(0);
  await expect(checklistItems(page).filter({ hasText: 'Botes tacos' })).not.toHaveClass(/checked/);
  await expect(page.locator('#matchday-checklist-input')).toHaveAttribute('placeholder', 'Añadir algo más…');

  expect(restWrites(backend)).toEqual([
    { kind: 'rest', method: 'UPDATE', table: 'matchday_checklist_items', filters: [['owner_id', `eq.${IDS.player}`]], body: { checked: false } },
    expect.objectContaining({ method: 'UPSERT', table: 'matchday_checklist_state', body: [{ owner_id: IDS.player, last_match_id: 'ce1' }] }),
  ]);

  await checklistModal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(checklistModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Recuerda" keeps the checks when the list was already reset for this match', async ({ page }) => {
  const s = gameDaySeed((x) => { x.matchday_checklist_state.find((r) => r.owner_id === IDS.player).last_match_id = 'ce1'; });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await openChecklist(page);

  await expect(checklistItems(page)).toHaveCount(4);
  await expect(checklistItems(page).nth(0)).toHaveClass(/checked/);
  await expect(checklistItems(page).nth(0).locator('input')).toBeChecked();
  await expect(checklistItems(page).nth(1).locator('input')).not.toBeChecked();
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Recuerda": check, add (button and Enter) and delete items, each saved to Supabase', async ({ page }) => {
  const s = gameDaySeed((x) => { x.matchday_checklist_state.find((r) => r.owner_id === IDS.player).last_match_id = 'ce1'; });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await openChecklist(page);
  const items = writesTo.bind(null, backend, 'matchday_checklist_items');

  // Toggle "Bucal"
  await checklistItems(page).filter({ hasText: 'Bucal' }).locator('input').check();
  await expect(checklistItems(page).filter({ hasText: 'Bucal' })).toHaveClass(/checked/);
  await expect.poll(() => items().length).toBe(1);
  expect(items()[0]).toMatchObject({ method: 'UPDATE', filters: [['id', 'eq.e1000000-0000-4000-8000-000000000002']], body: { checked: true } });

  // Empty input: nothing happens
  await page.locator('#matchday-checklist-list .shopping-item-add button').click();
  await expect(checklistItems(page)).toHaveCount(4);

  // Add with Enter and with "+"
  await page.locator('#matchday-checklist-input').fill('  Crema solar  ');
  await page.locator('#matchday-checklist-input').press('Enter');
  await expect(checklistItems(page).locator('.shopping-item-label')).toHaveText(['Botes tacos', 'Bucal', 'Toalla', 'Hawaiana', 'Crema solar']);
  await page.locator('#matchday-checklist-input').fill('Gorra');
  await page.locator('#matchday-checklist-list .shopping-item-add button').click();
  await expect(checklistItems(page).locator('.shopping-item-label')).toHaveText(['Botes tacos', 'Bucal', 'Toalla', 'Hawaiana', 'Crema solar', 'Gorra']);
  await expect(page.locator('#matchday-checklist-input')).toHaveValue('');
  expect(items().filter((m) => m.method === 'INSERT').map((m) => m.body)).toEqual([
    [{ owner_id: IDS.player, label: 'Crema solar', checked: false }],
    [{ owner_id: IDS.player, label: 'Gorra', checked: false }],
  ]);

  // Delete "Toalla"
  await checklistItems(page).filter({ hasText: 'Toalla' }).getByRole('button', { name: 'Eliminar' }).click();
  await expect(checklistItems(page).locator('.shopping-item-label')).toHaveText(['Botes tacos', 'Bucal', 'Hawaiana', 'Crema solar', 'Gorra']);
  await expect.poll(() => items().filter((m) => m.method === 'DELETE').length).toBe(1);
  expect(items().find((m) => m.method === 'DELETE').filters).toEqual([['id', 'eq.e1000000-0000-4000-8000-000000000003']]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Recuerda" creates the default list the first time a user opens it', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: MARTA, seed: gameDaySeed() });
  await openAppReady(page);
  await openChecklist(page);

  const defaults = ['Botes tacos', 'Mijetes', 'Hombreres', 'Pantalons equipció', 'Leggins o samarreta interior',
    'Roba Interior', 'Bucal', 'Sabo o coses per a la ducha', 'Roba pa cambiarse', 'Toalla', 'Hawaiana'];
  await expect(checklistItems(page).locator('.shopping-item-label')).toHaveText(defaults);
  await expect(checklistItems(page).locator('input:checked')).toHaveCount(0);
  const inserts = writesTo(backend, 'matchday_checklist_items');
  expect(inserts).toHaveLength(1);
  expect(inserts[0].method).toBe('INSERT');
  expect(inserts[0].body).toEqual(defaults.map((label) => ({ owner_id: IDS.marta, label, checked: false })));
  // Nothing was checked, so no reset UPDATE, but the match is remembered.
  expect(writesTo(backend, 'matchday_checklist_state')).toEqual([
    expect.objectContaining({ method: 'UPSERT', body: [{ owner_id: IDS.marta, last_match_id: 'ce1' }] }),
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting every item shows the empty checklist message', async ({ page }) => {
  const s = gameDaySeed((x) => {
    x.matchday_checklist_items = x.matchday_checklist_items.filter((r) => r.owner_id !== IDS.player || r.label === 'Bucal');
    x.matchday_checklist_state.find((r) => r.owner_id === IDS.player).last_match_id = 'ce1';
  });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await openChecklist(page);
  await expect(checklistItems(page)).toHaveCount(1);
  await checklistItems(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#matchday-checklist-list .shopping-empty')).toHaveText('No hay nada en la lista. Añade lo que necesites llevar 👇');
  await expect(page.locator('#matchday-checklist-input')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// "Lista": roll call on game day
// ---------------------------------------------------------------------------

const rollcallModal = (page) => page.locator('#rollcall-modal');
const rollcallRows = (page) => page.locator('#rollcall-list .rollcall-row');

// Opens the match detail first (it loads everybody's answers), then "Lista".
async function openRollCallAfterDetail(page) {
  await banner(page).click();
  await expect(page.locator('#att-count-yes')).toHaveText(/\d+/);
  await expect(page.locator('#att-count-yes')).not.toHaveText('0');
  await goToSection(page, 'inicio');
  await page.locator('#game-day-actions').getByRole('button', { name: 'Lista' }).click();
  await expect(rollcallModal(page)).toHaveClass(/active/);
}

test('"Lista" only knows the confirmations already loaded in memory', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: gameDaySeed() });
  await openAppReady(page);
  await page.locator('#game-day-actions').getByRole('button', { name: 'Lista' }).click();
  await expect(rollcallModal(page)).toHaveClass(/active/);
  await expect(rollcallModal(page).locator('h3')).toHaveText('Pasar lista');
  // NOTE: 4 people confirmed ce1 in att_attendance, but opened straight from Inicio
  // the Lista is empty: other people's answers are only loaded by the event detail.
  await expect(page.locator('#rollcall-list .shopping-empty')).toHaveText('Todavía no hay ninguna jugadora confirmada para este partido.');
  await expect(page.locator('#rollcall-summary')).toHaveText('');
  await rollcallModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(rollcallModal(page)).not.toHaveClass(/active/);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Lista": marking players and saving fines the absent ones and stores the roll call', async ({ page }) => {
  const s = gameDaySeed((x) => {
    x.att_attendance.push({ event_id: 'ce1', user_id: IDS.player, status: 'yes', comment: '', updated_at: '2026-09-24T10:00:00Z' });
  });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await openRollCallAfterDetail(page);

  await expect(rollcallRows(page).locator('.meta b')).toHaveText(['Juls', 'Rovi', 'Carla', 'Paula', 'Jordi']);
  await expect(page.locator('#rollcall-summary')).toHaveText('0 de 5 marcadas');

  const row = (name) => rollcallRows(page).filter({ hasText: name });
  await row('Rovi').getByRole('button', { name: 'Presente' }).click();
  await row('Carla').getByRole('button', { name: 'Falta o llega tarde' }).click();
  await row('Jordi').getByRole('button', { name: 'Presente' }).click();
  await expect(page.locator('#rollcall-summary')).toHaveText('3 de 5 marcadas');
  await expect(row('Rovi').locator('button.v')).toHaveClass(/is-active/);
  await expect(row('Carla').locator('button.x')).toHaveClass(/is-active/);
  // Repeating a mark undoes it
  await row('Jordi').getByRole('button', { name: 'Presente' }).click();
  await expect(row('Jordi').locator('button.v')).not.toHaveClass(/is-active/);
  await expect(page.locator('#rollcall-summary')).toHaveText('2 de 5 marcadas');

  await rollcallModal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(rollcallModal(page)).not.toHaveClass(/active/);

  await expect.poll(() => writesTo(backend, 'matchday_rollcall').length).toBe(1);
  expect(writesTo(backend, 'fines')).toEqual([
    expect.objectContaining({ method: 'INSERT', body: [{ player_id: IDS.carla, reason_id: 'retraso', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-25' }] }),
  ]);
  const rc = writesTo(backend, 'matchday_rollcall')[0];
  expect(rc.method).toBe('UPSERT');
  expect(rc.body).toEqual([{
    match_id: 'ce1', marks: { [IDS.marta]: 'v', [IDS.carla]: 'x' },
    saved_at: NOW.toISOString(), updated_at: NOW.toISOString(),
  }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Lista" is locked for non-Tesoreria members once it has been saved', async ({ page }) => {
  const s = gameDaySeed((x) => {
    x.matchday_rollcall.push({ match_id: 'ce1', marks: { [IDS.carla]: 'x' }, saved_at: '2026-09-25T08:00:00Z', updated_at: '2026-09-25T08:00:00Z' });
  });
  const { backend, errors } = await setupApp(page, { user: USERS.player, seed: s });
  const msgs = [];
  page.on('dialog', (d) => msgs.push(d.message()));
  await openAppReady(page);
  await page.locator('#game-day-actions').getByRole('button', { name: 'Lista' }).click();

  await expect.poll(() => msgs).toEqual(['Esta lista ya se ha pasado y guardado. Solo Comi Tesoreria puede volver a abrirla para corregirla.']);
  await expect(rollcallModal(page)).not.toHaveClass(/active/);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Comi Tesoreria reopens a saved "Lista"; changing ✕ to ✓ removes the automatic fine and keeps saved_at', async ({ page }) => {
  const s = gameDaySeed((x) => {
    x.matchday_rollcall.push({ match_id: 'ce1', marks: { [IDS.marta]: 'x', [IDS.paula]: 'v' }, saved_at: '2026-09-25T08:00:00Z', updated_at: '2026-09-25T08:00:00Z' });
    x.fines.push({ id: 'f0000000-0000-4000-8000-000000000099', player_id: IDS.marta, reason_id: 'retraso', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-25', paid_at: null, created_at: '2026-09-25T08:00:00Z' });
  });
  const { backend, errors } = await setupApp(page, { user: CARLA, seed: s });
  await openAppReady(page);
  await openRollCallAfterDetail(page);

  // Carla herself is "me" (her own answer is 'yes' in the seed).
  await expect(rollcallRows(page).locator('.meta b')).toHaveText(['Carla', 'Rovi', 'Paula', 'Jordi']);
  const row = (name) => rollcallRows(page).filter({ hasText: name });
  await expect(row('Rovi').locator('button.x')).toHaveClass(/is-active/);
  await expect(row('Paula').locator('button.v')).toHaveClass(/is-active/);
  await expect(page.locator('#rollcall-summary')).toHaveText('2 de 4 marcadas');

  await row('Rovi').getByRole('button', { name: 'Presente' }).click();
  await rollcallModal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(rollcallModal(page)).not.toHaveClass(/active/);

  await expect.poll(() => writesTo(backend, 'matchday_rollcall').length).toBe(1);
  const fineWrites = writesTo(backend, 'fines');
  expect(fineWrites).toEqual([{
    kind: 'rest', method: 'DELETE', table: 'fines',
    filters: [['reason_id', 'eq.retraso'], ['auto_match_iso', 'eq.2026-09-25'], ['status', 'eq.pendiente'], ['player_id', `eq.${IDS.marta}`]],
  }]);
  expect(writesTo(backend, 'matchday_rollcall')[0].body).toEqual([{
    match_id: 'ce1', marks: { [IDS.marta]: 'v', [IDS.paula]: 'v' },
    saved_at: '2026-09-25T08:00:00Z', updated_at: NOW.toISOString(),
  }]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Vestuario → Partidos
// ---------------------------------------------------------------------------

const partidoCards = (page) => page.locator('#partidos-list .att-event');

test('Partidos lists every match of the season in date order', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);
  await goToSection(page, 'partidos');
  await expect(page.locator('#sec-partidos')).toHaveClass(/active/);

  await expect(partidoCards(page)).toHaveCount(5);
  await expect(partidoCards(page).locator('.info b')).toHaveText(['Partido vs Tarragona', 'Partido vs Gòtics', 'Partido vs Santboi', 'Partido vs Cornellà', 'Partido vs Badalona']);
  await expect(partidoCards(page).locator('.info span')).toHaveText([
    'Sábado 12/09/26 · CEM Mar Bella · 12:00 - 13:30h',
    'Sábado 19/09/26 · CEM Mar Bella · 17:30 - 19:00h',
    'Sábado 26/09/26 · CEM Mar Bella · 17:30h',
    'Sábado 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h',
    'Sábado 10/10/26 · CEM Mar Bella · 17:30h',
  ]);
  await expect(partidoCards(page).locator('.cal-date .d')).toHaveText(['12', '19', '26', '3', '10']);
  await expect(partidoCards(page).locator('.cal-date .m')).toHaveText(['Sep', 'Sep', 'Sep', 'Oct', 'Oct']);

  await page.evaluate(() => window.setLang('ca'));
  await goToSection(page, 'partidos');
  await expect(partidoCards(page).locator('.cal-date .m')).toHaveText(['Set', 'Set', 'Set', 'Oct', 'Oct']);
  await expect(partidoCards(page).nth(0).locator('.info span')).toHaveText('Dissabte 12/09/26 · CEM Mar Bella · 12:00 - 13:30h');
  expect(relevantErrors(errors)).toEqual([]);
});

test('without matches Partidos shows the empty message', async ({ page }) => {
  const s = clone(seed);
  s.att_events = s.att_events.filter((e) => e.type !== 'match');
  // ce1 (hardcoded match) turned into a training through a shared row.
  s.att_events.push({ id: 'ce1', type: 'training', label: 'Entreno extra', date: 26, month: 'Sep', iso: '2026-09-26', when_text: '', place: 'CEM Mar Bella', place_maps_url: '', is_home: true, meet_time: '', start_time: '10:00h', end_time: '', intensity: null });
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await goToSection(page, 'partidos');
  await expect(page.locator('#partidos-list .att-roster-empty')).toHaveText('Todavía no hay partidos programados.');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Partido detail: match report ("acta")
// ---------------------------------------------------------------------------

async function openPartido(page, label) {
  await goToSection(page, 'partidos');
  await partidoCards(page).filter({ hasText: label }).click();
  await expect(page.locator('#sec-partido-detalle')).toHaveClass(/active/);
  await expect(page.locator('#partido-detalle-title')).toHaveText(label);
  await page.waitForLoadState('networkidle');
}

const reportRows = (page) => page.locator('#match-report-box tbody tr');
const cells = (row) => row.locator('td');

test('a player sees the acta of a played match, starters first, read-only', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Gòtics');

  await expect(page.locator('#match-report-box thead th')).toHaveText(['Nº', 'JUGADORA', 'ESTADO', 'MIN', 'A', 'T', 'CC', 'PUNTOS', 'TARJETAS']);
  await expect(reportRows(page)).toHaveCount(6);
  await expect(reportRows(page).locator('td.name')).toHaveText([
    'Marta Rovira', 'Carla Font', 'Júlia Serra', 'Paula Vidal', 'Laura Gil (sin perfil en la app)', 'Aina Soler',
  ]);
  await expect(cells(reportRows(page).nth(0))).toHaveText(['2', 'Marta Rovira', 'Titular', '80', '1', '—', '—', '5', "Amarilla · 34'"]);
  await expect(cells(reportRows(page).nth(1))).toHaveText(['4', 'Carla Font', 'Titular', '60', '—', '—', '—', '—', '—']);
  await expect(cells(reportRows(page).nth(2))).toHaveText(['10', 'Júlia Serra', 'Titular', '80', '1', '3', '1', '14', "Amarilla · 61'"]);
  await expect(cells(reportRows(page).nth(5))).toHaveText(['18', 'Aina Soler', 'Suplente', '20', '—', '—', '—', '—', '—']);
  await expect(reportRows(page).nth(4).locator('td.name .muted')).toHaveText('(sin perfil en la app)');
  await expect(reportRows(page).nth(0).locator('.badge')).toHaveClass('badge warn');
  await expect(page.locator('#match-report-box .gym-split-note')).toHaveCount(0);

  await expect(page.locator('#match-report-upload-btn')).toBeHidden();
  await expect(page.locator('#match-report-create-btn')).toBeHidden();
  await expect(page.locator('#match-report-delete-btn')).toBeHidden();

  // Back link returns to the list
  await page.locator('#sec-partido-detalle .back-link').click();
  await expect(page.locator('#sec-partidos')).toHaveClass(/active/);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a match without acta shows the empty state; only managers get the upload/create buttons', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');
  await expect(page.locator('#match-report-box .gym-routine-empty p')).toHaveText('Todavía no se ha subido el acta de este partido.');
  await expect(page.locator('#match-report-box button')).toHaveCount(0);
  await expect(page.locator('#match-report-upload-btn')).toBeHidden();
  await expect(page.locator('#match-report-create-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin sees upload/create buttons on an empty acta and delete only when there is data', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');
  await expect(page.locator('#match-report-upload-btn')).toBeVisible();
  await expect(page.locator('#match-report-create-btn')).toBeVisible();
  await expect(page.locator('#match-report-delete-btn')).toBeHidden();
  await expect(page.locator('#match-report-box button')).toHaveText(['Subir acta en PDF', 'Crear acta a mano']);

  await page.locator('#sec-partido-detalle .back-link').click();
  await partidoCards(page).filter({ hasText: 'Partido vs Gòtics' }).click();
  await expect(reportRows(page)).toHaveCount(6);
  await expect(page.locator('#match-report-delete-btn')).toBeVisible();
  await expect(page.locator('#match-report-upload-btn')).toBeVisible();
  await expect(page.locator('#match-report-create-btn')).toBeVisible();

  await page.evaluate(() => window.setLang('ca'));
  await page.locator('#sec-partido-detalle .back-link').click();
  await partidoCards(page).filter({ hasText: 'Partido vs Cornellà' }).click();
  await expect(page.locator('#match-report-box .gym-routine-empty p')).toHaveText("Encara no s'ha pujat l'acta d'aquest partit.");
  await expect(page.locator('#match-report-box button')).toHaveText(['Pujar acta en PDF', 'Crear acta a mà']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('an acta with an estimated duration shows the 80-minute note', async ({ page }) => {
  const s = clone(seed);
  s.match_reports[0].match_duration_estimated = true;
  const { errors } = await setupApp(page, { user: USERS.player, seed: s });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Gòtics');
  await expect(page.locator('#match-report-box .gym-split-note')).toHaveText('El acta no indicaba la duración: se ha asumido 80 minutos.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('an acta header without players is shown as "no acta yet"', async ({ page }) => {
  const s = clone(seed);
  s.match_reports.push({ id: EVENT_IDS.matchPast1, match_duration_minutes: 80, match_duration_estimated: false, updated_at: '2026-09-13T10:00:00Z' });
  const { errors } = await setupApp(page, { user: USERS.admin, seed: s });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Tarragona');
  await expect(page.locator('#match-report-box .gym-routine-empty p')).toHaveText('Todavía no se ha subido el acta de este partido.');
  await expect(page.locator('#match-report-delete-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---- Manual builder ----

const builderModal = (page) => page.locator('#match-report-builder-modal');
const builderRows = (page) => page.locator('#acta-builder-rows tr');
// Inputs of a builder row: 0 jersey, 1 entry, 2 exit, 3 tries, 4 conversions, 5 penalties
const builderInput = (row, i) => row.locator('> td input[type=number]').nth(i);

test('manual acta: validation, then rows with players, minutes, points and cards are saved', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');
  const before = restWrites(backend).length;

  await page.locator('#match-report-create-btn').click();
  await expect(builderModal(page)).toHaveClass(/active/);
  await expect(builderModal(page).locator('h3')).toHaveText('Crear acta a mano');
  await expect(builderModal(page).locator('thead th')).toHaveText(['Nº', 'Jugadora', 'Min. entra', 'Min. sale', 'A', 'T', 'CC', 'Tarjetas', '']);
  await expect(builderRows(page)).toHaveCount(1);
  const first = builderRows(page).nth(0);
  await expect(builderInput(first, 0)).toHaveValue('');
  await expect(builderInput(first, 1)).toHaveValue('0');
  await expect(builderInput(first, 2)).toHaveValue('80');
  // Player options: me (the admin) + the roster
  await expect(first.locator('select option')).toHaveText(['Elegir…', 'Montse Puig', 'Júlia Serra', 'Marta Rovira', 'Carla Font', 'Paula Vidal', 'Aina Soler', 'Jordi Casals', 'Núria Pons', 'Sergi Martí']);

  // Saving without any player chosen
  await builderModal(page).getByRole('button', { name: 'Guardar acta' }).click();
  await expect(page.locator('#acta-builder-status')).toHaveText('Añade al menos una jugadora y elige su nombre.');
  expect(restWrites(backend).length).toBe(before);

  // Row 1: Júlia, #10, starter, 2 tries + 1 conversion, red card at 30'
  await builderInput(first, 0).fill('10');
  await first.locator('select').selectOption({ label: 'Júlia Serra' });
  await builderInput(first, 3).fill('2');
  await builderInput(first, 4).fill('1');
  await first.getByRole('button', { name: '+ tarjeta' }).click();
  await first.locator('td select').nth(1).selectOption('roja');
  await first.locator('input[placeholder=min]').fill('30');
  // A second card without minute is dropped on save
  await first.getByRole('button', { name: '+ tarjeta' }).click();
  await expect(first.locator('input[placeholder=min]')).toHaveCount(2);

  // Row 2: Rovi comes in at minute 50
  await builderModal(page).getByRole('button', { name: '+ Añadir jugadora' }).click();
  const second = builderRows(page).nth(1);
  await builderInput(second, 0).fill('16');
  await second.locator('select').selectOption({ label: 'Marta Rovira' });
  await builderInput(second, 1).fill('50');
  await builderInput(second, 5).fill('1');

  // Row 3: no player chosen → ignored; row 4 added and removed again
  await builderModal(page).getByRole('button', { name: '+ Añadir jugadora' }).click();
  await builderModal(page).getByRole('button', { name: '+ Añadir jugadora' }).click();
  await expect(builderRows(page)).toHaveCount(4);
  await builderRows(page).nth(3).locator('button[title="Quitar jugadora"]').click();
  await expect(builderRows(page)).toHaveCount(3);

  await builderModal(page).getByRole('button', { name: 'Guardar acta' }).click();
  await expect(page.locator('#acta-builder-status')).toHaveText('¡Acta guardada!');
  await expect(builderModal(page)).not.toHaveClass(/active/);

  const writes = restWrites(backend).slice(before);
  expect(writes.map((m) => `${m.method} ${m.table}`)).toEqual([
    'UPSERT match_reports', 'DELETE match_report_players', 'INSERT match_report_players', 'INSERT match_report_cards',
  ]);
  expect(writes[0].body).toEqual([{ id: EVENT_IDS.matchAway, match_duration_minutes: 80, match_duration_estimated: false, updated_at: NOW.toISOString() }]);
  expect(writes[1].filters).toEqual([['match_id', `eq.${EVENT_IDS.matchAway}`]]);
  expect(writes[2].body).toEqual([
    { match_id: EVENT_IDS.matchAway, profile_id: IDS.player, is_own_team: true, jersey_number: 10, player_name: 'Júlia Serra', license_number: 'CAT-10234', is_starter: true, minutes_played: 80, tries_count: 2, conversions_count: 1, penalties_count: 0, points: 12 },
    { match_id: EVENT_IDS.matchAway, profile_id: IDS.marta, is_own_team: true, jersey_number: 16, player_name: 'Marta Rovira', license_number: 'CAT-10187', is_starter: false, minutes_played: 30, tries_count: 0, conversions_count: 0, penalties_count: 1, points: 3 },
  ]);
  const juliaRowId = backend.db.match_report_players.find((p) => p.match_id === EVENT_IDS.matchAway && p.profile_id === IDS.player).id;
  expect(writes[3].body).toEqual([{ match_report_player_id: juliaRowId, card_type: 'roja', minute: 30 }]);

  // The acta table is shown with the saved data
  await expect(cells(reportRows(page).nth(0))).toHaveText(['10', 'Júlia Serra', 'Titular', '80', '2', '1', '—', '12', "Roja · 30'"]);
  await expect(cells(reportRows(page).nth(1))).toHaveText(['16', 'Marta Rovira', 'Suplente', '30', '—', '—', '1', '3', '—']);
  await expect(reportRows(page).nth(0).locator('.badge')).toHaveClass('badge bad');
  await expect(page.locator('#match-report-delete-btn')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('manual acta opens pre-filled with the existing acta and replaces it on save', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Gòtics');
  await expect(reportRows(page)).toHaveCount(6);
  const before = restWrites(backend).length;

  await page.locator('#match-report-create-btn').click();
  await expect(builderRows(page)).toHaveCount(6);
  // Jersey order as loaded; entry/exit reconstructed from minutes played
  const values = async (i) => builderRows(page).evaluateAll((trs, idx) => trs.map((tr) => tr.querySelectorAll(':scope > td input[type=number]')[idx].value), i);
  expect(await values(0)).toEqual(['2', '4', '10', '12', '15', '18']);
  expect(await values(1)).toEqual(['0', '0', '0', '0', '0', '60']);
  expect(await values(2)).toEqual(['80', '60', '80', '80', '80', '80']);
  expect(await values(3)).toEqual(['1', '0', '1', '2', '0', '0']);
  expect(await builderRows(page).locator('> td:nth-child(2) select').evaluateAll((ss) => ss.map((s) => s.value))).toEqual(
    [IDS.marta, IDS.carla, IDS.player, IDS.paula, '', IDS.aina],
  );
  await expect(builderRows(page).nth(0).locator('input[placeholder=min]')).toHaveValue('34');
  await expect(builderRows(page).nth(2).locator('input[placeholder=min]')).toHaveValue('61');

  // Remove Júlia's yellow card
  await builderRows(page).nth(2).locator('span button').click();
  await expect(builderRows(page).nth(2).locator('input[placeholder=min]')).toHaveCount(0);

  await builderModal(page).getByRole('button', { name: 'Guardar acta' }).click();
  await expect(page.locator('#acta-builder-status')).toHaveText('¡Acta guardada!');
  await expect(builderModal(page)).not.toHaveClass(/active/);

  const writes = restWrites(backend).slice(before);
  expect(writes.map((m) => `${m.method} ${m.table}`)).toEqual([
    'UPSERT match_reports', 'DELETE match_report_cards', 'DELETE match_report_players', 'INSERT match_report_players', 'INSERT match_report_cards',
  ]);
  const oldIds = [1, 2, 3, 4, 5, 6].map((n) => `d1000000-0000-4000-8000-00000000000${n}`);
  expect(writes[1].filters).toEqual([['match_report_player_id', `in.(${oldIds.join(',')})`]]);
  // NOTE: "Laura Gil" (no profile in the app, so no player chosen in the builder) is
  // silently dropped when the acta is saved again from the builder.
  expect(writes[3].body.map((r) => r.player_name)).toEqual(['Marta Rovira', 'Carla Font', 'Júlia Serra', 'Paula Vidal', 'Aina Soler']);
  expect(writes[3].body[4]).toMatchObject({ profile_id: IDS.aina, jersey_number: 18, is_starter: false, minutes_played: 20, points: 0 });
  expect(writes[3].body[2]).toMatchObject({ profile_id: IDS.player, tries_count: 1, conversions_count: 3, penalties_count: 1, points: 14 });
  expect(writes[4].body).toEqual([{ match_report_player_id: expect.any(String), card_type: 'amarilla', minute: 34 }]);

  await expect(reportRows(page)).toHaveCount(5);
  await expect(reportRows(page).locator('td.name')).toHaveText(['Marta Rovira', 'Carla Font', 'Júlia Serra', 'Paula Vidal', 'Aina Soler']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('cancelling the manual builder writes nothing', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');
  await page.locator('#match-report-box').getByRole('button', { name: 'Crear acta a mano' }).click();
  await expect(builderModal(page)).toHaveClass(/active/);
  await builderRows(page).nth(0).locator('select').selectOption({ label: 'Carla Font' });
  await builderModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(builderModal(page)).not.toHaveClass(/active/);
  await expect(page.locator('#match-report-box .gym-routine-empty')).toBeVisible();
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---- PDF upload (Edge Function) ----

const PDF = { name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% acta de prueba\n') };
const FUNCTION_URL = '**/functions/v1/process-match-report-pdf';
const uploadModal = (page) => page.locator('#match-report-upload-modal');
const preflight = (route) => route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });

test('uploading an acta PDF calls the Edge Function and shows the stored acta', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  const calls = [];
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route(FUNCTION_URL, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    calls.push({ method: req.method(), auth: req.headers().authorization, body: req.postDataBuffer().toString('latin1') });
    await held;
    // The Edge Function stores the acta itself.
    backend.table('match_reports').push({ id: EVENT_IDS.matchAway, match_duration_minutes: 80, match_duration_estimated: true, updated_at: NOW.toISOString() });
    backend.table('match_report_players').push(
      { id: 'd1000000-0000-4000-8000-000000000101', match_id: EVENT_IDS.matchAway, profile_id: IDS.paula, is_own_team: true, jersey_number: 12, player_name: 'Paula Vidal', license_number: 'CAT-10302', is_starter: true, minutes_played: 80, tries_count: 1, conversions_count: 0, penalties_count: 0, points: 5 },
      { id: 'd1000000-0000-4000-8000-000000000102', match_id: EVENT_IDS.matchAway, profile_id: null, is_own_team: true, jersey_number: 9, player_name: 'aina  soler', license_number: null, is_starter: false, minutes_played: 25, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 },
      { id: 'd1000000-0000-4000-8000-000000000103', match_id: EVENT_IDS.matchAway, profile_id: null, is_own_team: true, jersey_number: 7, player_name: 'Nora Puig', license_number: 'CAT-99999', is_starter: true, minutes_played: 80, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 },
    );
    backend.table('match_report_cards').push({ id: 'd2000000-0000-4000-8000-000000000101', match_report_player_id: 'd1000000-0000-4000-8000-000000000103', card_type: 'roja', minute: null });
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ playersMatched: 2, playersProcessed: 3, unmatchedOwnTeamNames: ['Nora Puig'] }),
    });
  });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');

  await page.locator('#match-report-upload-btn').click();
  await expect(uploadModal(page)).toHaveClass(/active/);
  await expect(uploadModal(page).locator('h3')).toHaveText('Subir acta en PDF');
  await expect(page.locator('#match-report-upload-status')).toHaveText('');

  // Without a file
  await uploadModal(page).getByRole('button', { name: 'Subir y procesar' }).click();
  await expect(page.locator('#match-report-upload-status')).toHaveText('Elige primero un archivo PDF.');
  expect(calls).toHaveLength(0);

  await page.locator('#match-report-pdf-input').setInputFiles(PDF);
  await uploadModal(page).getByRole('button', { name: 'Subir y procesar' }).click();
  await expect(page.locator('#match-report-upload-status')).toHaveText('Subiendo y leyendo el acta con Gemini… puede tardar unos segundos.');
  await expect(page.locator('#match-report-upload-submit-btn')).toBeDisabled();
  await expect(page.locator('#match-report-upload-cancel-btn')).toBeDisabled();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].method).toBe('POST');
  expect(calls[0].auth).toMatch(/^Bearer \S+\.\S+\.signature$/);
  expect(calls[0].body).toContain('name="pdf"; filename="acta.pdf"');
  expect(calls[0].body).toContain('%PDF-1.4');
  expect(calls[0].body).toMatch(new RegExp(`name="match_id"\\r\\n\\r\\n${EVENT_IDS.matchAway}\\r\\n`));

  release();
  await expect(page.locator('#match-report-upload-status')).toHaveText('¡Acta cargada! (2/3 jugadoras cruzadas) (1 jugadora/s no identificadas: revísalas) Cerrando…');
  await expect(page.locator('#match-report-upload-submit-btn')).toBeEnabled();
  await expect(uploadModal(page)).not.toHaveClass(/active/);

  await expect(page.locator('#match-report-box .gym-split-note')).toHaveText('El acta no indicaba la duración: se ha asumido 80 minutos.');
  // Starters by jersey, then substitutes; names matched by profile id or normalized name.
  await expect(reportRows(page).locator('td.name')).toHaveText(['Nora Puig (sin perfil en la app)', 'Paula Vidal', 'Aina Soler']);
  await expect(cells(reportRows(page).nth(0))).toHaveText(['7', 'Nora Puig (sin perfil en la app)', 'Titular', '80', '—', '—', '—', '—', 'Roja']);
  await expect(cells(reportRows(page).nth(2))).toHaveText(['9', 'Aina Soler', 'Suplente', '25', '—', '—', '—', '—', '—']);
  // The app writes nothing itself.
  expect(restWrites(backend)).toEqual([]);

  // Reopening the modal starts clean
  await page.locator('#match-report-upload-btn').click();
  await expect(page.locator('#match-report-upload-status')).toHaveText('');
  await expect(page.locator('#match-report-pdf-input')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('an error from the acta Edge Function is shown and the modal stays open', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  let calls = 0;
  await page.route(FUNCTION_URL, async (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    calls++;
    return route.fulfill({
      status: 422, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'El PDF no parece un acta de partido.' }),
    });
  });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Cornellà');
  await page.locator('#match-report-box').getByRole('button', { name: 'Subir acta en PDF' }).click();
  await page.locator('#match-report-pdf-input').setInputFiles(PDF);
  await uploadModal(page).getByRole('button', { name: 'Subir y procesar' }).click();

  await expect(page.locator('#match-report-upload-status')).toHaveText('El PDF no parece un acta de partido.');
  expect(calls).toBe(1);
  await expect(page.locator('#match-report-upload-submit-btn')).toBeEnabled();
  await expect(uploadModal(page)).toHaveClass(/active/);
  await expect(page.locator('#match-report-box .gym-routine-empty')).toBeVisible();

  await uploadModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(uploadModal(page)).not.toHaveClass(/active/);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---- Delete ----

test('deleting the acta asks for confirmation and removes cards, players and header', async ({ page }) => {
  const msgs = [];
  page.on('dialog', (d) => { msgs.push(d.message()); d.accept().catch(() => {}); });
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Gòtics');
  await expect(reportRows(page)).toHaveCount(6);
  const before = restWrites(backend).length;

  await page.locator('#match-report-delete-btn').click();
  await expect(page.locator('#match-report-box .gym-routine-empty p')).toHaveText('Todavía no se ha subido el acta de este partido.');
  expect(msgs).toEqual(['¿Seguro que quieres borrar el acta de este partido? Se perderán todos los datos: jugadoras, minutos, puntos y tarjetas.']);
  await expect(page.locator('#match-report-delete-btn')).toBeHidden();

  const oldIds = [1, 2, 3, 4, 5, 6].map((n) => `d1000000-0000-4000-8000-00000000000${n}`);
  expect(restWrites(backend).slice(before)).toEqual([
    { kind: 'rest', method: 'DELETE', table: 'match_report_cards', filters: [['match_report_player_id', `in.(${oldIds.join(',')})`]] },
    { kind: 'rest', method: 'DELETE', table: 'match_report_players', filters: [['match_id', `eq.${EVENT_IDS.matchPast2}`]] },
    { kind: 'rest', method: 'DELETE', table: 'match_reports', filters: [['id', `eq.${EVENT_IDS.matchPast2}`]] },
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('dismissing the delete confirmation keeps the acta', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openAppReady(page);
  await openPartido(page, 'Partido vs Gòtics');
  await page.locator('#match-report-delete-btn').click();
  await page.waitForTimeout(300);
  await expect(reportRows(page)).toHaveCount(6);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Tullidas (bandage list per match)
// ---------------------------------------------------------------------------

const tullidesModal = (page) => page.locator('#tullides-modal');
const tullidesRows = (page) => page.locator('#tullides-list .tullides-row');

test('Tullidas from the Inicio banner: list, sign up (own name) and remove own entry', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);
  await page.locator('#next-match-tullides-btn').click();

  await expect(tullidesModal(page)).toHaveClass(/active/);
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/); // it does not navigate
  await expect(page.locator('#tullides-modal-title')).toHaveText('Tullidas🤕');
  await expect(page.locator('#tullides-modal-sub')).toHaveText('Partido vs Santboi · Sábado 26/09/26 · CEM Mar Bella · 17:30h');
  await expect(tullidesRows(page).locator('.meta b')).toHaveText(['Rovi', 'Paula']);
  await expect(tullidesRows(page).locator('.meta span')).toHaveText(['Vendaje tobillo izquierdo', 'Tape en los dedos de la mano derecha']);
  // Other people's rows cannot be deleted
  await expect(tullidesRows(page).locator('button.del')).toHaveCount(0);
  await expect(page.locator('#tullides-input')).toBeFocused();
  await expect(page.locator('#tullides-input')).toHaveAttribute('placeholder', '¿Qué vendaje necesitas?');

  // Empty note: nothing
  await tullidesModal(page).getByRole('button', { name: 'Añadir' }).click();
  expect(writesTo(backend, 'match_injuries')).toEqual([]);

  await page.locator('#tullides-input').fill('  Vendaje rodilla  ');
  await page.locator('#tullides-input').press('Enter');
  await expect(tullidesRows(page)).toHaveCount(3);
  await expect(tullidesRows(page).nth(2).locator('.meta b')).toHaveText('Juls');
  await expect(tullidesRows(page).nth(2).locator('.meta span')).toHaveText('Vendaje rodilla');
  await expect(page.locator('#tullides-input')).toHaveValue('');
  expect(writesTo(backend, 'match_injuries')).toEqual([
    expect.objectContaining({ method: 'INSERT', body: [{ event_id: 'ce1', user_id: IDS.player, player_name: 'Juls', note: 'Vendaje rodilla' }] }),
  ]);
  const newId = backend.db.match_injuries.find((r) => r.user_id === IDS.player).id;

  await tullidesRows(page).nth(2).getByRole('button', { name: 'Eliminar' }).click();
  await expect(tullidesRows(page)).toHaveCount(2);
  expect(writesTo(backend, 'match_injuries')[1]).toEqual({
    kind: 'rest', method: 'DELETE', table: 'match_injuries', filters: [['id', `eq.${newId}`], ['user_id', `eq.${IDS.player}`]],
  });

  await tullidesModal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(tullidesModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Tullidas from a match detail in Asistencia; the button is only shown for matches', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openAppReady(page);
  await goToSection(page, 'asistencia');
  await page.locator('#att-event-list .att-event').filter({ hasText: 'Partido vs Cornellà' }).click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-tullides-btn')).toBeVisible();

  await page.locator('#att-detail-tullides-btn').click();
  await expect(tullidesModal(page)).toHaveClass(/active/);
  await expect(page.locator('#tullides-modal-sub')).toHaveText('Partido vs Cornellà · Sábado 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h');
  await expect(page.locator('#tullides-list .att-roster-empty')).toHaveText('Nadie se ha apuntado todavía.');

  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#tullides-modal-title')).toHaveText('Tullides🤕');
  await expect(page.locator('#tullides-modal-sub')).toHaveText('Partido vs Cornellà · Dissabte 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h');
  await expect(page.locator('#tullides-input')).toHaveAttribute('placeholder', 'Quin embenat necessites?');
  await tullidesModal(page).getByRole('button', { name: 'Tancar' }).click();
  await expect(tullidesModal(page)).not.toHaveClass(/active/);

  // A training has no Tullidas button
  await goToSection(page, 'asistencia');
  await page.locator('#att-event-list .att-event').filter({ hasText: 'Entreno' }).first().click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await expect(page.locator('#att-detail-tullides-btn')).toBeHidden();
  expect(relevantErrors(errors)).toEqual([]);
});
