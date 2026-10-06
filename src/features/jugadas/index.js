import { mountAt, mountInto } from '../../lib/mount.js';
import Jugadas from './Jugadas.svelte';
import PlayModal from './PlayModal.svelte';
import AddPlayModal from './AddPlayModal.svelte';
import PlayEditor from './PlayEditor.svelte';

export function install() {
  mountInto(Jugadas, '#sec-jugadas');
  mountInto(PlayEditor, '#sec-jugada-editor');
  mountAt(PlayModal, 'play-modal');
  mountAt(AddPlayModal, 'add-play-modal');
}
