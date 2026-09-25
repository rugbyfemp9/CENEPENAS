<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { rmModal, closeGymRmModal, saveGymRm } from './gym.svelte.js';
</script>

<Modal id="gym-rm-modal" bind:open={rmModal.open} boxStyle="max-width:360px;">
  <h3 style="margin-top:0;" id="gym-rm-modal-title">{rmModal.title ?? 'Registrar marca'}</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('gym.myRm')}</span>
      <input type="number" id="gym-rm-input" placeholder="80" min="0" step="0.5" bind:value={rmModal.weight} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeGymRmModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveGymRm}>{t('gym.saveGeneric')}</button>
  </div>
</Modal>
