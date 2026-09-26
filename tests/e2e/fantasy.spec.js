// Characterization tests for "Fantasy": the rugby lineup builder (match selector,
// pitch with 15 positions + 8 substitutes, bench of available players, click / mouse
// drag / touch drag to place players, reset, local draft), private saved lineups,
// publishing to an audience, the "shared with you" modal and the Inicio banner
// "X ha compartido contigo su alineación".
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

const SAVED_ID = seed.fantasy_lineups[0].id;
const PUBLISHED_ID = seed.fantasy_published_lineups[0].id;
const DRAFT_KEY = (user) => `cnpenas:fantasy:draft:${user.id}`;
const DISMISSED_KEY = 'cnpenas:fantasy:dismissed-banners';
const EMPTY_LINEUP = Object.fromEntries(Array.from({ length: 23 }, (_, i) => [String(i + 1), null]));

const select = (page) => page.locator('#fantasy-match-select');
const pitch = (page) => page.locator('#fantasy-pitch');
const slot = (page, n) => page.locator(`#fantasy-pitch .rugby-slot[data-pos="${n}"]`);
const slotButton = (page, n) => slot(page, n).locator('.slot-shape');
const bench = (page) => page.locator('#fantasy-bench');
const benchCard = (page, name) => page.locator('#fantasy-bench .jersey-card', { hasText: name });
const benchCards = (page) => page.locator('#fantasy-bench .jersey-card');
const benchNames = (page) => page.locator('#fantasy-bench .jersey-card .jname');
const benchCount = (page) => page.locator('#fantasy-bench-count');
const savedItems = (page) => page.locator('#fantasy-saved-list .fantasy-saved-item');
const actions = (page) => page.locator('#sec-fantasy .fantasy-actions');
const saveModal = (page) => page.locator('#save-lineup-modal');
const publishModal = (page) => page.locator('#publish-modal');
const sharedModal = (page) => page.locator('#shared-lineups-modal');
const sharedBanner = (page) => page.locator('#inicio-shared-lineup-banner');
const fantasyWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest' && m.table.startsWith('fantasy_'));

// { position: shown player name } for every filled slot on the pitch/substitutes.
const placed = (page) => page.locator('#fantasy-pitch .rugby-slot.filled').evaluateAll((els) =>
  Object.fromEntries(els.map((e) => [e.dataset.pos, e.querySelector('.slot-pname').textContent.trim()])));

const readStorage = (page, key) => page.evaluate((k) => {
  const v = localStorage.getItem(k);
  return v === null ? null : JSON.parse(v);
}, key);

// The other players' attendance (who said "yes" to the match) is only fetched when an
// event detail is opened in Asistencia; opening the next match (ce1) from the Inicio
// scoreboard is how a user gets it. Then Fantasy's bench lists them.
async function openFantasyWithMatchAttendance(page, expectedBench = ['Rovi', 'Carla', 'Paula', 'Jordi']) {
  await goToSection(page, 'inicio');
  await page.locator('#next-match-banner').click();
  await expect(page.locator('#sec-asistencia-detalle')).toHaveClass(/active/);
  await page.waitForLoadState('networkidle');
  // Entering Fantasy re-renders the bench; retry in case the answers arrive late.
  await expect(async () => {
    await goToSection(page, 'fantasy');
    if (expectedBench) await expect(benchNames(page)).toHaveText(expectedBench, { timeout: 500 });
  }).toPass();
}

// HTML5 drag and drop as the browser fires it (dragstart on the dragged element, then
// dragover + drop on the target, sharing one DataTransfer).
// NOTE: a real mouse drag does not start at all in Chromium (see the test below), so the
// drop logic is exercised with these events.
async function htmlDrag(page, source, target) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

// Dialog handling: setupApp dismisses every dialog; this registers (before setupApp) a
// handler that records messages and accepts confirms while `state.accept` is true.
function recordDialogs(page) {
  const state = { accept: false, messages: [] };
  page.on('dialog', (d) => {
    state.messages.push(d.message());
    if (state.accept) d.accept().catch(() => {});
  });
  return state;
}

