// Devuelve el contenido de un .avatar: la foto si existe, o si no las iniciales/texto de reserva,
// más la insignia de lesión si aplica. Se usa tanto en Mi perfil como en la lista de Jugadoras.
function avatarHtml(url, fallbackText, injured, injuryIcon){
  const badge = injuryBadgeHtml(injured, injuryIcon);
  if(url) return `<img src="${url}" alt="" loading="lazy">` + badge;
  return escapeHtml(fallbackText) + badge;
}

// Igual que avatarHtml, pero para el avatar propio (Mi perfil / barra superior): si no
// hay foto subida, en vez de iniciales se muestra el escudo del club entero (sin recortar
// y sin el cuadrado de color de fondo detrás). containerEl es el elemento .avatar donde
// se pinta, porque además de rellenarlo hay que añadir/quitar la clase que le quita el fondo.
function ownAvatarHtml(containerEl, url, injured, injuryIcon){
  const badge = injuryBadgeHtml(injured, injuryIcon);
  if(containerEl) containerEl.classList.toggle('avatar-logo-fallback', !url);
  if(url) return `<img src="${url}" alt="">` + badge;
  return `<img src="assets/img/logo.png" alt="">` + badge;
}

// ---- Insignia de "lesionada" (botiquín) o "tocada" (🤕) en los avatares ----
function injuryBadgeHtml(injured, injuryIcon){
  if(!injured) return '';
  if(injuryIcon === 'tocada'){
    return `<span class="avatar-injured-badge icon-tocada" title="Tocada"><span class="emoji">🤕</span></span>`;
  }
  return `<span class="avatar-injured-badge" title="Lesionada"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M12 11v6M9 14h6"/></svg></span>`;
}

// Abre/cierra el pequeño desplegable con las dos opciones (botiquín / 🤕)
function toggleInjuryPicker(){
  const me = rosterById[currentUserId];
  const picker = document.getElementById('injury-picker');
  const isOpening = !picker.classList.contains('open');
  picker.classList.toggle('open', isOpening);
  if(isOpening && me){
    document.getElementById('injury-picker-botiquin').classList.toggle('selected', me.injured && me.injuryIcon !== 'tocada');
    document.getElementById('injury-picker-tocada').classList.toggle('selected', me.injured && me.injuryIcon === 'tocada');
  }
}
// Elegir una opción del desplegable: si ya estaba marcada esa misma opción, la quita
// (igual que el toggle de antes); si no, la marca con ese icono.
function chooseInjuryIcon(icon){
  const me = rosterById[currentUserId];
  if(!me) return;

  if(me.injured && me.injuryIcon === icon){
    me.injured = false;
    me.injuryIcon = '';
  } else {
    me.injured = true;
    me.injuryIcon = icon;
  }

  document.getElementById('injury-picker').classList.remove('open');

  const btn = document.getElementById('injury-toggle-btn');
  btn.classList.toggle('active', me.injured);
  btn.classList.toggle('icon-tocada', me.injured && me.injuryIcon === 'tocada');

  { const el = document.getElementById('pf-avatar'); el.innerHTML = ownAvatarHtml(el, myProfile.avatarUrl, me.injured, me.injuryIcon); }
  { const el = document.getElementById('profile-btn'); el.innerHTML = ownAvatarHtml(el, myProfile.avatarUrl, me.injured, me.injuryIcon); }

  // Refresca cualquier otra vista que ya esté pintando avatares del roster,
  // para que la insignia aparezca al momento en todas las interacciones donde salga su perfil.
  renderFinesTable();
  renderFinePlayerGrid();
  loadPlantilla();
  if(currentEventId) renderEventDetail();
}

