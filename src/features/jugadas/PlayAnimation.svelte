<script>
  // Reproductor de una jugada animada (dentro del modal de la jugada). Empieza solo al
  // abrirse, como los vídeos, y se para en el último paso. Solo existe con el modal
  // abierto, así que al cerrarlo se para el bucle (ver el $effect).
  import { t } from '../../lib/i18n.svelte.js';
  import PlayBoard from './PlayBoard.svelte';
  import { positionsAt, frameAt, totalMs, timeOfStep, fitViewBox } from './board.js';

  let { anim, title = '' } = $props();

  const SPEEDS = [1, 2, 0.5];
  const viewBox = $derived(fitViewBox(anim));
  const total = $derived(totalMs(anim));

  let elapsed = $state(0);
  let playing = $state(true);
  let speed = $state(1);

  const frame = $derived(frameAt(anim, elapsed));
  const positions = $derived(positionsAt(anim, frame.from, frame.progress));
  const ended = $derived(elapsed >= total);

  // Bucle de animación: avanza `elapsed` con el tiempo real entre fotogramas.
  $effect(() => {
    if (!playing) return;
    let raf;
    let last = null;
    const tick = (now) => {
      if (last !== null) elapsed = Math.min(total, elapsed + (now - last) * speed);
      last = now;
      if (elapsed >= total) { playing = false; return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function togglePlay() {
    if (ended) elapsed = 0;
    playing = !playing || ended;
  }
  function replay() {
    elapsed = 0;
    playing = true;
  }
  function goToStep(i) {
    playing = false;
    elapsed = timeOfStep(anim, i);
  }
  function nextSpeed() {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  }
</script>

<div class="play-anim" data-state={playing ? 'playing' : ended ? 'ended' : 'paused'} data-step={frame.atStep}>
  <div class="play-anim-board">
    <PlayBoard {anim} {positions} {viewBox} label={title} />
  </div>
  <div class="play-anim-controls">
    <button class="play-anim-btn" data-action="toggle" onclick={togglePlay}
            aria-label={playing ? t('jugadas.pause') : t('jugadas.play')} title={playing ? t('jugadas.pause') : t('jugadas.play')}>
      {#if playing}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      {/if}
    </button>
    <button class="play-anim-btn" data-action="replay" onclick={replay} aria-label={t('jugadas.replay')} title={t('jugadas.replay')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 103-6.7"/><path d="M3 3v6h6"/></svg>
    </button>
    <div class="play-anim-steps" role="group" aria-label={t('jugadas.stepsAria')}>
      {#each anim.steps as _, i (i)}
        <button class="play-anim-dot" class:active={frame.atStep === i} onclick={() => goToStep(i)}
                aria-label={t('jugadas.stepN', { n: i + 1 })} title={t('jugadas.stepN', { n: i + 1 })}>{i + 1}</button>
      {/each}
    </div>
    <button class="play-anim-speed" data-action="speed" onclick={nextSpeed} aria-label={t('jugadas.speedAria')} title={t('jugadas.speedAria')}>{speed}×</button>
  </div>
</div>
