<script>
  // Modal de edición de multa (solo Comi Tesoreria): cambiar jugadora/motivo de una
  // multa, o eliminar las multas pendientes de los motivos marcados.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import FinePlayerSearch from './FinePlayerSearch.svelte';
  import FineReasonGrid from './FineReasonGrid.svelte';
  import { editFineModal, closeEditFineModal, saveEditFine, deleteFineFromEditModal, reasonsTotal } from './multas.svelte.js';
</script>

<Modal id="edit-fine-modal" bind:open={editFineModal.open} boxStyle="max-width:460px;">
  <h3>{t('fines.editTitle')}</h3>
  <div class="modal-sub">{t('fines.editSub')}</div>

  <div class="fine-modal-section">
    <div class="fine-modal-label">{t('fines.player')}</div>
    <FinePlayerSearch modal={editFineModal} prefix="edit-fine" />
  </div>

  <div class="fine-modal-section">
    <div class="fine-modal-label">{t('fines.reason')}</div>
    <FineReasonGrid modal={editFineModal} id="edit-fine-reason-grid" />
  </div>

  <div class="fine-total-row">
    <span>{t('fines.amount')}</span>
    <b id="edit-fine-total-amount">{reasonsTotal(editFineModal.reasonIds)} €</b>
  </div>

  <div class="modal-actions" style="justify-content:space-between;">
    <button class="btn-ghost" onclick={deleteFineFromEditModal} style="color:var(--bad);">{t('fines.deleteFine')}</button>
    <div style="display:flex; gap:10px;">
      <button class="btn-ghost" onclick={closeEditFineModal}>{t('att.cancel')}</button>
      <button class="btn" onclick={saveEditFine}>{t('fines.saveChanges')}</button>
    </div>
  </div>
</Modal>
