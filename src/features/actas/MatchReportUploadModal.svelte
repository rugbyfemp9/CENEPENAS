<script>
  // MODAL: SUBIR PDF DEL ACTA DEL PARTIDO
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { reportUpload, closeMatchReportUploadModal, uploadMatchReportPdf } from './upload.svelte.js';
</script>

<Modal id="match-report-upload-modal" bind:open={reportUpload.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">{t('partido.uploadPdf')}</h3>
  <p class="modal-sub" style="margin-bottom:14px;">{t('partido.uploadPdfSub')}</p>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:0 0 18px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('partido.pdfFileLabel')}</span>
      <input type="file" id="match-report-pdf-input" accept="application/pdf" bind:this={reportUpload.fileInput} style="font-family:'Roboto',sans-serif; font-size:13px;">
    </label>
    <div id="match-report-upload-status" style="font-size:12.5px; color:{reportUpload.statusColor};">{reportUpload.status}</div>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" id="match-report-upload-cancel-btn" onclick={closeMatchReportUploadModal} disabled={reportUpload.busy}>{t('att.cancel')}</button>
    <button class="btn" id="match-report-upload-submit-btn" onclick={uploadMatchReportPdf} disabled={reportUpload.busy}>{t('partido.uploadAndProcess')}</button>
  </div>
</Modal>
