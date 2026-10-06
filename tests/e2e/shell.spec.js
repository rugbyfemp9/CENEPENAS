// Characterization tests for the app shell: the login / register overlay (Supabase
// Auth), logout, session restore, the desktop sidebar, the mobile top bar + bottom nav,
// the Vestuario hub, the browser back button, the pages hidden from staff, the
// language switch (ES / CAT) and the PWA bits in the DOM.
//
// Seed accounts: USERS.player = Júlia Serra "Juls" (jugadora, group A),
// USERS.admin = Montse Puig (directiva, is_admin -> treated as staff / "Cos Tècnic").
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { PROJECT_REF, SUPABASE_ORIGIN } from './support/fake-supabase.js';
import { seed, IDS } from './fixtures/seed.js';

const TOKEN_KEY = `sb-${PROJECT_REF}-auth-token`;
const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
const JORDI = authUser(IDS.jordi, 'jordi@cnpenas.test'); // entrenador/a (staff, not admin)
const MARTA = authUser(IDS.marta, 'marta@cnpenas.test'); // Capitana (same pages as a jugadora)

const overlay = (page) => page.locator('#auth-overlay');
const loginView = (page) => page.locator('#auth-login-view');
const registerView = (page) => page.locator('#auth-register-view');
const sidebarBtn = (page, id) => page.locator(`.sidebar .nav button[data-section="${id}"]`);
const bottomBtn = (page, tab) => page.locator(`.bottom-nav button[data-tab="${tab}"]`);
const activeSection = (page) => page.locator('main .section.active');
const authWrites = (backend) => backend.mutations.filter((m) => m.kind === 'auth');
const restWrites = (backend, table) => backend.mutations.filter((m) => m.kind === 'rest' && m.table === table);
const tokenInStorage = (page) => page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);

const PLAYER_SIDEBAR = ['Inicio', 'Asistencia', 'Multas', 'Tercer tiempo', 'Comisiones', 'Tricount', 'Liga', 'Fantasy', 'Jugadas', 'Galería', 'Jugadoras', 'Gym', 'Partidos', 'Mi perfil'];
const STAFF_SIDEBAR = ['Inicio', 'Asistencia', 'Multas', 'Liga', 'Fantasy', 'Jugadas', 'Galería', 'Jugadoras', 'Gym', 'Partidos', 'Percepción del esfuerzo', 'Mi perfil'];
const STAFF_HIDDEN = ['tercer', 'tercer-historial', 'tercer-detalle', 'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps', 'comi-tesoreria', 'comi-gira', 'tricount'];

async function startLoggedOut(page, opts = {}) {
  await page.setViewportSize(VIEWPORTS.desktop);
  const ctx = await setupApp(page, { user: null, ...opts });
  await openApp(page);
  return ctx;
}

async function login(page, email, password = 'secreta123') {
  await page.locator('#login-email-input').fill(email);
  await page.locator('#login-password-input').fill(password);
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
}

async function start(page, { user = USERS.player, viewport = VIEWPORTS.desktop, seed: s } = {}) {
  await page.setViewportSize(viewport);
  const ctx = await setupApp(page, { user, ...(s ? { seed: s } : {}) });
  await openApp(page);
  return ctx;
}

// The registration asks for the size of each tercer-tiempo group with HEAD + count=exact.
// The fake backend does not expose Content-Range to the (cross-origin) page, so those
// counts would read as null; this answers them like real PostgREST does.
async function exposeProfileCounts(page, backend) {
  await page.route(`${SUPABASE_ORIGIN}/rest/v1/profiles**`, (route) => {
    const req = route.request();
    if (req.method() !== 'HEAD') return route.fallback();
    const url = new URL(req.url());
    const group = (url.searchParams.get('grupo_tercer_tiempo') || '').replace(/^eq\./, '');
    const n = backend.db.profiles.filter((p) => p.grupo_tercer_tiempo === group && !p.is_admin).length;
    return route.fulfill({
      status: 200, body: '',
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', 'Content-Range': n ? `0-${n - 1}/${n}` : `*/0` },
    });
  });
}

