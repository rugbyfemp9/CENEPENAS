// Characterization tests for "Mi perfil": the profile banner and data table, the
// matches-played / attendance stats, the injury badge picker, the edit-profile modal
// (own profile and the admin editing any player from Jugadoras), and the avatar menu
// (upload -> compress -> Storage "avatars", remove, adjust/crop modal).
//
// Seed (tests/e2e/fixtures/seed.js):
//   player = Júlia Serra "Juls", jugadora, 3/4, veterana, Comi Gira, licence CAT-10234,
//            appears (by licence) in the one seeded match report -> 1 match played.
//   admin  = Montse Puig, directiva, is_admin, Comi Tesoreria (hidden for staff roles).
// Injuries are only kept in memory (never written to Supabase).
import zlib from 'node:zlib';
import { test, expect } from '@playwright/test';
import { setupApp, openApp, goToSection, USERS, VIEWPORTS, relevantErrors } from './support/app.js';
import { seed, IDS, EVENT_IDS } from './fixtures/seed.js';

const authUser = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
// Marta Rovira "Rovi": Capitana, delantera, has a (local) photo.
const ROVI = authUser(IDS.marta, 'rovi@cnpenas.test');

const SUPABASE = 'https://tpbuxspqibwitqzstdcz.supabase.co';
const NOW_MS = 1790323200000; // 2026-09-25T10:00:00+02:00 (fixed clock)
const avatarPublicUrl = (id) => `${SUPABASE}/storage/v1/object/public/avatars/${id}/avatar.jpg?t=${NOW_MS}`;

const withProfile = (id, patch, base = seed) => ({
  ...base,
  profiles: base.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
});
const restWrites = (backend) => backend.mutations.filter((m) => m.kind === 'rest');
const storageWrites = (backend) => backend.mutations.filter((m) => m.kind === 'storage');

const sec = (page) => page.locator('#sec-perfil');
const modal = (page) => page.locator('#edit-profile-modal');
const pfAvatar = (page) => page.locator('#pf-avatar');
const avatarMenu = (page) => page.locator('#pf-avatar-menu');
const adjustModal = (page) => page.locator('#avatar-adjust-modal');
const plantillaRow = (page, name) => page.locator('#plantilla-grid tr').filter({ has: page.locator('.col-player b', { hasText: new RegExp(`^${name}$`) }) });

async function openProfile(page, opts = {}) {
  const ctx = await setupApp(page, { user: USERS.player, ...opts });
  await openApp(page);
  await goToSection(page, 'perfil');
  await expect(sec(page)).toHaveClass(/active/);
  return ctx;
}

async function openEditModal(page) {
  await sec(page).getByRole('button', { name: 'Editar perfil' }).click();
  await expect(modal(page)).toHaveClass(/active/);
}

async function openAvatarMenu(page) {
  await sec(page).getByRole('button', { name: 'Editar foto de perfil' }).click();
  await expect(avatarMenu(page)).toHaveClass(/open/);
}

// Dialog handling: setupApp dismisses every dialog; this records messages (and accepts
// them while `state.accept` is true). Must be registered BEFORE setupApp.
function recordDialogs(page) {
  const state = { accept: false, messages: [] };
  page.on('dialog', (d) => {
    state.messages.push(d.message());
    if (state.accept) d.accept().catch(() => {});
  });
  return state;
}

// Upload bodies sent to Storage (multipart form data with the JPEG inside).
function recordAvatarUploads(page) {
  const uploads = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/storage/v1/object/avatars/')) uploads.push(r.postDataBuffer());
  });
  return uploads;
}

