<script>
  // Modal de alta de multa (solo Comi Tesoreria).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import FinePlayerSearch from './FinePlayerSearch.svelte';
  import FineReasonGrid from './FineReasonGrid.svelte';
  import { fineModal, closeFineModal, saveFine, reasonsTotal } from './multas.svelte.js';
</script>

<Modal id="fine-modal" bind:open={fineModal.open} boxStyle="max-width:460px;">
  <h3>{t('fines.addFine')}</h3>
  <div class="modal-sub">{t('fines.addFineSub')}</div>

  <div class="fine-modal-section">
    <div class="fine-modal-label">{t('fines.player')}</div>
    <FinePlayerSearch modal={fineModal} prefix="fine" />
  </div>

  <div class="fine-modal-section">
    <div class="fine-modal-label">{t('fines.reasonMulti')}</div>
    <FineReasonGrid modal={fineModal} id="fine-reason-grid" />
  </div>

  <div class="fine-total-row">
    <span>{t('fines.amount')}</span>
    <b id="fine-total-amount">{reasonsTotal(fineModal.reasonIds)} €</b>
  </div>

  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeFineModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveFine}>{t('fines.save')}</button>
  </div>
</Modal>