function renderProfile(){
  const me = rosterById[currentUserId];
  const pfAvatarEl = document.getElementById('pf-avatar');
  pfAvatarEl.innerHTML = ownAvatarHtml(pfAvatarEl, myProfile.avatarUrl, me && me.injured, me && me.injuryIcon);
  const profileBtnEl = document.getElementById('profile-btn');
  if(profileBtnEl) profileBtnEl.innerHTML = ownAvatarHtml(profileBtnEl, myProfile.avatarUrl, me && me.injured, me && me.injuryIcon);
  const avatarAdjustBtn = document.getElementById('pf-avatar-adjust-btn');
  if(avatarAdjustBtn) avatarAdjustBtn.disabled = !myProfile.avatarUrl;

  const injuryBtn = document.getElementById('injury-toggle-btn');
  if(injuryBtn){
    injuryBtn.classList.toggle('active', !!(me && me.injured));
    injuryBtn.classList.toggle('icon-tocada', !!(me && me.injured && me.injuryIcon === 'tocada'));
  }

  document.getElementById('profile-name-display').textContent = (myProfile.name && myProfile.name !== 'Tu nombre') ? myProfile.name : t('profile.defaultName');
  const moteRoleParts = [myProfile.mote, myProfile.rol].filter(Boolean);
  document.getElementById('profile-mote-role-display').textContent = moteRoleParts.length ? moteRoleParts.join(' · ') : t('profile.setUpRole');
  document.getElementById('profile-phone-display').textContent = myProfile.phone || '—';
  document.getElementById('profile-birthdate-display').textContent = myProfile.birthdate ? formatFullDate(myProfile.birthdate) : '—';
  document.getElementById('profile-comision-display').textContent = myProfile.comision || '—';
  document.getElementById('profile-rango-display').textContent = myProfile.rango || '—';
  document.getElementById('profile-posicion-display').textContent = posicionLabel(myProfile.posicion);
  // Comisión, Rango y Posición son datos propios de jugadoras (a Capitana se la
  // trata como jugadora en toda la app, ver effectiveRoleForPermissions): si el rol
  // es otro (entrenador/a, delegado/a, directiva...) esas filas no se muestran.
  const esJugadoraPropia = effectiveRoleForPermissions(myProfile.rol) === 'jugadora';
  document.getElementById('profile-comision-row').style.display = esJugadoraPropia ? '' : 'none';
  document.getElementById('profile-rango-row').style.display = esJugadoraPropia ? '' : 'none';
  document.getElementById('profile-posicion-row').style.display = esJugadoraPropia ? '' : 'none';
  document.getElementById('profile-rol-display').textContent = myProfile.rol || '—';
  document.getElementById('profile-licencia-display').textContent = myProfile.licencia || '—';
  document.getElementById('profile-licencia-hero-display').textContent = myProfile.licencia ? t('profile.licenseHero', { num: myProfile.licencia }) : '';

  // Partidos jugados: se calcula aparte, cruzando las actas guardadas por nombre o
  // licencia (ver loadProfileMatchesPlayedStat), porque necesita consultar Supabase.
  loadProfileMatchesPlayedStat();

  // % de asistencia a entrenos: entrenos ya realizados hasta hoy (pasados), sobre
  // cuántos de ellos marcaste "Asistiré"
  const todayIso = todayLocalIso();
  const pastTrainings = attEvents.filter(ev =>
    attEventType(ev) === 'training' && attEventIso(ev) <= todayIso
  );
  const attendedTrainings = pastTrainings.filter(ev => ev.attendance && ev.attendance[currentUserId] === 'yes').length;
  const attendancePct = pastTrainings.length
    ? Math.round((attendedTrainings / pastTrainings.length) * 100) + '%'
    : '—';
  document.getElementById('pf-stat-attendance').textContent = attendancePct;
}

