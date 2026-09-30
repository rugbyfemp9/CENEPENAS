<script>
  import Modal from '../../lib/Modal.svelte';
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { ranking } from './test.svelte.js';
</script>

<Modal id="test-ranking-modal" bind:open={ranking.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">{t('test.rankingTitle')}</h3>
  <div id="test-ranking-list">
    {#if ranking.status === 'loading'}
      <div class="gym-routine-empty" style="padding:14px 0;">{t('test.rankingLoading')}</div>
    {:else if ranking.status === 'error'}
      <div class="gym-routine-empty" style="padding:14px 0;">{t('test.rankingError')}</div>
    {:else if ranking.status === 'empty'}
      <div class="gym-routine-empty" style="padding:14px 0;">{t('test.rankingEmpty')}</div>
    {:else if ranking.status === 'ok'}
      {#each ranking.rows as row, i (i)}
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
          <span style="font-family:'Oswald',sans-serif; font-weight:700; width:20px; text-align:center; color:var(--text-muted); flex-shrink:0;">{i + 1}</span>
          <span class="avatar"><Avatar url={row.avatarUrl} fallback={row.initials} /></span>
          <b style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{row.name}</b>
          <span style="font-weight:700; color:var(--navy); flex-shrink:0;">{row.points} {t('test.pointsAbbr')}</span>
        </div>
      {/each}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={() => (ranking.open = false)}>{t('att.close')}</button>
  </div>
</Modal>
