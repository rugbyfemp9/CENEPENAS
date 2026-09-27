<script>
  // Banner "Próximo partido" de Inicio (con "Recuerda" y "Lista" el día de partido).
  import { t } from '../../lib/i18n.svelte.js';
  import { nextMatchBanner as b, goToNextMatch, onNextMatchCtaClick } from './partidos.svelte.js';
  import { openMatchdayChecklistModal } from './checklist.svelte.js';
  import { openRollCallModal } from './rollcall.svelte.js';
  import { openTullidesModalForNextMatch } from '../tullidas/tullidas.svelte.js';

  const isGameDay = $derived(b.kind === 'gameDay');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scoreboard" id="next-match-banner" onclick={goToNextMatch} style="cursor:pointer;">
  <button class="scoreboard-tullides-btn" id="next-match-tullides-btn" onclick={(event) => { event.stopPropagation(); openTullidesModalForNextMatch(); }} style:display={b.kind === 'none' ? 'none' : null} aria-label={t('att.tullidesButton')} title={t('att.tullidesButton')}>🩹</button>
  <div class="msg">
    <b id="next-match-title" class:game-day={isGameDay}>{isGameDay ? b.label : t('nextMatch.title')}</b>
    <span id="next-match-subtitle">{b.kind === 'none' ? t('nextMatch.subtitleNone') : (isGameDay ? b.when : `${b.label} · ${b.when}`)}</span>
  </div>
  <div class="right-group">
    <div class="chips" id="next-match-chips" style:display={isGameDay ? 'none' : null}>
      <div class="chip"><div class="n" id="next-match-confirmed">{b.kind === 'none' ? '—' : b.confirmed}</div><div class="l">{t('nextMatch.confirmed')}</div></div>
    </div>
    <button class="scoreboard-cta" id="next-match-cta" onclick={onNextMatchCtaClick} style:display={b.kind === 'upcoming' && b.showCta ? null : 'none'}>{t('nextMatch.confirmCta')}</button>
    <span class={b.statusClass ? `scoreboard-status ${b.statusClass}` : 'scoreboard-status'} id="next-match-status" style:display={b.kind === 'upcoming' && b.showStatus ? null : 'none'}>{b.statusKey ? t(b.statusKey) : ''}</span>
    <div class="game-day-actions" id="game-day-actions" style:display={isGameDay ? null : 'none'}>
      <button class="scoreboard-cta" onclick={(event) => { event.stopPropagation(); openMatchdayChecklistModal(); }}>{t('nextMatch.remindCta')}</button>
      <button class="scoreboard-cta" onclick={(event) => { event.stopPropagation(); openRollCallModal(); }}>{t('nextMatch.listCta')}</button>
    </div>
  </div>
</div>
