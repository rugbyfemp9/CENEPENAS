<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { checkinModal, closeGymCheckinModal, saveGymCheckin } from './gym.svelte.js';
</script>

<Modal id="gym-checkin-modal" bind:open={checkinModal.open} boxStyle="max-width:340px;">
  <h3 style="margin-top:0;">{t('gym.goingToday')}</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('gym.whatTime')}</span>
      <input type="time" id="gym-checkin-time-input" bind:value={checkinModal.time} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeGymCheckinModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveGymCheckin}>{t('gym.signMeUp')}</button>
  </div>
</Modal>
