<script>
  // Vestuario → Partidos: una tarjeta por partido de la temporada, en orden de fecha.
  import { t } from '../../lib/i18n.svelte.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import { partidosListView, openPartidoDetail } from './partidos.svelte.js';

  const matches = $derived(partidosListView());
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head"><h2>{t('nav.partidos')}</h2></div>
<div id="partidos-list">
  {#if matches}
    {#each matches as ev}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="att-event att-event--match" onclick={() => openPartidoDetail(ev.id)}>
        <div class="left">
          <div class="cal-date"><div class="d">{ev.date}</div><div class="m">{ev.month}</div></div>
          <div class="info">
            <b>{ev.label}</b>
            <span>{ev.when}</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="att-roster-empty">{t('att.noMatchesScheduled')}</div>
    {/each}
  {/if}
</div>
