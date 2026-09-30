<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { saveModal, closeSaveLineupModal, confirmSaveLineup } from './fantasy.svelte.js';
</script>

<Modal id="save-lineup-modal" bind:open={saveModal.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">{t('fantasy.saveLineup')}</h3>
  <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
    <span>{t('fantasy.nameLabel')}</span>
    <input type="text" id="lineup-name-input" placeholder={t('fantasy.namePlaceholder')} bind:value={saveModal.name} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">
  </label>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeSaveLineupModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={confirmSaveLineup}>{t('gym.saveGeneric')}</button>
  </div>
</Modal>
