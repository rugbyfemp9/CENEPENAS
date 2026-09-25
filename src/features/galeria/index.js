import { mountAt, mountInto } from '../../lib/mount.js';
import Galeria from './Galeria.svelte';
import AddAlbumModal from './AddAlbumModal.svelte';
import { loadGalleryData, subscribeToGalleryRealtime, showSeasons } from './galeria.svelte.js';

export function install(bridge) {
  mountInto(Galeria, '#sec-galeria');
  mountAt(AddAlbumModal, 'add-album-modal');

  bridge.galeria = {
    load: loadGalleryData,
    subscribe: subscribeToGalleryRealtime,
    // Al entrar en Galería desde fuera, siempre se empieza por las temporadas, y se
    // recarga por si Comi Xarxes ha añadido algún álbum desde otra cuenta.
    onEnter() {
      showSeasons();
      loadGalleryData();
    },
  };
}
