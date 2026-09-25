<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import Avatar from '../../lib/Avatar.svelte';
  import {
    gymAttendanceToday, openGymCheckinModal, cancelGymCheckin, ranking, gymRankingExercises, gymRankingRows,
  } from './gym.svelte.js';

  const attendance = $derived(gymAttendanceToday());
  const myEntry = $derived(attendance.find((e) => e.playerId === legacy.currentUserId));

  const rankingExercises = $derived(gymRankingExercises());
  // Sin nada elegido (o si lo elegido ya no está), el desplegable muestra el primero.
  const rankingExercise = $derived(rankingExercises.includes(ranking.exercise) ? ranking.exercise : rankingExercises[0]);
  const rows = $derived(gymRankingRows(rankingExercise));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('gym')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.gym')}</span></div>
<div class="section-head"><h2>{t('gym.team')}</h2></div>

<div class="card" style="margin-bottom:16px;">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
    <h3 style="margin:0; font-size:15px; text-transform:uppercase;">{t('gym.gymAttendanceToday')}</h3>
    <button class="cal-open-btn small" id="gym-checkin-btn" onclick={openGymCheckinModal} aria-label={t('gym.signUpToday')} title={t('gym.signUpToday')} style:display={myEntry ? 'none' : 'flex'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  </div>
  <div id="gym-attendance-today">
    {#if !attendance.length}
      <div class="att-roster-empty">Todavía no se ha apuntado nadie hoy.</div>
    {:else}
      {#each attendance as e, i (i)}
        {@const p = legacy.rosterById[e.playerId]}
        {#if p}
          <div class="gym-attendee-row">
            <span class="avatar"><Avatar url={p.avatarUrl} fallback={legacy.initials(legacy.displayName(p))} injured={p.injured} injuryIcon={p.injuryIcon} /></span>
            <div class="meta"><b>{legacy.displayName(p)}</b></div>
            <span class="time">{e.time}</span>
            {#if e.playerId === legacy.currentUserId}
              <button class="cancel-btn" onclick={cancelGymCheckin} aria-label="Quitarme de hoy" title="Quitarme de hoy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<div class="card" style="padding:0; overflow:hidden;">
  <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:16px 16px 12px;">
    <h3 style="margin:0; font-size:15px; text-transform:uppercase;">{t('gym.ranking')}</h3>
    <select id="gym-ranking-exercise" value={rankingExercise} onchange={(e) => { ranking.exercise = e.currentTarget.value; }} style="font-family:'Roboto',sans-serif; font-size:12.5px; padding:6px 10px; border-radius:9px; border:1.5px solid var(--line); color:var(--navy); background:var(--white);">
      {#each rankingExercises as ex (ex)}<option value={ex}>{ex}</option>{/each}
    </select>
  </div>
  <div class="liga-table-scroll">
    <table class="treasury-table gym-ranking-table">
      <thead>
        <tr><th>{t('gym.colHash')}</th><th>{t('nav.plantilla')}</th><th>{t('gym.colMarkRm')}</th><th>{t('gym.colUpdated')}</th></tr>
      </thead>
      <tbody id="gym-ranking-table-body">
        {#if !rows.withRecord.length && !rows.without.length}
          <tr><td colspan="4"><div class="att-roster-empty">Todavía no hay nadie en la plantilla.</div></td></tr>
        {:else}
          {#each rows.withRecord as entry, i (i)}
            <tr class={i === 0 ? 'gym-rank-top' : ''}>
              <td class="rank-cell">{i + 1}</td>
              <td class="player-row"><div class="meta"><b>{legacy.displayName(entry.p)}</b></div></td>
              <td class="weight-cell">{entry.weight} kg</td>
              <td class="updated-cell">{entry.updatedAt ? legacy.formatShortDate(entry.updatedAt) : '—'}</td>
            </tr>
          {/each}
          {#each rows.without as entry, i (i)}
            <tr>
              <td class="rank-cell">—</td>
              <td class="player-row"><div class="meta"><b>{legacy.displayName(entry.p)}</b></div></td>
              <td class="weight-cell no-rm">Sin registrar</td>
              <td class="updated-cell">—</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
