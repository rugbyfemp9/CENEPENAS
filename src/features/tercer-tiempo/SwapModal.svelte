<script>
  // Modal "No puedo asistir": pedir a una compañera que te cubra el turno.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { swapModal, closeSwapModal, confirmSwapRequest } from './covers.svelte.js';

  let select = $state();
</script>

<Modal id="swap-modal" bind:open={swapModal.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('tercer.cantAttend')}</h3>
  <div class="modal-sub" id="swap-modal-sub">{swapModal.sub}</div>
  <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
    <span>{t('tercer.swapWithLabel')}</span>
    {#key swapModal.seq}
      <select id="swap-teammate-select" bind:this={select} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">{#each swapModal.options as p}<option value={p.id}>{p.name}</option>{/each}</select>
    {/key}
  </label>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeSwapModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={() => confirmSwapRequest(select?.value)}>{t('tercer.sendNotice')}</button>
  </div>
</Modal>
