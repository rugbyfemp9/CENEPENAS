<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { sharedModal, closeSharedLineupsModal, loadSharedLineup } from './fantasy.svelte.js';
</script>

<Modal id="shared-lineups-modal" bind:open={sharedModal.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('fantasy.sharedWithYou')}</h3>
  <div class="fantasy-saved-list" id="shared-lineups-list">
    {#if sharedModal.status === 'loading'}
      <div class="fantasy-saved-empty">Cargando…</div>
    {:else if sharedModal.status === 'empty'}
      <div class="fantasy-saved-empty">Todavía no hay alineaciones compartidas contigo para este partido.</div>
    {:else if sharedModal.status === 'list'}
      {#each sharedModal.items as it (it.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="shared-lineup-item" onclick={() => loadSharedLineup(it.id)}>
          <div class="info">
            <b>{it.name}</b>
            <span>{it.publisherName} · para {it.audienceLabel}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeSharedLineupsModal}>{t('att.close')}</button>
  </div>
</Modal>
