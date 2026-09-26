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

// ---- Permisos del botón "Añadir evento" en Asistencia ----
// Entrenador/a, delegado/a, junta directiva y Capitana pueden crear/editar/borrar
// eventos (a Capitana se le da aparte, porque jugadora normal no tiene este permiso:
// ver el comentario sobre effectiveRoleForPermissions más arriba).
const rolesWithEventManagement = ['entrenador/a', 'delegado/a', 'directiva', 'Capitana'];
function canManageEvents(){
  // Ojo: aquí NO se pasa por effectiveRoleForPermissions, porque este es justo un
  // permiso donde Capitana y jugadora se diferencian (jugadora normal no lo tiene).
  return isAdmin || rolesWithEventManagement.includes(myProfile.rol);
}
function toggleAttAddButtonVisibility(){
  const btn = document.getElementById('att-add-event-btn');
  if(btn) btn.style.display = canManageEvents() ? '' : 'none';
}

// Los permisos de Multas (canManageFines y el modo edición de la tabla), Comi
// Tesoreria y Comi Tercer Temps (canManageClubTreasury, canManageTercerTemps) viven
// ahora en Svelte: src/features/multas/, src/features/tesoreria/ y
// src/features/comi-tercer-temps/.

let currentEventId = null;
let currentAttTab = 'yes';
let commentModalCtx = null; // { eventId, playerId } mientras el modal está abierto
let pendingNewEventType = null; // 'training' | 'match' | 'meeting' — preconfiguración activa del modal "Añadir evento"
let editingEventId = null; // id del evento que se está editando (null = el modal está en modo "crear")
