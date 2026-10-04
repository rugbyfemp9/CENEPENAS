// ================= INICIO DE SESIÓN / REGISTRO (Supabase Auth) =================
// (antes js/core/auth.js) El formulario lo pinta src/shell/AuthOverlay.svelte.
import { supabase } from '../lib/supabase.js';
import { setAuthUserId, setIsAdmin, refreshSession } from '../lib/session.svelte.js';
import { myProfile, rosterById } from '../lib/roster.js';
import { effectiveRoleForPermissions } from '../lib/permissions.js';
import { t } from '../lib/i18n.svelte.js';
import { flushPendingPushToken } from '../lib/push.svelte.js';
import { openSectionFromHash } from './navigation.svelte.js';
import { toggleWellnessStaffCardVisibility, toggleStaffOnlyPagesVisibility } from './visibility.svelte.js';
import { renderProfile, setEmail } from '../features/perfil/perfil.svelte.js';
import { toggleAttAddButtonVisibility, refreshSharedEventsAndUI } from '../features/asistencia/asistencia.svelte.js';
import { subscribeToAttAttendanceRealtime } from '../features/asistencia/attendance.svelte.js';
import { permissionsChanged as finesPermissionsChanged, loadFines, subscribeToFinesRealtime } from '../features/multas/multas.svelte.js';
import { treasury } from '../features/tesoreria/tesoreria.svelte.js';
import { tercerTreasury } from '../features/comi-tercer-temps/comi-tercer-temps.svelte.js';
import { loadPlantilla, subscribeToProfilesRealtime } from '../features/jugadoras/jugadoras.svelte.js';
import { loadAfterLogin as loadGymAfterLogin } from '../features/gym/gym.svelte.js';
import { subscribeToMatchReportRealtime } from '../features/actas/actas.svelte.js';
import { subscribeToTullidesRealtime } from '../features/tullidas/tullidas.svelte.js';
import { loadAfterLogin as loadFantasyAfterLogin } from '../features/fantasy/fantasy.svelte.js';
import { refreshAll as refreshNotices } from '../features/avisos/avisos.svelte.js';
import { loadThirdTimeCovers, loadThirdTimeDebts } from '../features/tercer-tiempo/covers.svelte.js';
import { loadThirdTimeFood } from '../features/tercer-tiempo/food.svelte.js';
import { subscribeToThirdTimeRealtime } from '../features/tercer-tiempo/tercer-tiempo.svelte.js';
import { loadGalleryData, subscribeToGalleryRealtime } from '../features/galeria/galeria.svelte.js';

export const authUi = $state({
  // Se oculta al iniciar sesión (o al restaurar la sesión guardada).
  hidden: false,
  view: 'login',
  loginError: '',
  registerError: '',
  // null = sin color propio (como antes de tocarlo por primera vez)
  registerErrorColor: null,
});

// Los mensajes de error/aviso del acceso son o un texto tal cual (el de Supabase)
// o { key, vars } del diccionario, que se traduce al pintarlo (y cambia con el idioma).
export function authMessage(msg) {
  return typeof msg === 'string' ? msg : t(msg.key, msg.vars);
}

export const loginForm = $state({ email: '', password: '' });

export const registerForm = $state({
  email: '', password: '', nombre: '', apellido: '', mote: '', fecha_nacimiento: '',
  rol: '', rango: '', posicion: '', comision: '', licencia: '',
});

// Alterna entre el formulario de login y el de registro dentro del overlay de acceso
export function showAuthView(view) {
  authUi.view = view;
  authUi.loginError = '';
  authUi.registerError = '';
  authUi.registerErrorColor = 'var(--bad)';
}

// Solo si el rol elegido en el registro es "jugadora" (o "Capitana", que es una
// jugadora con galones extra) se piden Rango y Comisión
export function registerAsksPlayerFields() {
  return effectiveRoleForPermissions(registerForm.rol) === 'jugadora';
}

// Calcula a qué grupo (A o B) le toca la próxima jugadora que se registre: al que
// tenga menos miembros ahora mismo (y a A en caso de empate), para que la plantilla
// quede repartida lo más igualada posible según se va registrando gente.
async function nextThirdTimeGroup() {
  const [countA, countB] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('grupo_tercer_tiempo', 'A').eq('is_admin', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('grupo_tercer_tiempo', 'B').eq('is_admin', false)
  ]);
  return (countB.count || 0) < (countA.count || 0) ? 'B' : 'A';
}

