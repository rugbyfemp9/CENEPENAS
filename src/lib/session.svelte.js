// Datos de la sesión que usan los componentes de Svelte (permisos, sobre todo).
// Los rellena el código antiguo al iniciar sesión y al editar el perfil, llamando a
// appBridge.sessionChanged().
import { legacy } from './legacy.js';

export const session = $state({ isAdmin: false, comision: '' });

export function refreshSession() {
  session.isAdmin = !!legacy.isAdmin;
  session.comision = legacy.me?.comision || '';
}
