// Acceso al código antiguo (js/), que sigue cargándose con <script> clásicos.
//
// Sus `let`/`const`/`function` de primer nivel viven en el ámbito global, así que
// desde aquí se pueden leer por su nombre. Todo acceso desde Svelte pasa por este
// archivo para que quede a la vista qué depende todavía del código antiguo: cuando
// una pieza se migra, sale de aquí. Al final de la migración este archivo desaparece.

/* global supabaseClient, isAdmin, roster, rosterById, currentUserId, currentAuthUserId, myProfile,
   currentLang, t, readCache, writeCache, setSection, displayName, initials, computeDisplayNames,
   effectiveRoleForPermissions, toRemotePlayerId, SUPABASE_URL, handleLogout,
   canUseWellness, canViewWellnessStaff */

export const legacy = {
  get supabase() { return supabaseClient; },
  // Para llamar a las funciones Edge (p.ej. process-gym-routine-pdf) con fetch.
  get supabaseUrl() { return SUPABASE_URL; },
  get isAdmin() { return isAdmin; },
  get authUserId() { return currentAuthUserId; },
  // La propia cuenta vive en el roster bajo la clave especial 'me', no bajo su UUID.
  get me() { return rosterById[currentUserId]; },
  get currentUserId() { return currentUserId; },
  get myProfile() { return myProfile; },
  get roster() { return roster; },
  get rosterById() { return rosterById; },
  rosterEntry: (profileId) => (profileId === currentAuthUserId ? rosterById.me : rosterById[profileId]),
  displayName: (p) => displayName(p),
  computeDisplayNames: (players) => computeDisplayNames(players),
  initials: (name) => initials(name),
  effectiveRole: (rol) => effectiveRoleForPermissions(rol),
  // 'me' → id real de auth.users, para escribir en Supabase (vive en js/core/auth.js).
  toRemotePlayerId: (localId) => toRemotePlayerId(localId),
  get storage() { return window.storage; },
  // Cerrar sesión (js/core/auth.js).
  logout: () => handleLogout(),
  // Permisos de Wellness/RPE (js/core/permissions.js): los usan también la navegación
  // y el inicio de sesión.
  canUseWellness: () => canUseWellness(),
  canViewWellnessStaff: () => canViewWellnessStaff(),
  get lang() { return currentLang; },
  t: (key, vars) => t(key, vars),
  readCache: (key) => readCache(key),
  writeCache: (key, data) => writeCache(key, data),
  setSection: (id, opts) => setSection(id, opts),
};
