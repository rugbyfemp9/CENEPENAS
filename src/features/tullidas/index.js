import { mountAt } from '../../lib/mount.js';
import TullidasModal from './TullidasModal.svelte';
import { subscribeToTullidesRealtime } from './tullidas.svelte.js';

export function install(bridge) {
  mountAt(TullidasModal, 'tullides-modal');

  bridge.tullidas = {
    // Al iniciar sesión (auth.js).
    subscribeRealtime: subscribeToTullidesRealtime,
  };
}
