// Alterna entre el formulario de login y el de registro dentro del overlay de acceso
function showAuthView(view){
  document.getElementById('auth-login-view').style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('auth-register-view').style.display = view === 'register' ? 'block' : 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('register-error').textContent = '';
  document.getElementById('register-error').style.color = 'var(--bad)';
}

// Solo si el rol elegido en el registro es "jugadora" (o "Capitana", que es una
// jugadora con galones extra) se piden Rango y Comisión
function onRegisterRolChange(){
  const rol = document.getElementById('register-rol-input').value;
  document.getElementById('register-jugadora-fields').style.display = effectiveRoleForPermissions(rol) === 'jugadora' ? 'flex' : 'none';
}

// Calcula a qué grupo (A o B) le toca la próxima jugadora que se registre: al que
// tenga menos miembros ahora mismo (y a A en caso de empate), para que la plantilla
// quede repartida lo más igualada posible según se va registrando gente.
async function nextThirdTimeGroup(){
  const [countA, countB] = await Promise.all([
    supabaseClient.from('profiles').select('id', { count:'exact', head:true }).eq('grupo_tercer_tiempo', 'A').eq('is_admin', false),
    supabaseClient.from('profiles').select('id', { count:'exact', head:true }).eq('grupo_tercer_tiempo', 'B').eq('is_admin', false)
  ]);
  return (countB.count || 0) < (countA.count || 0) ? 'B' : 'A';
}

async function handleRegister(){
  const email = document.getElementById('register-email-input').value.trim();
  const password = document.getElementById('register-password-input').value;
  const nombre = document.getElementById('register-nombre-input').value.trim();
  const apellido = document.getElementById('register-apellido-input').value.trim();
  const telefono = document.getElementById('register-telefono-input')?.value.trim() || null;
  const mote = document.getElementById('register-mote-input').value.trim();
  const fecha_nacimiento = document.getElementById('register-fecha-nacimiento-input').value || null;
  const rol = document.getElementById('register-rol-input').value;
  const esJugadora = effectiveRoleForPermissions(rol) === 'jugadora';
  const rango = esJugadora ? (document.getElementById('register-rango-input').value || null) : null;
  const posicion = esJugadora ? (document.getElementById('register-posicion-input').value || null) : null;
  const comision = esJugadora ? (document.getElementById('register-comision-input').value || null) : null;
  const licencia = esJugadora ? (document.getElementById('register-licencia-input').value.trim() || null) : null;

  const errorBox = document.getElementById('register-error');
  errorBox.style.color = 'var(--bad)';
  errorBox.textContent = '';

  if(!email || !password || !nombre || !rol){
    errorBox.textContent = 'Rellena al menos email, contraseña, nombre y rol.';
    return;
  }

  // Se calcula ANTES del signUp porque también viaja dentro de options.data,
  // para que si hay un trigger en Supabase que crea la fila de "profiles" a partir
  // de los metadatos del usuario, ya tenga el grupo asignado desde el primer momento.
  const grupo_tercer_tiempo = await nextThirdTimeGroup();

  // 1) Credenciales en auth.users. Los datos del perfil viajan en options.data
  // (raw_user_meta_data) para que, si existe un trigger que crea automáticamente
  // la fila en "profiles" al darse de alta el usuario, no la cree vacía.
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { nombre, apellido, mote, telefono, fecha_nacimiento, rol, rango, posicion, comision, licencia, grupo_tercer_tiempo }
    }
  });
  if(error){
    errorBox.textContent = error.message;
    return;
  }

  // 2) Datos del equipo en la tabla profiles, con el mismo id que el usuario de auth.
  // Se usa upsert (no insert) porque si el trigger de Supabase ya ha creado la fila
  // a partir de options.data, un insert() normal fallaría por choque de clave primaria.
  const userId = data.user ? data.user.id : (data.session ? data.session.user.id : null);
  if(userId){
    const { error: profileError } = await supabaseClient.from('profiles').upsert({
      id: userId, nombre, apellido, mote, telefono, fecha_nacimiento, rol, rango, posicion, comision, licencia, grupo_tercer_tiempo
    });
    if(profileError){
      errorBox.textContent = 'Se ha creado la cuenta, pero no se pudo guardar el perfil: ' + profileError.message;
      return;
    }
  }

  if(data.session){
    onAuthenticated(data.session.user);
  } else {
    // El proyecto de Supabase tiene activada la confirmación por email
    errorBox.style.color = 'var(--ok)';
    errorBox.textContent = 'Cuenta creada. Revisa tu email para confirmarla y luego inicia sesión.';
  }
}

