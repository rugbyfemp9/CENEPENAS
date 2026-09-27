// Visibilidad por rol de las páginas/tarjetas que no ven todos. Los permisos en sí
// (effectiveRoleForPermissions, canViewWellnessStaff, STAFF_*...) viven ahora en
// src/lib/permissions.js; aquí solo queda lo que toca el DOM del menú/Vestuario/Inicio.

// Muestra/oculta tanto la tarjeta de Vestuario (móvil) como el botón directo del
// sidebar (escritorio); se llama justo después de conocer el rol real, en
// onAuthenticated(), igual que el resto de toggles de visibilidad por rol.
function toggleWellnessStaffCardVisibility(){
  const allowed = appBridge.core.canViewWellnessStaff();
  const card = document.getElementById('vest-card-wellness-staff');
  if(card) card.style.display = allowed ? '' : 'none';
  const sidebarBtn = document.getElementById('sidebar-wellness-staff');
  if(sidebarBtn) sidebarBtn.style.display = allowed ? '' : 'none';
}

// Se llama justo después de conocer el rol real, en onAuthenticated(), igual que el
// resto de toggles de visibilidad por rol.
function toggleStaffOnlyPagesVisibility(){
  const hideForStaff = appBridge.core.canViewWellnessStaff();
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
