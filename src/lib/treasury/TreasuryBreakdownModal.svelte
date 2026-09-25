<script>
  // Desglose del saldo por integrante de la comisión (se calcula al abrirlo).
  import Modal from '../Modal.svelte';
  import Avatar from '../Avatar.svelte';
  import { t } from '../i18n.svelte.js';
  import { formatEuro } from '../format.js';

  let { treasury, id, listId, sub } = $props();
  const breakdown = $derived(treasury.breakdown);
</script>

<Modal {id} bind:open={breakdown.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('comi.breakdownTitle')}</h3>
  <div class="modal-sub">{sub}</div>
  <div class="tv-breakdown-list" id={listId}>
    {#if !breakdown.rows.length}
      <div class="treasury-table-empty">{treasury.messages.noMembersNoEntries}</div>
    {:else}
      {#each breakdown.rows as r, i (i)}
        <div class="tv-breakdown-row {r.unassigned ? 'unassigned' : ''}">
          <div class="avatar">{#if r.unassigned}—{:else}<Avatar url={r.avatarUrl} fallback={r.initials} injured={r.injured} injuryIcon={r.injuryIcon} />{/if}</div>
          <div class="meta">
            <b>{r.shownName}</b>
            <span>{r.count} movimiento{r.count === 1 ? '' : 's'}</span>
          </div>
          <div class="net {r.netClass}">{r.sign}{formatEuro(Math.abs(r.net))}</div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={treasury.closeBreakdown}>{t('att.close')}</button>
  </div>
</Modal>