// ---- tiny image helpers (no extra dependencies) ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// RGB PNG of w x h whose pixel colour is colorAt(x, y) -> [r, g, b].
function makePng(w, h, colorAt) {
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = colorAt(x, y);
      raw.set([r, g, b], y * stride + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
// Three vertical bands: red x<160, green 160<=x<320, blue x>=320.
const bands = (x) => (x < 160 ? [255, 0, 0] : x < 320 ? [0, 255, 0] : [0, 0, 255]);

// The JPEG inside a multipart upload body.
function jpegFrom(body) {
  const start = body.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
  const end = body.lastIndexOf(Buffer.from([0xff, 0xd9]));
  expect(start).toBeGreaterThanOrEqual(0);
  return body.subarray(start, end + 2);
}
function jpegSize(jpeg) {
  let i = 2;
  while (i < jpeg.length) {
    if (jpeg[i] !== 0xff) { i++; continue; }
    const marker = jpeg[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: jpeg.readUInt16BE(i + 7), height: jpeg.readUInt16BE(i + 5) };
    }
    i += 2 + jpeg.readUInt16BE(i + 2);
  }
  return null;
}
// Decodes the JPEG in the browser and returns the dominant channel ('r'|'g'|'b') at each point.
async function dominantColors(page, jpeg, points) {
  return page.evaluate(async ([b64, pts]) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return pts.map(([x, y]) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return r > g && r > b ? 'r' : g > b ? 'g' : 'b';
    });
  }, [jpeg.toString('base64'), points]);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test('shows the logged-in player\'s profile, stats and data from Supabase', async ({ page }) => {
  const { backend, errors } = await openProfile(page);

  await expect(sec(page).locator('h2')).toHaveText('Mi perfil');
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Juls · jugadora');
  await expect(page.locator('#profile-licencia-hero-display')).toHaveText('Licencia CAT-10234');
  // 1 match report where her licence appears; 3 of the 10 trainings up to today answered "yes".
  await expect(page.locator('#pf-stat-matches')).toHaveText('1');
  await expect(page.locator('#pf-stat-attendance')).toHaveText('30%');

  await expect(page.locator('.profile-info-table tr:visible td:first-child')).toHaveText([
    'Email', 'Teléfono', 'Fecha de nacimiento', 'Comisión', 'Rango', 'Posición', 'Rol', 'Núm. de Licencia',
  ]);
  await expect(page.locator('.profile-info-table tr:visible td:last-child')).toHaveText([
    'jugadora@cnpenas.test', '600100002', '12/04/1998', 'Comi Gira', 'veterana', '3/4', 'jugadora', 'CAT-10234',
  ]);

  // No photo: the club logo is shown (own avatar and top-bar button), photo adjust is disabled.
  await expect(pfAvatar(page)).toHaveClass(/avatar-logo-fallback/);
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/logo.png');
  await expect(page.locator('#profile-btn img')).toHaveAttribute('src', 'assets/img/logo.png');
  await expect(page.locator('#pf-avatar-adjust-btn')).toBeDisabled();
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveCount(0);
  await expect(page.locator('#injury-toggle-btn')).not.toHaveClass(/active/);

  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('staff profile (admin, directiva) hides commission, rank and position rows', async ({ page }) => {
  const { errors } = await openProfile(page, { user: USERS.admin });
  await expect(page.locator('#profile-name-display')).toHaveText('Montse Puig');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('directiva');
  await expect(page.locator('#profile-licencia-hero-display')).toHaveText('');
  await expect(page.locator('#pf-stat-matches')).toHaveText('0');
  await expect(page.locator('#pf-stat-attendance')).toHaveText('0%');

  await expect(page.locator('#profile-comision-row')).toBeHidden();
  await expect(page.locator('#profile-rango-row')).toBeHidden();
  await expect(page.locator('#profile-posicion-row')).toBeHidden();
  await expect(page.locator('.profile-info-table tr:visible td:last-child')).toHaveText([
    'admin@cnpenas.test', '600100001', '14/03/1985', 'directiva', '—',
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('Capitana counts as a player: her rows are shown, with the position label and her photo', async ({ page }) => {
  const { errors } = await openProfile(page, { user: ROVI });
  await expect(page.locator('#profile-name-display')).toHaveText('Marta Rovira');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Rovi · Capitana');
  await expect(page.locator('#profile-posicion-display')).toHaveText('Delantera');
  await expect(page.locator('#profile-comision-display')).toHaveText('Comi Activitats');
  await expect(page.locator('#pf-stat-matches')).toHaveText('1');
  await expect(pfAvatar(page)).not.toHaveClass(/avatar-logo-fallback/);
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/1.jpg');
  await expect(page.locator('#profile-btn img')).toHaveAttribute('src', 'assets/img/1.jpg');
  await expect(page.locator('#pf-avatar-adjust-btn')).toBeEnabled();
  expect(relevantErrors(errors)).toEqual([]);
});

test('an empty profile shows placeholders (also in Catalan)', async ({ page }) => {
  const { errors } = await openProfile(page, {
    seed: withProfile(IDS.player, {
      nombre: '', apellido: '', mote: '', telefono: null, fecha_nacimiento: null, rol: null,
      rango: null, posicion: null, comision: null, licencia: null,
    }),
  });
  await expect(page.locator('#profile-name-display')).toHaveText('Tu nombre');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Configura tu rol');
  await expect(page.locator('#profile-licencia-hero-display')).toHaveText('');
  // Without a role the commission/rank/position rows are hidden too.
  await expect(page.locator('#profile-comision-row')).toBeHidden();
  await expect(page.locator('.profile-info-table tr:visible td:last-child')).toHaveText([
    'jugadora@cnpenas.test', '—', '—', '—', '—',
  ]);
  await expect(page.locator('#pf-stat-matches')).toHaveText('0');

  await page.evaluate(() => window.setLang('ca'));
  await expect(page.locator('#profile-name-display')).toHaveText('El teu nom');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Configura el teu rol');
  expect(relevantErrors(errors)).toEqual([]);
});

test('matches played counts distinct own-team match reports matched by licence or accent-insensitive name', async ({ page }) => {
  const extraRows = [
    // Same match again (another row): not counted twice.
    { id: 'd1000000-0000-4000-8000-000000000101', match_id: EVENT_IDS.matchPast2, profile_id: null, is_own_team: true, player_name: 'Júlia Serra', license_number: null, minutes_played: 0, tries_count: 0, points: 0 },
    // Another match, matched only by name (case/accents/spaces ignored).
    { id: 'd1000000-0000-4000-8000-000000000102', match_id: EVENT_IDS.matchPast1, profile_id: null, is_own_team: true, player_name: '  JULIA   serra ', license_number: '', minutes_played: 40, tries_count: 0, points: 0 },
    // A third match, matched only by licence.
    { id: 'd1000000-0000-4000-8000-000000000103', match_id: 'ce-old-match', profile_id: null, is_own_team: true, player_name: 'J. Serra', license_number: ' CAT-10234 ', minutes_played: 80, tries_count: 0, points: 0 },
    // Rival team rows never count.
    { id: 'd1000000-0000-4000-8000-000000000104', match_id: 'ce-rival-match', profile_id: null, is_own_team: false, player_name: 'Júlia Serra', license_number: 'CAT-10234', minutes_played: 80, tries_count: 0, points: 0 },
  ];
  const { errors } = await openProfile(page, { seed: { ...seed, match_report_players: [...seed.match_report_players, ...extraRows] } });
  await expect(page.locator('#pf-stat-matches')).toHaveText('3');
  expect(relevantErrors(errors)).toEqual([]);
});

test('Catalan: labels, stats and table of the profile', async ({ page }) => {
  const { errors } = await openProfile(page, { user: ROVI });
  await page.evaluate(() => window.setLang('ca'));
  await expect(sec(page).locator('h2')).toHaveText('El meu perfil');
  await expect(page.locator('#profile-licencia-hero-display')).toHaveText('Llicència CAT-10187');
  await expect(page.locator('.pf-stat span')).toHaveText(['Partits jugats', 'Assistència a entrenos']);
  await expect(page.locator('.profile-info-table tr:visible td:first-child')).toHaveText([
    'Email', 'Telèfon', 'Data de naixement', 'Comissió', 'Rang', 'Posició', 'Rol', 'Núm. de Llicència',
  ]);
  await expect(page.locator('#profile-posicion-display')).toHaveText('Davantera');
  await expect(sec(page).getByRole('button', { name: 'Tanca sessió' })).toBeVisible();

  await openAvatarMenu(page);
  await expect(avatarMenu(page).getByRole('button')).toHaveText(['Canviar foto', 'Editar foto', 'Eliminar foto']);

  await sec(page).getByRole('button', { name: 'Editar perfil' }).click();
  await expect(modal(page).locator('h3')).toHaveText('Editar perfil');
  await expect(modal(page).locator('label > span')).toHaveText([
    'Nom', 'Malnom', 'Telèfon', 'Data de naixement', 'Comissió', 'Rang', 'Posició', 'Rol', 'Núm. de Llicència',
  ]);
  await expect(modal(page).locator('.modal-actions button')).toHaveText(['Cancel·la', 'Desa']);
  expect(relevantErrors(errors)).toEqual([]);
});

test('mobile: the top-bar "TÚ" button opens the profile and highlights the Perfil tab', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const { errors } = await setupApp(page, { user: USERS.player });
  await openApp(page);
  const topBtn = page.locator('#profile-btn');
  await expect(topBtn).toBeVisible();
  await expect(topBtn).toHaveClass(/avatar-logo-fallback/);
  await topBtn.click();
  await expect(sec(page)).toHaveClass(/active/);
  await expect(page.locator('.bottom-nav button[data-tab="perfil"]')).toHaveClass(/active/);
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Injury badge
// ---------------------------------------------------------------------------

test('injury picker marks the player as injured or knocked, everywhere, without saving it', async ({ page }) => {
  const { backend, errors } = await openProfile(page);
  const picker = page.locator('#injury-picker');
  const toggle = page.locator('#injury-toggle-btn');

  await expect(picker).toBeHidden();
  await sec(page).getByRole('button', { name: 'Marcar lesión' }).click();
  await expect(picker).toHaveClass(/open/);
  await expect(picker.getByRole('button')).toHaveText(['Lesionada', '🤕 Tocada']);
  await expect(picker.locator('.selected')).toHaveCount(0);

  // Lesionada (first-aid kit badge)
  await picker.getByRole('button', { name: 'Lesionada' }).click();
  await expect(picker).not.toHaveClass(/open/);
  await expect(toggle).toHaveClass(/active/);
  await expect(toggle).not.toHaveClass(/icon-tocada/);
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveAttribute('title', 'Lesionada');
  await expect(pfAvatar(page).locator('.avatar-injured-badge svg')).toHaveCount(1);
  await expect(page.locator('#profile-btn .avatar-injured-badge')).toHaveAttribute('title', 'Lesionada');

  // Reopening shows the current choice; Tocada replaces it (🤕 badge).
  await toggle.click();
  await expect(page.locator('#injury-picker-botiquin')).toHaveClass(/selected/);
  await expect(page.locator('#injury-picker-tocada')).not.toHaveClass(/selected/);
  await picker.getByRole('button', { name: 'Tocada' }).click();
  await expect(toggle).toHaveClass(/icon-tocada/);
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveAttribute('title', 'Tocada');
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveText('🤕');
  await expect(page.locator('#profile-btn .avatar-injured-badge.icon-tocada')).toHaveCount(1);

  // The badge also shows on her row in Jugadoras (only on hers).
  await goToSection(page, 'plantilla');
  await expect(plantillaRow(page, 'Juls').locator('.avatar-injured-badge')).toHaveAttribute('title', 'Tocada');
  await expect(page.locator('#plantilla-grid .avatar-injured-badge')).toHaveCount(1);

  // Choosing the selected option again removes the mark.
  await goToSection(page, 'perfil');
  await toggle.click();
  await expect(page.locator('#injury-picker-tocada')).toHaveClass(/selected/);
  await picker.getByRole('button', { name: 'Tocada' }).click();
  await expect(toggle).not.toHaveClass(/active/);
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveCount(0);
  await expect(page.locator('#profile-btn .avatar-injured-badge')).toHaveCount(0);

  // Toggling the button again just closes the picker.
  await toggle.click();
  await expect(picker).toHaveClass(/open/);
  await toggle.click();
  await expect(picker).not.toHaveClass(/open/);

  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('the injury mark is not persisted: it is gone after reloading', async ({ page }) => {
  const { backend, errors } = await openProfile(page);
  await page.locator('#injury-toggle-btn').click();
  await page.locator('#injury-picker').getByRole('button', { name: 'Lesionada' }).click();
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveCount(1);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await goToSection(page, 'perfil');
  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra');
  await expect(pfAvatar(page).locator('.avatar-injured-badge')).toHaveCount(0);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Edit profile modal
// ---------------------------------------------------------------------------

test('editing the own profile: prefilled modal, saved to profiles and shown everywhere', async ({ page }) => {
  const { backend, errors } = await openProfile(page);
  await openEditModal(page);
  await expect(modal(page).locator('h3')).toHaveText('Editar perfil');
  await expect(page.locator('#profile-name-input')).toHaveValue('Júlia Serra');
  await expect(page.locator('#profile-mote-input')).toHaveValue('Juls');
  await expect(page.locator('#profile-phone-input')).toHaveValue('600100002');
  await expect(page.locator('#profile-birthdate-input')).toHaveValue('1998-04-12');
  await expect(page.locator('#profile-comision-input')).toHaveValue('Comi Gira');
  await expect(page.locator('#profile-rango-input')).toHaveValue('veterana');
  await expect(page.locator('#profile-posicion-input')).toHaveValue('3/4');
  await expect(page.locator('#profile-rol-input')).toHaveValue('jugadora');
  await expect(page.locator('#profile-licencia-input')).toHaveValue('CAT-10234');
  await expect(page.locator('#profile-comision-input option')).toHaveText([
    'Sin asignar', 'Comi Activitats', 'Comi Xarxes', 'Comi Tercer Temps', 'Comi Tesoreria', 'Comi Gira',
  ]);
  await expect(page.locator('#profile-rango-input option')).toHaveText(['Sin asignar', 'Veterana', 'Novata', 'Sang de Fang']);
  await expect(page.locator('#profile-posicion-input option')).toHaveText(['Sin asignar', 'Delantera', '3/4']);
  await expect(page.locator('#profile-rol-input option')).toHaveText([
    'Sin asignar', 'Jugadora', 'Capitana', 'Entrenador/a', 'Delegado/a', 'Junta directiva', 'Fisios',
  ]);

  await page.locator('#profile-name-input').fill('  Júlia Serra Vidal ');
  await page.locator('#profile-mote-input').fill('Julieta');
  await page.locator('#profile-phone-input').fill('');
  await page.locator('#profile-birthdate-input').fill('1998-05-01');
  await page.locator('#profile-comision-input').selectOption('Comi Activitats');
  await page.locator('#profile-rango-input').selectOption('novata');
  await page.locator('#profile-posicion-input').selectOption('delantera');
  await page.locator('#profile-licencia-input').fill(' CAT-20000 ');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  const writes = restWrites(backend);
  expect(writes).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.player}`]],
    body: {
      nombre: 'Júlia', apellido: 'Serra Vidal', mote: 'Julieta', telefono: null, fecha_nacimiento: '1998-05-01',
      comision: 'Comi Activitats', rango: 'novata', posicion: 'delantera', rol: 'jugadora', licencia: 'CAT-20000',
    },
  }]);

  await expect(page.locator('#profile-name-display')).toHaveText('Júlia Serra Vidal');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Julieta · jugadora');
  await expect(page.locator('#profile-licencia-hero-display')).toHaveText('Licencia CAT-20000');
  await expect(page.locator('.profile-info-table tr:visible td:last-child')).toHaveText([
    'jugadora@cnpenas.test', '—', '01/05/1998', 'Comi Activitats', 'novata', 'Delantera', 'jugadora', 'CAT-20000',
  ]);
  // NOTE: matches played is recomputed from the new licence/name, which no longer match
  // the seeded match report row ("Júlia Serra", CAT-10234): it drops to 0.
  await expect(page.locator('#pf-stat-matches')).toHaveText('0');

  // Jugadoras is reloaded from Supabase with the new data.
  await goToSection(page, 'plantilla');
  await expect(plantillaRow(page, 'Julieta').locator('td')).toHaveText([
    'J Julieta', '01/05/1998', 'jugadora', 'novata', 'Delantera', 'Comi Activitats', 'CAT-20000',
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('commission/rank/position fields follow the role; a non-player role saves them empty', async ({ page }) => {
  const { backend, errors } = await openProfile(page);
  await openEditModal(page);
  const fields = ['#profile-comision-field', '#profile-rango-field', '#profile-posicion-field'];
  for (const f of fields) await expect(page.locator(f)).toBeVisible();

  await page.locator('#profile-rol-input').selectOption('entrenador/a');
  for (const f of fields) await expect(page.locator(f)).toBeHidden();
  await page.locator('#profile-rol-input').selectOption('Capitana');
  for (const f of fields) await expect(page.locator(f)).toBeVisible();
  await page.locator('#profile-rol-input').selectOption('');
  for (const f of fields) await expect(page.locator(f)).toBeHidden();

  // The hidden selects keep their values, but they are saved empty.
  await page.locator('#profile-rol-input').selectOption('fisio');
  await expect(page.locator('#profile-comision-input')).toHaveValue('Comi Gira');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  expect(restWrites(backend)).toHaveLength(1);
  expect(restWrites(backend)[0]).toMatchObject({
    method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.player}`]],
    body: { nombre: 'Júlia', apellido: 'Serra', rol: 'fisio', comision: null, rango: null, posicion: null, licencia: 'CAT-10234' },
  });
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Juls · fisio');
  await expect(page.locator('#profile-comision-row')).toBeHidden();
  await expect(page.locator('#profile-rango-row')).toBeHidden();
  await expect(page.locator('#profile-posicion-row')).toBeHidden();

  await goToSection(page, 'plantilla');
  await expect(plantillaRow(page, 'Juls').locator('td')).toHaveText([
    'J Juls', '12/04/1998', 'fisio', '—', '—', '—', 'CAT-10234',
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin (directiva) saving the own profile wipes the hidden commission', async ({ page }) => {
  const { backend, errors } = await openProfile(page, { user: USERS.admin });
  await openEditModal(page);
  await expect(page.locator('#profile-name-input')).toHaveValue('Montse Puig');
  await expect(page.locator('#profile-rol-input')).toHaveValue('directiva');
  await expect(page.locator('#profile-comision-field')).toBeHidden();
  await expect(page.locator('#profile-comision-input')).toHaveValue('Comi Tesoreria');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  // NOTE: the seeded admin has comision 'Comi Tesoreria', but directiva is not a player
  // role, so saving without touching anything writes comision: null.
  expect(restWrites(backend)).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.admin}`]],
    body: {
      nombre: 'Montse', apellido: 'Puig', mote: '', telefono: '600100001', fecha_nacimiento: '1985-03-14',
      comision: null, rango: null, posicion: null, rol: 'directiva', licencia: null,
    },
  }]);
  expect(backend.db.profiles.find((p) => p.id === IDS.admin).comision).toBeNull();
  expect(relevantErrors(errors)).toEqual([]);
});

test('cancel, or clicking outside the modal, closes it without saving', async ({ page }) => {
  const { backend, errors } = await openProfile(page);
  await openEditModal(page);
  await page.locator('#profile-mote-input').fill('Otra');
  await modal(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);
  await expect(page.locator('#profile-mote-role-display')).toHaveText('Juls · jugadora');

  // Reopening discards the unsaved edit.
  await openEditModal(page);
  await expect(page.locator('#profile-mote-input')).toHaveValue('Juls');
  await page.locator('#profile-mote-input').fill('Otra');
  await modal(page).click({ position: { x: 5, y: 5 } });
  await expect(modal(page)).not.toHaveClass(/active/);
  expect(restWrites(backend)).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('changing the own commission/role updates the role-dependent buttons in other sections', async ({ page }) => {
  const { errors } = await openProfile(page);
  // Juls (jugadora, Comi Gira): no gallery / treasury / fines / event management buttons.
  await goToSection(page, 'galeria');
  await expect(page.locator('#add-album-btn')).toBeHidden();

  await goToSection(page, 'perfil');
  await openEditModal(page);
  await page.locator('#profile-comision-input').selectOption('Comi Xarxes');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  // Comi Xarxes manages the gallery.
  await goToSection(page, 'galeria');
  await expect(page.locator('#add-album-btn')).toBeVisible();
  await goToSection(page, 'comi-tesoreria');
  await expect(page.locator('#treasury-add-btn')).toBeHidden();
  await goToSection(page, 'multas');
  await expect(page.locator('#add-fine-btn')).toBeHidden();
  await goToSection(page, 'asistencia');
  await expect(page.locator('#att-add-event-btn')).toBeHidden();

  // Comi Tesoreria + Capitana: treasury, fines and event buttons; no gallery button.
  await goToSection(page, 'perfil');
  await openEditModal(page);
  await page.locator('#profile-comision-input').selectOption('Comi Tesoreria');
  await page.locator('#profile-rol-input').selectOption('Capitana');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  await goToSection(page, 'galeria');
  await expect(page.locator('#add-album-btn')).toBeHidden();
  await goToSection(page, 'comi-tesoreria');
  await expect(page.locator('#treasury-add-btn')).toBeVisible();
  await goToSection(page, 'multas');
  await expect(page.locator('#add-fine-btn')).toBeVisible();
  await goToSection(page, 'asistencia');
  await expect(page.locator('#att-add-event-btn')).toBeVisible();
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin edits another player from Jugadoras; the admin\'s own profile is untouched', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openApp(page);
  await goToSection(page, 'plantilla');
  await plantillaRow(page, 'Carla').getByRole('button', { name: 'Editar' }).click();
  await expect(modal(page)).toHaveClass(/active/);
  await expect(modal(page).locator('h3')).toHaveText('Editar jugadora');
  await expect(page.locator('#profile-name-input')).toHaveValue('Carla Font');
  await expect(page.locator('#profile-mote-input')).toHaveValue('');
  await expect(page.locator('#profile-phone-input')).toHaveValue('600100004');
  await expect(page.locator('#profile-birthdate-input')).toHaveValue('2001-07-23');
  await expect(page.locator('#profile-comision-input')).toHaveValue('Comi Tesoreria');
  await expect(page.locator('#profile-rango-input')).toHaveValue('novata');
  await expect(page.locator('#profile-posicion-input')).toHaveValue('delantera');
  await expect(page.locator('#profile-rol-input')).toHaveValue('jugadora');
  await expect(page.locator('#profile-licencia-input')).toHaveValue('CAT-10411');

  await page.locator('#profile-mote-input').fill('Carlota');
  await page.locator('#profile-posicion-input').selectOption('3/4');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  expect(restWrites(backend)).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.carla}`]],
    body: {
      nombre: 'Carla', apellido: 'Font', mote: 'Carlota', telefono: '600100004', fecha_nacimiento: '2001-07-23',
      comision: 'Comi Tesoreria', rango: 'novata', posicion: '3/4', rol: 'jugadora', licencia: 'CAT-10411',
    },
  }]);
  await expect(plantillaRow(page, 'Carlota').locator('td')).toHaveText([
    'C Carlota', '23/07/2001', 'jugadora', 'novata', '3/4', 'Comi Tesoreria', 'CAT-10411', 'Editar',
  ]);
  await expect(page.locator('#plantilla-grid .col-player b')).toHaveText(['Carlota', 'Jordi', 'Juls', 'Núria', 'Paula', 'Rovi', 'Sergi', 'Tanke']);

  // The admin's own profile did not change, and the next own edit is the admin's again.
  await goToSection(page, 'perfil');
  await expect(page.locator('#profile-name-display')).toHaveText('Montse Puig');
  await expect(page.locator('#profile-mote-role-display')).toHaveText('directiva');
  await openEditModal(page);
  await expect(modal(page).locator('h3')).toHaveText('Editar perfil');
  await expect(page.locator('#profile-name-input')).toHaveValue('Montse Puig');
  await expect(page.locator('#profile-mote-input')).toHaveValue('');
  expect(relevantErrors(errors)).toEqual([]);
});

test('admin turns a staff member into a player: player fields appear and are saved', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.admin });
  await openApp(page);
  await goToSection(page, 'plantilla');
  await plantillaRow(page, 'Jordi').getByRole('button', { name: 'Editar' }).click();
  await expect(modal(page).locator('h3')).toHaveText('Editar jugadora');
  await expect(page.locator('#profile-rol-input')).toHaveValue('entrenador/a');
  await expect(page.locator('#profile-posicion-field')).toBeHidden();

  await page.locator('#profile-rol-input').selectOption('jugadora');
  await expect(page.locator('#profile-posicion-field')).toBeVisible();
  await expect(page.locator('#profile-posicion-input')).toHaveValue('');
  await page.locator('#profile-posicion-input').selectOption('delantera');
  await modal(page).getByRole('button', { name: 'Guardar' }).click();
  await expect(modal(page)).not.toHaveClass(/active/);

  expect(restWrites(backend)).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.jordi}`]],
    body: {
      nombre: 'Jordi', apellido: 'Casals', mote: '', telefono: '600100007', fecha_nacimiento: '1980-05-18',
      comision: null, rango: null, posicion: 'delantera', rol: 'jugadora', licencia: 'ENT-0042',
    },
  }]);
  await expect(plantillaRow(page, 'Jordi').locator('td')).toHaveText([
    'J Jordi', '18/05/1980', 'jugadora', 'Sin asignar', 'Delantera', 'Sin asignar', 'ENT-0042', 'Editar',
  ]);
  expect(relevantErrors(errors)).toEqual([]);
});

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

test('avatar menu: options, disabled "Editar foto" without photo, closes on outside click', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await openProfile(page);
  await expect(avatarMenu(page)).toBeHidden();
  await openAvatarMenu(page);
  await expect(avatarMenu(page).getByRole('button')).toHaveText(['Cambiar foto', 'Editar foto', 'Eliminar foto']);
  await expect(avatarMenu(page).getByRole('button', { name: 'Editar foto', exact: true })).toBeDisabled();

  // Outside click closes it; the edit button toggles it.
  await page.locator('#profile-name-display').click();
  await expect(avatarMenu(page)).not.toHaveClass(/open/);
  await openAvatarMenu(page);
  await sec(page).getByRole('button', { name: 'Editar foto de perfil' }).click();
  await expect(avatarMenu(page)).not.toHaveClass(/open/);

  // "Eliminar foto" without a photo only closes the menu.
  await openAvatarMenu(page);
  await avatarMenu(page).getByRole('button', { name: 'Eliminar foto' }).click();
  await expect(avatarMenu(page)).not.toHaveClass(/open/);
  expect(dialogs.messages).toEqual([]);
  expect(backend.mutations).toEqual([]);
  expect(relevantErrors(errors)).toEqual([]);
});

test('uploading a photo compresses it to a JPEG, stores it in "avatars" and shows it everywhere', async ({ page }) => {
  const { backend, errors } = await setupApp(page, { user: USERS.player });
  const uploads = recordAvatarUploads(page);
  await openApp(page);
  await goToSection(page, 'perfil');
  await openAvatarMenu(page);
  const chooser = page.waitForEvent('filechooser');
  await avatarMenu(page).getByRole('button', { name: 'Cambiar foto' }).click();
  await (await chooser).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: makePng(640, 480, (x) => (x < 320 ? [255, 0, 0] : [0, 0, 255])) });
  await expect(avatarMenu(page)).not.toHaveClass(/open/);

  const url = avatarPublicUrl(IDS.player);
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', url);
  await expect(pfAvatar(page)).not.toHaveClass(/avatar-logo-fallback/);
  await expect(page.locator('#profile-btn img')).toHaveAttribute('src', url);
  await expect(page.locator('#pf-avatar-adjust-btn')).toBeEnabled();

  expect(storageWrites(backend)).toEqual([
    { kind: 'storage', method: 'POST', path: `/storage/v1/object/avatars/${IDS.player}/avatar.jpg` },
  ]);
  expect(restWrites(backend)).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.player}`]], body: { avatar_url: url },
  }]);
  // Longest side scaled down to 320 px, always JPEG.
  expect(uploads).toHaveLength(1);
  const jpeg = jpegFrom(uploads[0]);
  expect(jpegSize(jpeg)).toEqual({ width: 320, height: 240 });
  expect(await dominantColors(page, jpeg, [[40, 120], [280, 120]])).toEqual(['r', 'b']);

  await goToSection(page, 'plantilla');
  await expect(plantillaRow(page, 'Juls').locator('.avatar img')).toHaveAttribute('src', url);
  expect(relevantErrors(errors)).toEqual([]);
});

