// Deterministic seed data for the fake Supabase (PostgREST) backend used by the e2e tests.
//
// Test clock: 2026-09-25T10:00:00+02:00 (Friday, Europe/Madrid).
//   - Auto-generated trainings (js/core/dates.js generateAutoTrainings) are
//     Mon/Wed/Fri 20:30-22:00 with ids 'auto-YYYY-MM-DD' (2026-09-24 is a holiday).
//     Relevant ones: auto-2026-09-21 (Mon), auto-2026-09-23 (Wed), auto-2026-09-25
//     (today, not yet ended at 10:00), auto-2026-09-28 (Mon), auto-2026-09-30 (Wed).
//   - Hardcoded home match 'ce1' (js/main.js): "Partido vs Santboi", Sat 2026-09-26.
//
// Column names were taken from the row mappers / select strings / insert+upsert
// payloads of the app code in public/js (see the comment above each table).
// Everything is fixed: no randomness, no Date.now().

const pad = (n) => String(n).padStart(12, '0');
// uuid-v4-shaped deterministic ids: <8 hex prefix per table>-0000-4000-8000-<n>
const uid = (prefix, n) => `${prefix}-0000-4000-8000-${pad(n)}`;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const ID = {
  admin:  uid('00000000', 1), // Montse Puig      - directiva, is_admin
  player: uid('00000000', 2), // Júlia Serra "Juls" - jugadora (group A)
  marta:  uid('00000000', 3), // Marta Rovira "Rovi" - Capitana (group A)
  carla:  uid('00000000', 4), // Carla Font       - jugadora, Comi Tesoreria (group B)
  paula:  uid('00000000', 5), // Paula Vidal      - jugadora, Comi Tercer Temps (group B)
  aina:   uid('00000000', 6), // Aina Soler "Tanke" - jugadora, Comi Xarxes (group A)
  jordi:  uid('00000000', 7), // Jordi Casals     - entrenador/a
  nuria:  uid('00000000', 8), // Núria Pons       - fisio
  sergi:  uid('00000000', 9)  // Sergi Martí      - delegado/a
};

// Supabase auth user objects (what signInWithPassword / getSession return as `user`).
export const USERS = {
  admin: {
    id: ID.admin,
    email: 'admin@cnpenas.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {}
  },
  player: {
    id: ID.player,
    email: 'jugadora@cnpenas.test',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {}
  }
};

// Event ids (att_events custom events use the 'ce...' prefix like generateCustomEventId)
const EV = {
  matchPast1: 'ce-seed-match-0912', // home, past  (tercer temps index 0)
  matchPast2: 'ce-seed-match-0919', // home, past  (tercer temps index 1) - has acta
  matchNext:  'ce1',                // hardcoded in main.js, home, tomorrow (index 2)
  matchAway:  'ce-seed-match-1003', // away, future (not in tercer temps)
  matchHome:  'ce-seed-match-1010', // home, future (index 3)
  meeting:    'ce-seed-meeting-0929',
  trMon:      'auto-2026-09-21',
  trWed:      'auto-2026-09-23',
  trToday:    'auto-2026-09-25'
};

