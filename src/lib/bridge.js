// window.appBridge: lo que el código antiguo (js/) puede llamar de la parte
// ya migrada a Svelte. Cada sección migrada añade aquí sus funciones; cuando ya no
// quede código antiguo, este archivo desaparece.
import { refreshSession, auth, setAuthUserId, setIsAdmin } from './session.svelte.js';
import { supabase } from './supabase.js';
import { myProfile, rosterById } from './roster.js';
import { applyI18n } from './i18n.svelte.js';
import { effectiveRoleForPermissions, canViewWellnessStaff, STAFF_HIDDEN_SECTIONS } from './permissions.js';

export const appBridge = {
  // Tras iniciar sesión o editar el perfil (cambian el rol, la comisión, is_admin...)
  sessionChanged: refreshSession,
  // El núcleo compartido (src/lib/) que usa todavía el armazón antiguo: inicio de
  // sesión y registro (js/core/auth.js), navegación (js/core/navigation.js),
  // visibilidad por rol (js/core/permissions.js), arranque (js/main.js) y push.
  core: {
    supabase,
    myProfile,
    rosterById,
    get authUserId() { return auth.userId; },
    setAuthUserId,
    setIsAdmin,
    applyI18n,
    effectiveRoleForPermissions,
    canViewWellnessStaff,
    STAFF_HIDDEN_SECTIONS,
  },
};

window.appBridge = appBridge;