// Partidos jugados: en vez de basarse en tus "Asistiré" de Asistencia (que no
// reflejan si de verdad saliste a jugar), se cuentan las actas de partido guardadas
// en las que apareces — cruzando cada fila de match_report_players por tu número de
// licencia o, si no coincide, por tu nombre (normalizado, sin tildes/mayúsculas).
// Si apareces en 3 actas distintas, son 3 partidos jugados.
async function loadProfileMatchesPlayedStat(){
  const el = document.getElementById('pf-stat-matches');
  if(!el) return;

  const { data, error } = await supabaseClient
    .from('match_report_players')
    .select('match_id, license_number, player_name')
    .eq('is_own_team', true);

  if(error){
    console.error('No se han podido cargar los partidos jugados', error);
    el.textContent = '—';
    return;
  }

  const myLicense = (myProfile.licencia || '').toString().trim();
  const myName = normalizeRosterName(myProfile.name);

  const matchIds = new Set();
  (data || []).forEach(row => {
    const rowLicense = (row.license_number || '').toString().trim();
    const isMe =
      (myLicense && rowLicense && rowLicense === myLicense) ||
      (myName && normalizeRosterName(row.player_name) === myName);
    if(isMe) matchIds.add(row.match_id);
  });

  el.textContent = matchIds.size;
}

// Si "targetId" tiene valor, es la cuenta admin editando el perfil de otra jugadora
// (viene del botón "Editar" de Jugadoras); si no, cada persona edita el suyo propio.
let profileEditTargetId = null;

