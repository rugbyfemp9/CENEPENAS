// Acceso al código antiguo (js/), que sigue cargándose con <script> clásicos.
//
// Sus `let`/`const`/`function` de primer nivel viven en el ámbito global, así que
// desde aquí se pueden leer por su nombre. Todo acceso desde Svelte pasa por este
// archivo para que quede a la vista qué depende todavía del código antiguo: cuando
// una pieza se migra, sale de aquí. Al final de la migración este archivo desaparece.

/* global supabaseClient, isAdmin, rosterById, currentUserId, currentAuthUserId, myProfile,
   currentLang, t, readCache, writeCache, setSection, displayName, initials,
   monthAbbrLabel, autoMonthAbbr */

export const legacy = {
  get supabase() { return supabaseClient; },
  get isAdmin() { return isAdmin; },
  get authUserId() { return currentAuthUserId; },
  // La propia cuenta vive en el roster bajo la clave especial 'me', no bajo su UUID.
  get me() { return rosterById[currentUserId]; },
  get myProfile() { return myProfile; },
  rosterEntry: (profileId) => (profileId === currentAuthUserId ? rosterById.me : rosterById[profileId]),
  displayName: (p) => displayName(p),
  initials: (name) => initials(name),
  monthAbbrLabel: (monthIndex) => monthAbbrLabel(autoMonthAbbr[monthIndex]),
  get storage() { return window.storage; },
  get lang() { return currentLang; },
  t: (key, vars) => t(key, vars),
  readCache: (key) => readCache(key),
  writeCache: (key, data) => writeCache(key, data),
  setSection: (id, opts) => setSection(id, opts),
};
