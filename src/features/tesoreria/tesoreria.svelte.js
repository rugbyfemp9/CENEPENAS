// ---- Comi Tesoreria ----
// Movimientos de tesorería del club ("Comi Tesorería"). Se guardan en Supabase
// (tabla "treasury_entries") para que estén sincronizados entre todo el mundo; la
// lógica es la misma que la de Comi Tercer Temps (ver src/lib/treasury/).
import { rosterById } from '../../lib/roster.js';
import { createTreasury } from '../../lib/treasury/treasury.svelte.js';
import { t } from '../../lib/i18n.svelte.js';
import { canManageClubTreasury } from '../../lib/permissions.js';
import { COMISIONES } from '../../lib/roles.js';

// Personas de la plantilla que tienen marcado "Comi Tesoreria" en su perfil
export function treasuryCommissionMembers() {
  return Object.values(rosterById).filter((p) => p.comision === COMISIONES.tesoreria);
}

export const treasury = createTreasury({
  table: 'treasury_entries',
  canManage: canManageClubTreasury,
  members: treasuryCommissionMembers,
  messages: {
    loadError: 'No se ha podido cargar la tesorería',
    addError: 'No se pudo guardar el movimiento de tesorería',
    persistError: 'No se pudo guardar la tesorería',
    // Se muestra en el desglose: getter para que siga el idioma activo.
    get noMembersNoEntries() { return t('comi.noMembersNoEntriesTesoreria'); },
  },
});
