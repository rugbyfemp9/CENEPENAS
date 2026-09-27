<script>
  // Tercer tiempo → "Pasados": partidos en casa ya jugados, del más reciente al más antiguo.
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import MatchRow from './MatchRow.svelte';
  import { tercer } from './tercer-tiempo.svelte.js';

  const history = $derived(tercer.history);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('tercer')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('tercer.title')}</span></div>
<div class="section-head"><h2>{t('tercer.past')}</h2></div>
<div id="tercer-history-list">
  {#if history}
    {#if history.rows.length === 0}
      <div class="att-roster-empty">{history.emptyText}</div>
    {:else}
      {#each history.rows as row}<MatchRow {row} origin="tercer-historial" />{/each}
    {/if}
  {/if}
</div>
