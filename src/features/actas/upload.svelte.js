// ---- Subir el PDF del acta (lo procesa la función Edge "process-match-report-pdf") ----
// y eliminar el acta entera (jugadoras + tarjetas + cabecera).
import { SUPABASE_URL, supabase } from '../../lib/supabase.js';
import { partidoDetalle } from '../partidos/partidos.svelte.js';
import { loadMatchReport } from './actas.svelte.js';

export const reportUpload = $state({
  open: false,
  busy: false,
  status: '',
  // Como antes, el color del mensaje se queda el último que se puso aunque se vuelva
  // a abrir el modal (al abrirlo solo se vacía el texto).
  statusColor: 'var(--text-muted)',
  fileInput: null,
});

function setStatus(color, text) {
  reportUpload.statusColor = color;
  reportUpload.status = text;
}

export function openMatchReportUploadModal() {
  if (reportUpload.fileInput) reportUpload.fileInput.value = '';
  reportUpload.status = '';
  reportUpload.open = true;
}
export function closeMatchReportUploadModal() {
  reportUpload.open = false;
}

export async function uploadMatchReportPdf() {
  const fileInput = reportUpload.fileInput;
  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    setStatus('var(--bad)', 'Elige primero un archivo PDF.');
    return;
  }
  if (!partidoDetalle.currentId) {
    setStatus('var(--bad)', 'No se ha podido identificar el partido.');
    return;
  }

  reportUpload.busy = true;
  setStatus('var(--text-muted)', 'Subiendo y leyendo el acta con Gemini… puede tardar unos segundos.');

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!accessToken) {
      setStatus('var(--bad)', 'Tu sesión ha caducado, vuelve a iniciar sesión e inténtalo de nuevo.');
      return;
    }

    const form = new FormData();
    form.append('pdf', file);
    form.append('match_id', partidoDetalle.currentId);

    const res = await fetch(`${SUPABASE_URL}/functions/v1/process-match-report-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const result = await res.json();

    if (!res.ok || result.error) {
      setStatus('var(--bad)', result.error || 'No se ha podido procesar el acta.');
      return;
    }

    await loadMatchReport(partidoDetalle.currentId);
    const aviso = result.unmatchedOwnTeamNames && result.unmatchedOwnTeamNames.length
      ? ` (${result.unmatchedOwnTeamNames.length} jugadora/s no identificadas: revísalas)`
      : '';
    setStatus('var(--ok)', `¡Acta cargada! (${result.playersMatched}/${result.playersProcessed} jugadoras cruzadas)${aviso} Cerrando…`);
    setTimeout(closeMatchReportUploadModal, 1200);
  } catch (e) {
    setStatus('var(--bad)', 'Error al subir el acta: ' + e.message);
  } finally {
    reportUpload.busy = false;
  }
}

// ---- Eliminar el acta entera (jugadoras + tarjetas + cabecera) ----
export async function deleteMatchReport() {
  if (!partidoDetalle.currentId) return;
  if (!confirm('¿Seguro que quieres borrar el acta de este partido? Se perderán todos los datos: jugadoras, minutos, puntos y tarjetas.')) return;

  try {
    const { data: oldPlayers, error: oldPlayersError } = await supabase
      .from('match_report_players').select('id').eq('match_id', partidoDetalle.currentId);
    if (oldPlayersError) throw new Error(oldPlayersError.message);
    const oldIds = (oldPlayers || []).map((p) => p.id);
    if (oldIds.length) {
      const { error: delCardsError } = await supabase.from('match_report_cards').delete().in('match_report_player_id', oldIds);
      if (delCardsError) throw new Error(delCardsError.message);
    }
    const { error: delPlayersError } = await supabase.from('match_report_players').delete().eq('match_id', partidoDetalle.currentId);
    if (delPlayersError) throw new Error(delPlayersError.message);
    const { error: delHeaderError } = await supabase.from('match_reports').delete().eq('id', partidoDetalle.currentId);
    if (delHeaderError) throw new Error(delHeaderError.message);

    await loadMatchReport(partidoDetalle.currentId);
  } catch (e) {
    alert('No se ha podido borrar el acta: ' + e.message);
  }
}
