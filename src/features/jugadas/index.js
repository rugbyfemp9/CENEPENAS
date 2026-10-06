import { mountAt, mountInto } from '../../lib/mount.js';
import Jugadas from './Jugadas.svelte';
import PlayModal from './PlayModal.svelte';

export function install() {
  mountInto(Jugadas, '#sec-jugadas');
  mountAt(PlayModal, 'play-modal');
}
