import { mountAt, mountInto } from '../../lib/mount.js';
import Jugadas from './Jugadas.svelte';
import PlayModal from './PlayModal.svelte';
import AddPlayModal from './AddPlayModal.svelte';
import DeletePlayModal from './DeletePlayModal.svelte';
import PlayEditor from './PlayEditor.svelte';
import PlayBoardFull from './PlayBoardFull.svelte';

export function install() {
  mountInto(Jugadas, '#sec-jugadas');
  mountInto(PlayEditor, '#sec-jugada-editor');
  mountAt(PlayModal, 'play-modal');
  mountAt(AddPlayModal, 'add-play-modal');
  mountAt(DeletePlayModal, 'delete-play-modal');
  mountAt(PlayBoardFull, 'play-board-full');
}
