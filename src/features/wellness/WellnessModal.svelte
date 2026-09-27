<script>
  // WELLNESS / RPE: valoración de dos fases (esfuerzo percibido + molestias físicas),
  // visible y accesible SOLO para el rol jugadora (ver canUseWellness()).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    wellnessModal as wm, wellnessRpeLevel, setWellnessSleep, setWellnessMood, setWellnessDiscomfort,
    closeWellnessModal, saveWellnessModal,
  } from './wellness.svelte.js';

  const level = $derived(wm.shown ? wellnessRpeLevel(wm.rpe) : null);
  const SLEEP_OPTS = [['lt6', 'att.wellnessSleepLt6'], ['7-8', 'att.wellnessSleep78'], ['gt8', 'att.wellnessSleepGt8']];
  const MOOD_OPTS = [[1, '😞'], [2, '🙁'], [3, '😐'], [4, '🙂'], [5, '😄']];
</script>

<Modal id="wellness-modal" bind:open={() => wm.open, (v) => { if (v) wm.open = true; else closeWellnessModal(); }} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;">{t('att.wellnessTitle')}</h3>
  <div class="modal-sub" id="wellness-modal-sub">{wm.sub}</div>

  <!-- FASE 1: RPE con slider -->
  <div class="wellness-phase">
    <div class="wellness-rpe-display">
      <div class="wellness-rpe-emoji" id="wellness-rpe-emoji">{level ? level.emoji : '🙂'}</div>
      <div class="wellness-rpe-value"><span id="wellness-rpe-value">{wm.rpe}</span>/10</div>
      <div class="wellness-rpe-desc" id="wellness-rpe-desc" style:color={level?.color}>{level ? t(level.key) : ''}</div>
    </div>
    <input type="range" min="1" max="10" step="1" id="wellness-rpe-slider" class="wellness-rpe-slider" bind:value={wm.rpe} style:--rpe-color={level?.color}>
    <div class="wellness-rpe-scale"><span>1</span><span>10</span></div>
  </div>

  <!-- FASE: horas de sueño (selector de un solo clic, en horizontal) -->
  <div class="wellness-phase wellness-phase-sleep">
    <div class="wellness-field-label">{t('att.wellnessSleepLabel')}</div>
    <div class="wellness-sleep-options" id="wellness-sleep-options">
      {#each SLEEP_OPTS as [val, key] (val)}
        <button type="button" class="wellness-pill-opt" class:selected={wm.sleep !== null && wm.sleep === val} data-val={val} onclick={() => setWellnessSleep(val)}>{t(key)}</button>
      {/each}
    </div>
  </div>

  <!-- FASE: estado de ánimo (5 emojis) -->
  <div class="wellness-phase wellness-phase-mood">
    <div class="wellness-field-label">{t('att.wellnessMoodLabel')}</div>
    <div class="wellness-mood-options" id="wellness-mood-options">
      {#each MOOD_OPTS as [val, emoji] (val)}
        <button type="button" class="wellness-mood-opt" class:selected={wm.mood !== null && Number(wm.mood) === val} data-val={val} onclick={() => setWellnessMood(val)} aria-label={t(`att.wellnessMood${val}`)} title={t(`att.wellnessMood${val}`)}>{emoji}</button>
      {/each}
    </div>
  </div>

  <!-- FASE 2: molestias físicas -->
  <div class="wellness-phase wellness-phase-molesties">
    <div class="wellness-toggle-row">
      <span class="wellness-toggle-label">{t('att.wellnessDiscomfortLabel')}</span>
      <div class="wellness-toggle-pill">
        <button type="button" class="wellness-toggle-opt" class:selected={wm.hasDiscomfort === false} data-val="no" onclick={() => setWellnessDiscomfort(false)}>{t('att.no')}</button>
        <button type="button" class="wellness-toggle-opt" class:selected={wm.hasDiscomfort === true} data-val="yes" onclick={() => setWellnessDiscomfort(true)}>{t('att.wellnessYes')}</button>
      </div>
    </div>
    <div class="wellness-discomfort-detail" id="wellness-discomfort-detail" style:display={wm.hasDiscomfort ? null : 'none'}>
      <textarea id="wellness-discomfort-textarea" maxlength="200" placeholder={t('att.wellnessDiscomfortPlaceholder')} bind:value={wm.discomfortDetail}></textarea>
    </div>
  </div>

  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeWellnessModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveWellnessModal}>{t('att.saveGeneric')}</button>
  </div>
</Modal>
