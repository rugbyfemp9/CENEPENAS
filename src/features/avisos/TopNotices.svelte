<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { notices, dismissBanner, deleteBannerPermanently } from './avisos.svelte.js';
</script>

{#each notices.banners as n (n.id)}
  <div class="inicio-top-notice-banner">
    <div class="icon">📢</div>
    <div class="txt">{n.text}</div>
    {#if n.mine}
      <button type="button" class="dismiss" onclick={() => deleteBannerPermanently(n.id)} aria-label={t('notices.delete')} title={t('notices.delete')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>
    {/if}
    <button type="button" class="dismiss" onclick={() => dismissBanner(n.id)} aria-label="Cerrar aviso" title="Cerrar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
{/each}
