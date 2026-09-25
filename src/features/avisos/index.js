import { mountAt, mountInto } from '../../lib/mount.js';
import NoticesCard from './NoticesCard.svelte';
import TopNotices from './TopNotices.svelte';
import AddNoticeModal from './AddNoticeModal.svelte';
import { refreshPinned, refreshAll } from './avisos.svelte.js';

export function install(bridge) {
  mountAt(NoticesCard, 'inicio-notices-card');
  mountInto(TopNotices, '#inicio-top-notices');
  mountAt(AddNoticeModal, 'add-notice-modal');

  bridge.avisos = {
    // Al arrancar solo se pide la lista (como antes); las notificaciones de arriba
    // necesitan la sesión, así que llegan con refreshAll() al iniciar sesión.
    refreshPinned,
    // Al iniciar sesión y al entrar en Inicio, por si alguien ha publicado algo nuevo.
    refreshAll,
  };
}