export async function handleRegister() {
  const f = registerForm;
  const email = f.email.trim();
  const password = f.password;
  const nombre = f.nombre.trim();
  const apellido = f.apellido.trim();
  // NOTE: el formulario no tiene campo de teléfono, así que siempre se envía null.
  const telefono = null;
  const mote = f.mote.trim();
  const fecha_nacimiento = f.fecha_nacimiento || null;
  const rol = f.rol;
  const esJugadora = effectiveRoleForPermissions(rol) === 'jugadora';
  const rango = esJugadora ? (f.rango || null) : null;
  const posicion = esJugadora ? (f.posicion || null) : null;
  const comision = esJugadora ? (f.comision || null) : null;
  const licencia = esJugadora ? (f.licencia.trim() || null) : null;

  authUi.registerErrorColor = 'var(--bad)';
  authUi.registerError = '';

  if (!email || !password || !nombre || !rol) {
    authUi.registerError = { key: 'auth.errRequiredFields' };
    return;
  }

  // Se calcula ANTES del signUp porque también viaja dentro de options.data,
  // para que si hay un trigger en Supabase que crea la fila de "profiles" a partir
  // de los metadatos del usuario, ya tenga el grupo asignado desde el primer momento.
  const grupo_tercer_tiempo = await nextThirdTimeGroup();

  // 1) Credenciales en auth.users. Los datos del perfil viajan en options.data
  // (raw_user_meta_data) para que, si existe un trigger que crea automáticamente
  // la fila en "profiles" al darse de alta el usuario, no la cree vacía.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, apellido, mote, telefono, fecha_nacimiento, rol, rango, posicion, comision, licencia, grupo_tercer_tiempo }
    }
  });
  if (error) {
    authUi.registerError = error.message;
    return;
  }

  // 2) Datos del equipo en la tabla profiles, con el mismo id que el usuario de auth.
  // Se usa upsert (no insert) porque si el trigger de Supabase ya ha creado la fila
  // a partir de options.data, un insert() normal fallaría por choque de clave primaria.
  const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
  if (userId) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId, nombre, apellido, mote, telefono, fecha_nacimiento, rol, rango, posicion, comision, licencia, grupo_tercer_tiempo
    });
    if (profileError) {
      authUi.registerError = { key: 'auth.errProfileSave', vars: { error: profileError.message } };
      return;
    }
  }

  if (data.session) {
    onAuthenticated(data.session.user);
  } else {
    // El proyecto de Supabase tiene activada la confirmación por email
    authUi.registerErrorColor = 'var(--ok)';
    authUi.registerError = { key: 'auth.accountCreated' };
  }
}

export async function handleLogin() {
  const email = loginForm.email.trim();
  const password = loginForm.password;
  authUi.loginError = '';

  if (!email || !password) {
    authUi.loginError = { key: 'auth.errLoginRequired' };
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authUi.loginError = error.message;
    return;
  }
  onAuthenticated(data.user);
}

// ---- Cerrar sesión: recarga completa de la página ----
// Antes esto intentaba "limpiar a mano" cada variable y cada vista una por una
// (reasignar 'me' al id real, resetear el perfil, la tabla de Jugadoras, Fantasy,
// los punteros de navegación, cerrar modales...). El problema es que esa lista nunca
// se puede dar por completa: cualquier vista que se nos quedara sin repintar (Asistencia,
// Comi Tesoreria, Comi Tercer Temps, Calendario, Tricount, Liga, avisos...) se quedaba
// mostrando los datos de quien acababa de desconectarse hasta el siguiente login.
//
// Además, comprobamos que ni las multas (src/features/multas) ni la asistencia de 'attEvents' se guardan en
// ningún sitio (ni Supabase ni window.storage): son solo memoria de la pestaña, así
// que ya se pierden con cualquier recarga normal del navegador. Es decir, un refresco
// completo de la página ya es, por definición, la limpieza perfecta de todo el estado
// en memoria — así que en vez de perseguir cada variable, forzamos ese refresco
// nosotros mismos justo después de cerrar sesión en Supabase.
export async function handleLogout() {
  try {
    await supabase.auth.signOut();
  } catch (e) { console.error('Error al cerrar sesión en Supabase', e); }
  location.reload();
}

