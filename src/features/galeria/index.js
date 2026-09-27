import { mountAt, mountInto } from '../../lib/mount.js';
import Galeria from './Galeria.svelte';
import AddAlbumModal from './AddAlbumModal.svelte';

export function install() {
  mountInto(Galeria, '#sec-galeria');
  mountAt(AddAlbumModal, 'add-album-modal');
}