function openEditProfileModal(targetId){
  profileEditTargetId = targetId || null;
  const source = profileEditTargetId ? plantillaData.find(p => p.id === profileEditTargetId) : null;

  const nameVal = source
    ? [source.nombre, source.apellido].filter(Boolean).join(' ')
    : ((myProfile.name && myProfile.name !== 'Tu nombre') ? myProfile.name : '');
  document.getElementById('profile-name-input').value = nameVal;
  document.getElementById('profile-mote-input').value = source ? (source.mote || '') : (myProfile.mote ?? '');
  document.getElementById('profile-phone-input').value = source ? (source.telefono || '') : (myProfile.phone ?? '');
  document.getElementById('profile-birthdate-input').value = source ? (source.fecha_nacimiento || '') : (myProfile.birthdate ?? '');
  document.getElementById('profile-comision-input').value = source ? (source.comision || '') : (myProfile.comision ?? '');
  document.getElementById('profile-rango-input').value = source ? (source.rango || '') : (myProfile.rango ?? '');
  document.getElementById('profile-posicion-input').value = source ? (source.posicion || '') : (myProfile.posicion ?? '');
  document.getElementById('profile-rol-input').value = source ? (source.rol || '') : (myProfile.rol ?? '');
  document.getElementById('profile-licencia-input').value = source ? (source.licencia || '') : (myProfile.licencia ?? '');

  // Comisión / Rango / Posición solo tienen sentido para jugadoras: se ocultan
  // por completo si el rol actual del formulario no lo es (igual que ya pasa
  // en la vista de "Mi perfil"), y se actualizan al vuelo si cambias el rol.
  toggleEditProfileJugadoraFields();

  const modalTitle = document.getElementById('edit-profile-modal-title');
  if(modalTitle) modalTitle.textContent = profileEditTargetId ? t('profile.editPlayerTitle') : t('profile.editTitle');

  document.getElementById('edit-profile-modal').classList.add('active');
}
function toggleEditProfileJugadoraFields(){
  const rol = document.getElementById('profile-rol-input').value;
  const esJugadora = effectiveRoleForPermissions(rol) === 'jugadora';
  document.getElementById('profile-comision-field').style.display = esJugadora ? '' : 'none';
  document.getElementById('profile-rango-field').style.display = esJugadora ? '' : 'none';
  document.getElementById('profile-posicion-field').style.display = esJugadora ? '' : 'none';
}
function onEditProfileRolChange(){
  toggleEditProfileJugadoraFields();
}
function closeEditProfileModal(){
  document.getElementById('edit-profile-modal').classList.remove('active');
  profileEditTargetId = null;
}
async function saveProfileEdits(){
  const name = document.getElementById('profile-name-input').value.trim();
  const mote = document.getElementById('profile-mote-input').value.trim();
  const phone = document.getElementById('profile-phone-input').value.trim();
  const birthdate = document.getElementById('profile-birthdate-input').value;
  const comision = document.getElementById('profile-comision-input').value;
  const rango = document.getElementById('profile-rango-input').value;
  const posicion = document.getElementById('profile-posicion-input').value;
  const rol = document.getElementById('profile-rol-input').value;
  const licencia = document.getElementById('profile-licencia-input').value.trim();

  // Si el rol final no es jugadora, estos campos van ocultos en el formulario:
  // se guardan vacíos aunque el <select> conserve un valor antiguo por debajo.
  const esJugadoraFinal = effectiveRoleForPermissions(rol) === 'jugadora';
  const comisionFinal = esJugadoraFinal ? comision : '';
  const rangoFinal = esJugadoraFinal ? rango : '';
  const posicionFinal = esJugadoraFinal ? posicion : '';

  const editingSelf = !profileEditTargetId;
  const targetId = profileEditTargetId || currentAuthUserId;

  if(editingSelf){
    myProfile.name = name || 'Tu nombre';
    myProfile.mote = mote;
    myProfile.phone = phone;
    myProfile.birthdate = birthdate;
    myProfile.comision = comisionFinal;
    myProfile.rango = rangoFinal;
    myProfile.posicion = posicionFinal;
    myProfile.rol = rol;
    myProfile.licencia = licencia;
    // El roster es lo que consultan otras secciones (como Comi Tesoreria y Jugadoras)
    // para saber quién está en cada comisión, así que lo mantenemos sincronizado con el perfil.
    rosterById['me'].name = myProfile.name;
    rosterById['me'].mote = myProfile.mote;
    rosterById['me'].comision = myProfile.comision;
    rosterById['me'].rango = myProfile.rango;
    rosterById['me'].posicion = myProfile.posicion;
    rosterById['me'].rol = myProfile.rol;
    rosterById['me'].licencia = myProfile.licencia;
    rosterById['me'].birthdate = myProfile.birthdate;
    renderProfile();
    // El rol y la comisión pueden cambiar qué botones ves en el resto de la app
    // (añadir evento, multa, álbum, subir rutina...): se refrescan todos aquí mismo,
    // sin esperar a la próxima vez que se inicie sesión.
    toggleAttAddButtonVisibility();
    toggleFineAddButtonVisibility();
    appBridge.sessionChanged();
    appBridge.tesoreria.permissionsChanged();
    appBridge.comiTercerTemps.permissionsChanged();
    appBridge.gym.refresh();
    if(typeof renderThirdTimeFood === 'function') renderThirdTimeFood();
  }

  // Guarda también los cambios en la tabla profiles de Supabase, para que no se
  // pierdan al recargar la página o al volver a consultar la Plantilla. Si es la
  // cuenta admin editando a otra jugadora, se guarda en la fila de esa jugadora
  // (lo permite la política de Supabase para is_admin, ver supabase_admin.sql).
  if(targetId){
    const nameParts = name.split(/\s+/).filter(Boolean);
    const nombre = nameParts[0] || '';
    const apellido = nameParts.slice(1).join(' ');

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        nombre,
        apellido,
        mote,
        telefono: phone || null,
        fecha_nacimiento: birthdate || null,
        comision: comisionFinal || null,
        rango: rangoFinal || null,
        posicion: posicionFinal || null,
        rol: rol || null,
        licencia: licencia || null
      })
      .eq('id', targetId);

    if(updateError){
      alert('El perfil se ha actualizado en la app, pero no se pudo guardar en Supabase: ' + updateError.message);
    }
  }

  loadPlantilla();
  closeEditProfileModal();
}

