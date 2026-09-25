<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import {
    dayDetail, setGymRoutineDayGroup, asText, quickCalc, gymQuickCalcPercents, gymAllExercises,
    gymQuickCalcSelectedPlayer, gymQuickCalcResult, toggleGymQuickCalcPlayerMenu, closeGymQuickCalcPlayerMenu,
    selectGymQuickCalcPlayer, goToGymMarks, rmCalc, toggleGymRmCalcBanner, closeGymRmCalcBanner, calculateGymRmTable,
  } from './gym.svelte.js';

  const exercises = $derived(gymAllExercises());
  // Si el ejercicio elegido deja de existir (lo ha eliminado alguien), la calculadora
  // vuelve a "Elige un ejercicio", como al repintar el desplegable antes.
  $effect(() => {
    if (quickCalc.exercise !== '' && !exercises.includes(quickCalc.exercise)) quickCalc.exercise = '';
  });
  const result = $derived(gymQuickCalcResult(exercises.includes(quickCalc.exercise) ? quickCalc.exercise : ''));
  const badgePlayer = $derived.by(() => {
    const player = gymQuickCalcSelectedPlayer();
    return !player || player.id === legacy.currentUserId ? null : player;
  });

  let playerWrap;
  // Cierra el desplegable de "cambiar jugadora" de la calculadora rápida si se hace
  // clic fuera de él.
  function onDocumentClick(e) {
    if (playerWrap && !playerWrap.contains(e.target)) closeGymQuickCalcPlayerMenu();
  }
</script>

<svelte:document onclick={onDocumentClick} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('gym-entrenamiento')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('gym.myTraining')}</span></div>
<div class="section-head"><h2 id="gym-routine-day-detalle-title">{dayDetail.n === null ? 'Día 1' : t('gym.dayLabel', { n: dayDetail.n })}</h2></div>

