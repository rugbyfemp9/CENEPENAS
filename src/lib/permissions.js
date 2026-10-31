// Quién puede ver y hacer qué. Todas las reglas de permisos de la app viven aquí;
// las páginas solo llaman a estas funciones.
//
// Tres cosas del perfil deciden los permisos (valores en src/lib/roles.js):
//   - el rol: jugadora, Capitana, admin, entrenador/a, delegado/a, directiva, fisio
//   - si es admin (rol 'admin'): una jugadora que además puede gestionarlo todo
//   - la comisión: cada comisión gestiona su propia página
//
//   Qué                                            Quién
//   ---------------------------------------------  ---------------------------------------
//   Editar el perfil de otras, Jugadas             admin
//   Panel de Wellness/RPE del equipo               Cos Tècnic + admin
//   Valorar el RPE, Tercer temps, Comisiones,      jugadoras (Capitana y admin incluidas);
//     Tricount                                       ocultas al Cos Tècnic
//   Crear/editar eventos, subir actas              entrenador/a, delegado/a, directiva,
//                                                    Capitana + admin
//   Ejercicios generales de Gym                    entrenador/a + admin
//   Subir la rutina de Gym                         todos menos fisio (y sin rol)
//   Multas, Comi Tesoreria                         Comi Tesoreria + admin
//   Comi Tercer Temps, comida del Tercer tiempo    Comi Tercer Temps + admin
//   Galería                                        Comi Xarxes + admin
//
// Todo lee `session` (src/lib/session.svelte.js), que es reactivo: en una plantilla,
// $derived(canX()) se actualiza solo cuando cambia el rol o la comisión.
//
// Esto solo decide qué se ve en la app; lo que se puede escribir de verdad lo
// bloquean las políticas RLS de Supabase (que llaman a public.is_admin()).
import { session } from './session.svelte.js';
import { ROLES, PLAYER_ROLES, STAFF_ROLES, COMISIONES } from './roles.js';

// ---- Roles ----

// Juega (jugadora, Capitana o admin). Sirve para cualquier perfil, no solo el propio.
export function isPlayerRole(rol) {
  return PLAYER_ROLES.includes(rol);
}

export function isPlayer() {
  return isPlayerRole(session.rol);
}

// Cos Tècnic: entrenador/a, delegado/a, directiva o fisio.
export function isCosTecnic() {
  return STAFF_ROLES.includes(session.rol);
}

function inComision(comision) {
  return session.isAdmin || session.comision === comision;
}

// ---- Wellness / RPE ----

// Valorar el propio RPE de entreno/partido: solo quien juega.
export function canUseWellness() {
  return isPlayer();
}

// Panel de análisis del equipo. Las admins también lo ven, aunque sean jugadoras.
export function canViewWellnessStaff() {
  return session.isAdmin || isCosTecnic();
}

// ---- Páginas de las jugadoras ----

// "Tercer tiempo", "Comisiones" y "Tricount" son cosas del día a día de las jugadoras
// (organizar la comida de después del partido, apuntarse a una comisión, repartir
// gastos compartidos): el Cos Tècnic no las necesita y no debe verlas ni en el
// sidebar, ni en el hub de Vestuario, ni en sus banners de Inicio. setSection()
// también usa estos IDs para redirigir si alguien del Cos Tècnic entra a mano.
export const STAFF_HIDDEN_SECTIONS = [
  'tercer', 'tercer-historial', 'tercer-detalle',
  'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps', 'comi-tesoreria', 'comi-gira',
  'tricount'
];

// ---- Asistencia: eventos y actas ----

// Capitana sí y jugadora no: es de los pocos permisos que las distinguen.
const EVENT_MANAGER_ROLES = [ROLES.coach, ROLES.delegate, ROLES.board, ROLES.captain];

export function canManageEvents() {
  return session.isAdmin || EVENT_MANAGER_ROLES.includes(session.rol);
}

// El acta del partido la sube quien gestiona los eventos.
export function canEditMatchReport() {
  return canManageEvents();
}

// ---- Gym ----

// Ejercicios "generales": los ve todo el equipo y entran en el ránking. El resto
// puede añadir los suyos, pero quedan privados (ver gymAllExercises).
export function canManageGeneralExercises() {
  return session.isAdmin || session.rol === ROLES.coach;
}

// Subir el PDF de la rutina: jugadoras y cuerpo técnico, menos fisio.
const GYM_ROUTINE_STAFF_ROLES = [ROLES.coach, ROLES.delegate, ROLES.board];

export function canEditGymRoutine() {
  return session.isAdmin || isPlayer() || GYM_ROUTINE_STAFF_ROLES.includes(session.rol);
}

// ---- Comisiones ----

// Multas: dar de alta y editar (el resto del equipo puede ver la lista, pagar las
// suyas y confirmar pagos recibidos con total normalidad).
export function canManageFines() {
  return inComision(COMISIONES.tesoreria);
}

// Tesorería del club: añadir/editar/borrar movimientos (RLS de "treasury_entries").
export function canManageClubTreasury() {
  return inComision(COMISIONES.tesoreria);
}

// Comi Tercer Temps: lista de la compra y su saldo (RLS de "tercer_shopping_items" y
// "tercer_treasury_entries").
export function canManageTercerTemps() {
  return inComision(COMISIONES.tercerTemps);
}

// Tercer tiempo: marcar traído/no traído (✓/✕) en la comida de cada jugadora.
export function canManageThirdTimeFood() {
  return inComision(COMISIONES.tercerTemps);
}

// Galería: añadir álbumes.
export function canManageGallery() {
  return inComision(COMISIONES.xarxes);
}

// ---- Solo admin ----

// Jugadas: añadir, dibujar y borrar jugadas.
export function canManagePlays() {
  return session.isAdmin;
}

// Jugadoras: editar el perfil de cualquier otra persona.
export function canEditOtherProfiles() {
  return session.isAdmin;
}

// Dar o quitar el rol admin (además lo bloquea el trigger profiles_guard_admin_role).
export function canGiveAdminRole() {
  return session.isAdmin;
}
