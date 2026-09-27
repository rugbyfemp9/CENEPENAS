import { myProfile } from './roster.js';
import { auth } from './session.svelte.js';

// ---- Rol "Capitana": siempre los mismos permisos que "jugadora" ----
// Capitana es una jugadora con galones extra, no un rol aparte con sus propios
// permisos desde cero. Por eso, cualquier comprobación de permisos que ya incluya
// 'jugadora' debe hacerse sobre effectiveRoleForPermissions(rol) en vez de sobre el
// rol tal cual: así, si en el futuro se le da un permiso nuevo a 'jugadora' (en
// cualquier array de roles), Capitana lo hereda automáticamente sin tener que tocar
// ese sitio también. Los permisos que sean EXCLUSIVOS de Capitana (más allá de los
// de jugadora) se comprueban aparte, comparando directamente contra rol === 'Capitana'.
export function effectiveRoleForPermissions(rol){
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
// la navegación (setSection, js/core/navigation.js), el inicio de sesión (js/core/auth.js)
// y Asistencia/Eventos.
// Solo el rol jugadora (Capitana incluida, ver effectiveRoleForPermissions) puede ver
// y usar este módulo — el resto de roles (entrenador/a, delegado/a, directiva...) no
// tienen relación con su propio RPE de entreno/partido.
export function canUseWellness(){
  return effectiveRoleForPermissions(myProfile.rol) === 'jugadora';
}

// Cos Tècnic: roles de gestión con acceso al Panel de Análisis Wellness/RPE.
export const STAFF_WELLNESS_ROLES = ['entrenador/a', 'delegado/a', 'directiva', 'fisio'];

export function canViewWellnessStaff(){
  return auth.isAdmin || STAFF_WELLNESS_ROLES.includes(effectiveRoleForPermissions(myProfile.rol));
}

// "Tercer tiempo", "Comisiones" y "Tricount" son cosas del día a día de las jugadoras
// (organizar la comida de después del partido, apuntarse a una comisión, repartir
// gastos compartidos): el Cos Tècnic (mismo criterio que Wellness/RPE, ver
// canViewWellnessStaff()) no las necesita y no debe verlas ni en el sidebar, ni en el
// hub de Vestuario, ni en sus banners de Inicio. Los IDs de sección de cada página se
// usan también en setSection() para redirigir si alguien del Cos Tècnic entra a mano.
export const STAFF_HIDDEN_SECTIONS = [
  'tercer', 'tercer-historial', 'tercer-detalle',
  'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps', 'comi-tesoreria', 'comi-gira',
  'tricount'
];
