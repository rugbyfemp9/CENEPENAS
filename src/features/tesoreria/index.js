import { mountAt, mountInto } from '../../lib/mount.js';
import TreasuryAddModal from '../../lib/treasury/TreasuryAddModal.svelte';
import TreasuryBreakdownModal from '../../lib/treasury/TreasuryBreakdownModal.svelte';
import TreasuryDeleteModal from '../../lib/treasury/TreasuryDeleteModal.svelte';
import { t } from '../../lib/i18n.svelte.js';
import Tesoreria from './Tesoreria.svelte';
import { treasury, treasuryCommissionMembers } from './tesoreria.svelte.js';

export function install(bridge) {
  mountInto(Tesoreria, '#sec-comi-tesoreria');
  mountAt(TreasuryAddModal, 'add-treasury-modal', {
    treasury,
    ids: {
      modal: 'add-treasury-modal', date: 'treasury-date-input', concept: 'treasury-concept-input',
      typeGasto: 'tx-type-gasto', typeIngreso: 'tx-type-ingreso', type: 'treasury-type-input',
      amount: 'treasury-amount-input', responsible: 'treasury-responsible-input', responsibleEmpty: 'treasury-responsible-empty',
    },
    conceptPlaceholder: 'Cuotas de agosto',
    amountPlaceholder: '150',
    noMembersText: 'Todavía nadie tiene marcado "Comi Tesoreria" en su perfil.',
  });
  mountAt(TreasuryBreakdownModal, 'treasury-breakdown-modal', {
    treasury, id: 'treasury-breakdown-modal', listId: 'treasury-breakdown-list',
    get sub() { return t('comi.breakdownSubTesoreria'); },
  });
  mountAt(TreasuryDeleteModal, 'delete-treasury-confirm-modal', {
    treasury, id: 'delete-treasury-confirm-modal',
    get title() { return t('comi.deleteMovementTitle'); },
    get message() { return t('comi.deleteMovementConfirm'); },
    get no() { return t('att.no'); },
    get yes() { return t('att.yesDelete'); },
  });

  bridge.tesoreria = {
    // Al entrar en "comi-tesoreria" (setSection), por si ha cambiado desde otro dispositivo.
    load: treasury.load,
    // Multas: al pagar una multa se añade el ingreso aquí, y el modal de pagar una
    // multa ofrece a las personas de Comi Tesoreria.
    addEntry: treasury.addEntry,
    commissionMembers: treasuryCommissionMembers,
    // Tras iniciar sesión o editar el perfil (puede cambiar quién gestiona la tesorería).
    permissionsChanged: treasury.permissionsChanged,
  };
}
