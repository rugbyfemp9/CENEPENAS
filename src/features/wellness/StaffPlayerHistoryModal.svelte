<script>
  // MODAL: HISTORIAL COMPLETO DE CARGA (sRPE) DE UNA JUGADORA, agrupado por semana.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { history, closeWellnessPlayerHistoryModal } from './wellness-history.svelte.js';

  const pm = $derived(history.playerModal);
</script>

<Modal id="wstaff-player-history-modal" bind:open={() => history.playerModal.open, (v) => { if (v) history.playerModal.open = true; else closeWellnessPlayerHistoryModal(); }} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;" id="wstaff-player-history-name">{pm.name}</h3>
  <div class="modal-sub">{t('wstaff.historyModalSub')}</div>
  <div class="wstaff-alert-list" id="wstaff-player-history-list">
    {#if pm.rows && pm.rows.length}
      {#each pm.rows as w}
        <div class="row"><b>{w.label}</b> <span>{w.load}</span></div>
      {/each}
    {:else if pm.rows}
      <div class="wstaff-alert-empty">{t('wstaff.historyNoData')}</div>
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={closeWellnessPlayerHistoryModal}>{t('att.close')}</button>
  </div>
</Modal>