// Abre/cierra el menú "Editar foto / Eliminar foto" bajo el botón de la foto de perfil
function togglePfAvatarMenu(){
  document.getElementById('pf-avatar-menu').classList.toggle('open');
}
function chooseEditAvatarPhoto(){
  document.getElementById('pf-avatar-menu').classList.remove('open');
  document.getElementById('pf-avatar-input').click();
}
// Quita la foto de perfil: borra la referencia en "profiles" y vuelve a mostrar las iniciales.
// El archivo en sí se queda en el bucket de Storage (no hace falta borrarlo para esto).
// Refresca cualquier vista que ya esté pintando avatares del roster (aunque no
// esté abierta ahora mismo, sus funciones de render tienen sus propias guardas y
// no hacen nada si su pantalla no está en el DOM), para que la foto nueva (o su
// ausencia, tras borrarla) aparezca al momento en toda la app sin recargar.
function refreshAvatarEverywhere(){
  renderFinesTable();
  renderFinePlayerGrid();
  renderFineConfirmRequests();
  renderRollCallList();
  appBridge.gym.refresh();
  loadPlantilla();
  if(currentEventId) renderEventDetail();
}

async function removeAvatarPhoto(){
  document.getElementById('pf-avatar-menu').classList.remove('open');
  if(!myProfile.avatarUrl) return;
  if(!confirm('¿Eliminar tu foto de perfil?')) return;

  if(currentAuthUserId){
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', currentAuthUserId);

    if(updateError){
      alert('No se ha podido eliminar la foto: ' + updateError.message);
      return;
    }
  }

  myProfile.avatarUrl = '';
  rosterById['me'].avatarUrl = '';
  renderProfile();
  refreshAvatarEverywhere();
}
// Cierra el menú de la foto de perfil si se hace clic fuera de él
document.addEventListener('click', function(e){
  const wrap = document.querySelector('.pf-avatar-wrap');
  const menu = document.getElementById('pf-avatar-menu');
  if(wrap && menu && menu.classList.contains('open') && !wrap.contains(e.target)){
    menu.classList.remove('open');
  }
});

// Sube la foto elegida al bucket "avatars" de Supabase Storage y guarda su URL
// pública en la fila de "profiles" de la jugadora, para que se vea en Mi perfil
// y en la lista de Jugadoras.
async function handleAvatarUpload(event){
  const input = event.target;
  const file = input.files && input.files[0];
  input.value = '';
  if(!file) return;

  if(!file.type.startsWith('image/')){
    alert('Elige un archivo de imagen (JPG, PNG…).');
    return;
  }
  if(file.size > 15 * 1024 * 1024){
    alert('La imagen pesa demasiado. Elige una de menos de 15 MB.');
    return;
  }

  // Las fotos que salen directas de la cámara del móvil suelen pesar varios MB a
  // una resolución (3000-4000px de lado) muchísimo mayor que la que jamás se va a
  // mostrar: el avatar se ve siempre en un recuadro pequeño (unos 90px). Antes de
  // subirla se redimensiona aquí mismo, en el navegador, a un JPEG de como mucho
  // 800px de lado — en la práctica el archivo final pesa entre 10 y 40 veces menos
  // sin que se note ninguna diferencia visual, lo que ahorra tanto almacenamiento
  // en Supabase como el tráfico de red cada vez que alguien la vuelve a cargar.
  let blob;
  try{
    // maxDim reducido a 320px: el avatar más grande que se ve en toda la app es el de
    // Mi perfil (88×88px CSS); con 320px hay margen de sobra incluso en pantallas de
    // alta densidad (hasta ~3.6x), y el archivo pesa varias veces menos — esto es lo
    // que más peso mueve en el "Cached Egress" de Supabase, porque el avatar es la
    // única imagen que se sube a Storage y se descarga una y otra vez desde todos los
    // dispositivos del equipo.
    blob = await compressImageFile(file, 320, 0.82);
  }catch(e){
    console.error('No se ha podido comprimir la imagen', e);
    alert('No se ha podido procesar la imagen. Prueba con otra foto.');
    return;
  }
  if(!blob){
    alert('No se ha podido procesar la imagen. Prueba con otra foto.');
    return;
  }

  // Siempre se sube como .jpg (independientemente del formato original) para que
  // "Cambiar foto" y "Editar foto" guarden siempre en la misma ruta de Storage
  // (avatar.jpg) y no se vayan quedando archivos antiguos huérfanos en otro formato.
  await uploadAvatarBlob(blob, 'jpg');
}

