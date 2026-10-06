<script>
  // Editor de jugadas animadas (sección "jugada-editor", solo admins). El estado y las
  // acciones están en editor.svelte.js; aquí solo se pinta y se arrastran las fichas.
  import { t } from '../../lib/i18n.svelte.js';
  import PlayBoard from './PlayBoard.svelte';
  import PlayAnimation from './PlayAnimation.svelte';
  import { jugadas, categoryName } from './jugadas.svelte.js';
  import {
    editor, STEP_SPEEDS, canAdd, addToken, selectToken, removeSelected, moveToken,
    setStep, addStep, deleteStep, setStepSpeed, togglePreview, toggleZoom, leaveEditor, saveAnimation, markDirty,
  } from './editor.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";

  let svg = $state(null);
  const anim = $derived(editor.anim);
  const current = $derived(anim ? anim.steps[editor.step] : null);
  const ghost = $derived(anim && editor.step > 0 ? anim.steps[editor.step - 1].pos : null);
  const canPreview = $derived(!!anim && anim.tokens.length > 0 && anim.steps.length > 1);

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

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={leaveEditor}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('nav.jugadas')}</span></div>
<div class="section-head">
  <h2>{editor.playId ? t('jugadas.editorEditTitle') : t('jugadas.editorNewTitle')}</h2>
</div>

{#if anim}
  <div class="play-editor">
    <div class="play-editor-meta card">
      <label style={labelStyle}>
        <span>{t('jugadas.titleLabel')}</span>
        <input type="text" id="editor-title-input" bind:value={editor.meta.title} oninput={markDirty} maxlength="80" style={inputStyle}>
      </label>
      <label style={labelStyle}>
        <span>{t('jugadas.categoryLabel')}</span>
        <select id="editor-category-input" bind:value={editor.meta.categoryId} onchange={markDirty} style="{inputStyle} background:var(--white);">
          {#each jugadas.categories as c (c.id)}<option value={c.id}>{categoryName(c.id)}</option>{/each}
        </select>
      </label>
      <label style={labelStyle}>
        <span>{t('jugadas.descriptionLabel')}</span>
        <textarea id="editor-description-input" bind:value={editor.meta.description} oninput={markDirty} rows="2" style="{inputStyle} resize:vertical; min-height:0;"></textarea>
      </label>
    </div>

    <div class="play-editor-main">
      {#if editor.preview}
        <div class="play-editor-preview">
          <PlayAnimation anim={$state.snapshot(anim)} title={editor.meta.title} />
        </div>
      {:else}
        <div class="play-editor-board">
          <button class="play-editor-zoom" id="editor-zoom-btn" onclick={toggleZoom} aria-pressed={editor.zoomed}
                  aria-label={editor.zoomed ? t('jugadas.zoomOut') : t('jugadas.zoomIn')} title={editor.zoomed ? t('jugadas.zoomOut') : t('jugadas.zoomIn')}>
            {#if editor.zoomed}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-5-5"/></svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M21 21l-5-5"/></svg>
            {/if}
          </button>
          <PlayBoard {anim} positions={current.pos} viewBox={editor.viewBox} {ghost}
                     selectedId={editor.selectedId} ontokendown={onTokenDown} bind:svg label={t('jugadas.editorBoardAria')} />
        </div>
      {/if}

      <div class="play-editor-side">
        {#if !editor.preview}
          <div class="play-editor-tools" role="group" aria-label={t('jugadas.editorToolsAria')}>
            <button class="editor-btn tool-attack" onclick={() => addToken('attack')} disabled={!canAdd('attack')}><span class="dot attack"></span>{t('jugadas.addAttacker')}</button>
            <button class="editor-btn tool-defense" onclick={() => addToken('defense')} disabled={!canAdd('defense')}><span class="dot defense"></span>{t('jugadas.addDefender')}</button>
            <button class="editor-btn tool-ball" onclick={() => addToken('ball')} disabled={!canAdd('ball')}><span class="dot ball"></span>{t('jugadas.addBall')}</button>
            <button class="editor-btn danger" onclick={removeSelected} disabled={!editor.selectedId}>{t('jugadas.removeToken')}</button>
          </div>
          {#if !anim.tokens.length}<p class="play-editor-hint">{t('jugadas.editorEmptyHint')}</p>{/if}

          <div class="play-editor-steps">
            <div class="play-editor-label">{t('jugadas.stepsLabel')}</div>
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
              <p class="play-editor-hint">{t('jugadas.editorStepHint')}</p>
            {:else if anim.tokens.length}
              <p class="play-editor-hint">{t('jugadas.editorFirstStepHint')}</p>
            {/if}
          </div>
        {/if}

        <div class="play-editor-actions">
          <button class="btn-ghost" id="editor-preview-btn" onclick={togglePreview} disabled={!canPreview && !editor.preview}>
            {editor.preview ? t('jugadas.backToEdit') : t('jugadas.preview')}
          </button>
          <button class="btn" id="editor-save-btn" onclick={saveAnimation} disabled={editor.saving}>
            {editor.saving ? t('jugadas.saving') : t('att.saveGeneric')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
