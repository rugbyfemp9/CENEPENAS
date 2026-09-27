import { mountAt } from '../../lib/mount.js';
import TullidasModal from './TullidasModal.svelte';
import { openTullidesModal, subscribeToTullidesRealtime, forgetTullidesForEvent } from './tullidas.svelte.js';

export function install(bridge) {
  mountAt(TullidasModal, 'tullides-modal');

  bridge.tullidas = {
    // Botón 🩹 del detalle de un partido en Asistencia (index.html).
    open: openTullidesModal,
    // Al iniciar sesión (auth.js).
    subscribeRealtime: subscribeToTullidesRealtime,
    // Al borrar un evento (eventos.js), junto con sus filas de match_injuries.
    forgetEvent: forgetTullidesForEvent,
  };
}
