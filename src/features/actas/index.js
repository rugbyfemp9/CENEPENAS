import { mountAt } from '../../lib/mount.js';
import MatchReportUploadModal from './MatchReportUploadModal.svelte';
import ActaBuilderModal from './ActaBuilderModal.svelte';
import { subscribeToMatchReportRealtime, renderMatchReport } from './actas.svelte.js';
import { partidoDetalle } from '../partidos/partidos.svelte.js';

// La tarjeta del acta (ActaCard.svelte) la monta el detalle del partido
// (src/features/partidos/PartidoDetalle.svelte).
export function install(bridge) {
  mountAt(MatchReportUploadModal, 'match-report-upload-modal');
  mountAt(ActaBuilderModal, 'match-report-builder-modal');

  // Antes setLang() (js/core/i18n.js) volvía a pintar el acta del partido abierto
  // (recalculando también los permisos): se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', () => {
    if (partidoDetalle.currentId) renderMatchReport(partidoDetalle.currentId);
  });

  bridge.actas = {
    // Al iniciar sesión (auth.js).
    subscribeRealtime: subscribeToMatchReportRealtime,
  };
}
