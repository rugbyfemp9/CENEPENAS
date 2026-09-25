<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { routineUpload, closeGymRoutineUploadModal, uploadGymRoutinePdf } from './gym.svelte.js';
</script>

<Modal id="gym-routine-upload-modal" bind:open={routineUpload.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">{t('gym.uploadRoutinePdfModalTitle')}</h3>
  <p class="modal-sub" style="margin-bottom:14px;">{t('gym.uploadRoutinePdfSub')}</p>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:0 0 18px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('partido.pdfFileLabel')}</span>
      <input type="file" id="gym-routine-pdf-input" accept="application/pdf" bind:this={routineUpload.fileInput} style="font-family:'Roboto',sans-serif; font-size:13px;">
    </label>
    <div id="gym-routine-upload-status" style="font-size:12.5px; color:{routineUpload.statusColor};">{routineUpload.status}</div>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" id="gym-routine-upload-cancel-btn" onclick={closeGymRoutineUploadModal} disabled={routineUpload.busy}>{t('att.cancel')}</button>
    <button class="btn" id="gym-routine-upload-submit-btn" onclick={uploadGymRoutinePdf} disabled={routineUpload.busy}>{t('partido.uploadAndProcess')}</button>
  </div>
</Modal>
