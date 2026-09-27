<script>
  // Pestaña "Histórico y tendencias" del panel de Cos Tècnic: evolución de los últimos
  // 30 días (equipo o jugadora) y carga acumulada semanal (sRPE).
  import { t } from '../../lib/i18n.svelte.js';
  import { history, onWellnessEvoPlayerChange, openWellnessPlayerHistoryModal } from './wellness-history.svelte.js';
  import EvoChart from './EvoChart.svelte';
</script>

<!-- EVOLUCIÓN INDIVIDUAL / EQUIPO: línea temporal de los últimos 30 días
     (ver EvoChart.svelte). -->
<div class="card wstaff-evo-card">
  <div class="wstaff-evo-head">
    <h3>{t('wstaff.evoTitle')}</h3>
    <label class="wstaff-evo-select-wrap">
      <span>{t('wstaff.evoPlayerLabel')}</span>
      <select id="wstaff-evo-player-select" value={history.evoSelected} onchange={(e) => onWellnessEvoPlayerChange(e.currentTarget.value)}>
        {#if history.evoPlayers}
          <option value="team">{t('wstaff.evoTeamOption')}</option>
          {#each history.evoPlayers as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        {/if}
      </select>
    </label>
  </div>
  <div class="wstaff-evo-summary-grid">
    <div class="wstaff-evo-summary-item"><span id="wstaff-evo-sum-sessions">{history.summary.sessions}</span><small>{t('wstaff.evoSumSessions')}</small></div>
    <div class="wstaff-evo-summary-item"><span id="wstaff-evo-sum-avgrpe">{history.summary.avgRpe}</span><small>{t('wstaff.evoSumAvgRpe')}</small></div>
    <div class="wstaff-evo-summary-item"><span id="wstaff-evo-sum-load">{history.summary.load}</span><small>{t('wstaff.evoSumLoad')}</small></div>
    <div class="wstaff-evo-summary-item warn"><span id="wstaff-evo-sum-sleep">{history.summary.sleep}</span><small>{t('wstaff.evoSumSleep')}</small></div>
    <div class="wstaff-evo-summary-item bad"><span id="wstaff-evo-sum-discomfort">{history.summary.discomfort}</span><small>{t('wstaff.evoSumDiscomfort')}</small></div>
  </div>
  <div class="wstaff-evo-chart-wrap" id="wstaff-evo-chart">{#if history.evoPoints?.length}<EvoChart points={history.evoPoints} />{/if}</div>
  <div class="wstaff-empty-state" id="wstaff-evo-chart-empty" style:display={history.evoPoints && !history.evoPoints.length ? null : 'none'}>{t('wstaff.evoNoData')}</div>
</div>

<!-- CARGA ACUMULADA SEMANAL: sumatorio de sRPE por jugadora y semana, para
     detectar picos de sobrecarga. -->
<div class="card wstaff-table-card wstaff-week-card">
  <div class="wstaff-week-head"><h3>{t('wstaff.weekTitle')}</h3></div>
  <table class="wstaff-table wstaff-week-table">
    <thead><tr id="wstaff-week-thead">
      {#if history.weekLabels}
        <th>{t('wstaff.colPlayer')}</th><th class="num">{t('wstaff.weekTotal')}</th>{#each history.weekLabels as label}<th class="num">{label}</th>{/each}<th class="num">{t('wstaff.weekHistoryCol')}</th>
      {/if}
    </tr></thead>
    <tbody id="wstaff-week-tbody">
      {#each history.weekRows as row}
        <tr>
          <td class="col-player"><b>{row.name}</b></td>
          <td class="num"><b>{row.grandTotal}</b></td>
          {#each row.cells as cell}
            <td class="num wstaff-week-cell {cell.cls}">{cell.val || '—'}</td>
          {/each}
          <td class="num"><button type="button" class="wstaff-history-btn" onclick={() => openWellnessPlayerHistoryModal(row.id)} aria-label={t('wstaff.weekHistoryBtn')} title={t('wstaff.weekHistoryBtn')}>📄</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="wstaff-empty-state" id="wstaff-week-empty" style:display={history.weekEmptyShown ? null : 'none'}>{t('wstaff.weekNoData')}</div>
</div>