// Extra players (all said "yes" to ce1), for filling every slot.
function withExtraPlayers(n) {
  const profiles = [...seed.profiles];
  const attendance = [...seed.att_attendance];
  for (let i = 1; i <= n; i++) {
    const id = `0e000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const mote = `Extra${String(i).padStart(2, '0')}`;
    profiles.push({ id, nombre: 'Extra', apellido: String(i), mote, telefono: '', fecha_nacimiento: '2000-01-01',
      rol: 'jugadora', rango: 'novata', posicion: 'delantera', comision: null, licencia: null,
      grupo_tercer_tiempo: 'A', avatar_url: null, is_admin: false });
    attendance.push({ event_id: EVENT_IDS.matchNext, user_id: id, status: 'yes', comment: '', updated_at: '2026-09-22T10:00:00Z' });
  }
  return { ...seed, profiles, att_attendance: attendance };
}

test('Fantasy shows the match selector, an empty pitch with 15 + 8 slots and the saved lineups', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'fantasy');

  await expect(page.locator('#sec-fantasy h2')).toHaveText('Fantasy');
  await expect(page.locator('#sec-fantasy label.fantasy-label')).toHaveText('Partido');
  await expect(select(page)).toBeEnabled();
  await expect(select(page).locator('option')).toHaveText([
    'Próximo partido — Partido vs Santboi (26 Sep)',
    'Partido vs Tarragona (12 Sep)',
    'Partido vs Gòtics (19 Sep)',
    'Partido vs Cornellà (3 Oct)',
    'Partido vs Badalona (10 Oct)',
  ]);
  // NOTE: "Próximo partido" is simply the first match in the events list (the
  // hardcoded ce1), not computed from the dates; past matches are listed too.
  await expect(select(page)).toHaveValue(EVENT_IDS.matchNext);
  await expect(actions(page).getByRole('button')).toHaveText(['Compartidas', 'Guardar alineación', 'Publicar']);

  // 15 positions on the pitch + 8 substitutes, all empty and numbered.
  await expect(pitch(page).locator('.rugby-slot')).toHaveCount(23);
  await expect(pitch(page).locator('.rugby-slot.sub-pitch-slot')).toHaveCount(8);
  await expect(pitch(page).locator('.rugby-slot.filled')).toHaveCount(0);
  await expect(pitch(page).locator('.rugby-slot .slot-num')).toHaveText(Array.from({ length: 23 }, (_, i) => String(i + 1)));
  await expect(slotButton(page, 1)).toHaveAttribute('title', '1 · Pilar');
  await expect(slotButton(page, 2)).toHaveAttribute('title', '2 · Talonador');
  await expect(slotButton(page, 15)).toHaveAttribute('title', '15 · Zaguero');
  await expect(slotButton(page, 16)).toHaveAttribute('title', '16 · Suplente');
  await expect(pitch(page).getByRole('button', { name: 'Vaciar el campo' })).toBeVisible();

  // The admin has not answered any match and nobody else's answers are loaded yet.
  await expect(benchCount(page)).toHaveText('0');
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');

  // "Mis alineaciones" shows the lineups saved for the selected match.
  // (The fake backend has no RLS, so the player's seeded lineup is listed as well.)
  await expect(page.locator('#fantasy-saved-card .fantasy-label')).toHaveText('Mis alineaciones');
  await expect(savedItems(page)).toHaveCount(1);
  await expect(savedItems(page).locator('.info b')).toHaveText('Mi XV ideal');
  await expect(savedItems(page).locator('.info span')).toHaveText('4/23 colocadas');
  await expect(savedItems(page).getByTitle('Eliminar')).toBeVisible();

  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the bench lists who said yes to the selected match; changing match clears the pitch', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'fantasy');

  // Only the user's own answers are known at start: Juls said yes to Cornellà and Gòtics.
  // NOTE: the other players' answers only show up after opening a match in Asistencia.
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');
  await select(page).selectOption(EVENT_IDS.matchAway);
  await expect(benchNames(page)).toHaveText(['Juls']);
  await expect(benchCount(page)).toHaveText('1');
  await expect(savedItems(page)).toHaveCount(0);
  await expect(page.locator('#fantasy-saved-list')).toHaveText('Aún no tienes alineaciones guardadas para este partido.');

  await benchCard(page, 'Juls').click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Juls' });
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');

  // Switching match empties the pitch without asking.
  await select(page).selectOption(EVENT_IDS.matchPast2);
  await expect.poll(() => placed(page)).toEqual({});
  await expect(benchNames(page)).toHaveText(['Juls']);
  await select(page).selectOption(EVENT_IDS.matchPast1);
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');

  // Back on the next match (ce1), after opening it the bench has the 4 who said yes
  // (Aina/Tanke said no, the user did not answer). The selected match is kept.
  await openFantasyWithMatchAttendance(page, null);
  await expect(select(page)).toHaveValue(EVENT_IDS.matchPast1);
  await select(page).selectOption(EVENT_IDS.matchNext);
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);
  await expect(benchCount(page)).toHaveText('4');
  await expect(savedItems(page).locator('.info b')).toHaveText(['Mi XV ideal']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('clicking bench cards fills the first free slot in order and clicking a placed player sends her back', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);

  await benchCard(page, 'Rovi').click();
  await benchCard(page, 'Paula').click();
  await benchCard(page, 'Jordi').click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 2: 'Paula', 3: 'Jordi' });
  await expect(slotButton(page, 2)).toHaveAttribute('title', '2 · Talonador · Paula');
  await expect(slot(page, 2).locator('.slot-num-filled')).toHaveText('2');
  await expect(benchNames(page)).toHaveText(['Carla']);
  await expect(benchCount(page)).toHaveText('1');

  // Clicking a placed player removes her; she goes back to the bench (roster order).
  await slotButton(page, 1).click();
  await expect.poll(() => placed(page)).toEqual({ 2: 'Paula', 3: 'Jordi' });
  await expect(slotButton(page, 1)).toHaveAttribute('title', '1 · Pilar');
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla']);

  // The next click fills the gap left in slot 1, then continues after 3.
  await benchCard(page, 'Carla').click();
  await benchCard(page, 'Rovi').click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Paula', 3: 'Jordi', 4: 'Rovi' });
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');
  await expect(benchCount(page)).toHaveText('0');

  // Clicking an empty slot does nothing.
  await slotButton(page, 5).click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Paula', 3: 'Jordi', 4: 'Rovi' });
  // Building a lineup never writes to Supabase.
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('after the 15 positions players go to the substitutes, and with all 23 filled an alert says there is no room', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { errors } = await setupApp(page, { seed: withExtraPlayers(20) });
  await openApp(page);
  await openFantasyWithMatchAttendance(page, null);
  await expect(benchCount(page)).toHaveText('24');

  for (let i = 0; i < 15; i++) await benchCards(page).first().click();
  await expect(pitch(page).locator('.rugby-slot.filled')).toHaveCount(15);
  await expect(pitch(page).locator('.rugby-slot.sub-pitch-slot.filled')).toHaveCount(0);

  await benchCards(page).first().click();
  await expect(slot(page, 16)).toHaveClass(/filled/);
  await expect(slotButton(page, 16)).toHaveAttribute('title', /^16 · Suplente · /);
  for (let i = 0; i < 7; i++) await benchCards(page).first().click();
  await expect(pitch(page).locator('.rugby-slot.filled')).toHaveCount(23);
  await expect(benchCount(page)).toHaveText('1');

  const expected = await placed(page);
  expect(Object.keys(expected)).toHaveLength(23);
  // Order: roster order (Rovi, Carla, Paula, Jordi, Extra01...).
  expect(expected[1]).toBe('Rovi');
  expect(expected[5]).toBe('Extra01');
  expect(expected[23]).toBe('Extra19');
  await expect(benchNames(page)).toHaveText(['Extra20']);

  expect(dialogs.messages).toEqual([]);
  await benchCards(page).first().click();
  expect(dialogs.messages).toEqual(['Ya no quedan huecos ni en el campo ni en el banquillo de suplentes. Quita a alguien para hacer sitio.']);
  await expect.poll(() => placed(page)).toEqual(expected);
  await expect(benchNames(page)).toHaveText(['Extra20']);
  expect(relevantErrors(errors)).toEqual([]);
});


test('drag and drop: bench to slot, slot to slot, onto an occupied slot and back to the bench', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);

  // Bench → any slot (not just the first free one).
  await htmlDrag(page, benchCard(page, 'Rovi'), slotButton(page, 9));
  await expect.poll(() => placed(page)).toEqual({ 9: 'Rovi' });
  await expect(benchNames(page)).toHaveText(['Carla', 'Paula', 'Jordi']);

  // Bench → a substitute slot.
  await htmlDrag(page, benchCard(page, 'Carla'), slotButton(page, 20));
  await expect.poll(() => placed(page)).toEqual({ 9: 'Rovi', 20: 'Carla' });

  // Slot → empty slot moves the player.
  await htmlDrag(page, slotButton(page, 9), slotButton(page, 10));
  await expect.poll(() => placed(page)).toEqual({ 10: 'Rovi', 20: 'Carla' });
  await expect(slot(page, 9)).not.toHaveClass(/filled/);

  // Slot → occupied slot: the dragged player takes it and the one who was there goes
  // back to the bench (no swap).
  await htmlDrag(page, slotButton(page, 20), slotButton(page, 10));
  await expect.poll(() => placed(page)).toEqual({ 10: 'Carla' });
  await expect(benchNames(page)).toHaveText(['Rovi', 'Paula', 'Jordi']);

  // Bench → occupied slot: same, the previous one returns to the bench.
  await htmlDrag(page, benchCard(page, 'Jordi'), slotButton(page, 10));
  await expect.poll(() => placed(page)).toEqual({ 10: 'Jordi' });
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula']);

  // Slot → bench removes the player from the pitch.
  await htmlDrag(page, slotButton(page, 10), bench(page));
  await expect.poll(() => placed(page)).toEqual({});
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);
  await expect(pitch(page).locator('.drag-over')).toHaveCount(0);

  // A slot is highlighted while something is dragged over it.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await benchCard(page, 'Rovi').dispatchEvent('dragstart', { dataTransfer });
  await slotButton(page, 4).dispatchEvent('dragover', { dataTransfer });
  await expect(slot(page, 4)).toHaveClass(/drag-over/);
  await slotButton(page, 4).dispatchEvent('dragleave', { dataTransfer });
  await expect(slot(page, 4)).not.toHaveClass(/drag-over/);

  // Empty slots cannot be dragged: dropping from one changes nothing.
  await expect(slotButton(page, 1)).toHaveAttribute('draggable', 'false');
  await htmlDrag(page, slotButton(page, 1), slotButton(page, 2));
  await expect.poll(() => placed(page)).toEqual({});
  await benchCard(page, 'Paula').click();
  await expect(slotButton(page, 1)).toHaveAttribute('draggable', 'true');
  // Dropping a bench card on the bench does nothing either.
  await htmlDrag(page, benchCard(page, 'Rovi'), bench(page));
  await expect.poll(() => placed(page)).toEqual({ 1: 'Paula' });
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Jordi']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('a real mouse drag does not move players in Chromium', async ({ page }) => {
  // NOTE (bug): .jersey-card and .slot-shape use `all:unset`, which also resets
  // Chromium's `-webkit-user-drag: element` for [draggable=true], so a mouse drag never
  // starts (no dragstart) in Chrome/Edge; only click and touch drag work there.
  const { errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);

  await benchCard(page, 'Rovi').dragTo(slotButton(page, 5));
  await expect.poll(() => placed(page)).toEqual({});
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);

  await benchCard(page, 'Rovi').click();
  await slotButton(page, 1).dragTo(slotButton(page, 5));
  // The mouse is released over slot 5 without a drag: nothing moves.
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi' });
  expect(relevantErrors(errors)).toEqual([]);
});

test.describe('on a touch phone', () => {
  test.use({ viewport: VIEWPORTS.mobile, hasTouch: true, isMobile: true });

  // Touch drag as the browser does it: touchstart on the dragged element, then
  // touchmove/touchend (targeted at that same element, bubbling to document) with the
  // finger's coordinates over the drop target.
  async function touchDrag(page, source, target) {
    await target.scrollIntoViewIfNeeded();
    const s = await source.boundingBox();
    const t = await target.boundingBox();
    const from = { identifier: 1, clientX: s.x + s.width / 2, clientY: s.y + s.height / 2 };
    const mid = { identifier: 1, clientX: (from.clientX + t.x + t.width / 2) / 2, clientY: (from.clientY + t.y + t.height / 2) / 2 };
    const to = { identifier: 1, clientX: t.x + t.width / 2, clientY: t.y + t.height / 2 };
    await source.dispatchEvent('touchstart', { touches: [from], targetTouches: [from], changedTouches: [from] });
    await source.dispatchEvent('touchmove', { touches: [mid], targetTouches: [mid], changedTouches: [mid] });
    await source.dispatchEvent('touchmove', { touches: [to], targetTouches: [to], changedTouches: [to] });
    await source.dispatchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [to] });
  }

  test('touch drag places, moves and removes players', async ({ page }) => {
    const { errors } = await setupApp(page);
    await openApp(page);
    await openFantasyWithMatchAttendance(page);

    // Bench → slot 12.
    await touchDrag(page, benchCard(page, 'Paula'), slot(page, 12));
    await expect.poll(() => placed(page)).toEqual({ 12: 'Paula' });
    await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Jordi']);
    // The floating copy that follows the finger is gone and no slot stays highlighted.
    await expect(page.locator('body > .jersey-card, body > .slot-shape')).toHaveCount(0);
    await expect(pitch(page).locator('.drag-over')).toHaveCount(0);

    // Bench → substitute slot.
    await touchDrag(page, benchCard(page, 'Rovi'), slot(page, 18));
    await expect.poll(() => placed(page)).toEqual({ 12: 'Paula', 18: 'Rovi' });

    // Slot → slot moves the player.
    await touchDrag(page, slotButton(page, 12), slot(page, 2));
    await expect.poll(() => placed(page)).toEqual({ 2: 'Paula', 18: 'Rovi' });

    // Slot → occupied slot replaces, the previous player returns to the bench.
    await touchDrag(page, slotButton(page, 18), slot(page, 2));
    await expect.poll(() => placed(page)).toEqual({ 2: 'Rovi' });
    await expect(benchNames(page)).toHaveText(['Carla', 'Paula', 'Jordi']);

    // Slot → bench removes her.
    await touchDrag(page, slotButton(page, 2), bench(page));
    await expect.poll(() => placed(page)).toEqual({});
    await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);

    // Bench card dropped outside the pitch and the bench: nothing changes.
    await touchDrag(page, benchCard(page, 'Carla'), page.locator('#sec-fantasy h2'));
    await expect.poll(() => placed(page)).toEqual({});
    await expect(page.locator('body > .jersey-card')).toHaveCount(0);

    // Tapping still works like a click.
    await benchCard(page, 'Jordi').tap();
    await expect.poll(() => placed(page)).toEqual({ 1: 'Jordi' });
    await slotButton(page, 1).tap();
    await expect.poll(() => placed(page)).toEqual({});
    expect(relevantErrors(errors)).toEqual([]);
  });
});

test('the reset button asks for confirmation before emptying the pitch', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);
  await benchCard(page, 'Rovi').click();
  await htmlDrag(page, benchCard(page, 'Carla'), slotButton(page, 17));
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 17: 'Carla' });

  const reset = pitch(page).getByRole('button', { name: 'Vaciar el campo' });
  await reset.click();
  expect(dialogs.messages).toEqual(['¿Quitar a todas las jugadoras del campo?']);
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 17: 'Carla' });

  dialogs.accept = true;
  await reset.click();
  expect(dialogs.messages).toHaveLength(2);
  await expect.poll(() => placed(page)).toEqual({});
  await expect(benchNames(page)).toHaveText(['Rovi', 'Carla', 'Paula', 'Jordi']);
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the lineup being built is autosaved locally per user and match and restored after a reload', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);
  await benchCard(page, 'Rovi').click();
  await htmlDrag(page, benchCard(page, 'Jordi'), slotButton(page, 22));

  expect(await readStorage(page, DRAFT_KEY(USERS.admin))).toEqual({
    matchId: EVENT_IDS.matchNext,
    lineup: { ...EMPTY_LINEUP, 1: IDS.marta, 22: IDS.jordi },
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await goToSection(page, 'fantasy');
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 22: 'Jordi' });
  await expect(select(page)).toHaveValue(EVENT_IDS.matchNext);

  // Removing a player updates the draft too.
  await slotButton(page, 22).click();
  expect((await readStorage(page, DRAFT_KEY(USERS.admin))).lineup).toEqual({ ...EMPTY_LINEUP, 1: IDS.marta });
  // Drafts never go to Supabase.
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the draft remembers the selected match; the user herself is stored as "me"', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'fantasy');
  await select(page).selectOption(EVENT_IDS.matchAway);
  await htmlDrag(page, benchCard(page, 'Juls'), slotButton(page, 10));

  // NOTE: the logged-in user is placed with the local id 'me' (not her profile id);
  // that is also what saved and published lineups store.
  expect(await readStorage(page, DRAFT_KEY(USERS.player))).toEqual({
    matchId: EVENT_IDS.matchAway,
    lineup: { ...EMPTY_LINEUP, 10: 'me' },
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await goToSection(page, 'fantasy');
  await expect(select(page)).toHaveValue(EVENT_IDS.matchAway);
  await expect.poll(() => placed(page)).toEqual({ 10: 'Juls' });
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');
  await expect(page.locator('#fantasy-saved-list')).toHaveText('Aún no tienes alineaciones guardadas para este partido.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('saving a lineup asks for a name and stores it privately in fantasy_lineups', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);
  await benchCard(page, 'Rovi').click();
  await htmlDrag(page, benchCard(page, 'Paula'), slotButton(page, 9));

  await actions(page).getByRole('button', { name: 'Guardar alineación' }).click();
  await expect(saveModal(page)).toHaveClass(/active/);
  await expect(saveModal(page).locator('h3')).toHaveText('Guardar alineación');
  await expect(page.locator('#lineup-name-input')).toHaveValue('');
  await expect(page.locator('#lineup-name-input')).toHaveAttribute('placeholder', 'Ej. Plan A vs Sagunt');

  // Cancel closes without saving.
  await saveModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(saveModal(page)).not.toHaveClass(/active/);

  // A name is required (blank counts as empty).
  await actions(page).getByRole('button', { name: 'Guardar alineación' }).click();
  await page.locator('#lineup-name-input').fill('   ');
  await saveModal(page).getByRole('button', { name: 'Guardar', exact: true }).click();
  expect(dialogs.messages).toEqual(['Ponle un nombre a la alineación.']);
  await expect(saveModal(page)).toHaveClass(/active/);
  expect(fantasyWrites(backend)).toEqual([]);

  await page.locator('#lineup-name-input').fill('  Plan A vs Santboi ');
  await saveModal(page).getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(saveModal(page)).not.toHaveClass(/active/);
  await expect(savedItems(page)).toHaveCount(2);

  const writes = fantasyWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'INSERT', table: 'fantasy_lineups' });
  expect(writes[0].body).toEqual([{
    owner_id: USERS.admin.id,
    match_id: EVENT_IDS.matchNext,
    name: 'Plan A vs Santboi',
    lineup: { ...EMPTY_LINEUP, 1: IDS.marta, 9: IDS.paula },
  }]);

  // Newest first; the pitch keeps the lineup.
  await expect(savedItems(page).locator('.info b')).toHaveText(['Plan A vs Santboi', 'Mi XV ideal']);
  await expect(savedItems(page).locator('.info span')).toHaveText(['2/23 colocadas', '4/23 colocadas']);
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 9: 'Paula' });

  // Reopening the modal starts with an empty name again.
  await actions(page).getByRole('button', { name: 'Guardar alineación' }).click();
  await expect(page.locator('#lineup-name-input')).toHaveValue('');
  // Clicking outside the box closes it.
  await saveModal(page).click({ position: { x: 5, y: 5 } });
  await expect(saveModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('loading a saved lineup puts its players on the pitch', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);
  await benchCard(page, 'Jordi').click();

  await savedItems(page).filter({ hasText: 'Mi XV ideal' }).locator('.info').click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Rovi', 8: 'Tanke', 12: 'Paula' });
  // Jordi (not in the saved lineup) is back on the bench; Tanke said no so she was never there.
  await expect(benchNames(page)).toHaveText(['Jordi']);
  await expect(select(page)).toHaveValue(EVENT_IDS.matchNext);
  expect((await readStorage(page, DRAFT_KEY(USERS.admin))).lineup)
    .toEqual({ ...EMPTY_LINEUP, 1: IDS.carla, 2: IDS.marta, 8: IDS.aina, 12: IDS.paula });
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('deleting a saved lineup asks for confirmation and deletes it in Supabase', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'fantasy');

  const del = savedItems(page).getByTitle('Eliminar');
  await del.click();
  expect(dialogs.messages).toEqual(['¿Eliminar esta alineación guardada?']);
  expect(fantasyWrites(backend)).toEqual([]);
  await expect(savedItems(page)).toHaveCount(1);
  // Deleting does not load the lineup.
  await expect.poll(() => placed(page)).toEqual({});

  dialogs.accept = true;
  await del.click();
  await expect(page.locator('#fantasy-saved-list')).toHaveText('Aún no tienes alineaciones guardadas para este partido.');
  const writes = fantasyWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'DELETE', table: 'fantasy_lineups', filters: [['id', `eq.${SAVED_ID}`]] });
  expect(backend.db.fantasy_lineups).toEqual([]);
  await expect.poll(() => placed(page)).toEqual({});
  expect(relevantErrors(errors)).toEqual([]);
});

test('publishing requires an audience and at least one player, then stores it for that audience', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await openFantasyWithMatchAttendance(page);
  const options = publishModal(page).locator('.publish-audience-opt');
  const confirm = publishModal(page).locator('.modal-actions').getByRole('button', { name: 'Publicar' });

  await actions(page).getByRole('button', { name: 'Publicar' }).click();
  await expect(publishModal(page)).toHaveClass(/active/);
  await expect(publishModal(page).locator('h3')).toHaveText('Compartir alineación con');
  await expect(options).toHaveText(['Jugadoras', 'Staff', 'Capitanas', 'Una persona']);
  await expect(publishModal(page).locator('.publish-audience-opt.selected')).toHaveCount(0);
  await expect(page.locator('#publish-person-wrap')).toBeHidden();

  await confirm.click();
  expect(dialogs.messages).toEqual(['Elige con quién quieres compartirla.']);

  await options.filter({ hasText: 'Staff' }).click();
  await expect(options.filter({ hasText: 'Staff' })).toHaveClass(/selected/);
  await expect(publishModal(page).locator('.publish-audience-opt.selected')).toHaveCount(1);
  await confirm.click();
  expect(dialogs.messages[1]).toBe('Coloca al menos una jugadora antes de publicar.');
  await expect(publishModal(page)).toHaveClass(/active/);
  expect(fantasyWrites(backend)).toEqual([]);

  // Cancel, build a lineup and publish it to the captains.
  await publishModal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(publishModal(page)).not.toHaveClass(/active/);
  await benchCard(page, 'Rovi').click();
  await htmlDrag(page, benchCard(page, 'Carla'), slotButton(page, 16));

  await actions(page).getByRole('button', { name: 'Publicar' }).click();
  // Reopening resets the choice.
  await expect(publishModal(page).locator('.publish-audience-opt.selected')).toHaveCount(0);
  await options.filter({ hasText: 'Staff' }).click();
  await options.filter({ hasText: 'Capitanas' }).click();
  await expect(publishModal(page).locator('.publish-audience-opt.selected')).toHaveText(['Capitanas']);
  await confirm.click();

  await expect(publishModal(page)).not.toHaveClass(/active/);
  await expect.poll(() => dialogs.messages.length).toBe(3);
  expect(dialogs.messages[2]).toBe('Alineación publicada para: Capitanas');
  const writes = fantasyWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ method: 'INSERT', table: 'fantasy_published_lineups' });
  expect(writes[0].body).toEqual([{
    published_by: USERS.admin.id,
    match_id: EVENT_IDS.matchNext,
    name: 'Alineación de Montse',
    lineup: { ...EMPTY_LINEUP, 1: IDS.marta, 16: IDS.carla },
    audience: 'capitanas',
    persona_id: null,
  }]);
  // The pitch keeps the lineup after publishing.
  await expect.poll(() => placed(page)).toEqual({ 1: 'Rovi', 16: 'Carla' });
  expect(relevantErrors(errors)).toEqual([]);
});

test('publishing to one person lets you pick anyone in the roster', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await goToSection(page, 'fantasy');
  await select(page).selectOption(EVENT_IDS.matchAway);
  await benchCard(page, 'Juls').click();

  await actions(page).getByRole('button', { name: 'Publicar' }).click();
  await publishModal(page).locator('.publish-audience-opt', { hasText: 'Una persona' }).click();
  await expect(page.locator('#publish-person-wrap')).toBeVisible();
  await expect(page.locator('#publish-person-wrap')).toContainText('Persona');
  const person = page.locator('#publish-person-select');
  // NOTE: the user herself is the first option (value 'me'); staff are listed too and
  // the admin account is not.
  await expect(person.locator('option')).toHaveText(['Juls', 'Rovi', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  // Choosing another audience hides the person picker again.
  await publishModal(page).locator('.publish-audience-opt', { hasText: 'Jugadoras' }).click();
  await expect(page.locator('#publish-person-wrap')).toBeHidden();
  await publishModal(page).locator('.publish-audience-opt', { hasText: 'Una persona' }).click();

  await person.selectOption({ label: 'Tanke' });
  await publishModal(page).locator('.modal-actions').getByRole('button', { name: 'Publicar' }).click();
  await expect(publishModal(page)).not.toHaveClass(/active/);
  await expect.poll(() => dialogs.messages).toEqual(['Alineación publicada para: Tanke']);

  const writes = fantasyWrites(backend);
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual([{
    published_by: USERS.player.id,
    match_id: EVENT_IDS.matchAway,
    name: 'Alineación de Juls',
    lineup: { ...EMPTY_LINEUP, 1: 'me' },
    audience: 'persona',
    persona_id: IDS.aina,
  }]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Compartidas" lists the lineups shared for the selected match and loads one onto the pitch', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);
  await goToSection(page, 'fantasy');

  await actions(page).getByRole('button', { name: 'Compartidas' }).click();
  await expect(sharedModal(page)).toHaveClass(/active/);
  await expect(sharedModal(page).locator('h3')).toHaveText('Compartidas contigo');
  const items = sharedModal(page).locator('.shared-lineup-item');
  await expect(items).toHaveCount(1);
  await expect(items.locator('.info b')).toHaveText('Alineación de Rovi');
  await expect(items.locator('.info span')).toHaveText('Rovi · para Ti');

  await items.click();
  await expect(sharedModal(page)).not.toHaveClass(/active/);
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Rovi', 3: 'Paula', 9: 'Tanke', 10: 'Juls' });
  expect((await readStorage(page, DRAFT_KEY(USERS.admin))).lineup)
    .toEqual({ ...EMPTY_LINEUP, 1: IDS.carla, 2: IDS.marta, 3: IDS.paula, 9: IDS.aina, 10: IDS.player });

  // Another match: nothing shared. Close button.
  await select(page).selectOption(EVENT_IDS.matchHome);
  await expect.poll(() => placed(page)).toEqual({});
  await actions(page).getByRole('button', { name: 'Compartidas' }).click();
  await expect(sharedModal(page)).toHaveClass(/active/);
  await expect(page.locator('#shared-lineups-list')).toHaveText('Todavía no hay alineaciones compartidas contigo para este partido.');
  await sharedModal(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(sharedModal(page)).not.toHaveClass(/active/);
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('shared lineups show audience labels and "Alguien" for unknown publishers', async ({ page }) => {
  const { errors } = await setupApp(page, { user: USERS.player, seed: { ...seed, fantasy_published_lineups: [
    ...seed.fantasy_published_lineups,
    { id: 'e3000000-0000-4000-8000-000000000002', published_by: IDS.jordi, match_id: EVENT_IDS.matchNext, name: 'Alineación de Jordi',
      lineup: { 1: IDS.marta }, audience: 'jugadoras', persona_id: null, created_at: '2026-09-25T07:00:00Z' },
    { id: 'e3000000-0000-4000-8000-000000000003', published_by: 'ffffffff-0000-4000-8000-000000000099', match_id: EVENT_IDS.matchNext, name: 'Alineación antigua',
      lineup: { 2: IDS.carla }, audience: 'staff', persona_id: null, created_at: '2026-09-20T07:00:00Z' },
  ] } });
  await openApp(page);
  await goToSection(page, 'fantasy');
  await actions(page).getByRole('button', { name: 'Compartidas' }).click();
  const items = sharedModal(page).locator('.shared-lineup-item');
  // Newest first.
  await expect(items.locator('.info b')).toHaveText(['Alineación de Jordi', 'Alineación de Rovi', 'Alineación antigua']);
  await expect(items.locator('.info span')).toHaveText(['Jordi · para Jugadoras', 'Rovi · para Ti', 'Alguien · para Staff']);

  // NOTE: the seeded lineup has the player herself in slot 10 under her profile id, but
  // for her the roster knows her only as 'me', so slot 10 looks empty.
  await items.filter({ hasText: 'Alineación de Rovi' }).click();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Rovi', 3: 'Paula', 9: 'Tanke' });
  await expect(slot(page, 10)).not.toHaveClass(/filled/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner: opening the lineup shared with you goes to Fantasy and the banner does not come back', async ({ page }) => {
  const { backend, errors } = await setupApp(page);
  await openApp(page);

  await expect(sharedBanner(page)).toBeVisible();
  await expect(page.locator('#inicio-shared-lineup-text')).toHaveText('Rovi ha compartido contigo su alineación del próximo partido Partido vs Santboi');
  await expect(page.locator('#inicio-shared-lineup-text b')).toHaveText(['Rovi', 'Partido vs Santboi']);

  await page.locator('#inicio-shared-lineup-text').click();
  await expect(page.locator('#sec-fantasy')).toHaveClass(/active/);
  await expect(sharedBanner(page)).toBeHidden();
  await expect.poll(() => placed(page)).toEqual({ 1: 'Carla', 2: 'Rovi', 3: 'Paula', 9: 'Tanke', 10: 'Juls' });
  await expect(select(page)).toHaveValue(EVENT_IDS.matchNext);
  expect(await readStorage(page, DISMISSED_KEY)).toEqual([PUBLISHED_ID]);

  await goToSection(page, 'inicio');
  await expect(sharedBanner(page)).toBeHidden();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect(sharedBanner(page)).toBeHidden();
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner: the dismiss button hides it for good on this device; a newer shared lineup shows again', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await expect(sharedBanner(page)).toBeVisible();

  await sharedBanner(page).getByRole('button', { name: 'Descartar aviso' }).click();
  await expect(sharedBanner(page)).toBeHidden();
  // Dismissing does not open Fantasy.
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect.poll(() => readStorage(page, DISMISSED_KEY)).toEqual([PUBLISHED_ID]);

  await goToSection(page, 'vestuario');
  await goToSection(page, 'inicio');
  await expect(sharedBanner(page)).toBeHidden();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(sharedBanner(page)).toBeHidden();

  // Someone shares a newer one (no realtime: it shows when coming back to Inicio).
  backend.db.fantasy_published_lineups.push({
    id: 'e3000000-0000-4000-8000-000000000004', published_by: IDS.jordi, match_id: EVENT_IDS.matchAway,
    name: 'Alineación de Jordi', lineup: { 1: IDS.marta }, audience: 'jugadoras', persona_id: null,
    created_at: '2026-09-25T07:30:00Z',
  });
  await goToSection(page, 'vestuario');
  await goToSection(page, 'inicio');
  await expect(sharedBanner(page)).toBeVisible();
  await expect(page.locator('#inicio-shared-lineup-text')).toHaveText('Jordi ha compartido contigo su alineación del próximo partido Partido vs Cornellà');
  expect(fantasyWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Inicio banner: own lineups do not show it; unknown publisher or match use fallbacks', async ({ page }) => {
  const mine = { id: 'e3000000-0000-4000-8000-000000000005', published_by: USERS.admin.id, match_id: EVENT_IDS.matchNext,
    name: 'Alineación de Montse', lineup: { 1: IDS.marta }, audience: 'staff', persona_id: null, created_at: '2026-09-25T07:00:00Z' };
  const { backend, errors } = await setupApp(page, { seed: { ...seed, fantasy_published_lineups: [mine] } });
  await openApp(page);
  await expect(sharedBanner(page)).toBeHidden();

  // Newer one from someone not in the roster, for a match that no longer exists.
  backend.db.fantasy_published_lineups.push({
    id: 'e3000000-0000-4000-8000-000000000006', published_by: 'ffffffff-0000-4000-8000-000000000099', match_id: 'ce-deleted',
    name: 'X', lineup: { 1: IDS.marta }, audience: 'jugadoras', persona_id: null, created_at: '2026-09-25T07:10:00Z',
  });
  await goToSection(page, 'vestuario');
  await goToSection(page, 'inicio');
  await expect(sharedBanner(page)).toBeVisible();
  await expect(page.locator('#inicio-shared-lineup-text')).toHaveText('Alguien ha compartido contigo su alineación del próximo partido el próximo partido');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Fantasy and the Inicio banner in Catalan', async ({ page }) => {
  const { errors } = await setupApp(page);
  await openApp(page);
  await page.evaluate(() => window.setLang('ca'));
  // The banner text is built when Inicio is entered.
  await goToSection(page, 'vestuario');
  await goToSection(page, 'inicio');
  await expect(page.locator('#inicio-shared-lineup-text')).toHaveText('Rovi ha compartit amb tu la seva alineació del proper partit Partido vs Santboi');
  await expect(sharedBanner(page).getByRole('button', { name: 'Descartar avís' })).toBeVisible();

  await goToSection(page, 'fantasy');
  await expect(page.locator('#sec-fantasy label.fantasy-label')).toHaveText('Partit');
  await expect(actions(page).getByRole('button')).toHaveText(['Compartides', "Desa l'alineació", 'Publica']);
  await expect(page.locator('#sec-fantasy .fantasy-side .fantasy-label')).toContainText('Disponibles');
  await expect(page.locator('#fantasy-saved-card .fantasy-label')).toHaveText('Les meves alineacions');
  // NOTE: texts rendered by fantasy.js itself are not translated (only the month is).
  await expect(select(page).locator('option').first()).toHaveText('Próximo partido — Partido vs Santboi (26 Set)');
  await expect(bench(page)).toHaveText('No hay jugadoras disponibles.');
  await expect(savedItems(page).locator('.info span')).toHaveText('4/23 colocadas');
  await expect(pitch(page).getByRole('button', { name: 'Vaciar el campo' })).toBeVisible();

  await actions(page).getByRole('button', { name: "Desa l'alineació" }).click();
  await expect(saveModal(page).locator('h3')).toHaveText("Desa l'alineació");
  await expect(saveModal(page)).toContainText('Nom');
  await expect(page.locator('#lineup-name-input')).toHaveAttribute('placeholder', 'Ex. Pla A vs Sagunt');
  await expect(saveModal(page).locator('.modal-actions').getByRole('button')).toHaveText(["Cancel·la", 'Desar']);
  await saveModal(page).getByRole('button', { name: "Cancel·la" }).click();
  await expect(saveModal(page)).not.toHaveClass(/active/);

  await actions(page).getByRole('button', { name: 'Publica' }).click();
  await expect(publishModal(page).locator('h3')).toHaveText("Comparteix l'alineació amb");
  await expect(publishModal(page).locator('.publish-audience-opt')).toHaveText(['Jugadores', 'Staff', 'Capitanes', 'Una persona']);
  await expect(publishModal(page).locator('.modal-actions').getByRole('button')).toHaveText(["Cancel·la", 'Publica']);
  await publishModal(page).getByRole('button', { name: "Cancel·la" }).click();

  await actions(page).getByRole('button', { name: 'Compartides' }).click();
  await expect(sharedModal(page).locator('h3')).toHaveText('Compartides amb tu');
  // NOTE: list texts are not translated.
  await expect(sharedModal(page).locator('.shared-lineup-item .info span')).toHaveText('Rovi · para Ti');
  await sharedModal(page).getByRole('button', { name: 'Tancar' }).click();
  await expect(sharedModal(page)).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});