// Redimensiona y comprime una imagen en el propio navegador usando un <canvas>,
// sin pasar por el servidor. maxDim limita el lado más largo (en píxeles); quality
// es la calidad JPEG (0-1). Devuelve un Blob listo para subir a Supabase Storage.
async function compressImageFile(file, maxDim, quality){
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se ha podido leer la imagen'));
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Sube un archivo o blob (usado tanto por "Cambiar foto" como, tras recortar, por
// "Editar foto") al bucket "avatars" de Supabase Storage y guarda su URL pública en
// la fila de "profiles" de la jugadora, para que se vea en Mi perfil y en la lista
// de Jugadoras. Devuelve true/false según si se ha podido completar.
async function uploadAvatarBlob(blob, extHint){
  if(!currentAuthUserId){
    alert('Inicia sesión para poder subir una foto de perfil.');
    return false;
  }

  const btn = document.querySelector('.pf-avatar-edit-btn');
  if(btn) btn.disabled = true;

  const ext = (extHint || 'jpg').toLowerCase();
  const path = `${currentAuthUserId}/avatar.${ext}`;

  // cacheControl a 1 año: es seguro porque cada subida cambia la URL pública (lleva
  // "?t=" con la fecha), así que el navegador nunca podría servir por error una foto
  // vieja aunque la cachee mucho tiempo. Esto evita que cada jugadora tenga que
  // volver a descargar la misma foto de sus compañeras cada vez que abre la lista
  // de Jugadoras o Asistencia, mientras esa foto no cambie.
  const { error: uploadError } = await supabaseClient.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, cacheControl: '31536000' });

  if(uploadError){
    alert('No se ha podido subir la foto: ' + uploadError.message);
    if(btn) btn.disabled = false;
    return false;
  }

  const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(path);
  // Parámetro añadido solo para evitar que el navegador muestre una versión en caché desactualizada
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  const { error: updateError } = await supabaseClient
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', currentAuthUserId);

  if(btn) btn.disabled = false;

  if(updateError){
    alert('La foto se subió, pero no se pudo guardar en tu perfil: ' + updateError.message);
    return false;
  }

  myProfile.avatarUrl = publicUrl;
  rosterById['me'].avatarUrl = publicUrl;
  renderProfile();
  refreshAvatarEverywhere();
  return true;
}

// ---- Ajustar/recortar la foto de perfil ya subida ----
// Deja arrastrar y hacer zoom sobre la foto actual dentro de un recuadro cuadrado
// (mismo aspecto que el avatar), y al guardar recorta ese encuadre a un cuadrado
// real con <canvas> y lo sube como la nueva foto de perfil.
let avatarAdjustState = null; // {naturalW, naturalH, baseScale, scale, x, y, dragging, startX, startY, startPX, startPY}
const AVATAR_ADJUST_FRAME = 240; // debe coincidir con el width/height en px del #avatar-adjust-frame

function openAvatarAdjustModal(){
  document.getElementById('pf-avatar-menu').classList.remove('open');
  if(!myProfile.avatarUrl){
    alert(t('profile.adjustPhotoNoPhoto'));
    return;
  }
  const img = document.getElementById('avatar-adjust-img');
  avatarAdjustState = null;
  document.getElementById('avatar-adjust-zoom').value = 100;
  img.onload = function(){
    const naturalW = img.naturalWidth, naturalH = img.naturalHeight;
    // Escala mínima para que la imagen cubra siempre todo el recuadro cuadrado
    const baseScale = AVATAR_ADJUST_FRAME / Math.min(naturalW, naturalH);
    avatarAdjustState = {
      naturalW, naturalH, baseScale, scale: 1,
      x: (AVATAR_ADJUST_FRAME - naturalW * baseScale) / 2,
      y: (AVATAR_ADJUST_FRAME - naturalH * baseScale) / 2,
    };
    renderAvatarAdjustTransform();
  };
  img.src = myProfile.avatarUrl;
  document.getElementById('avatar-adjust-modal').classList.add('active');
}

