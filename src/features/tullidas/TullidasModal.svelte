<script>
  // TULLIDAS: lista de jugadoras apuntadas para vendaje antes de un partido.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    tullidas, isMine, closeTullidesModal, addTullidesItem, removeTullidesItem,
  } from './tullidas.svelte.js';

  const rows = $derived(tullidas.byEventId[tullidas.eventId] || []);
</script>

<Modal id="tullides-modal" bind:open={tullidas.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;" id="tullides-modal-title">{t('att.tullidesTitle')}</h3>
  <div class="modal-sub" id="tullides-modal-sub" style="margin-bottom:14px;">{tullidas.sub}</div>
  <div class="tullides-list" id="tullides-list">
    {#if rows.length}
      {#each rows as row}
        <div class="tullides-row" data-tullides-id={row.id}>
          <div class="meta">
            <b>{row.player_name}</b>
            <span>{row.note}</span>
          </div>
          {#if isMine(row)}<button class="del" onclick={() => removeTullidesItem(row.id)} aria-label={t('att.delete')} title={t('att.delete')}>✕</button>{/if}
        </div>
      {/each}
    {:else if tullidas.eventId !== null}
      <div class="att-roster-empty">{t('att.tullidesEmpty')}</div>
    {/if}
  </div>
  <div class="tullides-add-row">
    <input type="text" id="tullides-input" maxlength="120" placeholder={t('att.tullidesPlaceholder')} bind:this={tullidas.input} onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTullidesItem(); } }}>
    <button onclick={addTullidesItem} aria-label={t('att.tullidesAdd')} title={t('att.tullidesAdd')}>+</button>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeTullidesModal}>{t('att.close')}</button>
  </div>
</Modal>
