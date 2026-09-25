<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { notices, openAddNoticeModal, deleteNotice } from './avisos.svelte.js';
</script>

<div class="card" id="inicio-notices-card">
  <div class="section-head" style="margin-bottom:14px;">
    <h3 style="margin:0; text-transform:uppercase; font-size:16px;">{t('notices.title')}</h3>
    <button class="cal-open-btn small" onclick={openAddNoticeModal} aria-label={t('notices.add')} title={t('notices.add')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  </div>
  <div id="notices-list">
    {#if notices.status === 'loading'}
      <div class="notices-empty">{t('notices.loading')}</div>
    {:else if notices.status === 'ok' && !notices.pinned.length}
      <div class="notices-empty">{t('notices.empty')}</div>
    {:else}
      {#each notices.pinned as n (n.id)}
        <div class="notice-card">
          <div class="notice-body">
            <div class="notice-text">{n.text}</div>
            <div class="notice-date">{n.byName ? n.byName + ' · ' : ''}{n.dateLabel}</div>
          </div>
          {#if n.mine}
            <button class="notice-delete-btn" onclick={() => deleteNotice(n.id)} aria-label={t('notices.delete')} title={t('notices.delete')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
