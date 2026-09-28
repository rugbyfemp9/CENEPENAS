import { mountAt } from '../../lib/mount.js';
import TullidasModal from './TullidasModal.svelte';
import { refreshTullidesSub } from './tullidas.svelte.js';

export function install() {
  mountAt(TullidasModal, 'tullides-modal');

  // Al cambiar de idioma se vuelve a calcular el subtítulo (fecha) del modal abierto.
  window.addEventListener('app:langchange', refreshTullidesSub);
}
