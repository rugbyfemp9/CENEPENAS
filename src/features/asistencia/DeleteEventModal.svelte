<script>
  // Confirmar antes de eliminar un evento.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { deleteConfirm, closeDeleteEventConfirm, confirmDeleteEvent } from './editor.svelte.js';
</script>

<Modal id="delete-event-confirm-modal" bind:open={() => deleteConfirm.open, (v) => { if (v) deleteConfirm.open = true; else closeDeleteEventConfirm(); }} boxStyle="max-width:340px; text-align:center;">
  <h3 style="margin-top:0;">{t('att.deleteEventTitle')}</h3>
  <p class="modal-sub" style="margin-bottom:20px;">{t('att.deleteEventConfirm')}</p>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeDeleteEventConfirm}>{t('att.no')}</button>
    <button class="btn" style="background:var(--bad);" onclick={confirmDeleteEvent}>{t('att.yesDelete')}</button>
  </div>
</Modal>
