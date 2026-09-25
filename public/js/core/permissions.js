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

// Solo Comi Tesoreria puede dar de alta multas nuevas (el resto del equipo puede
// ver la lista, pagar las suyas y confirmar pagos recibidos con total normalidad).
function canManageFines(){
  const me = rosterById[currentUserId];
  return isAdmin || !!(me && me.comision === 'Comi Tesoreria');
}
function toggleFineAddButtonVisibility(){
  const btn = document.getElementById('add-fine-btn');
  if(btn) btn.style.display = canManageFines() ? '' : 'none';
  const editBtn = document.getElementById('edit-fines-toggle-btn');
  if(editBtn) editBtn.style.display = canManageFines() ? '' : 'none';
  // Si deja de tener permiso mientras el modo edición estaba activo, se desactiva.
  if(!canManageFines() && finesEditMode){
    finesEditMode = false;
    if(editBtn) editBtn.classList.remove('active');
    renderFinesTable();
  }
}

// Solo Comi Tesoreria puede añadir/editar/borrar movimientos de la tesorería del
// club ("Comi Tesoreria"); el resto del equipo puede consultar el saldo y la tabla
// con total normalidad (la escritura real también la bloquea la política RLS de
// "treasury_entries" en Supabase).
function canManageClubTreasury(){
  const me = rosterById[currentUserId];
  return isAdmin || !!(me && me.comision === 'Comi Tesoreria');
}
function toggleClubTreasuryButtonsVisibility(){
  const addBtn = document.getElementById('treasury-add-btn');
  const editBtn2 = document.getElementById('treasury-edit-btn');
  const canManage = canManageClubTreasury();
  if(addBtn) addBtn.style.display = canManage ? '' : 'none';
  if(editBtn2) editBtn2.style.display = canManage ? '' : 'none';
  if(!canManage && treasuryEditMode){
    treasuryEditMode = false;
    renderTreasury();
  }
}

// Solo Comi Tercer Temps puede añadir/marcar/borrar cosas de la lista de la compra y
// de su saldo ("Comi Tercer Temps"); el resto del equipo puede consultar todo con
// total normalidad (la escritura real también la bloquea la política RLS de
// "tercer_shopping_items" y "tercer_treasury_entries" en Supabase).
function canManageTercerTemps(){
  const me = rosterById[currentUserId];
  return isAdmin || !!(me && me.comision === 'Comi Tercer Temps');
}
function toggleTercerTempsButtonsVisibility(){
  const addRow = document.getElementById('tercer-shopping-add-row');
  const treasuryAddBtn = document.getElementById('tercer-treasury-add-btn');
  const treasuryEditBtn = document.getElementById('tercer-treasury-edit-btn');
  const canManage = canManageTercerTemps();
  if(addRow) addRow.style.display = canManage ? '' : 'none';
  if(treasuryAddBtn) treasuryAddBtn.style.display = canManage ? '' : 'none';
  if(treasuryEditBtn) treasuryEditBtn.style.display = canManage ? '' : 'none';
  if(!canManage && tercerTreasuryEditMode){
    tercerTreasuryEditMode = false;
    renderTercerTreasury();
  }
  renderTercerShoppingList();
}

// Modo edición de la tabla de multas: mientras está activo, un clic en una multa
// abre el panel de editar/eliminar en vez de marcarla como pagada.
let finesEditMode = false;
function toggleFinesEditMode(){
  if(!canManageFines()) return;
  finesEditMode = !finesEditMode;
  document.getElementById('edit-fines-toggle-btn').classList.toggle('active', finesEditMode);
  renderFinesTable();
}

let currentEventId = null;
let currentAttTab = 'yes';
let commentModalCtx = null; // { eventId, playerId } mientras el modal está abierto
let pendingNewEventType = null; // 'training' | 'match' | 'meeting' — preconfiguración activa del modal "Añadir evento"
let editingEventId = null; // id del evento que se está editando (null = el modal está en modo "crear")
