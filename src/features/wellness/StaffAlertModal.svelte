<script>
  // MODAL: LISTA COMPLETA DE JUGADORAS DE UNA ALERTA DE WELLNESS (molestias / mal
  // descanso / carga alta). Se recalcula solo si cambian las filas con el modal abierto.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { staff, WSTAFF_ALERT_META, closeWellnessAlertModal } from './wellness-staff.svelte.js';

  const kind = $derived(staff.alertModal.kind);
  const rows = $derived(staff.alerts[kind]);
  // Antes de abrirlo por primera vez se ve el marcado inicial ("0 jugadoras", traducido).
  const countText = $derived(staff.alertModal.everOpened
    ? `${rows.length} ${rows.length === 1 ? t('wstaff.alertModalPlayerSingular') : t('wstaff.alertModalPlayerPlural')}`
    : `0 ${t('wstaff.alertModalPlayerPlural')}`);
</script>

<Modal id="wstaff-alert-modal" bind:open={() => staff.alertModal.open, (v) => { if (v) staff.alertModal.open = true; else closeWellnessAlertModal(); }} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;"><span id="wstaff-alert-modal-icon">{WSTAFF_ALERT_META[kind].icon}</span> <span id="wstaff-alert-modal-title">{t(WSTAFF_ALERT_META[kind].titleKey)}</span></h3>
  <div class="modal-sub" id="wstaff-alert-modal-count">{countText}</div>
  <div class="wstaff-alert-list" id="wstaff-alert-modal-list">
    {#each rows as r}
      {#if kind === 'discomfort'}
        <div class="row"><b>{r.name}</b>{#if r.discomfortDetail}{' — '}<span>{r.discomfortDetail}</span>{/if}</div>
      {:else if kind === 'sleep'}
        <div class="row"><b>{r.name}</b></div>
      {:else}
        <div class="row"><b>{r.name}</b> <span>RPE {r.rpe}</span></div>
      {/if}
    {/each}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={closeWellnessAlertModal}>{t('att.close')}</button>
  </div>
</Modal>
