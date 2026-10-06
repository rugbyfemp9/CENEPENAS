<script>
  // Pizarra del editor a pantalla completa (solo admins). Mientras está abierta la
  // página no se puede desplazar: en el móvil, al intentar mover una ficha se acababa
  // haciendo scroll. Lleva la clase "modal-overlay", así que el botón "atrás" del móvil
  // la cierra (src/shell/navigation.svelte.js) sin salir del editor.
  import { t } from '../../lib/i18n.svelte.js';
  import PlayBoard from './PlayBoard.svelte';
  import PlayAnimation from './PlayAnimation.svelte';
  import {
    editor, STEP_SPEEDS, SHIRT_NUMBERS, canAdd, addToken, toggleAttacker, onPitch, selectToken, removeSelected, moveToken,
    setStep, addStep, deleteStep, setStepSpeed, togglePreview, toggleZoom, closeBoard, saveAnimation,
  } from './editor.svelte.js';

  let overlay;
  let svg = $state(null);
  const open = $derived(editor.boardOpen && !!editor.anim);
  const anim = $derived(editor.anim);
  const current = $derived(anim ? anim.steps[editor.step] : null);
  const ghost = $derived(anim && editor.step > 0 ? anim.steps[editor.step - 1].pos : null);
  const canPreview = $derived(!!anim && anim.tokens.length > 0 && anim.steps.length > 1);

  // Sin scroll mientras está abierta: overflow:hidden en la página (html.board-open)
  // y, para iOS (que a veces lo ignora), se cancela cualquier touchmove dentro de la
  // pizarra. Los Pointer Events del arrastre siguen llegando igual.
  $effect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add('board-open');
    const block = (e) => { if (e.cancelable) e.preventDefault(); };
    overlay.addEventListener('touchmove', block, { passive: false });
    return () => {
      root.classList.remove('board-open');
      overlay.removeEventListener('touchmove', block);
    };
  });

  // El "atrás" del móvil la cierra quitándole la clase "active" (como a los modales).
  $effect(() => {
    const onClose = () => closeBoard();
    overlay.addEventListener('modal:close', onClose);
    return () => overlay.removeEventListener('modal:close', onClose);
  });

  // Pantalla → metros del campo (el SVG está escalado y puede estar desplazado).
  function toPitch(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }

  // Arrastre con Pointer Events: mismo código para ratón, dedo y lápiz. Se guarda la
  // distancia entre el dedo y el centro de la ficha para que no "salte" al cogerla.
  // Las zonas táctiles son más grandes que las fichas y se solapan (el balón suele ir
  // pegado a una jugadora), así que se coge la ficha más cercana al dedo, no la que
  // esté pintada encima.
  function onTokenDown(e) {
    e.preventDefault();
    const start = toPitch(e);
    let id = null;
    let best = Infinity;
    for (const [tid, [x, y]] of Object.entries(current.pos)) {
      const d = Math.hypot(x - start[0], y - start[1]);
      if (d < best) { best = d; id = tid; }
    }
    if (!id) return;
    selectToken(id);
    const [tx, ty] = current.pos[id];
    const off = [tx - start[0], ty - start[1]];
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const [x, y] = toPitch(ev);
      moveToken(id, [x + off[0], y + off[1]]);
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
</script>

<div class="modal-overlay play-board-full" class:active={open} id="play-board-full" bind:this={overlay}
     role="dialog" aria-modal="true" aria-label={t('jugadas.editorBoardAria')}>
  {#if open}
    <div class="pbf-head">
      <button class="pbf-done" id="board-done-btn" onclick={closeBoard}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L19 7"/></svg>
        <span>{t('jugadas.boardDone')}</span>
      </button>
      <div class="pbf-title">
        <b>{editor.meta.title || t('jugadas.editorNewTitle')}</b>
        <span>{t('jugadas.stepOf', { n: editor.step + 1, total: anim.steps.length })}</span>
      </div>
      {#if !editor.preview}
        <button class="pbf-icon" id="editor-zoom-btn" onclick={toggleZoom} aria-pressed={editor.zoomed}
                aria-label={editor.zoomed ? t('jugadas.zoomOut') : t('jugadas.zoomIn')} title={editor.zoomed ? t('jugadas.zoomOut') : t('jugadas.zoomIn')}>
          {#if editor.zoomed}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-5-5"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M21 21l-5-5"/></svg>
          {/if}
        </button>
      {/if}
      <button class="btn pbf-save" id="board-save-btn" onclick={saveAnimation} disabled={editor.saving}>
        {editor.saving ? t('jugadas.saving') : t('att.saveGeneric')}
      </button>
    </div>

    <div class="pbf-body">
      <div class="pbf-board">
        {#if editor.preview}
          <div class="pbf-preview"><PlayAnimation anim={$state.snapshot(anim)} title={editor.meta.title} /></div>
        {:else}
          <PlayBoard {anim} positions={current.pos} viewBox={editor.viewBox} {ghost}
                     selectedId={editor.selectedId} ontokendown={onTokenDown} bind:svg label={t('jugadas.editorBoardAria')} />
        {/if}
      </div>

      <div class="pbf-panel">
        {#if !editor.preview}
          <div class="pbf-bench" role="group" aria-label={t('jugadas.benchLabel')}>
            <span class="pbf-bench-label">{t('jugadas.benchLabel')}</span>
            <div class="pbf-bench-grid">
              {#each SHIRT_NUMBERS as n (n)}
                <button class="bench-chip" data-num={n} aria-pressed={onPitch(n)} onclick={() => toggleAttacker(n)}
                        aria-label={t('jugadas.benchChipAria', { n })} title={t('jugadas.benchChipAria', { n })}>{n}</button>
              {/each}
            </div>
          </div>
          <div class="play-editor-tools" role="group" aria-label={t('jugadas.editorToolsAria')}>
            <button class="editor-btn tool-defense" onclick={() => addToken('defense')} disabled={!canAdd('defense')}><span class="dot defense"></span>{t('jugadas.addDefender')}</button>
            <button class="editor-btn tool-ball" onclick={() => addToken('ball')} disabled={!canAdd('ball')}><span class="dot ball"></span>{t('jugadas.addBall')}</button>
            <button class="editor-btn danger" onclick={removeSelected} disabled={!editor.selectedId}>{t('jugadas.removeToken')}</button>
          </div>

          <div class="play-editor-chips" role="group" aria-label={t('jugadas.stepsAria')}>
            {#each anim.steps as _, i (i)}
              <button class="play-anim-dot" class:active={editor.step === i} onclick={() => setStep(i)}
                      aria-label={t('jugadas.stepN', { n: i + 1 })}>{i + 1}</button>
            {/each}
            <button class="editor-btn" id="editor-add-step" onclick={addStep}>{t('jugadas.addStep')}</button>
            <button class="editor-btn danger" id="editor-delete-step" onclick={deleteStep} disabled={anim.steps.length <= 1}>{t('jugadas.deleteStep')}</button>
          </div>

          {#if editor.step > 0}
            <div class="play-editor-speed" role="group" aria-label={t('jugadas.stepSpeedAria')}>
              <span>{t('jugadas.stepSpeedLabel')}</span>
              {#each STEP_SPEEDS as s (s.id)}
                <button class="jugadas-filter" class:active={current.ms === s.ms} data-speed={s.id} onclick={() => setStepSpeed(s.ms)}>{t('jugadas.speed.' + s.id)}</button>
              {/each}
            </div>
          {/if}

          <p class="play-editor-hint">
            {#if !anim.tokens.length}{t('jugadas.editorEmptyHint')}
            {:else if editor.step > 0}{t('jugadas.editorStepHint')}
            {:else}{t('jugadas.editorFirstStepHint')}{/if}
          </p>
        {/if}

        <button class="btn-ghost pbf-preview-btn" id="editor-preview-btn" onclick={togglePreview} disabled={!canPreview && !editor.preview}>
          {editor.preview ? t('jugadas.backToEdit') : t('jugadas.preview')}
        </button>
      </div>
    </div>
  {/if}
</div>
