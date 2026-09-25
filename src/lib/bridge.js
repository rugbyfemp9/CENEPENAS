// window.appBridge: lo que el código antiguo (js/) puede llamar de la parte
// ya migrada a Svelte. Cada sección migrada añade aquí sus funciones; cuando ya no
// quede código antiguo, este archivo desaparece.
import { refreshSession } from './session.svelte.js';

export const appBridge = {
  // Tras iniciar sesión o editar el perfil (cambian el rol, la comisión, is_admin...)
  sessionChanged: refreshSession,
};

window.appBridge = appBridge;
