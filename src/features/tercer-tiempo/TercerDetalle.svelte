<script>
  // Tercer tiempo → detalle de un partido: mi rol, el grupo que cocina, mis cambios de
  // turno y la comida.
  import { t } from '../../lib/i18n.svelte.js';
  import PersonalBanner from './PersonalBanner.svelte';
  import SwapSummary from './SwapSummary.svelte';
  import FoodGrid from './FoodGrid.svelte';
  import { tercer, backFromTercerDetalle } from './tercer-tiempo.svelte.js';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={backFromTercerDetalle}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('tercer.title')}</span></div>
<div class="section-head"><h2 id="tercer-detalle-title">{tercer.detailTitle ?? t('tercer.title')}</h2></div>

<div class="tt-banner" id="tt-banner"><PersonalBanner /></div>

<div class="card swap-card" id="swap-summary-card"><SwapSummary /></div>

<div class="tt-food-section">
  <div class="fantasy-label" style="margin-bottom:10px;">{t('tercer.whatWeBring')}</div>
  <div class="tt-food-grid" id="tt-food-grid"><FoodGrid /></div>
</div>
