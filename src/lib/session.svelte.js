// Sesión: quién ha iniciado sesión y si es la cuenta de administración.
//
// `auth` es la fuente única (no reactiva, como las antiguas variables globales
// currentAuthUserId / isAdmin de js/core/auth.js). La rellena el inicio de sesión
// (src/shell/auth.svelte.js) con setAuthUserId(); isAdmin sale del rol del perfil.
//
// `session` es la copia reactiva que usan las plantillas de Svelte (permisos, sobre
// todo). Se refresca al iniciar sesión y al editar el perfil, llamando a
// refreshSession().
import { rosterById, myRosterEntry, myProfile } from './roster.js';

// Rol de las cuentas de administración. Solo se asigna desde Supabase (o lo da otra
// admin desde Jugadoras): nadie puede dárselo a sí misma.
export const ADMIN_ROLE = 'admin';

export const auth = {
  // Id real de Supabase de la persona que ha iniciado sesión (para saber qué fila
  // de la lista de Jugadoras es "yo" y mostrarle ahí sus propias tarjetas/lesión).
  userId: null,
  // Las cuentas con rol "admin" pueden editar todo, incluida la información de
  // cualquier jugadora registrada.
  get isAdmin() { return myProfile.rol === ADMIN_ROLE; },
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

export const session = $state({ isAdmin: false, comision: '' });

export function refreshSession() {
  session.isAdmin = !!auth.isAdmin;
  session.comision = myRosterEntry()?.comision || '';
}
