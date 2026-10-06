<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { setSection } from '../../shell/navigation.svelte.js';
  import { quiz, startQuiz, exitQuiz, answer, next, openRanking } from './test.svelte.js';
  import { playsQuiz, startPlaysQuiz, exitPlaysQuiz, answerPlay, nextPlay } from './plays-quiz.svelte.js';
  import PlayAnimation from '../jugadas/PlayAnimation.svelte';

  const OPTION_FIELDS = ['option_a', 'option_b', 'option_c', 'option_d'];
  const total = $derived(quiz.selected.length);
  const q = $derived(quiz.selected[quiz.index]);
  const answered = $derived(quiz.chosen !== null);
  const progress = $derived(((answered ? quiz.index + 1 : quiz.index) / total) * 100);

  // Test de jugadas (plays-quiz.svelte.js): solo uno de los dos tests está en marcha.
  const playing = $derived(quiz.view === 'play' || playsQuiz.view === 'play');
  const showHub = $derived(quiz.view === 'intro' && playsQuiz.view === 'off');
  const pTotal = $derived(playsQuiz.questions.length);
  const pq = $derived(playsQuiz.questions[playsQuiz.index]);
  const pAnswered = $derived(playsQuiz.chosen !== null);
  const pProgress = $derived(pTotal ? ((pAnswered ? playsQuiz.index + 1 : playsQuiz.index) / pTotal) * 100 : 0);

  function backToHub() {
    exitQuiz();
    exitPlaysQuiz();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" id="test-back-vestuario" onclick={() => setSection('vestuario')} style:display={playing ? 'none' : null}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" id="test-back-intro" onclick={backToHub} style:display={playing ? null : 'none'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.test')}</span></div>
<div class="section-head">
  <h2>{t('nav.test')}</h2>
  <button class="cal-open-btn small" onclick={openRanking} aria-label={t('test.rankingAria')} title={t('test.rankingAria')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 19h20"/><path d="M3.5 19l-1-9.5 5 3.5 4.5-7 4.5 7 5-3.5-1 9.5"/></svg>
  </button>
</div>

<!-- Dos tests: el de reglas (preguntas de Supabase, suma puntos al ranking) y el de
     jugadas (ver la animación y elegir su nombre, solo para practicar). -->
<div id="test-quiz-intro" class="test-hub" style:display={showHub ? null : 'none'}>
  <div class="card test-quiz-intro-card" id="test-hub-rules">
    <div class="test-hub-ic emoji">📋</div>
    <h3>{t('test.rulesTitle')}</h3>
    <p>{t('test.introText')}</p>
    <button class="btn" onclick={startQuiz} disabled={quiz.loading}>{t('test.startBtn')}</button>
  </div>
  <div class="card test-quiz-intro-card" id="test-hub-plays">
    <div class="test-hub-ic emoji">🏉</div>
    <h3>{t('test.playsTitle')}</h3>
    <p>{t('test.playsIntro')}</p>
    <button class="btn" id="test-plays-start" onclick={startPlaysQuiz} disabled={playsQuiz.loading}>{t('test.playsStartBtn')}</button>
  </div>
</div>

<!-- Test de jugadas -->
<div id="test-plays-play" style:display={playsQuiz.view === 'play' ? null : 'none'}>
  {#if pq}
    <div class="test-quiz-progress">
      <div class="test-quiz-progress-bar"><div class="fill" style:width="{pProgress}%"></div></div>
      <span id="test-plays-progress-label">{playsQuiz.index + 1} / {pTotal}</span>
    </div>
    <div class="card test-quiz-card">
      <h3>{t('test.playsQuestion')}</h3>
      <div class="test-plays-anim">
        {#key pq.id}<PlayAnimation anim={pq.anim} />{/key}
      </div>
      <div class="test-quiz-options" id="test-plays-options">
        {#each pq.options as option, i (option)}
          <button
            type="button"
            class="test-quiz-option"
            class:disabled={pAnswered}
            class:correct={pAnswered && i === pq.correct}
            class:incorrect={pAnswered && i !== pq.correct && i === playsQuiz.chosen}
            data-index={i}
            onclick={() => answerPlay(i)}
          >{option}</button>
        {/each}
      </div>
      {#if pAnswered && (playsQuiz.chosen !== pq.correct || pq.description)}
        <div class="test-quiz-explanation" id="test-plays-explanation">
          {#if playsQuiz.chosen !== pq.correct}<b>{t('test.playsWasLabel', { title: pq.title })}</b>{/if}
          {#if pq.description}<p>{pq.description}</p>{/if}
        </div>
      {/if}
    </div>
    <button class="btn test-quiz-next-btn" id="test-plays-next-btn" onclick={nextPlay} style:display={pAnswered ? null : 'none'}>{playsQuiz.index === pTotal - 1 ? t('test.finishBtn') : t('test.nextBtn')}</button>
  {/if}
</div>

<div id="test-plays-results" style:display={playsQuiz.view === 'results' ? null : 'none'}>
  <div class="card test-quiz-intro-card">
    <div class="test-quiz-score" id="test-plays-score">{playsQuiz.score}/{pTotal}</div>
    <p>{t('test.playsResult')}</p>
    <div class="test-hub-actions">
      <button class="btn-ghost" onclick={exitPlaysQuiz}>{t('test.backToTests')}</button>
      <button class="btn" onclick={startPlaysQuiz}>{t('test.restartBtn')}</button>
    </div>
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