async function handleLogin(){
  const email = document.getElementById('login-email-input').value.trim();
  const password = document.getElementById('login-password-input').value;
  const errorBox = document.getElementById('login-error');
  errorBox.textContent = '';

  if(!email || !password){
    errorBox.textContent = 'Introduce tu email y contraseña.';
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){
    errorBox.textContent = error.message;
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
// Además, comprobamos que ni 'fines' ni la asistencia de 'attEvents' se guardan en
// ningún sitio (ni Supabase ni window.storage): son solo memoria de la pestaña, así
// que ya se pierden con cualquier recarga normal del navegador. Es decir, un refresco
// completo de la página ya es, por definición, la limpieza perfecta de todo el estado
// en memoria — así que en vez de perseguir cada variable, forzamos ese refresco
// nosotros mismos justo después de cerrar sesión en Supabase.
async function handleLogout(){
  try{
    await supabaseClient.auth.signOut();
  }catch(e){ console.error('Error al cerrar sesión en Supabase', e); }
  location.reload();
}

// Se ejecuta justo después de iniciar sesión (o registrarse) con éxito: vuelca los
// datos guardados en "profiles" sobre "Mi perfil" y carga la Plantilla
// Id real de Supabase de la persona que ha iniciado sesión (para saber qué fila de
// la lista de Jugadoras es "yo" y mostrarle ahí sus propias tarjetas/lesión).
let currentAuthUserId = null;
let isAdmin = false;

async function onAuthenticated(user){
  document.getElementById('auth-overlay').classList.add('hidden');
  currentAuthUserId = user.id;
  if(window.flushPendingPushToken) window.flushPendingPushToken();
  const emailDisplay = document.getElementById('profile-email-display');
  if(emailDisplay) emailDisplay.textContent = user.email;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if(profile){
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
    isAdmin = !!profile.is_admin;
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
    toggleFineAddButtonVisibility();
    appBridge.sessionChanged();
    appBridge.tesoreria.permissionsChanged();
    appBridge.comiTercerTemps.permissionsChanged();
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
  try{
    await refreshSharedEventsAndUI();
  }catch(e){ console.error('No se han podido refrescar Asistencia/Wellness al iniciar sesión', e); }

  try{
    await loadGymExercises();
    subscribeToGymExercisesRealtime();
    await loadGymRemovedDefaultExercises();
    subscribeToGymRemovedDefaultExercisesRealtime();
    await loadGymRm();
    subscribeToGymRmRealtime();
    renderGymRoutine();
    await loadGymWeeklyRoutine();
    subscribeToGymRoutineRealtime();
    await loadGymAttendanceToday();
    subscribeToGymAttendanceRealtime();
  }catch(e){ console.error('No se ha podido cargar el módulo de Gimnasio al iniciar sesión', e); }

  subscribeToMatchReportRealtime();
  subscribeToAttAttendanceRealtime();
  subscribeToTullidesRealtime();

  // Fantasy guarda su borrador y las alineaciones guardadas en almacenamiento de
  // navegador aparte de Supabase: se recargan aquí, ya con el id real fijado, para
  // traer las de esta persona y no las de quien usara antes este dispositivo.
  try{
    await loadFantasyDraft();
    refreshFantasyMatchesAndUI();
    // Por si alguien te ha compartido una alineación de Fantasy mientras no tenías la
    // app abierta, se comprueba también justo al iniciar sesión (no solo al entrar en
    // Inicio, que ya está activo por defecto y por tanto no dispara ese aviso).
    checkInicioSharedLineupBanner();
  }catch(e){ console.error('No se ha podido cargar Fantasy al iniciar sesión', e); }

  // Los avisos son compartidos entre toda la plantilla: se refrescan también al
  // iniciar sesión, para traer los que hayan publicado otras personas.
  try{
    appBridge.avisos.refreshAll();
  }catch(e){ console.error('No se han podido cargar los avisos al iniciar sesión', e); }

  // Multas: se recargan aquí, ya con el id real fijado, para que el botón "Añadir
  // multa" y la sincronización en directo funcionen desde el primer momento.
  try{
    await loadFines();
    subscribeToFinesRealtime();
  }catch(e){ console.error('No se han podido cargar las multas al iniciar sesión', e); }

  // Tercer tiempo (cambios de turno, deudas y comida): igual que las multas, se
  // recargan aquí con el id real fijado y quedan sincronizados en directo entre
  // todas las cuentas.
  try{
    await loadThirdTimeCovers();
    await loadThirdTimeDebts();
    await loadThirdTimeFood();
    subscribeToThirdTimeRealtime();
  }catch(e){ console.error('No se ha podido cargar Tercer Tiempo al iniciar sesión', e); }

  // Galería: se recarga aquí con el id real fijado (para saber si esta cuenta es
  // Comi Xarxes) y queda sincronizada en directo entre todas las cuentas.
  try{
    await appBridge.galeria.load();
    appBridge.galeria.subscribe();
  }catch(e){ console.error('No se ha podido cargar la Galería al iniciar sesión', e); }
}