// Se ejecuta justo después de iniciar sesión (o registrarse) con éxito, y al arrancar
// si ya había una sesión guardada: vuelca los datos guardados en "profiles" sobre
// "Mi perfil" y carga la Plantilla y el resto de secciones.
export async function onAuthenticated(user) {
  authUi.hidden = true;
  setAuthUserId(user.id);
  flushPendingPushToken();
  setEmail(user.email);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    myProfile.name = [profile.nombre, profile.apellido].filter(Boolean).join(' ') || profile.mote || 'Tu nombre';
    myProfile.mote = profile.mote || '';
    myProfile.phone = profile.telefono || '';
    myProfile.birthdate = profile.fecha_nacimiento || '';
    myProfile.comision = profile.comision || '';
    myProfile.rango = profile.rango || '';
    myProfile.posicion = profile.posicion || '';
    myProfile.rol = profile.rol || '';
    myProfile.licencia = profile.licencia || '';
    myProfile.avatarUrl = profile.avatar_url || '';
    // La cuenta de administración (marcada con is_admin en Supabase) puede editar
    // todo, incluida la información de cualquier jugadora registrada.
    setIsAdmin(!!profile.is_admin);
    rosterById['me'].name = myProfile.name;
    rosterById['me'].mote = myProfile.mote;
    rosterById['me'].comision = myProfile.comision;
    rosterById['me'].rango = myProfile.rango;
    rosterById['me'].posicion = myProfile.posicion;
    rosterById['me'].rol = myProfile.rol;
    rosterById['me'].licencia = myProfile.licencia;
    rosterById['me'].birthdate = myProfile.birthdate;
    renderProfile();
    // El botón "Añadir evento" depende del rol real, y los de "Añadir multa",
    // "Añadir álbum" y los de tesorería de las comisiones reales: todos ellos solo
    // se conocen a partir de aquí.
    toggleAttAddButtonVisibility();
    refreshSession();
    finesPermissionsChanged();
    treasury.permissionsChanged();
    tercerTreasury.permissionsChanged();
    toggleWellnessStaffCardVisibility();
    toggleStaffOnlyPagesVisibility();
  }

  await loadPlantilla();
  subscribeToProfilesRealtime();

  // Asistencia/Calendario y el módulo de Wellness (banner de Inicio + botón directo
  // de Cos Tècnic en cada evento) dependen de refreshSharedEventsAndUI(): se llama
  // aquí, justo después de tener la plantilla y el rol real cargados, y ANTES que
  // el resto de bloques (Gimnasio, Fantasy, Multas...). Antes iba después de todos
  // ellos: si cualquiera de esos bloques lanzaba un error, la cadena de await se
  // cortaba ahí y esta llamada no llegaba a ejecutarse nunca, dejando el listado de
  // eventos y el banner de Wellness congelados con el render de antes de iniciar
  // sesión (sin rol conocido) — el bug que hacía que ni el banner ni el botón de
  // entrenadors aparecieran. Además, cada bloque de abajo va envuelto en su propio
  // try/catch: así, aunque uno falle, no arrastra a los demás.
  try {
    await refreshSharedEventsAndUI();
  } catch (e) { console.error('No se han podido refrescar Asistencia/Wellness al iniciar sesión', e); }

  // Las notificaciones de "aún no has respondido" abren la app en ./#asistencia:
  // entramos directas en Asistencia (ya con los eventos cargados) y quitamos el #.
  openSectionFromHash();

  try {
    await loadGymAfterLogin();
  } catch (e) { console.error('No se ha podido cargar el módulo de Gimnasio al iniciar sesión', e); }

  subscribeToMatchReportRealtime();
  subscribeToAttAttendanceRealtime();
  subscribeToTullidesRealtime();

  // Fantasy guarda su borrador y las alineaciones guardadas en almacenamiento de
  // navegador aparte de Supabase: se recargan aquí, ya con el id real fijado, para
  // traer las de esta persona y no las de quien usara antes este dispositivo.
  try {
    // Por si alguien te ha compartido una alineación de Fantasy mientras no tenías la
    // app abierta, loadAfterLogin() comprueba también el aviso justo al iniciar sesión
    // (no solo al entrar en Inicio, que ya está activo por defecto y por tanto no
    // dispara ese aviso).
    await loadFantasyAfterLogin();
  } catch (e) { console.error('No se ha podido cargar Fantasy al iniciar sesión', e); }

  // Los avisos son compartidos entre toda la plantilla: se refrescan también al
  // iniciar sesión, para traer los que hayan publicado otras personas.
  try {
    refreshNotices();
  } catch (e) { console.error('No se han podido cargar los avisos al iniciar sesión', e); }

  // Multas: se recargan aquí, ya con el id real fijado, para que el botón "Añadir
  // multa" y la sincronización en directo funcionen desde el primer momento.
  try {
    await loadFines();
    subscribeToFinesRealtime();
  } catch (e) { console.error('No se han podido cargar las multas al iniciar sesión', e); }

  // Tercer tiempo (cambios de turno, deudas y comida): igual que las multas, se
  // recargan aquí con el id real fijado y quedan sincronizados en directo entre
  // todas las cuentas.
  try {
    await loadThirdTimeCovers();
    await loadThirdTimeDebts();
    await loadThirdTimeFood();
    subscribeToThirdTimeRealtime();
  } catch (e) { console.error('No se ha podido cargar Tercer Tiempo al iniciar sesión', e); }

  // Galería: se recarga aquí con el id real fijado (para saber si esta cuenta es
  // Comi Xarxes) y queda sincronizada en directo entre todas las cuentas.
  try {
    await loadGalleryData();
    subscribeToGalleryRealtime();
  } catch (e) { console.error('No se ha podido cargar la Galería al iniciar sesión', e); }
}
