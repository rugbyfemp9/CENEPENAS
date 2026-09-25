<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { quiz, startQuiz, exitQuiz, answer, next, openRanking } from './test.svelte.js';

  const OPTION_FIELDS = ['option_a', 'option_b', 'option_c', 'option_d'];
  const total = $derived(quiz.selected.length);
  const q = $derived(quiz.selected[quiz.index]);
  const answered = $derived(quiz.chosen !== null);
  const progress = $derived(((answered ? quiz.index + 1 : quiz.index) / total) * 100);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" id="test-back-vestuario" onclick={() => legacy.setSection('vestuario')} style:display={quiz.view === 'play' ? 'none' : null}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" id="test-back-intro" onclick={exitQuiz} style:display={quiz.view === 'play' ? null : 'none'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.test')}</span></div>
<div class="section-head">
  <h2>{t('nav.test')}</h2>
  <button class="cal-open-btn small" onclick={openRanking} aria-label={t('test.rankingAria')} title={t('test.rankingAria')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 19h20"/><path d="M3.5 19l-1-9.5 5 3.5 4.5-7 4.5 7 5-3.5-1 9.5"/></svg>
  </button>
</div>

<div id="test-quiz-intro" style:display={quiz.view === 'intro' ? null : 'none'}>
  <div class="card test-quiz-intro-card">
    <p>{t('test.introText')}</p>
    <button class="btn" onclick={startQuiz} disabled={quiz.loading}>{t('test.startBtn')}</button>
  </div>
</div>

<div id="test-quiz-play" style:display={quiz.view === 'play' ? null : 'none'}>
  {#if q}
    <div class="test-quiz-progress">
      <div class="test-quiz-progress-bar"><div class="fill" id="test-quiz-progress-fill" style:width="{progress}%"></div></div>
      <span id="test-quiz-progress-label">{quiz.index + 1} / {total}</span>
    </div>
    <div class="card test-quiz-card">
      <h3 id="test-quiz-question">{q.question}</h3>
      <div class="test-quiz-options" id="test-quiz-options">
        {#each OPTION_FIELDS as field, i (field)}
          <button
            type="button"
            class="test-quiz-option"
            class:disabled={answered}
            class:correct={answered && i === q.correct_index}
            class:incorrect={answered && i !== q.correct_index && i === quiz.chosen}
            data-index={i}
            onclick={() => answer(i)}
          >{q[field]}</button>
        {/each}
      </div>
      <div class="test-quiz-explanation" id="test-quiz-explanation" style:display={answered && q.explanation ? null : 'none'}>
        <b>{t('test.explanationLabel')}</b>
        <p id="test-quiz-explanation-text">{answered ? q.explanation : ''}</p>
      </div>
    </div>
    <button class="btn test-quiz-next-btn" id="test-quiz-next-btn" onclick={next} style:display={answered ? null : 'none'}>{quiz.index === total - 1 ? t('test.finishBtn') : t('test.nextBtn')}</button>
  {/if}
</div>

<div id="test-quiz-results" style:display={quiz.view === 'results' ? null : 'none'}>
  <div class="card test-quiz-intro-card">
    <div class="test-quiz-score" id="test-quiz-score">{quiz.score}/{total}</div>
    <p id="test-quiz-score-text">{t('test.resultDefault')}</p>
    <button class="btn" onclick={startQuiz}>{t('test.restartBtn')}</button>
  </div>
</div>
