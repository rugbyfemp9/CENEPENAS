// Perfil propio y plantilla (roster), compartidos por toda la app.
//
// No son reactivos (igual que cuando vivían en js/core/state.js): quien los cambia
// (inicio de sesión, edición del perfil, carga de Jugadoras...) avisa luego a las
// secciones que los pintan. Son siempre los mismos objetos: se modifican, nunca se
// reasignan.

// ---- Mi perfil ----
// Lo rellena el inicio de sesión (src/shell/auth.svelte.js) y
// la edición del perfil (src/features/perfil).
export const myProfile = { name:'Tu nombre', mote:'', phone:'', comision:'', rango:'', posicion:'', rol:'', licencia:'', birthdate:'', avatarUrl:'' };

// Plantilla usada para repartir a los jugadores en las 3 pestañas de cada evento
export const roster = [
  { id:'me', name:'Tú', pos:'', comision:'', rango:'', rol:'', birthdate:'', mote:'', injured:false, injuryIcon:'', rm:{} }
];
export const rosterById = Object.fromEntries(roster.map(p => [p.id, p]));

// Usuario que ha iniciado sesión: la propia cuenta vive en el roster bajo la clave
// especial 'me', no bajo su UUID.
export const currentUserId = 'me';

// La fila del roster de la propia cuenta.
export function myRosterEntry() {
  return rosterById[currentUserId];
}
