// Visibilidad por rol de las páginas/tarjetas que no ven todos (antes
// js/core/permissions.js, que las mostraba/ocultaba tocando el DOM). Los permisos en
// sí (canViewWellnessStaff, STAFF_HIDDEN_SECTIONS...) viven en src/lib/permissions.js.
//
// Los dos valores solo cambian cuando se llama a su toggle, justo después de conocer
// el rol real al iniciar sesión (onAuthenticated, src/shell/auth.svelte.js); hasta
// entonces, el menú y el Vestuario se ven como antes de iniciar sesión.
import { canViewWellnessStaff } from '../lib/permissions.js';

export const visibility = $state({
  // Tarjeta de Vestuario (móvil) + botón directo del sidebar (escritorio) de
  // "Percepción del esfuerzo": ocultos hasta saber que se tiene permiso.
  wellnessStaff: false,
  // "Tercer tiempo", "Comisiones" y "Tricount" (sidebar, Vestuario y banners de
  // Inicio): se ocultan al Cos Tècnic.
  staffPagesHidden: false,
});

export function toggleWellnessStaffCardVisibility() {
  visibility.wellnessStaff = canViewWellnessStaff();
}

export function toggleStaffOnlyPagesVisibility() {
  visibility.staffPagesHidden = canViewWellnessStaff();
}
