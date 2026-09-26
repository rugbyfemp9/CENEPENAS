<script>
  // Aviso de Inicio "X ha compartido contigo su alineación" (ver
  // checkInicioSharedLineupBanner). El texto se traduce solo al cambiar de idioma.
  import { t } from '../../lib/i18n.svelte.js';
  import { sharedBanner, openInicioSharedLineup, dismissInicioSharedLineupBanner } from './fantasy.svelte.js';

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Los nombres van escapados: la plantilla de la traducción es nuestra, pero el
  // nombre de quien publica y el del partido vienen de Supabase.
  const html = $derived(sharedBanner.text
    ? t('sharedLineup.text', {
        name: `<b>${escapeHtml(sharedBanner.text.publisherName ?? t('sharedLineup.someone'))}</b>`,
        match: `<b>${escapeHtml(sharedBanner.text.matchLabel ?? t('sharedLineup.nextMatchFallback'))}</b>`,
      })
    : '');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="inicio-shared-lineup-banner" id="inicio-shared-lineup-banner" style:display={sharedBanner.visible ? null : 'none'} onclick={openInicioSharedLineup}>
  <div class="icon">🏉</div>
  <div class="txt" id="inicio-shared-lineup-text">{@html html}</div>
  <button type="button" class="dismiss" onclick={dismissInicioSharedLineupBanner} aria-label={t('sharedLineup.dismiss')} title={t('sharedLineup.dismissShort')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
</div>