test('invalid photo files are rejected with a message and nothing is uploaded', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await openProfile(page);
  const input = page.locator('#pf-avatar-input');

  await input.setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') });
  await expect.poll(() => dialogs.messages).toEqual(['Elige un archivo de imagen (JPG, PNG…).']);

  await input.setInputFiles({ name: 'enorme.png', mimeType: 'image/png', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
  await expect.poll(() => dialogs.messages.length).toBe(2);
  expect(dialogs.messages[1]).toBe('La imagen pesa demasiado. Elige una de menos de 15 MB.');

  await input.setInputFiles({ name: 'rota.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') });
  await expect.poll(() => dialogs.messages.length).toBe(3);
  expect(dialogs.messages[2]).toBe('No se ha podido procesar la imagen. Prueba con otra foto.');

  expect(backend.mutations).toEqual([]);
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/logo.png');
  expect(relevantErrors(errors)).toEqual([expect.stringContaining('No se ha podido comprimir la imagen')]);
});

test('removing the photo asks for confirmation and clears avatar_url', async ({ page }) => {
  const dialogs = recordDialogs(page);
  const { backend, errors } = await openProfile(page, { seed: withProfile(IDS.player, { avatar_url: 'assets/img/2.jpeg' }) });
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/2.jpeg');

  // Dismissed: nothing happens.
  await openAvatarMenu(page);
  await avatarMenu(page).getByRole('button', { name: 'Eliminar foto' }).click();
  await expect.poll(() => dialogs.messages).toEqual(['¿Eliminar tu foto de perfil?']);
  await expect(avatarMenu(page)).not.toHaveClass(/open/);
  expect(backend.mutations).toEqual([]);
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/2.jpeg');

  // Accepted: avatar_url is set to null (the Storage file is kept).
  dialogs.accept = true;
  await openAvatarMenu(page);
  await avatarMenu(page).getByRole('button', { name: 'Eliminar foto' }).click();
  await expect.poll(() => restWrites(backend)).toEqual([{
    kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.player}`]], body: { avatar_url: null },
  }]);
  expect(storageWrites(backend)).toEqual([]);

  // Her Jugadoras row goes back to initials.
  await goToSection(page, 'plantilla');
  await expect(plantillaRow(page, 'Juls').locator('.avatar')).toHaveText('J');
  await expect(plantillaRow(page, 'Juls').locator('.avatar img')).toHaveCount(0);
  // NOTE (bug): the profile reloads Jugadoras right after removing, and the cached copy of
  // `profiles` (5-minute cache) still has the old avatar_url; applying it restores
  // the old photo in Mi perfil / top bar, and the fresh (null) row does not clear it
  // (`p.avatar_url || myProfile.avatarUrl`). So the photo is still shown there.
  await goToSection(page, 'perfil');
  await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', 'assets/img/2.jpeg');
  await expect(page.locator('#profile-btn img')).toHaveAttribute('src', 'assets/img/2.jpeg');
  expect(relevantErrors(errors)).toEqual([]);
});

test.describe('adjust photo modal', () => {
  // A same-origin 480x320 picture with three vertical colour bands (red/green/blue).
  const ADJUST_SRC = 'e2e-avatar.png';
  const adjustSeed = withProfile(IDS.player, { avatar_url: ADJUST_SRC });

  async function openAdjust(page, opts = {}) {
    const ctx = await setupApp(page, { user: USERS.player, seed: adjustSeed, ...opts });
    await page.route(`**/${ADJUST_SRC}`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: makePng(480, 320, bands) }));
    await openApp(page);
    await goToSection(page, 'perfil');
    await openAvatarMenu(page);
    await avatarMenu(page).getByRole('button', { name: 'Editar foto', exact: true }).click();
    await expect(adjustModal(page)).toHaveClass(/active/);
    return ctx;
  }

  // Position/size of the picture inside the 240x240 frame (relative to its padding box).
  async function imgBox(page) {
    const frame = page.locator('#avatar-adjust-frame');
    const [f, i, border] = await Promise.all([
      frame.boundingBox(),
      page.locator('#avatar-adjust-img').boundingBox(),
      frame.evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth)),
    ]);
    return { x: Math.round(i.x - f.x - border), y: Math.round(i.y - f.y - border), w: Math.round(i.width), h: Math.round(i.height) };
  }

  async function drag(page, dx, dy) {
    const f = await page.locator('#avatar-adjust-frame').boundingBox();
    // Start and end inside the frame (a mouseup outside the modal box would count as a
    // click on the overlay, which closes the modal).
    const sx = f.x + f.width / 2 - dx / 2, sy = f.y + f.height / 2 - dy / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + dx, sy + dy, { steps: 5 });
    await page.mouse.up();
  }

  test('the picture covers the frame, can be dragged within its edges and zoomed', async ({ page }) => {
    const { backend, errors } = await openAdjust(page);
    await expect(adjustModal(page).locator('h3')).toHaveText('Ajustar foto');
    await expect(adjustModal(page).locator('.modal-sub')).toHaveText('Arrastra y usa el zoom para encajar la foto en el recuadro.');
    await expect(page.locator('#avatar-adjust-zoom')).toHaveValue('100');
    await expect(page.locator('#avatar-adjust-img')).toHaveAttribute('src', ADJUST_SRC);

    // Scaled so the short side fills the 240px frame, centred.
    await expect.poll(() => imgBox(page)).toEqual({ x: -60, y: 0, w: 360, h: 240 });
    // Dragging is clamped so no empty border shows.
    await drag(page, -100, 50);
    expect(await imgBox(page)).toEqual({ x: -120, y: 0, w: 360, h: 240 });
    await drag(page, 70, 0);
    expect(await imgBox(page)).toEqual({ x: -50, y: 0, w: 360, h: 240 });
    await drag(page, 120, 0);
    expect(await imgBox(page)).toEqual({ x: 0, y: 0, w: 360, h: 240 });

    // Zoom 200%: twice as big, then it can also move vertically.
    await page.locator('#avatar-adjust-zoom').fill('200');
    expect(await imgBox(page)).toEqual({ x: 0, y: 0, w: 720, h: 480 });
    await drag(page, -200, -90);
    expect(await imgBox(page)).toEqual({ x: -200, y: -90, w: 720, h: 480 });
    // Zooming back out re-clamps the position.
    await page.locator('#avatar-adjust-zoom').fill('100');
    expect(await imgBox(page)).toEqual({ x: -120, y: 0, w: 360, h: 240 });

    // Cancel: nothing is uploaded.
    await adjustModal(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(adjustModal(page)).not.toHaveClass(/active/);
    expect(backend.mutations).toEqual([]);
    expect(relevantErrors(errors)).toEqual([]);
  });

  test('saving uploads the visible square crop (320x320 JPEG) as the new photo', async ({ page }) => {
    const uploadsHolder = recordAvatarUploads(page);
    const { backend, errors } = await openAdjust(page);
    await expect.poll(() => imgBox(page)).toEqual({ x: -60, y: 0, w: 360, h: 240 });
    await page.locator('#avatar-adjust-zoom').fill('200');
    await drag(page, -140, -60);
    // x: -60 - 140 = -200 -> visible source area x 133..293 (red | green)
    expect(await imgBox(page)).toEqual({ x: -200, y: -60, w: 720, h: 480 });

    await adjustModal(page).getByRole('button', { name: 'Guardar' }).click();
    await expect(adjustModal(page)).not.toHaveClass(/active/);

    const url = avatarPublicUrl(IDS.player);
    expect(storageWrites(backend)).toEqual([
      { kind: 'storage', method: 'POST', path: `/storage/v1/object/avatars/${IDS.player}/avatar.jpg` },
    ]);
    expect(restWrites(backend)).toEqual([{
      kind: 'rest', method: 'UPDATE', table: 'profiles', filters: [['id', `eq.${IDS.player}`]], body: { avatar_url: url },
    }]);
    expect(uploadsHolder).toHaveLength(1);
    const jpeg = jpegFrom(uploadsHolder[0]);
    expect(jpegSize(jpeg)).toEqual({ width: 320, height: 320 });
    expect(await dominantColors(page, jpeg, [[20, 160], [300, 160]])).toEqual(['r', 'g']);

    await expect(pfAvatar(page).locator('img')).toHaveAttribute('src', url);
    await expect(page.locator('#profile-btn img')).toHaveAttribute('src', url);
    expect(relevantErrors(errors)).toEqual([]);
  });
});
