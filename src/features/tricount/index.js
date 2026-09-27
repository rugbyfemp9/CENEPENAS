import { mountAt, mountInto } from '../../lib/mount.js';
import Tricount from './Tricount.svelte';
import TricountBanner from './TricountBanner.svelte';
import TricountExpenseModal from './TricountExpenseModal.svelte';

export function install() {
  mountInto(Tricount, '#sec-tricount');
  mountAt(TricountExpenseModal, 'add-tricount-modal');
  mountInto(TricountBanner, '#inicio-tricount-banner');
}
