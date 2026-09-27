import { mountAt, mountInto } from '../../lib/mount.js';
import Multas from './Multas.svelte';
import FinesBanner from './FinesBanner.svelte';
import VestTotal from './VestTotal.svelte';
import FineModal from './FineModal.svelte';
import EditFineModal from './EditFineModal.svelte';
import PayFineModal from './PayFineModal.svelte';
import FinesHistoryModal from './FinesHistoryModal.svelte';
import { loadFines, subscribeToFinesRealtime, permissionsChanged, onLangChange } from './multas.svelte.js';

export function install(bridge) {
  mountInto(FinesBanner, '#inicio-fines-banner');
  mountAt(VestTotal, 'vest-multas-total');
  mountInto(Multas, '#sec-multas');
  mountAt(FineModal, 'fine-modal');
  mountAt(EditFineModal, 'edit-fine-modal');
  mountAt(PayFineModal, 'pay-fine-modal');
  mountAt(FinesHistoryModal, 'fines-history-modal');

  // Antes setLang() (js/core/i18n.js) volvía a pintar el banner, la tarjeta personal,
  // la tabla y el histórico (si estaba abierto): se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', onLangChange);

  bridge.multas = {
    // Al iniciar sesión (auth.js), ya con el id real fijado.
    load: loadFines,
    subscribeRealtime: subscribeToFinesRealtime,
    // Tras iniciar sesión o editar el perfil, después de appBridge.sessionChanged().
    permissionsChanged,
  };
}
