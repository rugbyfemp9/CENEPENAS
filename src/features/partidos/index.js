import { mountAt, mountInto } from '../../lib/mount.js';
import NextMatchBanner from './NextMatchBanner.svelte';
import Partidos from './Partidos.svelte';
import PartidoDetalle from './PartidoDetalle.svelte';
import ChecklistModal from './ChecklistModal.svelte';
import RollCallModal from './RollCallModal.svelte';
import { renderNextMatchBanner, renderPartidosList, onLangChange } from './partidos.svelte.js';

export function install(bridge) {
  mountAt(NextMatchBanner, 'next-match-banner');
  mountInto(Partidos, '#sec-partidos');
  mountInto(PartidoDetalle, '#sec-partido-detalle');
  mountAt(ChecklistModal, 'matchday-checklist-modal');
  mountAt(RollCallModal, 'rollcall-modal');

  // Antes setLang() (js/core/i18n.js) volvía a pintar el banner de Inicio y la lista
  // de Partidos: se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', onLangChange);

  bridge.partidos = {
    // Al arrancar (legacyBoot).
    renderNextMatchBanner,
    // Al entrar en la sección (navigation.js).
    renderList: renderPartidosList,
  };
}
