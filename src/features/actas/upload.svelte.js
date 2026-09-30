// ---- Subir el PDF del acta (lo procesa la función Edge "process-match-report-pdf") ----
// y eliminar el acta entera (jugadoras + tarjetas + cabecera).
import { SUPABASE_URL, supabase } from '../../lib/supabase.js';
import { partidoDetalle } from '../partidos/partidos.svelte.js';
import { loadMatchReport } from './actas.svelte.js';
import { t } from '../../lib/i18n.svelte.js';

export const reportUpload = $state({
  open: false,
  busy: false,
  // '' | { key, vars } (se traduce al pintarse, así sigue el cambio de idioma) |
  // { text } (el error tal cual lo devuelve el servidor)
  status: '',
  // Como antes, el color del mensaje se queda el último que se puso aunque se vuelva
  // a abrir el modal (al abrirlo solo se vacía el texto).
  statusColor: 'var(--text-muted)',
  fileInput: null,
});

function setStatus(color, key, vars) {
  reportUpload.statusColor = color;
  reportUpload.status = { key, vars };
}

export function uploadStatusText() {
  const s = reportUpload.status;
  if (!s) return '';
  if (s.text != null) return s.text;
  const vars = { ...s.vars };
  if (s.key === 'actas.uploadDone') vars.warning = vars.unmatched ? t('actas.uploadUnmatched', { count: vars.unmatched }) : '';
  return t(s.key, vars);
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
    setStatus('var(--bad)', 'actas.chooseFileFirst');
    return;
  }
  if (!partidoDetalle.currentId) {
    setStatus('var(--bad)', 'actas.matchNotFound');
    return;
  }

  reportUpload.busy = true;
  setStatus('var(--text-muted)', 'actas.uploading');

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData && sessionData.session ? sessionData.session.access_token : null;
    if (!accessToken) {
      setStatus('var(--bad)', 'actas.sessionExpired');
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
      if (result.error) {
        reportUpload.statusColor = 'var(--bad)';
        reportUpload.status = { text: result.error };
      } else {
        setStatus('var(--bad)', 'actas.processError');
      }
      return;
    }

    await loadMatchReport(partidoDetalle.currentId);
    const unmatched = result.unmatchedOwnTeamNames && result.unmatchedOwnTeamNames.length ? result.unmatchedOwnTeamNames.length : 0;
    setStatus('var(--ok)', 'actas.uploadDone', { matched: result.playersMatched, processed: result.playersProcessed, unmatched });
    setTimeout(closeMatchReportUploadModal, 1200);
  } catch (e) {
    setStatus('var(--bad)', 'actas.uploadError', { error: e.message });
  } finally {
    reportUpload.busy = false;
  }
}

// ---- Eliminar el acta entera (jugadoras + tarjetas + cabecera) ----
export async function deleteMatchReport() {
  if (!partidoDetalle.currentId) return;
  if (!confirm(t('actas.confirmDelete'))) return;

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
    alert(t('actas.alertDeleteError', { error: e.message }));
  }
}
