import { mountAt, mountInto } from '../../lib/mount.js';
import TreasuryAddModal from '../../lib/treasury/TreasuryAddModal.svelte';
import TreasuryBreakdownModal from '../../lib/treasury/TreasuryBreakdownModal.svelte';
import TreasuryDeleteModal from '../../lib/treasury/TreasuryDeleteModal.svelte';
import { t } from '../../lib/i18n.svelte.js';
import ComiTercerTemps from './ComiTercerTemps.svelte';
import { tercerTreasury } from './comi-tercer-temps.svelte.js';

export function install() {
  mountInto(ComiTercerTemps, '#sec-comi-tercer-temps');
  mountAt(TreasuryAddModal, 'add-tercer-treasury-modal', {
    treasury: tercerTreasury,
    ids: {
      modal: 'add-tercer-treasury-modal', date: 'tercer-treasury-date-input', concept: 'tercer-treasury-concept-input',
      typeGasto: 'tx-tercer-type-gasto', typeIngreso: 'tx-tercer-type-ingreso', type: 'tercer-treasury-type-input',
      amount: 'tercer-treasury-amount-input', responsible: 'tercer-treasury-responsible-input', responsibleEmpty: 'tercer-treasury-responsible-empty',
    },
    get conceptPlaceholder() { return t('comi.conceptPlaceholderTercer'); },
    amountPlaceholder: '60',
    get noMembersText() { return t('comi.noMembersTercer'); },
  });
  mountAt(TreasuryBreakdownModal, 'tercer-treasury-breakdown-modal', {
    treasury: tercerTreasury, id: 'tercer-treasury-breakdown-modal', listId: 'tercer-treasury-breakdown-list',
    get sub() { return t('comi.breakdownSubTercer'); },
  });
  mountAt(TreasuryDeleteModal, 'delete-tercer-treasury-confirm-modal', {
    treasury: tercerTreasury, id: 'delete-tercer-treasury-confirm-modal',
    get title() { return t('comi.deleteMovementTitle'); },
    get message() { return t('comi.deleteMovementConfirm'); },
    get no() { return t('att.no'); },
    get yes() { return t('att.yesDelete'); },
  });
}
