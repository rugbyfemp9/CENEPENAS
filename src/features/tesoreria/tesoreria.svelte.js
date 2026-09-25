// ---- Comi Tesoreria ----
// Movimientos de tesorería del club ("Comi Tesorería"). Se guardan en Supabase
// (tabla "treasury_entries") para que estén sincronizados entre todo el mundo; la
// lógica es la misma que la de Comi Tercer Temps (ver src/lib/treasury/).
import { legacy } from '../../lib/legacy.js';
import { session } from '../../lib/session.svelte.js';
import { createTreasury } from '../../lib/treasury/treasury.svelte.js';

// Solo Comi Tesoreria puede añadir/editar/borrar movimientos de la tesorería del
// club; el resto del equipo puede consultar el saldo y la tabla con total normalidad
// (la escritura real también la bloquea la política RLS de "treasury_entries" en
// Supabase).
export function canManageClubTreasury() {
  return session.isAdmin || session.comision === 'Comi Tesoreria';
}

// Personas de la plantilla que tienen marcado "Comi Tesoreria" en su perfil
export function treasuryCommissionMembers() {
  return Object.values(legacy.rosterById).filter((p) => p.comision === 'Comi Tesoreria');
}

export const treasury = createTreasury({
  table: 'treasury_entries',
  canManage: canManageClubTreasury,
  members: treasuryCommissionMembers,
  messages: {
    loadError: 'No se ha podido cargar la tesorería',
    addError: 'No se pudo guardar el movimiento de tesorería',
    persistError: 'No se pudo guardar la tesorería',
    noMembersNoEntries: 'Todavía no hay nadie en Comi Tesoreria ni movimientos registrados.',
  },
});
