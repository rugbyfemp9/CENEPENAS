import { mountAt } from '../../lib/mount.js';
import TullidasModal from './TullidasModal.svelte';

export function install() {
  mountAt(TullidasModal, 'tullides-modal');
}