async function fillRegister(page, fields) {
  for (const [id, value] of Object.entries(fields)) {
    const el = page.locator(`#register-${id}-input`);
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(value);
    else await el.fill(value);
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

test('logged out: the login form is shown over the app', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await expect(overlay(page)).toBeVisible();
  await expect(overlay(page).locator('.auth-brand-name')).toHaveText('CNPENAS');
  await expect(loginView(page)).toBeVisible();
  await expect(registerView(page)).toBeHidden();
  await expect(loginView(page).locator('h3')).toHaveText('Iniciar sesión');
  await expect(page.locator('#login-email-input')).toHaveAttribute('type', 'email');
  await expect(page.locator('#login-password-input')).toHaveAttribute('type', 'password');
  await expect(page.locator('#login-error')).toHaveText('');
  expect(await tokenInStorage(page)).toBeNull();
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('login validation and invalid credentials', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  const error = page.locator('#login-error');
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
  await expect(error).toHaveText('Introduce tu email y contraseña.');
  await page.locator('#login-email-input').fill('jugadora@cnpenas.test');
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
  await expect(error).toHaveText('Introduce tu email y contraseña.');
  await page.locator('#login-email-input').fill('   ');
  await page.locator('#login-password-input').fill('secreta123');
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
  await expect(error).toHaveText('Introduce tu email y contraseña.');

  await login(page, 'nadie@cnpenas.test');
  await expect(error).toHaveText('Invalid login credentials');
  await expect(overlay(page)).toBeVisible();
  expect(await tokenInStorage(page)).toBeNull();
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('valid login hides the overlay, loads the profile and stores the session; reload restores it', async ({ page }) => {
  const { errors } = await startLoggedOut(page);
  await login(page, '  jugadora@cnpenas.test ');
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator('#login-error')).toHaveText('');
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect(page.locator('#inicio-tercer-banner .txt span')).toHaveText('Te toca cocinar · Partido vs Santboi');
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  await expect(page.locator('#profile-email-display')).toHaveText('jugadora@cnpenas.test');
  const stored = JSON.parse(await tokenInStorage(page));
  expect(stored.user.email).toBe('jugadora@cnpenas.test');

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('an existing session skips the login form', async ({ page }) => {
  const { errors } = await start(page);
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator('#profile-email-display')).toHaveText('jugadora@cnpenas.test');
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  expect(relevantErrors(errors)).toEqual([]);
});

test('logout signs out and reloads the page back to the login form', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await login(page, 'jugadora@cnpenas.test');
  await expect(overlay(page)).toBeHidden();
  await sidebarBtn(page, 'perfil').click();
  const loads = [];
  page.on('load', () => loads.push(Date.now()));
  await page.locator('#sec-perfil').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect.poll(() => loads.length).toBe(1);
  await page.waitForLoadState('networkidle');
  await expect(overlay(page)).toBeVisible();
  await expect(loginView(page)).toBeVisible();
  // After the full reload the app starts again on Inicio with empty fields.
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect(page.locator('#login-email-input')).toHaveValue('');
  expect(authWrites(backend)).toEqual([{ kind: 'auth', action: 'logout' }]);
  expect(await tokenInStorage(page)).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

test('switching between login and register clears the errors', async ({ page }) => {
  const { errors } = await startLoggedOut(page);
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#login-error')).toHaveText('Introduce tu email y contraseña.');

  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await expect(registerView(page)).toBeVisible();
  await expect(loginView(page)).toBeHidden();
  await expect(registerView(page).locator('h3')).toHaveText('Crear cuenta');
  await expect(page.locator('#login-error')).toHaveText('');

  await registerView(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.locator('#register-error')).toHaveText('Rellena al menos email, contraseña, nombre y rol.');
  await registerView(page).getByText('Inicia sesión', { exact: true }).click();
  await expect(loginView(page)).toBeVisible();
  await expect(registerView(page)).toBeHidden();
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await expect(page.locator('#register-error')).toHaveText('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('register form: the player-only fields appear only for Jugadora and Capitana', async ({ page }) => {
  const { errors } = await startLoggedOut(page);
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  const labels = registerView(page).locator('.auth-field-group > label');
  await expect(labels).toHaveCount(7);
  await expect(page.locator('#register-rol-input option')).toHaveText(['Selecciona un rol', 'Jugadora', 'Capitana', 'Entrenador/a', 'Delegado/a', 'Junta directiva', 'Fisios']);
  // NOTE: there is no phone field in the form (telefono is always sent as null).
  await expect(page.locator('#register-telefono-input')).toHaveCount(0);
  const playerFields = page.locator('#register-jugadora-fields');
  await expect(playerFields).toBeHidden();

  for (const [rol, visible] of [['jugadora', true], ['entrenador/a', false], ['Capitana', true], ['delegado/a', false], ['directiva', false], ['fisio', false], ['', false]]) {
    await page.locator('#register-rol-input').selectOption(rol);
    if (visible) await expect(playerFields).toBeVisible();
    else await expect(playerFields).toBeHidden();
  }
  await page.locator('#register-rol-input').selectOption('jugadora');
  await expect(page.locator('#register-rango-input option')).toHaveText(['Selecciona un rango', 'Veterana', 'Novata', 'Sang de Fang']);
  await expect(page.locator('#register-posicion-input option')).toHaveText(['Selecciona una posición', 'Delantera', '3/4']);
  await expect(page.locator('#register-comision-input option')).toHaveText(['Sin asignar', 'Comi Xarxes', 'Comi Tesoreria', 'Comi Gira', 'Comi Tercer Temps', 'Comi Activitats']);
  await expect(page.locator('#register-licencia-input')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('register validation: email, password, name and role are required', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  const submit = registerView(page).getByRole('button', { name: 'Crear cuenta' });
  const error = page.locator('#register-error');
  await fillRegister(page, { email: 'nueva@cnpenas.test', password: 'secreta123', nombre: 'Laia' });
  await submit.click();
  await expect(error).toHaveText('Rellena al menos email, contraseña, nombre y rol.');
  await fillRegister(page, { rol: 'jugadora', nombre: '  ' });
  await submit.click();
  await expect(error).toHaveText('Rellena al menos email, contraseña, nombre y rol.');
  await fillRegister(page, { nombre: 'Laia', password: '' });
  await submit.click();
  await expect(error).toHaveText('Rellena al menos email, contraseña, nombre y rol.');
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('registering a player: signUp metadata, profiles upsert with the smaller group, then logged in', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await exposeProfileCounts(page, backend);
  backend.idCounter = 500; // new auth user id: 9e9e9e9e-…-000000000500
  const newId = '9e9e9e9e-0000-4000-8000-000000000500';
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await fillRegister(page, {
    email: ' nueva@cnpenas.test ', password: 'secreta123', nombre: ' Laia ', apellido: ' Mogas ', mote: ' Lai ',
    'fecha-nacimiento': '2000-02-29', rol: 'jugadora', rango: 'novata', posicion: 'delantera', comision: 'Comi Gira', licencia: ' CAT-1 ',
  });
  await registerView(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(overlay(page)).toBeHidden();

  // Group A has 3 players and B has 2 (admin excluded), so the new player goes to B.
  const profile = { nombre: 'Laia', apellido: 'Mogas', mote: 'Lai', telefono: null, fecha_nacimiento: '2000-02-29', rol: 'jugadora', rango: 'novata', posicion: 'delantera', comision: 'Comi Gira', licencia: 'CAT-1', grupo_tercer_tiempo: 'B' };
  expect(authWrites(backend)).toEqual([{ kind: 'auth', action: 'signup', email: 'nueva@cnpenas.test', data: profile }]);
  const upserts = restWrites(backend, 'profiles');
  expect(upserts).toHaveLength(1);
  expect(upserts[0].method).toBe('UPSERT');
  expect(upserts[0].body).toEqual([{ id: newId, ...profile }]);

  await expect(page.locator('#profile-name-display')).toHaveText('Laia Mogas');
  await expect(page.locator('#profile-email-display')).toHaveText('nueva@cnpenas.test');
  await expect(page.locator('#inicio-tercer-banner .txt span')).toHaveText('Te toca limpiar · Partido vs Santboi');
  expect(JSON.parse(await tokenInStorage(page)).user.id).toBe(newId);
  expect(relevantErrors(errors)).toEqual([]);
});

test('registering with a staff role: player fields are dropped and the new account gets staff pages', async ({ page }) => {
  // Groups tied (A: Juls, Rovi; B: Carla, Paula) -> the new account goes to A.
  const tied = { ...seed, profiles: seed.profiles.map((p) => (p.id === IDS.aina ? { ...p, grupo_tercer_tiempo: null } : p)) };
  const { backend, errors } = await startLoggedOut(page, { seed: tied });
  await exposeProfileCounts(page, backend);
  backend.idCounter = 500;
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  // Player fields filled first, then the role is switched to "Junta directiva".
  await fillRegister(page, { rol: 'jugadora', rango: 'veterana', posicion: '3/4', comision: 'Comi Tesoreria', licencia: 'X' });
  await fillRegister(page, { email: 'jefa@cnpenas.test', password: 'secreta123', nombre: 'Jefa', rol: 'directiva' });
  await registerView(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(overlay(page)).toBeHidden();

  const profile = { nombre: 'Jefa', apellido: '', mote: '', telefono: null, fecha_nacimiento: null, rol: 'directiva', rango: null, posicion: null, comision: null, licencia: null, grupo_tercer_tiempo: 'A' };
  expect(authWrites(backend)).toEqual([{ kind: 'auth', action: 'signup', email: 'jefa@cnpenas.test', data: profile }]);
  expect(restWrites(backend, 'profiles')[0].body).toEqual([{ id: '9e9e9e9e-0000-4000-8000-000000000500', ...profile }]);
  // NOTE (security): anyone can pick their own role when registering, so a brand-new
  // account can self-assign "Junta directiva" (or coach, delegate, physio) and gets the
  // staff pages straight away. Staff also get a tercer-tiempo group assigned.
  await expect(sidebarBtn(page, 'wellness-staff')).toBeVisible();
  await expect(sidebarBtn(page, 'tercer')).toBeHidden();
  await expect(page.locator('#att-add-event-btn')).toBeAttached();
  await sidebarBtn(page, 'asistencia').click();
  await expect(page.locator('#att-add-event-btn')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('registering when the project requires email confirmation shows a message and stays on the form', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await exposeProfileCounts(page, backend);
  const signups = [];
  const newId = '00000000-0000-4000-8000-000000000777';
  // No session in the signUp response = email confirmation pending.
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup**`, (route) => {
    const body = route.request().postDataJSON();
    signups.push(body);
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ id: newId, email: body.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: body.data, identities: [{ id: newId }] }),
    });
  });
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await fillRegister(page, { email: 'nueva@cnpenas.test', password: 'secreta123', nombre: 'Laia', rol: 'fisio' });
  await registerView(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.locator('#register-error')).toHaveText('Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.');
  await expect(overlay(page)).toBeVisible();
  expect(signups).toHaveLength(1);
  expect(signups[0]).toMatchObject({ email: 'nueva@cnpenas.test', password: 'secreta123', data: { nombre: 'Laia', rol: 'fisio', grupo_tercer_tiempo: 'B' } });
  // The profile row is still upserted with the new user id.
  const upserts = restWrites(backend, 'profiles');
  expect(upserts).toHaveLength(1);
  expect(upserts[0].body[0]).toMatchObject({ id: newId, nombre: 'Laia', rol: 'fisio' });
  expect(await tokenInStorage(page)).toBeNull();
  // Switching views resets the message.
  await registerView(page).getByText('Inicia sesión', { exact: true }).click();
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await expect(page.locator('#register-error')).toHaveText('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a signUp error is shown and no profile is written', async ({ page }) => {
  const { backend, errors } = await startLoggedOut(page);
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/signup**`, (route) => route.fulfill({
    status: 422, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }),
  }));
  await loginView(page).getByText('Regístrate', { exact: true }).click();
  await fillRegister(page, { email: 'jugadora@cnpenas.test', password: 'secreta123', nombre: 'Júlia', rol: 'jugadora' });
  await registerView(page).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.locator('#register-error')).toHaveText('User already registered');
  await expect(overlay(page)).toBeVisible();
  expect(restWrites(backend, 'profiles')).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test('desktop sidebar: every link opens its section and is the only active one', async ({ page }) => {
  const { errors } = await start(page);
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('.top-bar-mobile')).toBeHidden();
  await expect(page.locator('.sidebar .brand .name span')).toHaveText('Panel del club');
  await expect(page.locator('.sidebar .footer-note')).toHaveText('Temporada 2026/27');
  await expect(page.locator('.sidebar .nav button[data-section]:visible')).toHaveText(PLAYER_SIDEBAR);
  await expect(sidebarBtn(page, 'inicio')).toHaveClass(/active/);

  const headings = {
    inicio: 'Inicio', asistencia: 'Asistencia', multas: 'Multas del equipo', tercer: 'Tercer tiempo', comisiones: 'Comisiones',
    tricount: 'Tricount', liga: 'Liga', fantasy: 'Fantasy', jugadas: 'Jugadas', galeria: 'Galería', plantilla: 'Jugadoras', gym: 'Gym', partidos: 'Partidos', perfil: 'Mi perfil',
  };
  for (const id of [...Object.keys(headings).slice(1), 'inicio']) {
    await sidebarBtn(page, id).click();
    await expect(page.locator(`#sec-${id}`)).toHaveClass(/active/);
    await expect(activeSection(page)).toHaveCount(1);
    await expect(page.locator(`#sec-${id} .section-head h2`).first()).toHaveText(headings[id]);
    await expect(page.locator('.sidebar .nav button.active')).toHaveCount(1);
    await expect(sidebarBtn(page, id)).toHaveClass(/active/);
  }
  // NOTE: the per-section titles/subtitles map in state.js (`titles`) is not rendered
  // anywhere: the document title never changes.
  await expect(page).toHaveTitle('CNPENAS — Panel del club');
  expect(relevantErrors(errors)).toEqual([]);
});

test('desktop sidebar: sub-pages keep their parent link highlighted', async ({ page }) => {
  const { errors } = await start(page);
  await sidebarBtn(page, 'tercer').click();
  await page.getByRole('button', { name: 'Ver tercers tiempos pasados' }).click();
  await expect(page.locator('#sec-tercer-historial')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'tercer')).toHaveClass(/active/);

  await sidebarBtn(page, 'comisiones').click();
  await page.locator('#sec-comisiones .vest-card').filter({ hasText: 'Comi Tesoreria' }).click();
  await expect(page.locator('#sec-comi-tesoreria')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'comisiones')).toHaveClass(/active/);
  await expect(page.locator('.sidebar .nav button.active')).toHaveCount(1);

  // Vestuario has no sidebar link: nothing is highlighted there.
  await page.locator('#sec-comi-tesoreria .back-link').click();
  await expect(page.locator('#sec-comisiones')).toHaveClass(/active/);
  await goToSection(page, 'vestuario');
  await expect(page.locator('.sidebar .nav button.active')).toHaveCount(0);
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: top bar and bottom nav; sub-pages highlight the Vestuario tab', async ({ page }) => {
  const { errors } = await start(page, { viewport: VIEWPORTS.mobile });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('.top-bar-mobile')).toBeVisible();
  await expect(page.locator('.top-bar-mobile .club .name')).toHaveText('CNPENAS');
  await expect(page.locator('.bottom-nav button')).toHaveText(['Inicio', 'Asistencia', 'Vestuario', 'Perfil']);
  await expect(bottomBtn(page, 'inicio')).toHaveClass(/active/);

  await bottomBtn(page, 'asistencia').click();
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  await expect(bottomBtn(page, 'asistencia')).toHaveClass(/active/);
  await expect(page.locator('.bottom-nav button.active')).toHaveCount(1);

  await bottomBtn(page, 'vestuario').click();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario h2')).toHaveText('Vestuario');
  await page.locator('#vest-card-tercer').click();
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  await expect(bottomBtn(page, 'vestuario')).toHaveClass(/active/);

  await page.locator('#profile-btn').click();
  await expect(page.locator('#sec-perfil')).toHaveClass(/active/);
  await expect(bottomBtn(page, 'perfil')).toHaveClass(/active/);
  await page.locator('#sec-perfil .back-link').click();
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect(bottomBtn(page, 'inicio')).toHaveClass(/active/);

  // Inicio cards navigate too.
  await page.locator('#inicio-fines-banner').click();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
  await expect(bottomBtn(page, 'vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Vestuario hub: the cards a player sees and where they lead', async ({ page }) => {
  const { errors } = await start(page, { viewport: VIEWPORTS.mobile });
  await bottomBtn(page, 'vestuario').click();
  const cards = page.locator('#sec-vestuario .vest-card:visible');
  await expect(cards.locator('.txt b')).toHaveText(['Gym', 'Multas', 'Tercer tiempo', 'Jugadoras', 'Galería', 'Comisiones', 'Liga', 'Tricount', 'Fantasy', 'Jugadas', 'Partidos', 'Test']);
  await expect(cards.locator('.txt span')).toHaveText([
    'Rutina, marcas y ranking', '23 € pendientes',
    // NOTE: hardcoded, stale subtitle (it is not computed from the next home match).
    'Próximo: 23 de agosto',
    'Lista de jugadoras y miembros del club', 'Fotos del equipo', 'Grupos de trabajo del club', 'Clasificación y resultados',
    /./, 'Prueba alineaciones a tu manera', 'Touch, melé, ataque y más', 'Todos los partidos de la temporada', 'Sección de pruebas',
  ]);
  const targets = ['gym', 'multas', 'tercer', 'plantilla', 'galeria', 'comisiones', 'liga', 'tricount', 'fantasy', 'jugadas', 'partidos', 'test'];
  for (let i = 0; i < targets.length; i++) {
    await cards.nth(i).click();
    await expect(page.locator(`#sec-${targets[i]}`)).toHaveClass(/active/);
    // NOTE: "Test" is not mapped to the Vestuario tab, so no bottom tab is active there.
    if (targets[i] === 'test') await expect(page.locator('.bottom-nav button.active')).toHaveCount(0);
    else await expect(bottomBtn(page, 'vestuario')).toHaveClass(/active/);
    await bottomBtn(page, 'vestuario').click();
    await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  }
  expect(relevantErrors(errors)).toEqual([]);
});

test('browser back / forward move between the visited sections', async ({ page }) => {
  const { errors } = await start(page);
  await sidebarBtn(page, 'asistencia').click();
  await sidebarBtn(page, 'multas').click();
  await sidebarBtn(page, 'multas').click(); // same section: no extra history entry
  await sidebarBtn(page, 'liga').click();

  await page.goBack();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'multas')).toHaveClass(/active/);
  await page.goBack();
  await expect(page.locator('#sec-asistencia')).toHaveClass(/active/);
  await page.goForward();
  await expect(page.locator('#sec-multas')).toHaveClass(/active/);
  await page.goBack();
  await page.goBack();
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'inicio')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('browser back with a modal open only closes the modal', async ({ page }) => {
  const { errors } = await start(page);
  await sidebarBtn(page, 'tercer').click();
  await page.locator('#tt-groups-btn').click();
  const modal = page.locator('#tt-groups-overview-modal');
  await expect(modal).toHaveClass(/active/);

  await page.goBack();
  await expect(modal).not.toHaveClass(/active/);
  await expect(page.locator('#sec-tercer')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'tercer')).toHaveClass(/active/);

  await page.goBack();
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  // NOTE: closing the modal replaced the forward entry with the previous section's
  // state, so "forward" now shows Inicio again instead of Tercer tiempo.
  await page.goForward();
  await expect(page.locator('#sec-inicio')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Staff-only visibility
// ---------------------------------------------------------------------------

test('staff (admin) do not see the player pages and see the effort analysis page', async ({ page }) => {
  const { errors } = await start(page, { user: USERS.admin });
  await expect(page.locator('.sidebar .nav button[data-section]:visible')).toHaveText(STAFF_SIDEBAR);
  await expect(page.locator('#inicio-tercer-banner')).toBeHidden();
  await expect(page.locator('#inicio-tricount-banner')).toBeHidden();
  await expect(page.locator('#inicio-fines-banner')).toBeVisible();
  await goToSection(page, 'vestuario');
  await expect(page.locator('#sec-vestuario .vest-card:visible .txt b')).toHaveText(['Gym', 'Multas', 'Jugadoras', 'Galería', 'Liga', 'Fantasy', 'Jugadas', 'Partidos', 'Percepción del esfuerzo', 'Test']);
  await sidebarBtn(page, 'wellness-staff').click();
  await expect(page.locator('#sec-wellness-staff')).toHaveClass(/active/);
  await expect(sidebarBtn(page, 'wellness-staff')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff reaching a player page is redirected to Vestuario', async ({ page }) => {
  const { errors } = await start(page, { user: JORDI });
  await expect(sidebarBtn(page, 'tercer')).toBeHidden();
  await expect(sidebarBtn(page, 'wellness-staff')).toBeVisible();
  for (const id of STAFF_HIDDEN) {
    await goToSection(page, id);
    await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
    await expect(activeSection(page)).toHaveCount(1);
  }
  // NOTE: the redirected entry stays in the history, so "back" lands on it again and
  // is redirected to Vestuario once more (staff get stuck on Vestuario).
  await page.goBack();
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);
});

test('players (and Capitana) do not see the effort analysis page and are redirected from it', async ({ page, browser }) => {
  const { errors } = await start(page);
  await expect(sidebarBtn(page, 'wellness-staff')).toBeHidden();
  await goToSection(page, 'wellness-staff');
  await expect(page.locator('#sec-wellness-staff')).not.toHaveClass(/active/);
  await expect(page.locator('#sec-vestuario')).toHaveClass(/active/);
  // Player pages are reachable.
  await goToSection(page, 'tricount');
  await expect(page.locator('#sec-tricount')).toHaveClass(/active/);
  expect(relevantErrors(errors)).toEqual([]);

  const other = await browser.newPage();
  const ctx2 = await start(other, { user: MARTA });
  await expect(other.locator('.sidebar .nav button[data-section]:visible')).toHaveText(PLAYER_SIDEBAR);
  await expect(other.locator('#inicio-tercer-banner')).toBeVisible();
  expect(relevantErrors(ctx2.errors)).toEqual([]);
  await other.close();
});

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

test('desktop ES / CAT switch translates the app, is remembered and sets <html lang>', async ({ page }) => {
  const { errors } = await start(page);
  const es = page.locator('.lang-switch').getByRole('button', { name: 'ES', exact: true });
  const ca = page.locator('.lang-switch').getByRole('button', { name: 'CAT', exact: true });
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(es).toHaveClass(/active/);
  await expect(ca).not.toHaveClass(/active/);

  await ca.click();
  await expect(ca).toHaveClass(/active/);
  await expect(es).not.toHaveClass(/active/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  expect(await page.evaluate(() => localStorage.getItem('cnpenas:lang'))).toBe('ca');
  await expect(page.locator('.sidebar .nav button[data-section]:visible')).toHaveText(['Inici', 'Assistència', 'Multes', 'Tercer temps', 'Comissions', 'Tricount', 'Lliga', 'Fantasy', 'Jugades', 'Galeria', 'Jugadores', 'Gym', 'Partits', 'El meu perfil']);
  await expect(page.locator('.sidebar .brand .name span')).toHaveText('Panell del club');
  await expect(page.locator('#sec-inicio h2')).toHaveText('Inici');
  await expect(page.locator('#inicio-tercer-banner .txt span')).toHaveText('Et toca cuinar · Partido vs Santboi');

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  await expect(sidebarBtn(page, 'inicio')).toHaveText('Inici');
  await expect(page.locator('.lang-switch').getByRole('button', { name: 'CAT', exact: true })).toHaveClass(/active/);

  await page.locator('.lang-switch').getByRole('button', { name: 'ES', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(sidebarBtn(page, 'inicio')).toHaveText('Inicio');
  expect(await page.evaluate(() => localStorage.getItem('cnpenas:lang'))).toBe('es');
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile language toggle switches between ES and CAT', async ({ page }) => {
  const { errors } = await start(page, { viewport: VIEWPORTS.mobile });
  const toggle = page.locator('#lang-toggle-mobile');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('data-lang', 'es');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-lang', 'ca');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  expect(await page.evaluate(() => localStorage.getItem('cnpenas:lang'))).toBe('ca');
  await expect(page.locator('#sec-inicio h2')).toHaveText('Inici');
  // The bottom nav labels follow the language (they used to stay in Spanish).
  await expect(page.locator('.bottom-nav button')).toHaveText(['Inici', 'Assistència', 'Vestidor', 'Perfil']);
  await bottomBtn(page, 'vestuario').click();
  await expect(page.locator('#sec-vestuario h2')).toHaveText('Vestidor');

  await toggle.click();
  await expect(toggle).toHaveAttribute('data-lang', 'es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#sec-vestuario h2')).toHaveText('Vestuario');
  expect(await page.evaluate(() => localStorage.getItem('cnpenas:lang'))).toBe('es');
  expect(relevantErrors(errors)).toEqual([]);
});

test('a saved language is applied on start, including the login form', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cnpenas:lang', 'ca'));
  const { errors } = await startLoggedOut(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  // The auth overlay follows the language too.
  await expect(loginView(page).locator('h3')).toHaveText('Iniciar sessió');
  await expect(loginView(page).getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(loginView(page).locator('.auth-switch')).toHaveText('No tens compte? Registra\'t');
  await expect(page.locator('#login-email-input')).toHaveAttribute('placeholder', 'el-teu@email.com');
  await loginView(page).getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#login-error')).toHaveText('Introdueix el teu email i contrasenya.');
  await loginView(page).locator('.auth-switch a').click();
  await expect(page.locator('#auth-register-view h3')).toHaveText('Crear compte');
  await expect(page.locator('#register-password-input')).toHaveAttribute('placeholder', 'Mínim 6 caràcters');
  await expect(page.locator('#register-rol-input option')).toHaveText(['Selecciona un rol', 'Jugadora', 'Capitana', 'Entrenador/a', 'Delegat/da', 'Junta directiva', 'Fisios']);
  await page.locator('#auth-register-view .auth-submit-btn').click();
  await expect(page.locator('#register-error')).toHaveText('Omple com a mínim email, contrasenya, nom i rol.');
  await page.locator('#auth-register-view .auth-switch a').click();
  await login(page, 'jugadora@cnpenas.test');
  await expect(overlay(page)).toBeHidden();
  await expect(sidebarBtn(page, 'inicio')).toHaveText('Inici');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// PWA
// ---------------------------------------------------------------------------

test('PWA: manifest link, theme colour and iOS home-screen tags', async ({ page, request }) => {
  const { errors } = await start(page);
  await expect(page).toHaveTitle('CNPENAS — Panel del club');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#4A9FD8');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'CNPN');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'assets/img/applogo.png');
  const manifestUrl = await page.locator('link[rel="manifest"]').evaluate((l) => l.href);
  const manifest = await (await request.get(manifestUrl)).json();
  expect(manifest).toMatchObject({ name: 'CNPENAS — Panel del club', short_name: 'CNPN', display: 'standalone', start_url: '.', theme_color: '#4A9FD8' });
  expect(manifest.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
  expect(relevantErrors(errors)).toEqual([]);
});
