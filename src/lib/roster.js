// Perfil propio y plantilla (roster), compartidos por toda la app.
//
// No son reactivos (igual que cuando vivían en js/core/state.js): quien los cambia
// (inicio de sesión, edición del perfil, carga de Jugadoras...) avisa luego a las
// secciones que los pintan. Son siempre los mismos objetos: se modifican, nunca se
// reasignan.

import { COMISION_OPTIONS } from './roles.js';

// ---- Comisiones de cada persona ----
// Una persona puede estar en varias comisiones: cada una es una fila de la tabla
// "commission_memberships" (profile_id, commission). Se piden junto con el perfil:
export const PROFILE_SELECT = '*, commission_memberships(commission)';

// Lista de comisiones de una fila de "profiles" pedida con PROFILE_SELECT, siempre en
// el orden de COMISION_OPTIONS (así se pintan igual en todas partes).
export function comisionesOf(profileRow) {
  const mine = (profileRow?.commission_memberships || []).map((m) => m.commission);
  return COMISION_OPTIONS.filter((c) => mine.includes(c));
}

// "Comi Xarxes, Comi Gira" (o '' si no está en ninguna).
export function comisionesLabel(comisiones) {
  return (comisiones || []).join(', ');
}

// ---- Mi perfil ----
// Lo rellena el inicio de sesión (src/shell/auth.svelte.js) y
// la edición del perfil (src/features/perfil).
export const myProfile = { name:'Tu nombre', mote:'', phone:'', comisiones:[], rango:'', posicion:'', rol:'', licencia:'', birthdate:'', avatarUrl:'' };

// Plantilla usada para repartir a los jugadores en las 3 pestañas de cada evento
export const roster = [
  { id:'me', name:'Tú', pos:'', comisiones:[], rango:'', rol:'', birthdate:'', mote:'', injured:false, injuryIcon:'', rm:{} }
];
export const rosterById = Object.fromEntries(roster.map(p => [p.id, p]));

// Usuario que ha iniciado sesión: la propia cuenta vive en el roster bajo la clave
// especial 'me', no bajo su UUID.
export const currentUserId = 'me';

// La fila del roster de la propia cuenta.
export function myRosterEntry() {
  return rosterById[currentUserId];
}