<div class="card">
  <span id="gym-routine-day-detalle-focus" style="display:block; font-size:11.5px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.02em; margin-bottom:12px;">{dayDetail.focus}</span>
  <div id="gym-routine-day-detalle-split-note" class="gym-split-note" style:display={dayDetail.splitVisible ? 'inline-flex' : 'none'}><span class="dot"></span><span id="gym-routine-day-detalle-split-note-text">{dayDetail.splitKey ? t(dayDetail.splitKey) : ''}</span></div>
  <div class="gym-day-group-tabs">
    <button class="gym-day-group-tab" class:active={dayDetail.group === 'forwards'} data-group="forwards" onclick={() => setGymRoutineDayGroup('forwards')}>Forwards</button>
    <button class="gym-day-group-tab" class:active={dayDetail.group === 'backs'} data-group="backs" onclick={() => setGymRoutineDayGroup('backs')}>Backs</button>
  </div>
  <table class="gym-exercise-table">
    <thead>
      <tr>
        <th>{t('gym.colExercise')}</th>
        <th class="num">{t('gym.colSeries')}</th>
        <th>{t('gym.colReps')}</th>
        <th>{t('gym.colLoad')}</th>
        <th>{t('gym.colRest')}</th>
      </tr>
    </thead>
    <tbody id="gym-routine-day-detalle-exercises">
      {#if dayDetail.exercises && !dayDetail.exercises.length}
        <tr><td colspan="5" class="modal-sub" style="padding:14px 8px;">No hay ejercicios registrados para este grupo en este día.</td></tr>
      {:else if dayDetail.exercises}
        {#each dayDetail.exercises as ex, i (i)}
          <tr>
            <td class="name">{asText(ex.name)}</td>
            <td class="num">{asText(ex.sets)}</td>
            <td class="muted">{asText(ex.reps)}</td>
            <td class="muted">{asText(ex.load)}</td>
            <td class="muted">{asText(ex.rest || '—')}</td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  <div class="gym-quick-calc-inline">
    <div class="gym-quick-calc-head">
      <h3 style="margin:0 0 4px; font-size:13.5px; text-transform:uppercase;">{t('gym.quickCalc')}</h3>
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="gym-quick-calc-player" id="gym-quick-calc-player" bind:this={playerWrap}>
          <button type="button" class="cal-open-btn small" id="gym-quick-calc-player-btn" onclick={toggleGymQuickCalcPlayerMenu} aria-label={t('gym.changePlayer')} title={t('gym.changePlayer')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
          <div class="gym-quick-calc-player-menu" class:open={quickCalc.menuOpen} id="gym-quick-calc-player-menu">
            {#each quickCalc.menuPlayers as p, i (i)}
              <button type="button" class="gym-quick-calc-player-option{p.selected ? ' selected' : ''}" onclick={() => selectGymQuickCalcPlayer(p.id)}>
                <span>{p.name}</span>
                {#if p.selected}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>{/if}
              </button>
            {/each}
          </div>
        </div>
        <button type="button" class="cal-open-btn small" id="gym-rm-calc-toggle-btn" onclick={toggleGymRmCalcBanner} aria-label={t('gym.advancedRmCalc')} title={t('gym.advancedRmCalc')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        </button>
      </div>
    </div>
    <div class="gym-rm-calc-banner" id="gym-rm-calc-banner" style:display={rmCalc.open ? 'block' : 'none'}>
      <div class="gym-rm-calc-banner-head">
        <h4>{t('gym.rmCalcTitle')}</h4>
        <button type="button" class="modal-close" onclick={closeGymRmCalcBanner} aria-label={t('att.close')}>✕</button>
      </div>
      <p class="modal-sub" style="margin-bottom:14px;">{t('gym.rmCalcSub')}</p>
      <div class="gym-rm-calc-inputs">
        <label>
          <span>{t('gym.known1rm')}</span>
          <input type="number" id="gym-calc-1rm" placeholder="80" min="0" step="0.5" bind:value={rmCalc.oneRm}>
        </label>
        <span class="gym-rm-calc-or">{t('gym.or')}</span>
        <label>
          <span>{t('gym.liftedWeight')}</span>
          <input type="number" id="gym-calc-weight" placeholder="70" min="0" step="0.5" bind:value={rmCalc.weight}>
        </label>
        <label>
          <span>{t('gym.colReps')}</span>
          <input type="number" id="gym-calc-reps" placeholder="5" min="1" max="15" step="1" bind:value={rmCalc.reps}>
        </label>
      </div>
      <button class="btn" style="margin-top:12px;" onclick={calculateGymRmTable}>{t('gym.calculate')}</button>
      <div id="gym-rm-calc-result">
        {#if rmCalc.result && rmCalc.result.oneRm === null}
          <div class="modal-sub" style="margin-top:12px;">Escribe tu 1RM, o un peso y unas repeticiones, para calcularlo.</div>
        {:else if rmCalc.result}
          <table class="gym-rm-calc-table">
            <tbody>
              {#each gymQuickCalcPercents as pct (pct)}
                <tr class={pct === 100 ? 'gym-rm-100' : ''}>
                  <td class="pct">{pct}%</td>
                  <td class="kg">{(rmCalc.result.oneRm * pct / 100).toFixed(1)} kg</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
    <p class="modal-sub" style="margin-bottom:10px;">{t('gym.quickCalcSub')}</p>
    <div id="gym-quick-calc-player-badge" class="gym-quick-calc-player-badge" style:display={badgePlayer ? 'inline-flex' : 'none'}>
      {#if badgePlayer}
        <span>Calculando la marca de <b>{legacy.displayName(badgePlayer)}</b></span>
        <button type="button" onclick={() => selectGymQuickCalcPlayer(legacy.currentUserId)} aria-label="Volver a tu calculadora" title="Volver a tu calculadora">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      {/if}
    </div>
    <div class="gym-rm-calc-inputs">
      <label>
        <span>{t('gym.colExercise')}</span>
        <select id="gym-quick-calc-exercise" bind:value={quickCalc.exercise}>
          <option value="">Elige un ejercicio</option>
          {#each exercises as ex (ex)}<option value={ex}>{ex}</option>{/each}
        </select>
      </label>
      <label>
        <span>{t('gym.pctOfRm')}</span>
        <select id="gym-quick-calc-pct" bind:value={quickCalc.pct}>
          <option value="">%</option>
          {#each gymQuickCalcPercents as pct (pct)}<option value={String(pct)}>{pct}%</option>{/each}
        </select>
      </label>
    </div>
    <div id="gym-quick-calc-result">
      {#if quickCalc.shown}
        {#if result.kind === 'prompt'}
          <div class="gym-quick-calc-empty">Elige un ejercicio y un % para calcular.</div>
        {:else if result.kind === 'noMarkMine'}
          <div class="gym-quick-calc-empty">
            Todavía no tienes una marca (1RM) registrada para <b>{result.exercise}</b>.
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
            <a onclick={goToGymMarks}>Regístrala en Mis Marcas ›</a>
          </div>
        {:else if result.kind === 'noMarkTheirs'}
          <div class="gym-quick-calc-empty">
            <b>{result.name}</b> todavía no tiene una marca (1RM) registrada para <b>{result.exercise}</b>.
          </div>
        {:else}
          <div class="gym-quick-calc-out">
            <span class="pct">{result.pct}% de {result.isMe ? 'tu' : `la de ${result.name}`} {result.exercise}</span>
            <span class="kg">{result.kg} kg</span>
            <span class="raw">Exacto: {result.raw} kg · {result.isMe ? 'tu marca' : 'su marca'}: {result.weight} kg</span>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>
