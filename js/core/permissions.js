// ---- Rol "Capitana": siempre los mismos permisos que "jugadora" ----
// Capitana es una jugadora con galones extra, no un rol aparte con sus propios
// permisos desde cero. Por eso, cualquier comprobación de permisos que ya incluya
// 'jugadora' debe hacerse sobre effectiveRoleForPermissions(rol) en vez de sobre el
// rol tal cual: así, si en el futuro se le da un permiso nuevo a 'jugadora' (en
// cualquier array de roles), Capitana lo hereda automáticamente sin tener que tocar
// ese sitio también. Los permisos que sean EXCLUSIVOS de Capitana (más allá de los
// de jugadora) se comprueban aparte, comparando directamente contra rol === 'Capitana'.
function effectiveRoleForPermissions(rol){
  return rol === 'Capitana' ? 'jugadora' : rol;
}

// Los permisos de gestión de eventos (canManageEvents, el botón "Añadir evento" de
// Asistencia) viven ahora en Svelte: src/features/asistencia/events.js.
// Los permisos de Multas (canManageFines y el modo edición de la tabla), Comi
// Tesoreria y Comi Tercer Temps (canManageClubTreasury, canManageTercerTemps) viven
// ahora en Svelte: src/features/multas/, src/features/tesoreria/ y
// src/features/comi-tercer-temps/.

// ---- Wellness / RPE: quién ve qué ----
// El módulo de Wellness (modal de valoración, banner de Inicio y panel de Cos Tècnic)
// vive ahora en Svelte (src/features/wellness/), pero estos permisos también los usan
// la navegación (setSection), el inicio de sesión (auth.js) y Asistencia/Eventos.
// Solo el rol jugadora (Capitana incluida, ver effectiveRoleForPermissions) puede ver
// y usar este módulo — el resto de roles (entrenador/a, delegado/a, directiva...) no
// tienen relación con su propio RPE de entreno/partido.
function canUseWellness(){
  return effectiveRoleForPermissions(myProfile.rol) === 'jugadora';
}

// Cos Tècnic: roles de gestión con acceso al Panel de Análisis Wellness/RPE.
const STAFF_WELLNESS_ROLES = ['entrenador/a', 'delegado/a', 'directiva', 'fisio'];

function canViewWellnessStaff(){
  return isAdmin || STAFF_WELLNESS_ROLES.includes(effectiveRoleForPermissions(myProfile.rol));
}

// Muestra/oculta tanto la tarjeta de Vestuario (móvil) como el botón directo del
// sidebar (escritorio); se llama justo después de conocer el rol real, en
// onAuthenticated(), igual que el resto de toggles de visibilidad por rol.
function toggleWellnessStaffCardVisibility(){
  const allowed = canViewWellnessStaff();
  const card = document.getElementById('vest-card-wellness-staff');
  if(card) card.style.display = allowed ? '' : 'none';
  const sidebarBtn = document.getElementById('sidebar-wellness-staff');
  if(sidebarBtn) sidebarBtn.style.display = allowed ? '' : 'none';
}

// "Tercer tiempo", "Comisiones" y "Tricount" son cosas del día a día de las jugadoras
// (organizar la comida de después del partido, apuntarse a una comisión, repartir
// gastos compartidos): el Cos Tècnic (mismo criterio que Wellness/RPE, ver
// canViewWellnessStaff()) no las necesita y no debe verlas ni en el sidebar, ni en el
// hub de Vestuario, ni en sus banners de Inicio. Los IDs de sección de cada página se
// usan también en setSection() para redirigir si alguien del Cos Tècnic entra a mano.
const STAFF_HIDDEN_SECTIONS = [
  'tercer', 'tercer-historial', 'tercer-detalle',
  'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps', 'comi-tesoreria', 'comi-gira',
  'tricount'
];

// Se llama justo después de conocer el rol real, en onAuthenticated(), igual que el
// resto de toggles de visibilidad por rol.
function toggleStaffOnlyPagesVisibility(){
  const hideForStaff = canViewWellnessStaff();
  ['sidebar-tercer', 'sidebar-comisiones', 'sidebar-tricount'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.style.display = hideForStaff ? 'none' : '';
  });
  ['vest-card-tercer', 'vest-card-comisiones', 'vest-card-tricount'].forEach(id => {
    const card = document.getElementById(id);
    if(card) card.style.display = hideForStaff ? 'none' : '';
  });
  ['inicio-tercer-banner', 'inicio-tricount-banner'].forEach(id => {
    const banner = document.getElementById(id);
    if(banner) banner.style.display = hideForStaff ? 'none' : '';
  });
}
