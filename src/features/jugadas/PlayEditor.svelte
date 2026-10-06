<script>
  // Editor de jugadas animadas (sección "jugada-editor", solo admins): nombre, categoría
  // y descripción, y una vista previa de la pizarra. Las fichas se mueven en la pizarra
  // a pantalla completa (PlayBoardFull.svelte), que no deja hacer scroll. El estado y
  // las acciones están en editor.svelte.js.
  import { t } from '../../lib/i18n.svelte.js';
  import PlayBoard from './PlayBoard.svelte';
  import { fitViewBox, FULL_PITCH_VIEWBOX } from './board.js';
  import { jugadas, categoryName } from './jugadas.svelte.js';
  import { editor, openBoard, leaveEditor, saveAnimation, markDirty } from './editor.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";

  const anim = $derived(editor.anim);
  const current = $derived(anim ? anim.steps[editor.step] : null);
  // Vista previa 16:9 del paso actual, encuadrada en las fichas (o el campo entero si no hay).
  const previewBox = $derived(anim && anim.tokens.length ? fitViewBox(anim) : FULL_PITCH_VIEWBOX);
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

    <button class="play-editor-open" id="editor-open-board" onclick={openBoard}>
      <div class="play-editor-open-board">
        <PlayBoard {anim} positions={current.pos} viewBox={previewBox} />
      </div>
      <div class="play-editor-open-cap">
        <b>{t('jugadas.openBoard')}</b>
        <span>{t('jugadas.boardSummary', { tokens: anim.tokens.length, steps: anim.steps.length })}</span>
      </div>
    </button>

    <div class="play-editor-actions">
      <button class="btn" id="editor-save-btn" onclick={saveAnimation} disabled={editor.saving}>
        {editor.saving ? t('jugadas.saving') : t('att.saveGeneric')}
      </button>
    </div>
  </div>
{/if}
