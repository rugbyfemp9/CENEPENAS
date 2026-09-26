<script>
  // Histórico de multas pagadas (el icono de reloj de "Multas del equipo").
  import Modal from '../../lib/Modal.svelte';
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { historyModal, closeFinesHistoryModal, finesHistory } from './multas.svelte.js';

  const items = $derived(finesHistory());
</script>

<Modal id="fines-history-modal" bind:open={historyModal.open} boxStyle="max-width:440px;">
  <h3 style="margin-top:0;">{t('fines.history')}</h3>
  <div class="modal-sub">{t('fines.historySub')}</div>
  <div id="fines-history-list" style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin:14px 0 18px;">
    {#if items}
      {#if items.length === 0}
        <div style="color:var(--text-muted); text-align:center; padding:20px 0;">{t('fines.noHistoryYet')}</div>
      {:else}
        {#each items as f}
          <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--line); border-radius:10px;">
            <div class="avatar"><Avatar {...f.avatar} /></div>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:600; font-size:13.5px;">{f.name}</div>
              <div style="font-size:12px; color:var(--text-muted);">
                {f.reasonLabel} · {f.amount} €{#if f.paidToName} · {t('fines.paidToSuffix', { name: f.paidToName })}{/if}
              </div>
            </div>
            <div style="font-size:12px; color:var(--text-muted); white-space:nowrap;">{f.date}</div>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeFinesHistoryModal}>{t('att.close')}</button>
  </div>
</Modal>