const mapsUrl = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export const seed = {
  // profiles: js/core/auth.js onAuthenticated (select *) + handleRegister upsert,
  // js/features/jugadoras.js applyPlantillaRows, perfil.js saveProfileEdits.
  // Allowed values from index.html selects: rol jugadora|Capitana|entrenador/a|delegado/a|
  // directiva|fisio; rango veterana|novata|sang_de_fang; posicion delantera|3/4;
  // comision Comi Xarxes|Comi Tesoreria|Comi Gira|Comi Tercer Temps|Comi Activitats.
  // is_admin rows are hidden from Jugadoras / tercer-temps groups (applyPlantillaRows).
  // Injuries are NOT persisted in profiles (only in-memory, perfil.js), so no column.
  profiles: [
    {
      id: ID.admin, nombre: 'Montse', apellido: 'Puig', mote: '', telefono: '600100001',
      fecha_nacimiento: '1985-03-14', rol: 'directiva', rango: null, posicion: null,
      comision: 'Comi Tesoreria', licencia: null, grupo_tercer_tiempo: null,
      avatar_url: null, is_admin: true
    },
    {
      id: ID.player, nombre: 'Júlia', apellido: 'Serra', mote: 'Juls', telefono: '600100002',
      fecha_nacimiento: '1998-04-12', rol: 'jugadora', rango: 'veterana', posicion: '3/4',
      comision: 'Comi Gira', licencia: 'CAT-10234', grupo_tercer_tiempo: 'A',
      avatar_url: null, is_admin: false
    },
    {
      id: ID.marta, nombre: 'Marta', apellido: 'Rovira', mote: 'Rovi', telefono: '600100003',
      fecha_nacimiento: '1995-11-02', rol: 'Capitana', rango: 'veterana', posicion: 'delantera',
      comision: 'Comi Activitats', licencia: 'CAT-10187', grupo_tercer_tiempo: 'A',
      avatar_url: 'assets/img/1.jpg', is_admin: false
    },
    {
      id: ID.carla, nombre: 'Carla', apellido: 'Font', mote: '', telefono: '600100004',
      fecha_nacimiento: '2001-07-23', rol: 'jugadora', rango: 'novata', posicion: 'delantera',
      comision: 'Comi Tesoreria', licencia: 'CAT-10411', grupo_tercer_tiempo: 'B',
      avatar_url: null, is_admin: false
    },
    {
      id: ID.paula, nombre: 'Paula', apellido: 'Vidal', mote: '', telefono: '600100005',
      fecha_nacimiento: '1999-01-30', rol: 'jugadora', rango: 'sang_de_fang', posicion: '3/4',
      comision: 'Comi Tercer Temps', licencia: 'CAT-10302', grupo_tercer_tiempo: 'B',
      avatar_url: null, is_admin: false
    },
    {
      id: ID.aina, nombre: 'Aina', apellido: 'Soler', mote: 'Tanke', telefono: '600100006',
      fecha_nacimiento: '2003-09-05', rol: 'jugadora', rango: 'novata', posicion: '3/4',
      comision: 'Comi Xarxes', licencia: 'CAT-10455', grupo_tercer_tiempo: 'A',
      avatar_url: null, is_admin: false
    },
    {
      id: ID.jordi, nombre: 'Jordi', apellido: 'Casals', mote: '', telefono: '600100007',
      fecha_nacimiento: '1980-05-18', rol: 'entrenador/a', rango: null, posicion: null,
      comision: null, licencia: 'ENT-0042', grupo_tercer_tiempo: null,
      avatar_url: null, is_admin: false
    },
    {
      id: ID.nuria, nombre: 'Núria', apellido: 'Pons', mote: '', telefono: '600100008',
      fecha_nacimiento: '1990-12-09', rol: 'fisio', rango: null, posicion: null,
      comision: null, licencia: null, grupo_tercer_tiempo: null,
      avatar_url: null, is_admin: false
    },
    {
      id: ID.sergi, nombre: 'Sergi', apellido: 'Martí', mote: '', telefono: '600100009',
      fecha_nacimiento: '1987-02-26', rol: 'delegado/a', rango: null, posicion: null,
      comision: null, licencia: null, grupo_tercer_tiempo: null,
      avatar_url: null, is_admin: false
    }
  ],

  // fines: multas.js loadFines select('id, player_id, reason_id, status, paid_to_id,
  // auto_match_iso, paid_at, created_at') + fineRowToLocal. reason_id in fineReasons
  // (amarilla|roja|retraso|tercer); status 'pendiente'|'pagada'; paid_at 'YYYY-MM-DD'
  // (rendered with formatFullDate). A pending fine with paid_to_id = "awaiting
  // confirmation" by that Comi Tesoreria member.
  fines: [
    // Júlia (player): one to pay, one awaiting Carla's confirmation, one paid
    { id: uid('f0000000', 1), player_id: ID.player, reason_id: 'retraso', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-19', paid_at: null, created_at: '2026-09-19T15:10:00Z' },
    { id: uid('f0000000', 2), player_id: ID.player, reason_id: 'amarilla', status: 'pendiente', paid_to_id: ID.carla, auto_match_iso: null, paid_at: null, created_at: '2026-09-20T09:00:00Z' },
    { id: uid('f0000000', 3), player_id: ID.player, reason_id: 'tercer', status: 'pagada', paid_to_id: null, auto_match_iso: '2026-09-12', paid_at: '2026-09-15', created_at: '2026-09-12T20:00:00Z' },
    // Rovi: yellow card (pending) + red card (paid)
    { id: uid('f0000000', 4), player_id: ID.marta, reason_id: 'amarilla', status: 'pendiente', paid_to_id: null, auto_match_iso: null, paid_at: null, created_at: '2026-09-20T09:01:00Z' },
    { id: uid('f0000000', 5), player_id: ID.marta, reason_id: 'roja', status: 'pagada', paid_to_id: null, auto_match_iso: null, paid_at: '2026-09-18', created_at: '2026-09-13T10:00:00Z' },
    // Paula: pending, awaiting confirmation from the admin (admin sees a confirm request)
    { id: uid('f0000000', 6), player_id: ID.paula, reason_id: 'retraso', status: 'pendiente', paid_to_id: ID.admin, auto_match_iso: '2026-09-19', paid_at: null, created_at: '2026-09-19T15:11:00Z' },
    // Aina: two pending
    { id: uid('f0000000', 7), player_id: ID.aina, reason_id: 'tercer', status: 'pendiente', paid_to_id: null, auto_match_iso: '2026-09-19', paid_at: null, created_at: '2026-09-19T20:00:00Z' },
    { id: uid('f0000000', 8), player_id: ID.aina, reason_id: 'retraso', status: 'pendiente', paid_to_id: null, auto_match_iso: null, paid_at: null, created_at: '2026-09-22T19:00:00Z' },
    // Carla: paid
    { id: uid('f0000000', 9), player_id: ID.carla, reason_id: 'retraso', status: 'pagada', paid_to_id: null, auto_match_iso: null, paid_at: '2026-09-21', created_at: '2026-09-16T19:00:00Z' }
  ],

  // att_events: eventos.js eventMetaForStorage / eventFromStorageRow. type
  // training|match|meeting; month = Spanish abbr ('Sep','Oct'); when_text is only
  // stored (display is recomputed); times carry an 'h' suffix like saveNewEvent.
  att_events: [
    {
      id: EV.matchPast1, type: 'match', label: 'Partido vs Tarragona', date: 12, month: 'Sep', iso: '2026-09-12',
      when_text: 'Sábado 12/09/26 · CEM Mar Bella · 12:00 - 13:30h', place: 'CEM Mar Bella',
      place_maps_url: mapsUrl('CEM Mar Bella, Av. del Litoral, Barcelona'), is_home: true,
      meet_time: '11:00h', start_time: '12:00h', end_time: '13:30h', intensity: null
    },
    {
      id: EV.matchPast2, type: 'match', label: 'Partido vs Gòtics', date: 19, month: 'Sep', iso: '2026-09-19',
      when_text: 'Sábado 19/09/26 · CEM Mar Bella · 17:30 - 19:00h', place: 'CEM Mar Bella',
      place_maps_url: mapsUrl('CEM Mar Bella, Av. del Litoral, Barcelona'), is_home: true,
      meet_time: '16:30h', start_time: '17:30h', end_time: '19:00h', intensity: null
    },
    {
      id: EV.meeting, type: 'meeting', label: 'Reunión de equipo', date: 29, month: 'Sep', iso: '2026-09-29',
      when_text: 'Martes 29/09/26 · Local del club · 21:00 - 22:00h', place: 'Local del club',
      place_maps_url: '', is_home: true,
      meet_time: '', start_time: '21:00h', end_time: '22:00h', intensity: null
    },
    {
      id: EV.matchAway, type: 'match', label: 'Partido vs Cornellà', date: 3, month: 'Oct', iso: '2026-10-03',
      when_text: 'Sábado 03/10/26 · Camp Municipal de Rugby La Bòbila · 16:30h', place: 'Camp Municipal de Rugby La Bòbila',
      place_maps_url: mapsUrl('Camp Municipal de Rugby La Bòbila, Cornellà de Llobregat'), is_home: false,
      meet_time: '15:15h', start_time: '16:30h', end_time: '', intensity: null
    },
    {
      id: EV.matchHome, type: 'match', label: 'Partido vs Badalona', date: 10, month: 'Oct', iso: '2026-10-10',
      when_text: 'Sábado 10/10/26 · CEM Mar Bella · 17:30h', place: 'CEM Mar Bella',
      place_maps_url: mapsUrl('CEM Mar Bella, Av. del Litoral, Barcelona'), is_home: true,
      meet_time: '16:30h', start_time: '17:30h', end_time: '', intensity: null
    }
  ],

  // att_attendance: asistencia.js saveMyAttendanceToStorage upsert
  // (event_id, user_id, status, comment, updated_at); status 'yes'|'no'.
  // No id column is ever read (PK is presumably event_id+user_id).
  // The player has NOT answered 'ce1' on purpose (next-match CTA stays visible).
  att_attendance: [
    { event_id: EV.matchNext, user_id: ID.marta, status: 'yes', comment: '', updated_at: '2026-09-21T18:00:00Z' },
    { event_id: EV.matchNext, user_id: ID.carla, status: 'yes', comment: '', updated_at: '2026-09-21T18:05:00Z' },
    { event_id: EV.matchNext, user_id: ID.paula, status: 'yes', comment: '', updated_at: '2026-09-22T08:30:00Z' },
    { event_id: EV.matchNext, user_id: ID.aina, status: 'no', comment: 'Estoy de viaje con la familia', updated_at: '2026-09-22T09:00:00Z' },
    { event_id: EV.matchNext, user_id: ID.jordi, status: 'yes', comment: '', updated_at: '2026-09-21T12:00:00Z' },
    { event_id: EV.trToday, user_id: ID.player, status: 'yes', comment: '', updated_at: '2026-09-24T20:00:00Z' },
    { event_id: EV.trToday, user_id: ID.marta, status: 'yes', comment: '', updated_at: '2026-09-24T20:10:00Z' },
    { event_id: EV.trToday, user_id: ID.carla, status: 'no', comment: 'Salgo tarde de trabajar', updated_at: '2026-09-24T21:00:00Z' },
    { event_id: EV.trWed, user_id: ID.player, status: 'yes', comment: '', updated_at: '2026-09-22T19:00:00Z' },
    { event_id: EV.trWed, user_id: ID.marta, status: 'yes', comment: '', updated_at: '2026-09-22T19:00:00Z' },
    { event_id: EV.trWed, user_id: ID.aina, status: 'yes', comment: '', updated_at: '2026-09-22T19:00:00Z' },
    { event_id: EV.trMon, user_id: ID.player, status: 'yes', comment: '', updated_at: '2026-09-20T19:00:00Z' },
    { event_id: EV.matchPast2, user_id: ID.player, status: 'yes', comment: '', updated_at: '2026-09-15T19:00:00Z' },
    { event_id: EV.matchPast2, user_id: ID.marta, status: 'yes', comment: '', updated_at: '2026-09-15T19:00:00Z' },
    { event_id: EV.matchPast2, user_id: ID.paula, status: 'yes', comment: '', updated_at: '2026-09-15T19:00:00Z' },
    { event_id: EV.matchAway, user_id: ID.player, status: 'yes', comment: '', updated_at: '2026-09-23T10:00:00Z' }
  ],

  // attendance_wellness: wellness.js saveWellness upsert (event_id, user_id, rpe,
  // sleep_hours, mood, has_discomfort, discomfort_detail, updated_at); sleep_hours
  // 'lt6'|'7-8'|'gt8'; mood 1-5. The player rated auto-2026-09-21 but NOT
  // auto-2026-09-23, so her Inicio "pending wellness" banner points to 09-23.
  // Staff panel defaults to the most recent ended event (auto-2026-09-23).
  attendance_wellness: [
    { event_id: EV.trWed, user_id: ID.marta, rpe: 7, sleep_hours: '7-8', mood: 4, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-23T21:30:00Z' },
    { event_id: EV.trWed, user_id: ID.aina, rpe: 9, sleep_hours: 'lt6', mood: 2, has_discomfort: true, discomfort_detail: 'Molestia en el tobillo derecho', updated_at: '2026-09-23T21:40:00Z' },
    { event_id: EV.trWed, user_id: ID.carla, rpe: 5, sleep_hours: 'gt8', mood: 5, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-23T22:05:00Z' },
    { event_id: EV.trWed, user_id: ID.paula, rpe: 6, sleep_hours: '7-8', mood: 3, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-23T22:10:00Z' },
    { event_id: EV.trMon, user_id: ID.player, rpe: 6, sleep_hours: '7-8', mood: 4, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-21T21:30:00Z' },
    { event_id: EV.trMon, user_id: ID.marta, rpe: 8, sleep_hours: 'lt6', mood: 3, has_discomfort: true, discomfort_detail: 'Sobrecarga en isquios', updated_at: '2026-09-21T21:45:00Z' },
    { event_id: EV.matchPast2, user_id: ID.player, rpe: 9, sleep_hours: '7-8', mood: 5, has_discomfort: false, discomfort_detail: '', updated_at: '2026-09-19T20:00:00Z' },
    { event_id: EV.matchPast2, user_id: ID.marta, rpe: 10, sleep_hours: 'gt8', mood: 4, has_discomfort: true, discomfort_detail: 'Golpe en el hombro', updated_at: '2026-09-19T20:05:00Z' }
  ],

  // notices: avisos.js fetchAllNotices (select *, order created_at desc) + saveNotice
  // insert (id, text, type, created_by, created_by_name, date_label). type
  // 'pinned'|'banner'. id is a text id ('n' + ...), not a uuid.
  notices: [
    {
      id: 'n-seed-1', text: 'Mañana partido en casa contra Santboi: convocatoria a las 16:30h en Mar Bella. ¡Todas de azul!',
      type: 'banner', created_by: ID.admin, created_by_name: 'Montse',
      created_at: '2026-09-24T17:00:00Z', date_label: '24 Sep · 19:00'
    },
    {
      id: 'n-seed-2', text: 'Recordad pagar la cuota de temporada antes del 30 de septiembre (120 €).',
      type: 'pinned', created_by: ID.jordi, created_by_name: 'Jordi',
      created_at: '2026-09-20T08:30:00Z', date_label: '20 Sep · 10:30'
    },
    {
      id: 'n-seed-3', text: 'Busco coche compartido para ir a Cornellà el 3 de octubre, ¿alguien?',
      type: 'pinned', created_by: ID.player, created_by_name: 'Juls',
      created_at: '2026-09-22T19:45:00Z', date_label: '22 Sep · 21:45'
    }
  ],

  // gallery_data: galeria.js loadGalleryData (eq id 'current', reads data.seasons) +
  // saveGalleryData upsert (id, seasons, updated_at). seasons is a JSON blob:
  // [{ id:'AAAA-AAAA', label, cover, current?, albums:[{ id, title, cover, url }] }].
  // Covers use the small images in assets/img (p3/gipsy/etc. are 8-16 MB).
  gallery_data: [
    {
      id: 'current',
      updated_at: '2026-09-20T12:00:00Z',
      seasons: [
        {
          id: '2025-2026', label: 'Temporada 2025/2026', cover: 'assets/img/tempo3.jpg',
          albums: [
            { id: '2526-album-1', title: 'FOTOS OFICIALS', cover: 'assets/img/tempo3.jpg', url: 'https://photos.app.goo.gl/seedAlbum2526a' },
            { id: '2526-album-2', title: 'CNPN vs UNIZAR', cover: 'assets/img/cefaunizar.jpg', url: 'https://photos.app.goo.gl/seedAlbum2526b' },
            { id: '2526-album-3', title: 'CNPN VS CORNECRUC COPA', cover: 'assets/img/cornecruc.jpg', url: 'https://photos.app.goo.gl/seedAlbum2526c' }
          ]
        },
        {
          id: '2026-2027', label: 'Temporada 2026/2027', current: true, cover: 'assets/img/rugby.jpg',
          albums: [
            { id: '2627-album-1', title: 'CNPN VS TARRAGONA', cover: 'assets/img/1.jpg', url: 'https://photos.app.goo.gl/seedAlbum2627a' },
            { id: '2627-album-2', title: 'CNPN VS GÒTICS', cover: 'assets/img/2.jpeg', url: 'https://photos.app.goo.gl/seedAlbum2627b' }
          ]
        }
      ]
    }
  ],

  // treasury_entries (TREASURY_TABLE): tesoreria.js treasuryRowToEntry + addTreasuryEntry
  // insert (iso, concept, type, amount, responsible_id). type 'ingreso'|'gasto';
  // amount always positive; responsible_id = a profile id (looked up in rosterById).
  // Balance: 1200 + 360 + 14 - 450 - 185.5 = 938.50 €
  treasury_entries: [
    { id: uid('a1000000', 1), iso: '2026-09-01', concept: 'Subvención municipal temporada 26/27', type: 'ingreso', amount: 1200, responsible_id: null },
    { id: uid('a1000000', 2), iso: '2026-09-10', concept: 'Cuotas de temporada (3 jugadoras)', type: 'ingreso', amount: 360, responsible_id: ID.carla },
    { id: uid('a1000000', 3), iso: '2026-09-15', concept: 'Multas cobradas', type: 'ingreso', amount: 14, responsible_id: ID.carla },
    { id: uid('a1000000', 4), iso: '2026-09-05', concept: 'Inscripción federación', type: 'gasto', amount: 450, responsible_id: null },
    { id: uid('a1000000', 5), iso: '2026-09-18', concept: 'Balones y conos de entreno', type: 'gasto', amount: 185.5, responsible_id: ID.jordi }
  ],

  // tercer_treasury_entries (TERCER_TREASURY_TABLE): comi-tercer-temps.js, same shape
  // as treasury_entries. Balance: 150 + 64 - 72.3 - 38.9 = 102.80 €
  tercer_treasury_entries: [
    { id: uid('a2000000', 1), iso: '2026-09-12', concept: 'Barra tercer temps vs Tarragona', type: 'ingreso', amount: 150, responsible_id: ID.paula },
    { id: uid('a2000000', 2), iso: '2026-09-19', concept: 'Barra tercer temps vs Gòtics', type: 'ingreso', amount: 64, responsible_id: ID.paula },
    { id: uid('a2000000', 3), iso: '2026-09-11', concept: 'Compra bebidas Mercadona', type: 'gasto', amount: 72.3, responsible_id: ID.paula },
    { id: uid('a2000000', 4), iso: '2026-09-18', concept: 'Hielo y vasos', type: 'gasto', amount: 38.9, responsible_id: null }
  ],

  // tercer_shopping_items (TERCER_SHOPPING_TABLE): loadTercerShoppingItems (select *,
  // order created_at) maps { id, label, checked }; insert { label, checked }.
  tercer_shopping_items: [
    { id: uid('a3000000', 1), label: 'Cervezas (4 packs)', checked: false, created_at: '2026-09-20T10:00:00Z' },
    { id: uid('a3000000', 2), label: 'Refrescos sin azúcar', checked: false, created_at: '2026-09-20T10:01:00Z' },
    { id: uid('a3000000', 3), label: 'Servilletas', checked: true, created_at: '2026-09-20T10:02:00Z' },
    { id: uid('a3000000', 4), label: 'Bolsas de basura', checked: false, created_at: '2026-09-20T10:03:00Z' }
  ],

  // tricount_expenses (TRICOUNT_EXPENSES_TABLE): tricount.js tricountExpenseRowToEntry
  // (id, label, amount, iso, paid_by, participants, created_by). participants is a
  // uuid[] / JSON array of profile ids. Only jugadora/Capitana count for balances.
  tricount_expenses: [
    {
      id: uid('b1000000', 1), label: 'Gasolina viaje a Tarragona', amount: 48, iso: '2026-09-12',
      paid_by: ID.player, participants: [ID.player, ID.marta, ID.carla, ID.aina], created_by: ID.player
    },
    {
      id: uid('b1000000', 2), label: 'Cena post-partido', amount: 90, iso: '2026-09-19',
      paid_by: ID.marta, participants: [ID.player, ID.marta, ID.carla, ID.paula, ID.aina], created_by: ID.marta
    },
    {
      id: uid('b1000000', 3), label: 'Peajes', amount: 12.6, iso: '2026-09-12',
      paid_by: ID.carla, participants: [ID.player, ID.carla, ID.aina], created_by: ID.carla
    }
  ],

  // tricount_settlements (TRICOUNT_SETTLEMENTS_TABLE): tricountSettlementRowToEntry
  // (id, from_id, to_id, amount, iso) + insert payload.
  tricount_settlements: [
    { id: uid('b2000000', 1), from_id: ID.aina, to_id: ID.marta, amount: 18, iso: '2026-09-21' }
  ],

  // third_time_food: tercer-tiempo.js foodRowToLocal (id, category, detail, player_id,
  // status) + insert { category, detail, player_id }; order created_at. category keys
  // from foodCategories (pasta|arroz|empanadas|tortilla|picar|dulce|otros); status
  // null|'brought'|'missing'. No match column: the list is for the current match
  // (ce1, index 2 -> group A cooks, group B cleans). The player (group A) has not
  // signed up yet on purpose.
  third_time_food: [
    { id: uid('c3000000', 1), category: 'pasta', detail: 'Macarrones a la boloñesa', player_id: ID.marta, status: null, created_at: '2026-09-22T18:00:00Z' },
    { id: uid('c3000000', 2), category: 'tortilla', detail: 'Tortilla de patatas con cebolla', player_id: ID.carla, status: null, created_at: '2026-09-23T09:00:00Z' },
    { id: uid('c3000000', 3), category: 'dulce', detail: 'Brownie', player_id: ID.paula, status: null, created_at: '2026-09-23T12:00:00Z' }
  ],

  // third_time_covers: coverRowToLocal (id, match_id, from_player_id, to_player_id,
  // status, auto) + insert payload; order created_at. status 'pendiente'|'aceptado'|
  // 'rechazado'.
  third_time_covers: [
    // Incoming request for the player on ce1 (she can accept/reject it)
    { id: uid('c1000000', 1), match_id: EV.matchNext, from_player_id: ID.paula, to_player_id: ID.player, status: 'pendiente', auto: false, created_at: '2026-09-23T10:00:00Z' },
    // Aina is covered by Carla on ce1 (creates the unsettled debt below)
    { id: uid('c1000000', 2), match_id: EV.matchNext, from_player_id: ID.aina, to_player_id: ID.carla, status: 'aceptado', auto: false, created_at: '2026-09-22T11:00:00Z' },
    // History: Paula covered by Rovi on 09-12, favour returned automatically on 09-19
    { id: uid('c1000000', 3), match_id: EV.matchPast1, from_player_id: ID.paula, to_player_id: ID.marta, status: 'aceptado', auto: false, created_at: '2026-09-10T10:00:00Z' },
    { id: uid('c1000000', 4), match_id: EV.matchPast2, from_player_id: ID.marta, to_player_id: ID.paula, status: 'aceptado', auto: true, created_at: '2026-09-13T10:00:00Z' }
  ],

  // third_time_debts: debtRowToLocal (id, owed_by, owed_to, settled, origin_match_id,
  // origin_label, settled_match_label) + insert payload; order created_at.
  // CAREFUL: resolveThirdTimeDebts() auto-settles (and WRITES) any unsettled debt whose
  // origin_match_id != the current match, so the only unsettled debt originates on ce1.
  third_time_debts: [
    { id: uid('c2000000', 1), owed_by: ID.aina, owed_to: ID.carla, settled: false, origin_match_id: EV.matchNext, origin_label: 'Partido vs Santboi', settled_match_label: null, created_at: '2026-09-22T11:00:00Z' },
    { id: uid('c2000000', 2), owed_by: ID.paula, owed_to: ID.marta, settled: true, origin_match_id: EV.matchPast1, origin_label: 'Partido vs Tarragona', settled_match_label: 'Partido vs Gòtics', created_at: '2026-09-10T10:00:00Z' }
  ],

  // match_reports: actas.js loadMatchReport (select *, eq id = event id) + manual
  // builder upsert (id, match_duration_minutes, match_duration_estimated, updated_at).
  match_reports: [
    { id: EV.matchPast2, match_duration_minutes: 80, match_duration_estimated: false, updated_at: '2026-09-20T10:00:00Z' }
  ],

  // match_report_players: actas.js builder insert (match_id, profile_id, is_own_team,
  // jersey_number, player_name, license_number, is_starter, minutes_played,
  // tries_count, conversions_count, penalties_count, points) + id. Read with the
  // EMBEDDED resource select('*, match_report_cards(*)') and in jugadoras.js stats
  // select('profile_id, license_number, player_name, minutes_played, tries_count,
  // points, match_report_cards(id)').eq('is_own_team', true).
  match_report_players: [
    { id: uid('d1000000', 1), match_id: EV.matchPast2, profile_id: ID.marta, is_own_team: true, jersey_number: 2, player_name: 'Marta Rovira', license_number: 'CAT-10187', is_starter: true, minutes_played: 80, tries_count: 1, conversions_count: 0, penalties_count: 0, points: 5 },
    { id: uid('d1000000', 2), match_id: EV.matchPast2, profile_id: ID.carla, is_own_team: true, jersey_number: 4, player_name: 'Carla Font', license_number: 'CAT-10411', is_starter: true, minutes_played: 60, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 },
    { id: uid('d1000000', 3), match_id: EV.matchPast2, profile_id: ID.player, is_own_team: true, jersey_number: 10, player_name: 'Júlia Serra', license_number: 'CAT-10234', is_starter: true, minutes_played: 80, tries_count: 1, conversions_count: 3, penalties_count: 1, points: 14 },
    { id: uid('d1000000', 4), match_id: EV.matchPast2, profile_id: ID.paula, is_own_team: true, jersey_number: 12, player_name: 'Paula Vidal', license_number: 'CAT-10302', is_starter: true, minutes_played: 80, tries_count: 2, conversions_count: 0, penalties_count: 0, points: 10 },
    { id: uid('d1000000', 5), match_id: EV.matchPast2, profile_id: ID.aina, is_own_team: true, jersey_number: 18, player_name: 'Aina Soler', license_number: 'CAT-10455', is_starter: false, minutes_played: 20, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 },
    // Player without an account in the app (matched by nothing)
    { id: uid('d1000000', 6), match_id: EV.matchPast2, profile_id: null, is_own_team: true, jersey_number: 15, player_name: 'Laura Gil', license_number: 'CAT-10999', is_starter: true, minutes_played: 80, tries_count: 0, conversions_count: 0, penalties_count: 0, points: 0 }
  ],

  // match_report_cards: actas.js card insert (match_report_player_id, card_type,
  // minute) + id; card_type 'amarilla'|'roja'.
  match_report_cards: [
    { id: uid('d2000000', 1), match_report_player_id: uid('d1000000', 1), card_type: 'amarilla', minute: 34 },
    { id: uid('d2000000', 2), match_report_player_id: uid('d1000000', 3), card_type: 'amarilla', minute: 61 }
  ],

  // match_injuries ("Tullidas"): tullidas.js (id, event_id, user_id, player_name, note,
  // created_at), order created_at.
  match_injuries: [
    { id: uid('d3000000', 1), event_id: EV.matchNext, user_id: ID.marta, player_name: 'Rovi', note: 'Vendaje tobillo izquierdo', created_at: '2026-09-24T18:00:00Z' },
    { id: uid('d3000000', 2), event_id: EV.matchNext, user_id: ID.paula, player_name: 'Paula', note: 'Tape en los dedos de la mano derecha', created_at: '2026-09-24T19:30:00Z' }
  ],

  // matchday_checklist_items: partidos.js select('id, label, checked, created_at')
  // .eq('owner_id', currentAuthUserId) + insert { owner_id, label, checked }. If a
  // user has 0 rows the app INSERTS the defaults on open, so both USERS get rows.
  matchday_checklist_items: [
    { id: uid('e1000000', 1), owner_id: ID.player, label: 'Botes tacos', checked: true, created_at: '2026-09-10T10:00:00Z' },
    { id: uid('e1000000', 2), owner_id: ID.player, label: 'Bucal', checked: false, created_at: '2026-09-10T10:00:01Z' },
    { id: uid('e1000000', 3), owner_id: ID.player, label: 'Toalla', checked: false, created_at: '2026-09-10T10:00:02Z' },
    { id: uid('e1000000', 4), owner_id: ID.player, label: 'Hawaiana', checked: false, created_at: '2026-09-10T10:00:03Z' },
    { id: uid('e1000000', 5), owner_id: ID.admin, label: 'Botiquín', checked: false, created_at: '2026-09-10T10:00:00Z' },
    { id: uid('e1000000', 6), owner_id: ID.admin, label: 'Actas y licencias', checked: false, created_at: '2026-09-10T10:00:01Z' }
  ],

  // matchday_checklist_state: partidos.js select('last_match_id').eq('owner_id', ...) +
  // upsert { owner_id, last_match_id }.
  matchday_checklist_state: [
    { owner_id: ID.player, last_match_id: EV.matchPast2 },
    { owner_id: ID.admin, last_match_id: EV.matchPast2 }
  ],

  // matchday_rollcall: partidos.js select('marks, saved_at').eq('match_id', ...) + upsert
  // (match_id, marks, saved_at, updated_at). marks is a JSON object
  // { localPlayerId: 'v'|'x' } (local ids = profile uuids, 'me' for the saver).
  // Only a past match is seeded: a row for ce1 with saved_at would lock the Lista
  // for non-Tesoreria users.
  matchday_rollcall: [
    {
      match_id: EV.matchPast2,
      marks: { [ID.marta]: 'v', [ID.carla]: 'v', [ID.player]: 'x', [ID.paula]: 'x', [ID.aina]: 'v' },
      saved_at: '2026-09-19T15:10:00Z',
      updated_at: '2026-09-19T15:10:00Z'
    }
  ],

  // fantasy_lineups: fantasy.js select('id, name, lineup, match_id, created_at') + insert
  // (owner_id, match_id, name, lineup). lineup = JSON { posNum: localPlayerId|null }
  // for positions 1-23. Privacy is enforced by RLS on owner_id — the fake backend has
  // no RLS, so every user will see this row.
  fantasy_lineups: [
    {
      id: uid('e2000000', 1), owner_id: ID.player, match_id: EV.matchNext, name: 'Mi XV ideal',
      lineup: { 1: ID.carla, 2: ID.marta, 8: ID.aina, 12: ID.paula },
      created_at: '2026-09-23T20:00:00Z'
    }
  ],

  // fantasy_published_lineups: fantasy.js select('id, name, audience, published_by,
  // match_id, created_at') / select('match_id, lineup') + insert (published_by,
  // match_id, name, lineup, audience, persona_id). audience jugadoras|staff|capitanas|
  // persona. The Inicio banner query is .neq('published_by', me).order(created_at desc)
  // .limit(1) -> this row shows for both USERS (published by Rovi).
  fantasy_published_lineups: [
    {
      id: uid('e3000000', 1), published_by: ID.marta, match_id: EV.matchNext, name: 'Alineación de Rovi',
      lineup: { 1: ID.carla, 2: ID.marta, 3: ID.paula, 9: ID.aina, 10: ID.player },
      audience: 'persona', persona_id: ID.admin,
      created_at: '2026-09-24T21:00:00Z'
    }
  ],

  // gym_exercises: gym.js loadGymExercises (select *, order created_at; reads row.name)
  // + insert { name, created_by }. General exercises added by coach/admin.
  gym_exercises: [
    { id: uid('91000000', 1), name: 'Hip thrust', created_by: ID.jordi, created_at: '2026-09-02T10:00:00Z' },
    { id: uid('91000000', 2), name: 'Remo con barra', created_by: ID.jordi, created_at: '2026-09-02T10:01:00Z' }
  ],

  // gym_removed_default_exercises: select('name') + insert { name, removed_by }.
  // Left empty so the 5 fixed main exercises stay visible.
  gym_removed_default_exercises: [],

  // gym_weekly_routine: loadGymWeeklyRoutine (eq id 'current'; reads week_label, days,
  // updated_at|created_at). days is a JSON blob: [{ day, focus, group_split?,
  // exercises? | exercises_forwards/exercises_backs: [{ name, sets, reps, load, rest }] }].
  // updated_at MUST be in the current week (Mon 21/09 - Sun 27/09) or the app archives
  // it on load (checkAndArchiveGymRoutineIfExpired -> writes).
  gym_weekly_routine: [
    {
      id: 'current',
      week_label: 'Semana 21/09 – 27/09',
      created_at: '2026-09-21T07:00:00Z',
      updated_at: '2026-09-21T07:00:00Z',
      days: [
        {
          day: 'Lunes', focus: 'Fuerza tren inferior', group_split: true,
          exercises_forwards: [
            { name: 'Sentadilla', sets: '5', reps: '5', load: '80% RM', rest: '2 min' },
            { name: 'Peso muerto', sets: '4', reps: '4', load: '85% RM', rest: '3 min' },
            { name: 'Hip thrust', sets: '3', reps: '10', load: '60 kg', rest: '90 s' }
          ],
          exercises_backs: [
            { name: 'Sentadilla', sets: '4', reps: '6', load: '70% RM', rest: '2 min' },
            { name: 'Zancadas', sets: '3', reps: '10 por pierna', load: 'Mancuernas 12 kg', rest: '90 s' },
            { name: 'Saltos al cajón', sets: '4', reps: '5', load: 'Peso corporal', rest: '60 s' }
          ]
        },
        {
          day: 'Miércoles', focus: 'Tren superior', group_split: false,
          exercises: [
            { name: 'Press banca', sets: '5', reps: '5', load: '75% RM', rest: '2 min' },
            { name: 'Remo con barra', sets: '4', reps: '8', load: '65% RM', rest: '90 s' },
            { name: 'Press militar', sets: '3', reps: '8', load: '60% RM', rest: '90 s' }
          ]
        },
        {
          day: 'Viernes', focus: 'Potencia y core', group_split: false,
          exercises: [
            { name: 'Dominadas lastradas', sets: '4', reps: '5', load: '+5 kg', rest: '2 min' },
            { name: 'Plancha', sets: '3', reps: '45 s', load: '—', rest: '30 s' }
          ]
        }
      ]
    }
  ],

  // gym_weekly_routine_archive: insert (week_label, days, archived_at); read select *
  // order archived_at desc (+ limit 1 / maybeSingle for "cargar última rutina").
  gym_weekly_routine_archive: [
    {
      id: uid('93000000', 1),
      week_label: 'Semana 14/09 – 20/09',
      archived_at: '2026-09-21T06:00:00Z',
      days: [
        {
          day: 'Martes', focus: 'Fuerza general', group_split: false,
          exercises: [
            { name: 'Sentadilla', sets: '4', reps: '6', load: '75% RM', rest: '2 min' },
            { name: 'Press banca', sets: '4', reps: '6', load: '70% RM', rest: '2 min' }
          ]
        }
      ]
    }
  ],

  // gym_rm: loadGymRm select('profile_id, exercise, weight, updated_at') + upsert
  // onConflict 'profile_id,exercise'. weight in kg (number); updated_at sliced to date.
  gym_rm: [
    { profile_id: ID.player, exercise: 'Sentadilla', weight: 85, updated_at: '2026-09-18T19:00:00Z' },
    { profile_id: ID.player, exercise: 'Press banca', weight: 45, updated_at: '2026-09-16T19:00:00Z' },
    { profile_id: ID.player, exercise: 'Peso muerto', weight: 100, updated_at: '2026-09-18T19:10:00Z' },
    { profile_id: ID.marta, exercise: 'Sentadilla', weight: 110, updated_at: '2026-09-17T19:00:00Z' },
    { profile_id: ID.marta, exercise: 'Peso muerto', weight: 130, updated_at: '2026-09-17T19:10:00Z' },
    { profile_id: ID.carla, exercise: 'Sentadilla', weight: 95, updated_at: '2026-09-15T19:00:00Z' },
    { profile_id: ID.carla, exercise: 'Press banca', weight: 55, updated_at: '2026-09-15T19:05:00Z' },
    { profile_id: ID.paula, exercise: 'Sentadilla', weight: 70, updated_at: '2026-09-14T19:00:00Z' },
    { profile_id: ID.aina, exercise: 'Sentadilla', weight: 75, updated_at: '2026-09-22T19:00:00Z' },
    { profile_id: ID.aina, exercise: 'Hip thrust', weight: 120, updated_at: '2026-09-22T19:05:00Z' }
  ],

  // gym_rm_history: insert (profile_id, exercise, weight, recorded_at); read
  // select('weight, recorded_at').eq('profile_id').eq('exercise').order(recorded_at desc).
  gym_rm_history: [
    { id: uid('92000000', 1), profile_id: ID.player, exercise: 'Sentadilla', weight: 75, recorded_at: '2026-06-10T19:00:00Z' },
    { id: uid('92000000', 2), profile_id: ID.player, exercise: 'Sentadilla', weight: 80, recorded_at: '2026-09-04T19:00:00Z' },
    { id: uid('92000000', 3), profile_id: ID.player, exercise: 'Sentadilla', weight: 85, recorded_at: '2026-09-18T19:00:00Z' },
    { id: uid('92000000', 4), profile_id: ID.player, exercise: 'Press banca', weight: 45, recorded_at: '2026-09-16T19:00:00Z' },
    { id: uid('92000000', 5), profile_id: ID.player, exercise: 'Peso muerto', weight: 100, recorded_at: '2026-09-18T19:10:00Z' },
    { id: uid('92000000', 6), profile_id: ID.marta, exercise: 'Sentadilla', weight: 110, recorded_at: '2026-09-17T19:00:00Z' }
  ],

  // gym_attendance: loadGymAttendanceToday select * .eq('attendance_date', today) (reads
  // profile_id, time) + upsert onConflict 'profile_id,attendance_date'. time 'HH:MM'.
  // The player is NOT checked in today (so the check-in button is available).
  gym_attendance: [
    { profile_id: ID.marta, attendance_date: '2026-09-25', time: '18:00' },
    { profile_id: ID.carla, attendance_date: '2026-09-25', time: '18:30' },
    { profile_id: ID.aina, attendance_date: '2026-09-25', time: '19:15' },
    { profile_id: ID.paula, attendance_date: '2026-09-23', time: '18:00' }
  ],

  // test_questions: test.js startTestQuiz (select *) reads question, option_a..option_d,
  // correct_index (0-3, compared with ===, so a number) and optional explanation.
  test_questions: [
    { id: uid('94000000', 1), question: '¿Cuántos puntos vale un ensayo?', option_a: '3', option_b: '5', option_c: '7', option_d: '2', correct_index: 1, explanation: 'Un ensayo vale 5 puntos en rugby union.' },
    { id: uid('94000000', 2), question: '¿Cuántos puntos vale una transformación?', option_a: '1', option_b: '2', option_c: '3', option_d: '5', correct_index: 1, explanation: 'La transformación tras un ensayo suma 2 puntos.' },
    { id: uid('94000000', 3), question: '¿Cuántos puntos vale un golpe de castigo a palos?', option_a: '2', option_b: '3', option_c: '4', option_d: '5', correct_index: 1, explanation: 'Un golpe de castigo convertido suma 3 puntos.' },
    { id: uid('94000000', 4), question: '¿Cuántas jugadoras hay en el campo por equipo en rugby XV?', option_a: '13', option_b: '11', option_c: '15', option_d: '7', correct_index: 2, explanation: 'En rugby XV juegan 15 por equipo.' },
    { id: uid('94000000', 5), question: '¿Qué dorsal lleva normalmente la talonadora?', option_a: '1', option_b: '2', option_c: '9', option_d: '8', correct_index: 1, explanation: 'La talonadora lleva el 2, entre las dos pilares.' },
    { id: uid('94000000', 6), question: '¿Hacia dónde se puede pasar el balón con la mano?', option_a: 'Hacia delante', option_b: 'Solo en horizontal o hacia atrás', option_c: 'En cualquier dirección', option_d: 'Solo hacia atrás en melé', correct_index: 1, explanation: 'Un pase hacia delante es un "avant" de pase.' },
    { id: uid('94000000', 7), question: '¿Cuánto dura un partido de rugby XV senior?', option_a: '60 minutos', option_b: '70 minutos', option_c: '80 minutos', option_d: '90 minutos', correct_index: 2, explanation: 'Dos partes de 40 minutos.' },
    { id: uid('94000000', 8), question: '¿Qué dorsal lleva la medio melé?', option_a: '9', option_b: '10', option_c: '8', option_d: '12', correct_index: 0, explanation: 'La medio melé lleva el 9.' },
    { id: uid('94000000', 9), question: '¿Cuántos minutos dura una exclusión temporal (tarjeta amarilla)?', option_a: '5', option_b: '10', option_c: '15', option_d: '20', correct_index: 1, explanation: 'La tarjeta amarilla supone 10 minutos fuera.' },
    { id: uid('94000000', 10), question: '¿Cuántas jugadoras forman una melé ordenada completa por equipo?', option_a: '6', option_b: '8', option_c: '5', option_d: '10', correct_index: 1, explanation: 'Los 8 delanteros forman la melé.' },
    { id: uid('94000000', 11), question: '¿Qué es un "drop"?', option_a: 'Un pase largo', option_b: 'Una patada a palos con bote previo en juego', option_c: 'Una falta en el ruck', option_d: 'Un tipo de placaje', correct_index: 1, explanation: 'El drop vale 3 puntos y se patea tras botar el balón.' },
    { id: uid('94000000', 12), question: '¿Qué dorsal lleva la zaguera?', option_a: '11', option_b: '14', option_c: '15', option_d: '13', correct_index: 2, explanation: 'La zaguera (full-back) lleva el 15.' }
  ],

  // test_scores: test.js loadTestRanking select('profile_id, points') order points desc +
  // upsert { profile_id, points, updated_at }.
  test_scores: [
    { profile_id: ID.marta, points: 42, updated_at: '2026-09-22T20:00:00Z' },
    { profile_id: ID.player, points: 27, updated_at: '2026-09-21T20:00:00Z' },
    { profile_id: ID.aina, points: 19, updated_at: '2026-09-20T20:00:00Z' },
    { profile_id: ID.paula, points: 8, updated_at: '2026-09-19T20:00:00Z' }
  ],

  // push_subscriptions: write-only from js/push.js upsert (profile_id, fcm_token,
  // platform, updated_at) onConflict 'fcm_token'. Never read by the app.
  push_subscriptions: []
};

// Supabase Storage objects (bucket 'avatars' is only written by perfil.js uploadAvatar;
// avatar_url values in profiles point to local assets instead).
export const storageObjects = {};

// Handy re-exports for specs.
export const IDS = ID;
export const EVENT_IDS = EV;
