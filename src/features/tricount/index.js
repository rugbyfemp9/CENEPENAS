import { mountAt, mountInto } from '../../lib/mount.js';
import Tricount from './Tricount.svelte';
import TricountBanner from './TricountBanner.svelte';
import TricountExpenseModal from './TricountExpenseModal.svelte';
import { loadExpenses, loadSettlements } from './tricount.svelte.js';

export function install(bridge) {
  mountInto(Tricount, '#sec-tricount');
  mountAt(TricountExpenseModal, 'add-tricount-modal');
  mountInto(TricountBanner, '#inicio-tricount-banner');

  bridge.tricount = {
    // Al entrar en "tricount" (setSection): los gastos y las liquidaciones solo se
    // piden entonces, así que hasta la primera visita el banner de Inicio dice
    // "al día".
    loadExpenses,
    loadSettlements,
  };
}
