import { mountAt, mountInto } from '../../lib/mount.js';
import Jugadas from './Jugadas.svelte';
import PlayModal from './PlayModal.svelte';
import AddPlayModal from './AddPlayModal.svelte';

export function install() {
  mountInto(Jugadas, '#sec-jugadas');
  mountAt(PlayModal, 'play-modal');
  mountAt(AddPlayModal, 'add-play-modal');
}
