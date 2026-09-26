<script>
  // Pestaña "Estadísticas" de Jugadoras: menú de ordenar y la tabla con los minutos,
  // ensayos, puntos y tarjetas de las actas (#plantilla-stats-grid).
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    plantilla, togglePlantillaStatsSortMenu, closePlantillaStatsSortMenu, setPlantillaStatsSort,
  } from './jugadoras.svelte.js';

  const SORTS = [
    ['alfabetico', 'plantilla.sortAlpha'],
    ['minutos', 'plantilla.minutesPlayed'],
    ['ensayos', 'plantilla.tries'],
    ['tarjetas', 'plantilla.cardsCount'],
    ['puntos', 'plantilla.points'],
  ];

  let sortWrap;
  // Cierra el menú de ordenar si se toca fuera de él.
  function onDocumentClick(e) {
    if (!sortWrap.contains(e.target)) closePlantillaStatsSortMenu();
  }
</script>

<svelte:document onclick={onDocumentClick} />

<div id="plantilla-panel-estadisticas" style:display={plantilla.activeTab === 'estadisticas' ? null : 'none'}>
  <div style="display:flex; justify-content:flex-end; margin-bottom:14px;">
    <div class="sort-menu-wrap" bind:this={sortWrap}>
      <button class="cal-open-btn" class:active={plantilla.statsSortMenuOpen} id="plantilla-stats-sort-btn" onclick={togglePlantillaStatsSortMenu} aria-label={t('plantilla.sort')} title={t('plantilla.sort')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
      </button>
      <div class="sort-menu" class:active={plantilla.statsSortMenuOpen} id="plantilla-stats-sort-menu">
        {#each SORTS as [sort, key]}
          <button type="button" data-sort={sort} class:active={plantilla.statsSortBy === sort} onclick={() => setPlantillaStatsSort(sort)}>{t(key)}</button>
        {/each}
      </div>
    </div>
  </div>
  <div class="card players-table-card">
    <table class="players-table">
      <thead>
        <tr>
          <th>{t('fines.player')}</th>
          <th class="num">{t('plantilla.minutesPlayed')}</th>
          <th class="num">{t('plantilla.tries')}</th>
          <th class="num">{t('plantilla.points')}</th>
          <th class="num">{t('plantilla.cardsCount')}</th>
        </tr>
      </thead>
      <tbody id="plantilla-stats-grid">
        {#if plantilla.statsGrid.rows}
          {#each plantilla.statsGrid.rows as s}
            <tr>
              <td>
                <div class="col-player">
                  <span class="avatar"><Avatar {...s.avatar} /></span>
                  <b>{s.name}</b>
                </div>
              </td>
              <td class="num">{s.minutes || '—'}</td>
              <td class="num">{s.tries || '—'}</td>
              <td class="num">{s.points || '—'}</td>
              <td class="num">{s.cards || '—'}</td>
            </tr>
          {/each}
        {:else}
          <tr><td colspan="5"><div class="att-roster-empty">{t(plantilla.statsGrid.key, plantilla.statsGrid.vars)}</div></td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
