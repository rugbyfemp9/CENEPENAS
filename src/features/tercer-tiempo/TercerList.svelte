<script>
  // Vestuario → Tercer tiempo: próximos partidos en casa con mi rol y su estado.
  import { t } from '../../lib/i18n.svelte.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import MatchRow from './MatchRow.svelte';
  import GroupPreviewCol from './GroupPreviewCol.svelte';
  import { tercer, openThirdTimeGroupsOverviewModal } from './tercer-tiempo.svelte.js';

  const list = $derived(tercer.list);
  // El botón "grupo" (integrantes de cada grupo) solo tiene sentido si hay próximos
  // partidos en la lista; si no hay ninguno, esa misma información ya se muestra
  // directamente en la página, así que el botón se oculta.
  const showGroupsBtn = $derived(!!list && list.rows.length > 0);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('tercer.title')}</h2>
  <div style="display:flex; gap:8px;">
    <button class="cal-open-btn" id="tt-groups-btn" onclick={openThirdTimeGroupsOverviewModal} aria-label={t('tercer.viewGroupsAria')} title={t('tercer.viewGroups')} style="display:none;" style:display={showGroupsBtn ? null : 'none'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M16 8a3 3 0 100-6"/><path d="M23 20c0-2.7-2-4.9-4.7-5.7"/></svg>
    </button>
    <button class="cal-open-btn" onclick={() => setSection('tercer-historial')} aria-label={t('tercer.viewPastAria')} title={t('tercer.viewPast')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
    </button>
  </div>
</div>
<div id="tercer-list">
  {#if list}
    {#if list.rows.length === 0}
      <div class="att-roster-empty" style="margin-bottom:14px;">{list.emptyText}</div>
      <div class="tt-groups-preview">
        {#each list.cols as col}<GroupPreviewCol {col} />{/each}
      </div>
    {:else}
      {#each list.rows as row}<MatchRow {row} origin="tercer" />{/each}
    {/if}
  {/if}
</div>
