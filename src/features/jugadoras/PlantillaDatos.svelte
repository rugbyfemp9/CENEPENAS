<script>
  // Pestaña "Datos" de Jugadoras: filtro por posición, menú de ordenar y la tabla de
  // miembros (#plantilla-grid).
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import {
    plantilla, posicionLabel, setPlantillaPositionFilter, togglePlantillaSortMenu,
    closePlantillaSortMenu, setPlantillaSort,
  } from './jugadoras.svelte.js';

  const SORTS = [
    ['alfabetico', 'plantilla.sortAlpha'],
    ['nacimiento', 'plantilla.birthdate'],
    ['comision', 'plantilla.commission'],
    ['tarjetas', 'plantilla.sortCardsDesc'],
  ];

  let sortWrap;
  // Cierra el menú de ordenar si se toca fuera de él.
  function onDocumentClick(e) {
    if (!sortWrap.contains(e.target)) closePlantillaSortMenu();
  }
</script>

<svelte:document onclick={onDocumentClick} />

<div id="plantilla-panel-datos" style:display={plantilla.activeTab === 'datos' ? null : 'none'}>
  <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
    <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('plantilla.positionLabel')}</span>
      <select id="plantilla-position-filter" onchange={(e) => setPlantillaPositionFilter(e.currentTarget.value)} style="font-family:'Roboto',sans-serif; font-size:13px; padding:6px 10px; border-radius:8px; border:1.5px solid var(--line); color:var(--navy); background:var(--white); text-transform:none; font-weight:500;">
        <option value="">{t('plantilla.allPositions')}</option>
        <option value="delantera">{t('plantilla.posForward')}</option>
        <option value="3/4">3/4</option>
      </select>
    </label>
    <div class="sort-menu-wrap" bind:this={sortWrap}>
      <button class="cal-open-btn" class:active={plantilla.sortMenuOpen} id="plantilla-sort-btn" onclick={togglePlantillaSortMenu} aria-label={t('plantilla.sort')} title={t('plantilla.sort')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
      </button>
      <div class="sort-menu" class:active={plantilla.sortMenuOpen} id="plantilla-sort-menu">
        {#each SORTS as [sort, key]}
          <button type="button" data-sort={sort} class:active={plantilla.sortBy === sort} onclick={() => setPlantillaSort(sort)}>{t(key)}</button>
        {/each}
      </div>
    </div>
  </div>
  <div class="card players-table-card">
    <table class="players-table">
      <thead>
        <tr>
          <th>{t('fines.player')}</th>
          <th>{t('plantilla.birthdate')}</th>
          <th>{t('plantilla.role')}</th>
          <th>{t('plantilla.rango')}</th>
          <th>{t('plantilla.positionLabel')}</th>
          <th>{t('plantilla.commission')}</th>
          <th>{t('plantilla.license')}</th>
          <th id="plantilla-th-actions" style:display={plantilla.showActions ? null : 'none'}>{t('att.edit')}</th>
        </tr>
      </thead>
      <tbody id="plantilla-grid">
        {#if plantilla.grid.rows}
          {#each plantilla.grid.rows as row}
            <tr>
              <td>
                <div class="col-player">
                  <span class="avatar"><Avatar {...row.avatar} /></span>
                  <b>{row.shownName}</b>
                </div>
              </td>
              <td class={row.birthdate ? '' : 'muted-cell'}>{row.birthdate || t('plantilla.unassigned')}</td>
              <td class={row.rol ? '' : 'muted-cell'}>{row.rol || t('plantilla.unassigned')}</td>
              <td class={row.esJugadora && row.rango ? '' : 'muted-cell'}>{row.esJugadora ? (row.rango || t('plantilla.unassigned')) : '—'}</td>
              <td class={row.esJugadora && row.posicion ? '' : 'muted-cell'}>{row.esJugadora ? (posicionLabel(row.posicion) === '—' ? t('plantilla.unassigned') : posicionLabel(row.posicion)) : '—'}</td>
              <td class={row.esJugadora && row.comision ? '' : 'muted-cell'}>{row.esJugadora ? (row.comision || t('plantilla.unassigned')) : '—'}</td>
              <td class={row.licencia ? '' : 'muted-cell'}>{row.licencia || t('plantilla.unassigned')}</td>
              {#if row.editable}<td><button class="btn-ghost" style="padding:4px 10px; font-size:12px;" onclick={() => legacy.openEditProfileModal(row.id)}>{t('att.edit')}</button></td>{/if}
            </tr>
          {/each}
        {:else}
          <tr><td colspan={plantilla.grid.colspan}><div class="att-roster-empty">{t(plantilla.grid.key, plantilla.grid.vars)}</div></td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
