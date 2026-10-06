<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { jugadas, playForm, saveNewPlay, categoryName, MAX_VIDEO_MB } from './jugadas.svelte.js';
  import { continueToEditor } from './editor.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
</script>

<Modal id="add-play-modal" bind:open={jugadas.addModalOpen} boxStyle="max-width:420px;">
  <h3 style="margin-top:0;">{t('jugadas.addPlay')}</h3>
  <p class="modal-sub">{t('jugadas.addModalSub')}</p>
  <div class="jugadas-filters play-kind-toggle" role="group" aria-label={t('jugadas.kindAria')}>
    <button class="jugadas-filter" class:active={playForm.kind === 'video'} data-kind="video" onclick={() => (playForm.kind = 'video')}>{t('jugadas.kindVideo')}</button>
    <button class="jugadas-filter" class:active={playForm.kind === 'animation'} data-kind="animation" onclick={() => (playForm.kind = 'animation')}>{t('jugadas.kindAnimation')}</button>
  </div>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      <span>{t('jugadas.categoryLabel')}</span>
      <select id="play-category-input" bind:value={playForm.categoryId} style="{inputStyle} background:var(--white);">
        {#each jugadas.categories as c (c.id)}<option value={c.id}>{categoryName(c.id)}</option>{/each}
      </select>
    </label>
    <label style={labelStyle}>
      <span>{t('jugadas.titleLabel')}</span>
      <input type="text" id="play-title-input" bind:value={playForm.title} placeholder={t('jugadas.titlePlaceholder')} maxlength="80" style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('jugadas.descriptionLabel')}</span>
      <textarea id="play-description-input" bind:value={playForm.description} placeholder={t('jugadas.descriptionPlaceholder')} rows="3" style="{inputStyle} resize:vertical; min-height:0;"></textarea>
    </label>
    {#if playForm.kind === 'animation'}
      <p class="play-editor-hint" style="margin:0;">{t('jugadas.kindAnimationHint')}</p>
    {:else}
    <label style={labelStyle}>
      <span>{t('jugadas.videoLabel', { max: MAX_VIDEO_MB })}</span>
      <!-- {#key}: un <input type="file"> no se puede vaciar desde el estado, así que se
           vuelve a crear cada vez que se abre el modal. -->
      {#key jugadas.formKey}
        <input type="file" id="play-video-input" accept="video/*" onchange={(e) => (playForm.file = e.currentTarget.files[0] || null)} style="{inputStyle} padding:8px 10px;">
      {/key}
      <span style="text-transform:none; letter-spacing:0; font-weight:400;">{t('jugadas.videoHint')}</span>
    </label>
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={() => (jugadas.addModalOpen = false)} disabled={playForm.saving}>{t('att.cancel')}</button>
    {#if playForm.kind === 'animation'}
      <button class="btn" id="play-continue-btn" onclick={continueToEditor}>{t('jugadas.continue')}</button>
    {:else}
      <button class="btn" id="play-save-btn" onclick={saveNewPlay} disabled={playForm.saving}>{playForm.saving ? t('jugadas.uploading') : t('att.saveGeneric')}</button>
    {/if}
  </div>
</Modal>
