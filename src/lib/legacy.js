// Acceso al código antiguo (js/), que sigue cargándose con <script> clásicos.
//
// Sus `let`/`const`/`function` de primer nivel viven en el ámbito global, así que
// desde aquí se pueden leer por su nombre. Todo acceso desde Svelte pasa por este
// archivo para que quede a la vista qué depende todavía del código antiguo: cuando
// una pieza se migra, sale de aquí. Al final de la migración este archivo desaparece.

/* global supabaseClient, isAdmin, roster, rosterById, currentUserId, currentAuthUserId, myProfile,
   currentLang, t, readCache, writeCache, setSection, displayName, initials, computeDisplayNames,
   monthAbbrLabel, autoMonthAbbr, monthFullLabel, withDePrefix, todayLocalIso,
   effectiveRoleForPermissions, toRemotePlayerId, SUPABASE_URL, formatShortDate, attEvents, attEventType,
   fines:writable, loadPlantilla, formatFullDate */

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
  monthAbbrLabel: (monthIndex) => monthAbbrLabel(autoMonthAbbr[monthIndex]),
  // Igual, pero a partir de la abreviatura en castellano que guardan los eventos (ev.month, p.ej. 'Sep').
  monthAbbrFromEs: (esAbbr) => monthAbbrLabel(esAbbr),
  monthFullLabel: (monthIndex) => monthFullLabel(monthIndex),
  withDePrefix: (word) => withDePrefix(word),
  todayIso: () => todayLocalIso(),
  // yyyy-mm-dd → dd/mm/aa
  formatShortDate: (iso) => formatShortDate(iso),
  // yyyy-mm-dd → dd/mm/aaaa
  formatFullDate: (iso) => formatFullDate(iso),
  get storage() { return window.storage; },
  // Entrenos/partidos de Asistencia (con sus respuestas en ev.attendance), que siguen
  // viviendo en el código antiguo (js/core/state.js) y no son reactivos.
  get attEvents() { return attEvents; },
  // Multas (js/core/state.js): también las leen y modifican la Lista de partidos, el
  // Tercer tiempo y Jugadoras, que siguen en el código antiguo. No son reactivas (ver
  // src/features/multas/multas.svelte.js).
  get fines() { return fines; },
  set fines(value) { fines = value; },
  // Recarga la Plantilla (tabla profiles) y el roster; lo que se pinta con él (tarjetas
  // de cada jugadora, que cuentan sus multas) se refresca solo.
  loadPlantilla: () => loadPlantilla(),
  attEventType: (ev) => attEventType(ev),
  get lang() { return currentLang; },
  t: (key, vars) => t(key, vars),
  readCache: (key) => readCache(key),
  writeCache: (key, data) => writeCache(key, data),
  setSection: (id, opts) => setSection(id, opts),
};
