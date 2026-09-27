<script>
  // PARTIDO: DETALLE (de momento, solo su acta).
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import ActaCard from '../actas/ActaCard.svelte';
  import { partidoDetalle } from './partidos.svelte.js';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('partidos')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.partidos')}</span></div>
<div class="section-head"><h2 id="partido-detalle-title">{partidoDetalle.title ?? t('partido.defaultTitle')}</h2></div>

<ActaCard />
