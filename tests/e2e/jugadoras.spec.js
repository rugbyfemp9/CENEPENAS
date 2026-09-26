// Characterization tests for "Jugadoras" (sec-plantilla): the members table read from
// `profiles` (admin account hidden), the position filter, the sort menu, the
// "Datos" / "Estadísticas" tabs (stats summed from own-team match report rows), the
// stats sort menu, menus closing on outside click, admin-only edit column, Catalan and
// the mobile layout.
//
// Seed members (shown name = mote, else first name), alphabetically:
//   Carla   2001-07-23 jugadora     novata       delantera Comi Tesoreria    CAT-10411
//   Jordi   1980-05-18 entrenador/a                                          ENT-0042
//   Juls    1998-04-12 jugadora     veterana     3/4       Comi Gira         CAT-10234  (the player account)
//   Núria   1990-12-09 fisio
//   Paula   1999-01-30 jugadora     sang_de_fang 3/4       Comi Tercer Temps CAT-10302
//   Rovi    1995-11-02 Capitana     veterana     delantera Comi Activitats   CAT-10187  (has a photo)
//   Sergi   1987-02-26 delegado/a
//   Tanke   2003-09-05 jugadora     novata       3/4       Comi Xarxes       CAT-10455
// Fines: Rovi yellow + red, Juls one yellow (cards used by the "Nº de tarjetas" sort).
// Match report (Gòtics): Rovi 80' 1 try 5 pts 1 card, Carla 60', Juls 80' 1 try 14 pts
// 1 card, Paula 80' 2 tries 10 pts, Tanke 20', and Laura Gil (no account, not listed).
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
const JORDI = authUser(IDS.jordi, 'jordi@cnpenas.test'); // entrenador/a (staff)

const sec = (page) => page.locator('#sec-plantilla');
const rows = (page) => page.locator('#plantilla-grid tr');
const names = (page) => page.locator('#plantilla-grid .col-player b');
const statsRows = (page) => page.locator('#plantilla-stats-grid tr');
const statsNames = (page) => page.locator('#plantilla-stats-grid .col-player b');
const sortMenu = (page) => page.locator('#plantilla-sort-menu');
const statsSortMenu = (page) => page.locator('#plantilla-stats-sort-menu');
const rowOf = (page, name) => rows(page).filter({ has: page.locator('.col-player b', { hasText: new RegExp(`^${name}$`) }) });
const tab = (page, name) => sec(page).locator('.gym-day-group-tab', { hasText: name });

const ALPHA = ['Carla', 'Jordi', 'Juls', 'Núria', 'Paula', 'Rovi', 'Sergi', 'Tanke'];

async function openJugadoras(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'plantilla');
  await expect(sec(page)).toHaveClass(/active/);
  return ctx;
}

async function sortBy(page, option) {
  await page.locator('#plantilla-sort-btn').click();
  await expect(sortMenu(page)).toHaveClass(/active/);
  await sortMenu(page).getByRole('button', { name: option }).click();
  await expect(sortMenu(page)).not.toHaveClass(/active/);
}

async function statsSortBy(page, option) {
  await page.locator('#plantilla-stats-sort-btn').click();
  await expect(statsSortMenu(page)).toHaveClass(/active/);
  await statsSortMenu(page).getByRole('button', { name: option }).click();
  await expect(statsSortMenu(page)).not.toHaveClass(/active/);
}

