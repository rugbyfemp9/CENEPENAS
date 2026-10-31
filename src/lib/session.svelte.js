// Sesión: quién ha iniciado sesión y con qué rol.
//
// `auth.userId` es el id real de Supabase de quien ha iniciado sesión (no reactivo,
// lo rellena el inicio de sesión, src/shell/auth.svelte.js, con setAuthUserId()).
//
// `session` es la única fuente del rol, la comisión y si es admin, y es reactiva:
// la leen todas las reglas de src/lib/permissions.js. Se refresca al iniciar sesión
// y al editar el perfil propio, llamando a refreshSession() ANTES de repintar nada
// que dependa de los permisos.
import { rosterById, myRosterEntry, myProfile } from './roster.js';
import { ROLES } from './roles.js';

export const auth = {
  // Id real de Supabase de la persona que ha iniciado sesión (para saber qué fila
  // de la lista de Jugadoras es "yo" y mostrarle ahí sus propias tarjetas/lesión).
  userId: null,
};

export function setAuthUserId(id) { auth.userId = id; }

export function toRemotePlayerId(localId) {
  // Para escribir en Supabase hace falta el id real de auth.users; 'me' se traduce
  // al id de quien ha iniciado sesión.
  return localId === 'me' ? auth.userId : localId;
}

// Fila del roster de un perfil de Supabase (la propia cuenta está bajo 'me').
export function rosterEntry(profileId) {
  return profileId === auth.userId ? rosterById.me : rosterById[profileId];
}

export const session = $state({ rol: '', isAdmin: false, comision: '' });

export function refreshSession() {
  session.rol = myProfile.rol || '';
  // Admin es un rol (rol 'admin'), no una marca aparte: una jugadora que además
  // puede gestionarlo todo.
  session.isAdmin = session.rol === ROLES.admin;
  session.comision = myRosterEntry()?.comision || '';
}
