import { mountAt, mountInto } from '../../lib/mount.js';
import TreasuryAddModal from '../../lib/treasury/TreasuryAddModal.svelte';
import TreasuryBreakdownModal from '../../lib/treasury/TreasuryBreakdownModal.svelte';
import TreasuryDeleteModal from '../../lib/treasury/TreasuryDeleteModal.svelte';
import { t } from '../../lib/i18n.svelte.js';
import ComiTercerTemps from './ComiTercerTemps.svelte';
import { loadShoppingItems, tercerTreasury } from './comi-tercer-temps.svelte.js';

export function install(bridge) {
  mountInto(ComiTercerTemps, '#sec-comi-tercer-temps');
  mountAt(TreasuryAddModal, 'add-tercer-treasury-modal', {
    treasury: tercerTreasury,
    ids: {
      modal: 'add-tercer-treasury-modal', date: 'tercer-treasury-date-input', concept: 'tercer-treasury-concept-input',
      typeGasto: 'tx-tercer-type-gasto', typeIngreso: 'tx-tercer-type-ingreso', type: 'tercer-treasury-type-input',
      amount: 'tercer-treasury-amount-input', responsible: 'tercer-treasury-responsible-input', responsibleEmpty: 'tercer-treasury-responsible-empty',
    },
    conceptPlaceholder: 'Bebida y hielo',
    amountPlaceholder: '60',
    noMembersText: 'Todavía nadie tiene marcado "Comi Tercer Temps" en su perfil.',
  });
  mountAt(TreasuryBreakdownModal, 'tercer-treasury-breakdown-modal', {
    treasury: tercerTreasury, id: 'tercer-treasury-breakdown-modal', listId: 'tercer-treasury-breakdown-list',
    get sub() { return t('comi.breakdownSubTercer'); },
  });
  // Este modal nunca se tradujo: textos fijos en castellano.
  mountAt(TreasuryDeleteModal, 'delete-tercer-treasury-confirm-modal', {
    treasury: tercerTreasury, id: 'delete-tercer-treasury-confirm-modal',
    title: 'Eliminar movimiento',
    message: '¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.',
    no: 'No',
    yes: 'Sí, eliminar',
  });

  bridge.comiTercerTemps = {
    // Al entrar en "comi-tercer-temps" (setSection), por si han cambiado desde otro dispositivo.
    loadShoppingItems,
    loadTreasury: tercerTreasury.load,
    // Tras iniciar sesión o editar el perfil (puede cambiar quién gestiona la comisión).
    permissionsChanged: tercerTreasury.permissionsChanged,
  };
}