test('lists every registered member except the admin account, alphabetically, with all columns', async ({ page }) => {
  const { backend, errors } = await openJugadoras(page);
  await expect(sec(page).locator('h2')).toHaveText('Jugadoras');
  await expect(sec(page).locator('thead').first().locator('th:visible')).toHaveText([
    'Jugadora', 'Fecha de nacimiento', 'Rol', 'Rango', 'Posición', 'Comisión', 'Núm. de licencia',
  ]);
  await expect(page.locator('#plantilla-th-actions')).toBeHidden();

  await expect(names(page)).toHaveText(ALPHA);
  await expect(sec(page)).not.toContainText('Montse');
  // Players show rank/position/commission ("Sin asignar" when empty); staff show "—".
  await expect(rows(page).nth(0).locator('td')).toHaveText(['C Carla', '23/07/2001', 'jugadora', 'novata', 'Delantera', 'Comi Tesoreria', 'CAT-10411']);
  await expect(rows(page).nth(1).locator('td')).toHaveText(['J Jordi', '18/05/1980', 'entrenador/a', '—', '—', '—', 'ENT-0042']);
  await expect(rows(page).nth(2).locator('td')).toHaveText(['J Juls', '12/04/1998', 'jugadora', 'veterana', '3/4', 'Comi Gira', 'CAT-10234']);
  await expect(rows(page).nth(3).locator('td')).toHaveText(['N Núria', '09/12/1990', 'fisio', '—', '—', '—', 'Sin asignar']);
  // NOTE: the rank is shown as the raw value ("sang_de_fang"), not as the "Sang de Fang" label.
  await expect(rows(page).nth(4).locator('td')).toHaveText(['P Paula', '30/01/1999', 'jugadora', 'sang_de_fang', '3/4', 'Comi Tercer Temps', 'CAT-10302']);
  await expect(rows(page).nth(5).locator('td')).toHaveText(['Rovi', '02/11/1995', 'Capitana', 'veterana', 'Delantera', 'Comi Activitats', 'CAT-10187']);
  await expect(rows(page).nth(6).locator('td')).toHaveText(['S Sergi', '26/02/1987', 'delegado/a', '—', '—', '—', 'Sin asignar']);
  await expect(rows(page).nth(7).locator('td')).toHaveText(['T Tanke', '05/09/2003', 'jugadora', 'novata', '3/4', 'Comi Xarxes', 'CAT-10455']);

  // Photo or initials in the avatar; empty/staff cells are muted.
  await expect(rowOf(page, 'Rovi').locator('.avatar img')).toHaveAttribute('src', 'assets/img/1.jpg');
  await expect(rows(page).locator('.avatar img')).toHaveCount(1);
  await expect(rowOf(page, 'Núria').locator('td').nth(6)).toHaveClass(/muted-cell/);
  await expect(rowOf(page, 'Jordi').locator('td').nth(3)).toHaveClass(/muted-cell/);
  await expect(rowOf(page, 'Carla').locator('td').nth(3)).not.toHaveClass(/muted-cell/);
  await expect(rows(page).getByRole('button')).toHaveCount(0);

  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin sees the "Editar" column with a button per member', async ({ page }) => {
  const { errors } = await openJugadoras(page, { user: USERS.admin });
  await expect(page.locator('#plantilla-th-actions')).toBeVisible();
  await expect(page.locator('#plantilla-th-actions')).toHaveText('Editar');
  await expect(names(page)).toHaveText(ALPHA);
  await expect(rows(page).getByRole('button', { name: 'Editar' })).toHaveCount(8);
  await expect(rowOf(page, 'Juls').locator('td')).toHaveText(['J Juls', '12/04/1998', 'jugadora', 'veterana', '3/4', 'Comi Gira', 'CAT-10234', 'Editar']);

  await rowOf(page, 'Paula').getByRole('button', { name: 'Editar' }).click();
  await expect(page.locator('#edit-profile-modal')).toHaveClass(/active/);
  await expect(page.locator('#edit-profile-modal h3')).toHaveText('Editar jugadora');
  await expect(page.locator('#profile-name-input')).toHaveValue('Paula Vidal');
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff (entrenador/a) can open Jugadoras, without the edit column', async ({ page }) => {
  const { errors } = await openJugadoras(page, { user: JORDI });
  await expect(page.locator('#sec-vestuario')).not.toHaveClass(/active/);
  await expect(names(page)).toHaveText(ALPHA);
  await expect(page.locator('#plantilla-th-actions')).toBeHidden();
  await expect(rows(page).getByRole('button')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('position filter shows only forwards or only backs', async ({ page }) => {
  const { backend, errors } = await openJugadoras(page);
  const filter = page.locator('#plantilla-position-filter');
  await expect(filter).toHaveValue('');
  await expect(filter.locator('option')).toHaveText(['Todas', 'Delantera', '3/4']);

  await filter.selectOption('delantera');
  await expect(names(page)).toHaveText(['Carla', 'Rovi']);
  await filter.selectOption('3/4');
  await expect(names(page)).toHaveText(['Juls', 'Paula', 'Tanke']);
  await filter.selectOption('');
  await expect(names(page)).toHaveText(ALPHA);
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('position filter without matches shows an empty message', async ({ page }) => {
  const noForwards = { ...seed, profiles: seed.profiles.map((p) => (p.posicion === 'delantera' ? { ...p, posicion: '3/4' } : p)) };
  const { errors } = await openJugadoras(page, { seed: noForwards });
  await page.locator('#plantilla-position-filter').selectOption('delantera');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toHaveText('No hay ninguna jugadora con esa posición.');

  await page.evaluate(() => window.setLang('ca'));
  await expect(rows(page)).toHaveText('No hi ha cap jugadora amb aquesta posició.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('sort menu: alphabetical, birth date, commission and number of cards', async ({ page }) => {
  const { backend, errors } = await openJugadoras(page);
  await expect(sortMenu(page)).toBeHidden();
  await page.locator('#plantilla-sort-btn').click();
  await expect(sortMenu(page)).toBeVisible();
  await expect(page.locator('#plantilla-sort-btn')).toHaveClass(/active/);
  await expect(sortMenu(page).getByRole('button')).toHaveText([
    'Alfabéticamente', 'Fecha de nacimiento', 'Comisión', 'Nº de tarjetas (de más a menos)',
  ]);
  await expect(sortMenu(page).locator('button.active')).toHaveText('Alfabéticamente');
  // The toggle closes it again.
  await page.locator('#plantilla-sort-btn').click();
  await expect(sortMenu(page)).toBeHidden();
  await expect(page.locator('#plantilla-sort-btn')).not.toHaveClass(/active/);

  // Oldest first.
  await sortBy(page, 'Fecha de nacimiento');
  await expect(names(page)).toHaveText(['Jordi', 'Sergi', 'Núria', 'Rovi', 'Juls', 'Paula', 'Carla', 'Tanke']);
  await expect(page.locator('#plantilla-sort-btn')).not.toHaveClass(/active/);
  await page.locator('#plantilla-sort-btn').click();
  await expect(sortMenu(page).locator('button.active')).toHaveText('Fecha de nacimiento');
  await page.locator('#plantilla-sort-btn').click();

  // By commission name; members without one (staff) at the end, in load order.
  await sortBy(page, 'Comisión');
  await expect(names(page)).toHaveText(['Rovi', 'Juls', 'Paula', 'Carla', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  // Most cards (yellow/red fines) first. NOTE: ties keep the order in which profiles
  // were loaded from Supabase, not alphabetical order.
  await sortBy(page, 'Nº de tarjetas');
  await expect(names(page)).toHaveText(['Rovi', 'Juls', 'Carla', 'Paula', 'Tanke', 'Jordi', 'Núria', 'Sergi']);

  await sortBy(page, 'Alfabéticamente');
  await expect(names(page)).toHaveText(ALPHA);
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('sort and position filter combine, and are kept when switching tabs', async ({ page }) => {
  const { errors } = await openJugadoras(page);
  await sortBy(page, 'Fecha de nacimiento');
  await page.locator('#plantilla-position-filter').selectOption('3/4');
  await expect(names(page)).toHaveText(['Juls', 'Paula', 'Tanke']);
  await page.locator('#plantilla-position-filter').selectOption('delantera');
  await expect(names(page)).toHaveText(['Rovi', 'Carla']);

  await tab(page, 'Estadísticas').click();
  await tab(page, 'Datos').click();
  await expect(names(page)).toHaveText(['Rovi', 'Carla']);
  await expect(page.locator('#plantilla-position-filter')).toHaveValue('delantera');
  expect(relevantErrors(errors)).toEqual([]);
});

test('sort menus close when clicking outside them', async ({ page }) => {
  const { errors } = await openJugadoras(page);
  await page.locator('#plantilla-sort-btn').click();
  await expect(sortMenu(page)).toBeVisible();
  await sec(page).locator('h2').click();
  await expect(sortMenu(page)).toBeHidden();
  await expect(page.locator('#plantilla-sort-btn')).not.toHaveClass(/active/);
  await expect(names(page)).toHaveText(ALPHA);

  await tab(page, 'Estadísticas').click();
  await page.locator('#plantilla-stats-sort-btn').click();
  await expect(statsSortMenu(page)).toBeVisible();
  await expect(page.locator('#plantilla-stats-sort-btn')).toHaveClass(/active/);
  await statsRows(page).first().click();
  await expect(statsSortMenu(page)).toBeHidden();
  await expect(page.locator('#plantilla-stats-sort-btn')).not.toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('"Estadísticas" tab sums the match reports of members with an account', async ({ page }) => {
  const { backend, errors } = await openJugadoras(page);
  await expect(tab(page, 'Datos')).toHaveClass(/active/);
  await expect(page.locator('#plantilla-panel-estadisticas')).toBeHidden();

  await tab(page, 'Estadísticas').click();
  await expect(tab(page, 'Estadísticas')).toHaveClass(/active/);
  await expect(tab(page, 'Datos')).not.toHaveClass(/active/);
  await expect(page.locator('#plantilla-panel-datos')).toBeHidden();
  await expect(page.locator('#plantilla-panel-estadisticas')).toBeVisible();
  await expect(page.locator('#plantilla-panel-estadisticas thead th')).toHaveText([
    'Jugadora', 'Minutos jugados', 'Ensayos', 'Puntos', 'Tarjetas',
  ]);

  // Sorted by shown name (Carla, Juls, Paula, Rovi, Tanke) but labelled with the full name.
  // NOTE: so the list does not look alphabetical ("Marta Rovira" after "Paula Vidal").
  // Laura Gil (no account in the app) is not listed; zero values are shown as "—".
  await expect(statsRows(page)).toHaveCount(5);
  await expect(statsRows(page).nth(0).locator('td')).toHaveText(['CF Carla Font', '60', '—', '—', '—']);
  await expect(statsRows(page).nth(1).locator('td')).toHaveText(['JS Júlia Serra', '80', '1', '14', '1']);
  await expect(statsRows(page).nth(2).locator('td')).toHaveText(['PV Paula Vidal', '80', '2', '10', '—']);
  await expect(statsRows(page).nth(3).locator('td')).toHaveText(['Marta Rovira', '80', '1', '5', '1']);
  await expect(statsRows(page).nth(4).locator('td')).toHaveText(['AS Aina Soler', '20', '—', '—', '—']);
  await expect(statsRows(page).nth(3).locator('.avatar img')).toHaveAttribute('src', 'assets/img/1.jpg');
  await expect(page.locator('#plantilla-panel-estadisticas')).not.toContainText('Laura');

  await tab(page, 'Datos').click();
  await expect(page.locator('#plantilla-panel-datos')).toBeVisible();
  await expect(page.locator('#plantilla-panel-estadisticas')).toBeHidden();
  await expect(names(page)).toHaveText(ALPHA);
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('stats sort menu: minutes, tries, cards and points (most first)', async ({ page }) => {
  const { errors } = await openJugadoras(page);
  await tab(page, 'Estadísticas').click();
  await page.locator('#plantilla-stats-sort-btn').click();
  await expect(statsSortMenu(page).getByRole('button')).toHaveText(['Alfabéticamente', 'Minutos jugados', 'Ensayos', 'Tarjetas', 'Puntos']);
  await expect(statsSortMenu(page).locator('button.active')).toHaveText('Alfabéticamente');
  await page.locator('#plantilla-stats-sort-btn').click();
  await expect(statsSortMenu(page)).toBeHidden();

  // Ties keep the order of the match report rows.
  await statsSortBy(page, 'Minutos jugados');
  await expect(statsNames(page)).toHaveText(['Marta Rovira', 'Júlia Serra', 'Paula Vidal', 'Carla Font', 'Aina Soler']);
  await statsSortBy(page, 'Ensayos');
  await expect(statsNames(page)).toHaveText(['Paula Vidal', 'Marta Rovira', 'Júlia Serra', 'Carla Font', 'Aina Soler']);
  await statsSortBy(page, 'Tarjetas');
  await expect(statsNames(page)).toHaveText(['Marta Rovira', 'Júlia Serra', 'Carla Font', 'Paula Vidal', 'Aina Soler']);
  await statsSortBy(page, 'Puntos');
  await expect(statsNames(page)).toHaveText(['Júlia Serra', 'Paula Vidal', 'Marta Rovira', 'Carla Font', 'Aina Soler']);
  await page.locator('#plantilla-stats-sort-btn').click();
  await expect(statsSortMenu(page).locator('button.active')).toHaveText('Puntos');
  await page.locator('#plantilla-stats-sort-btn').click();

  // The Datos sort is independent.
  await tab(page, 'Datos').click();
  await expect(names(page)).toHaveText(ALPHA);
  await tab(page, 'Estadísticas').click();
  await expect(statsNames(page)).toHaveText(['Júlia Serra', 'Paula Vidal', 'Marta Rovira', 'Carla Font', 'Aina Soler']);

  await statsSortBy(page, 'Alfabéticamente');
  await expect(statsNames(page)).toHaveText(['Carla Font', 'Júlia Serra', 'Paula Vidal', 'Marta Rovira', 'Aina Soler']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('stats add up several matches, matching rows by profile, licence or name', async ({ page }) => {
  const extra = {
    ...seed,
    match_reports: [...seed.match_reports, { id: EVENT_IDS.matchPast1, match_duration_minutes: 80, match_duration_estimated: false, updated_at: '2026-09-13T10:00:00Z' }],
    match_report_players: [
      ...seed.match_report_players,
      // Paula by (accent/case-insensitive) name only
      { id: 'd1000000-0000-4000-8000-000000000201', match_id: EVENT_IDS.matchPast1, profile_id: null, is_own_team: true, jersey_number: 12, player_name: 'PAULA VIDAL', license_number: null, is_starter: true, minutes_played: 70, tries_count: 1, conversions_count: 0, penalties_count: 0, points: 5 },
      // Tanke by licence only
      { id: 'd1000000-0000-4000-8000-000000000202', match_id: EVENT_IDS.matchPast1, profile_id: null, is_own_team: true, jersey_number: 18, player_name: 'A. Soler', license_number: 'CAT-10455', is_starter: true, minutes_played: 60, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 },
      // Rival team rows are ignored
      { id: 'd1000000-0000-4000-8000-000000000203', match_id: EVENT_IDS.matchPast1, profile_id: IDS.carla, is_own_team: false, jersey_number: 4, player_name: 'Carla Font', license_number: 'CAT-10411', is_starter: true, minutes_played: 80, tries_count: 4, conversions_count: 0, penalties_count: 0, points: 20 },
    ],
    match_report_cards: [
      ...seed.match_report_cards,
      { id: 'd2000000-0000-4000-8000-000000000201', match_report_player_id: 'd1000000-0000-4000-8000-000000000201', card_type: 'amarilla', minute: 12 },
      { id: 'd2000000-0000-4000-8000-000000000202', match_report_player_id: 'd1000000-0000-4000-8000-000000000201', card_type: 'roja', minute: 70 },
    ],
  };
  const { errors } = await openJugadoras(page, { seed: extra });
  await tab(page, 'Estadísticas').click();
  await expect(statsRows(page).nth(0).locator('td')).toHaveText(['CF Carla Font', '60', '—', '—', '—']);
  await expect(statsRows(page).nth(2).locator('td')).toHaveText(['PV Paula Vidal', '150', '3', '15', '2']);
  await expect(statsRows(page).nth(4).locator('td')).toHaveText(['AS Aina Soler', '80', '—', '—', '—']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('without match reports the stats tab says so (also in Catalan)', async ({ page }) => {
  const { errors } = await openJugadoras(page, { seed: { ...seed, match_report_players: [] } });
  await tab(page, 'Estadísticas').click();
  await expect(statsRows(page)).toHaveText('Todavía no hay actas de partido guardadas.');
  await page.evaluate(() => window.setLang('ca'));
  await expect(statsRows(page)).toHaveText('Encara no hi ha actes de partit desades.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('with only the admin account registered the table says there are no members', async ({ page }) => {
  // (fines of unknown players are dropped too: they would break the Multas table)
  const onlyAdmin = { ...seed, profiles: seed.profiles.filter((p) => p.is_admin), fines: [] };
  const { errors } = await openJugadoras(page, { user: USERS.admin, seed: onlyAdmin });
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toHaveText('Todavía no hay miembros registrados.');
  expect(relevantErrors(errors)).toEqual([]);
});

test('shown names: mote, else first name, else first name + surname initial when repeated', async ({ page }) => {
  const extraProfile = (n, patch) => ({
    id: `0f000000-0000-4000-8000-00000000000${n}`, nombre: '', apellido: '', mote: '', telefono: null,
    fecha_nacimiento: null, rol: null, rango: null, posicion: null, comision: null, licencia: null,
    grupo_tercer_tiempo: null, avatar_url: null, is_admin: false, ...patch,
  });
  const { errors } = await openJugadoras(page, { seed: { ...seed, profiles: [
    ...seed.profiles,
    extraProfile(1, { nombre: 'Carla', apellido: 'Puig', rol: 'jugadora' }), // second "Carla"
    extraProfile(2, { nombre: 'Marta', apellido: 'Gil', rol: 'jugadora' }),  // Marta Rovira has a mote
    extraProfile(3, {}),                                                      // nothing filled in
  ] } });
  // NOTE: a member without name nor mote is shown as "Sin" (the first word of the
  // "Sin nombre" placeholder), with initial "S".
  await expect(names(page)).toHaveText(['Carla F.', 'Carla P.', 'Jordi', 'Juls', 'Marta', 'Núria', 'Paula', 'Rovi', 'Sergi', 'Sin', 'Tanke']);
  // Everything unassigned: "Sin asignar" cells (no role -> "—" for player-only columns).
  await expect(rowOf(page, 'Sin').locator('td')).toHaveText(['S Sin', 'Sin asignar', 'Sin asignar', '—', '—', '—', 'Sin asignar']);
  await expect(rowOf(page, 'Sin').locator('td').nth(1)).toHaveClass(/muted-cell/);
  await expect(rowOf(page, 'Carla P.').locator('td')).toHaveText(['CP Carla P.', 'Sin asignar', 'jugadora', 'Sin asignar', 'Sin asignar', 'Sin asignar', 'Sin asignar']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the refresh button reloads the members from Supabase', async ({ page }) => {
  const { backend, errors } = await openJugadoras(page);
  await expect(names(page)).toHaveText(ALPHA);
  backend.db.profiles.push({
    id: '0f000000-0000-4000-8000-000000000009', nombre: 'Berta', apellido: 'Roca', mote: 'Bertu', telefono: null,
    fecha_nacimiento: '2004-02-02', rol: 'jugadora', rango: 'novata', posicion: 'delantera', comision: null,
    licencia: null, grupo_tercer_tiempo: 'B', avatar_url: null, is_admin: false,
  });
  backend.db.profiles.find((p) => p.id === IDS.paula).mote = 'Pauleta';
  await sec(page).getByRole('button', { name: 'Actualizar' }).click();
  await expect(names(page)).toHaveText(['Bertu', 'Carla', 'Jordi', 'Juls', 'Núria', 'Pauleta', 'Rovi', 'Sergi', 'Tanke']);
  await expect(rowOf(page, 'Bertu').locator('td')).toHaveText(['B Bertu', '02/02/2004', 'jugadora', 'novata', 'Delantera', 'Sin asignar', 'Sin asignar']);
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: headers, tabs, filter, sort options and cell texts', async ({ page }) => {
  const { errors } = await openJugadoras(page);
  await page.evaluate(() => window.setLang('ca'));
  await expect(sec(page).locator('h2')).toHaveText('Jugadores');
  await expect(sec(page).locator('.gym-day-group-tab')).toHaveText(['Dades', 'Estadístiques']);
  await expect(sec(page).locator('thead').first().locator('th:visible')).toHaveText([
    'Jugadora', 'Data de naixement', 'Rol', 'Rang', 'Posició', 'Comissió', 'Núm. de llicència',
  ]);
  await expect(page.locator('#plantilla-position-filter option')).toHaveText(['Totes', 'Davantera', '3/4']);
  await expect(sortMenu(page).locator('button')).toHaveText([
    'Alfabèticament', 'Data de naixement', 'Comissió', 'Núm. de targetes (de més a menys)',
  ]);
  await expect(rowOf(page, 'Carla').locator('td').nth(4)).toHaveText('Davantera');
  await expect(rowOf(page, 'Núria').locator('td').nth(6)).toHaveText('Sense assignar');
  await expect(names(page)).toHaveText(ALPHA);

  await tab(page, 'Estadístiques').click();
  await expect(page.locator('#plantilla-panel-estadisticas thead th')).toHaveText(['Jugadora', 'Minuts jugats', 'Assaigs', 'Punts', 'Targetes']);
  await expect(statsSortMenu(page).locator('button')).toHaveText(['Alfabèticament', 'Minuts jugats', 'Assaigs', 'Targetes', 'Punts']);
  await expect(statsRows(page)).toHaveCount(5);
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: opened from the Vestuario hub, the table scrolls inside its card, not the page', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  await page.locator('.bottom-nav button[data-tab="vestuario"]').click();
  await page.locator('#sec-vestuario .vest-card.i-plantilla').click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(page.locator('.bottom-nav button[data-tab="vestuario"]')).toHaveClass(/active/);

  await expect(names(page)).toHaveText(ALPHA);
  await expect(rows(page).first().locator('td')).toHaveCount(7);
  // The 7 columns do not fit in 390px: the card scrolls horizontally, the page does not.
  const card = page.locator('#plantilla-panel-datos .players-table-card');
  const cardSize = await card.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  expect(cardSize.scrollWidth).toBeGreaterThan(cardSize.clientWidth);
  const pageSize = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(pageSize.scrollWidth).toBeLessThanOrEqual(pageSize.innerWidth);

  // Back link returns to Vestuario.
  await sec(page).locator('.back-link').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});
