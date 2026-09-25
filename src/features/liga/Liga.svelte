<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import TeamCrest from './TeamCrest.svelte';
  import { LEAGUE_OWN_TEAM, LEAGUE_STANDINGS, LEAGUE_RESULTS } from './liga.js';

  let tab = $state('clasificacion');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('nav.liga')}</h2>
  <span style="font-size:12px; color:var(--text-muted); font-weight:600;">Divisió d'Honor Catalana AON</span>
</div>

<div class="simple-tabs liga-tabs">
  <button class:active={tab === 'clasificacion'} data-liga-tab="clasificacion" onclick={() => (tab = 'clasificacion')}>{t('liga.tabStandings')}</button>
  <button class:active={tab === 'resultados'} data-liga-tab="resultados" onclick={() => (tab = 'resultados')}>{t('liga.tabResults')}</button>
</div>

<!-- rugby.cat bloquea que su widget (matchready.es) se incruste en otras páginas
     (X-Frame-Options), así que no es viable mostrarlo en directo aquí dentro.
     Esta tabla es una foto fija de los datos; para verla siempre al día usa el
     enlace de abajo, o pídeme que la actualice y la repaso a mano. -->
<div class="liga-panel" class:active={tab === 'clasificacion'} id="liga-panel-clasificacion">
  <div class="card liga-table-card">
    <div class="liga-table-scroll">
      <table class="liga-table" id="liga-standings-table">
        <thead>
          <tr><th>#</th><th style="text-align:left;">{t('liga.teamCol')}</th><th>J</th><th>G</th><th>E</th><th>P</th><th>PF</th><th>PC</th><th>DP</th><th>AF</th><th>AC</th><th>BO</th><th>BD</th><th>Pts</th></tr>
        </thead>
        <tbody>
          {#each LEAGUE_STANDINGS as row (row.team)}
            <tr class={row.team === LEAGUE_OWN_TEAM ? 'liga-own-team' : ''}>
              <td class="liga-pos">{row.pos}</td>
              <td class="liga-team"><TeamCrest name={row.team} />{row.team}</td>
              <td>{row.j}</td><td>{row.g}</td><td>{row.e}</td><td>{row.p}</td>
              <td>{row.pf}</td><td>{row.pc}</td><td>{row.dp > 0 ? '+' : ''}{row.dp}</td>
              <td>{row.af}</td><td>{row.ac}</td><td>{row.bo}</td><td>{row.bd}</td>
              <td class="liga-pts">{row.pts}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="liga-panel" class:active={tab === 'resultados'} id="liga-panel-resultados">
  <div id="liga-results-list">
    {#each LEAGUE_RESULTS as round (round.jornada)}
      <div class="liga-jornada-heading">{round.jornada}</div>
      {#each round.matches as m, i (i)}
        <div class="liga-match {m.home === LEAGUE_OWN_TEAM || m.away === LEAGUE_OWN_TEAM ? 'liga-own-match' : ''}">
          <div class="teams"><TeamCrest name={m.home} />{m.home} <span class="score">{m.score}</span> {m.away}<TeamCrest name={m.away} /></div>
          <div class="date">{m.date}</div>
        </div>
      {/each}
    {/each}
  </div>
</div>

<div class="liga-source-note">
  <span>{t('liga.sourceNotePrefix')}</span> <a href="https://rugby.cat/dhc-femenina/divisio-dhonor-catalana-aon/" target="_blank" rel="noopener">rugby.cat</a><span>{t('liga.sourceNoteSuffix')}</span>
</div>