function closeAvatarAdjustModal(){
  document.getElementById('avatar-adjust-modal').classList.remove('active');
}

function renderAvatarAdjustTransform(){
  if(!avatarAdjustState) return;
  const s = avatarAdjustState;
  const totalScale = s.baseScale * s.scale;
  const w = s.naturalW * totalScale, h = s.naturalH * totalScale;
  // No dejar que se separen bordes del recuadro al arrastrar
  const minX = Math.min(0, AVATAR_ADJUST_FRAME - w), maxX = 0;
  const minY = Math.min(0, AVATAR_ADJUST_FRAME - h), maxY = 0;
  s.x = Math.max(minX, Math.min(maxX, s.x));
  s.y = Math.max(minY, Math.min(maxY, s.y));
  const img = document.getElementById('avatar-adjust-img');
  img.style.width = w + 'px';
  img.style.height = h + 'px';
  img.style.transform = `translate(${s.x}px, ${s.y}px)`;
}

document.getElementById('avatar-adjust-zoom').addEventListener('input', function(e){
  if(!avatarAdjustState) return;
  avatarAdjustState.scale = Number(e.target.value) / 100;
  renderAvatarAdjustTransform();
});

(function setupAvatarAdjustDrag(){
  const frame = document.getElementById('avatar-adjust-frame');
  let dragging = false, startPointerX = 0, startPointerY = 0, startX = 0, startY = 0;

  function pointerDown(clientX, clientY){
    if(!avatarAdjustState) return;
    dragging = true;
    startPointerX = clientX; startPointerY = clientY;
    startX = avatarAdjustState.x; startY = avatarAdjustState.y;
    frame.style.cursor = 'grabbing';
  }
  function pointerMove(clientX, clientY){
    if(!dragging || !avatarAdjustState) return;
    avatarAdjustState.x = startX + (clientX - startPointerX);
    avatarAdjustState.y = startY + (clientY - startPointerY);
    renderAvatarAdjustTransform();
  }
  function pointerUp(){
    dragging = false;
    frame.style.cursor = 'grab';
  }

  frame.addEventListener('mousedown', e => { pointerDown(e.clientX, e.clientY); e.preventDefault(); });
  window.addEventListener('mousemove', e => pointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', pointerUp);

  frame.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    pointerDown(touch.clientX, touch.clientY);
  }, { passive:true });
  frame.addEventListener('touchmove', e => {
    const touch = e.touches[0];
    pointerMove(touch.clientX, touch.clientY);
    e.preventDefault();
  }, { passive:false });
  frame.addEventListener('touchend', pointerUp);
})();

async function saveAvatarAdjust(){
  if(!avatarAdjustState) return;
  const s = avatarAdjustState;
  const totalScale = s.baseScale * s.scale;

  // Recorta, a resolución nativa de la imagen, exactamente la porción que se ve
  // dentro del recuadro cuadrado de la vista previa.
  const cropSize = AVATAR_ADJUST_FRAME / totalScale;
  const srcX = -s.x / totalScale;
  const srcY = -s.y / totalScale;

  const img = document.getElementById('avatar-adjust-img');
  // Igual que en "Cambiar foto": 320px es de sobra para el avatar más grande que se
  // ve en la app (88×88px CSS en Mi perfil), y reduce mucho el peso que se descarga
  // desde Supabase Storage cada vez que alguien ve una foto (el "Cached Egress").
  const OUTPUT_SIZE = 320;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, srcX, srcY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if(!blob){
    alert('No se ha podido procesar la imagen.');
    return;
  }
  const ok = await uploadAvatarBlob(blob, 'jpg');
  if(ok) closeAvatarAdjustModal();
}
