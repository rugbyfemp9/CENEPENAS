<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import PlayAnimation from './PlayAnimation.svelte';
  import { jugadas, openedPlay, categoryName, animationOf, canManagePlays } from './jugadas.svelte.js';
  import { editAnimation } from './editor.svelte.js';

  const play = $derived(openedPlay());
  const videoUrl = $derived(play ? safeUrl(play.video_url) : '');
  // Si tiene vídeo y animación, se ve el vídeo.
  const anim = $derived(videoUrl ? null : animationOf(play));

  // Al abrir una jugada, el vídeo empieza solo. Tocar la tarjeta cuenta como gesto de
  // la usuaria, así que casi siempre se deja con sonido; si el navegador no lo deja
  // (algunos móviles), arranca en silencio y se activa el sonido desde los controles.
  let videoEl = $state(null);
  $effect(() => {
    if (!videoEl) return;
    const el = videoEl;
    el.play().catch(() => {
      if (el.isConnected) {
        el.muted = true;
        el.play().catch(() => {});
      }
    });
  });
</script>

<Modal id="play-modal" bind:open={jugadas.modalOpen} boxStyle="max-width:640px;">
  {#if play}
    <h3>{play.title}</h3>
    <div class="modal-sub">{categoryName(play.category_id)}</div>
    {#if play.description}<p class="play-description">{play.description}</p>{/if}
    <div class="play-frame" class:has-anim={!!anim}>
      <!-- El <video> solo existe con el modal abierto, para que deje de sonar al cerrarlo.
           Las jugadas no tienen subtítulos (son animaciones sin voz). -->
      {#if videoUrl && jugadas.modalOpen}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={videoEl} src={videoUrl} poster={safeUrl(play.poster_url) || undefined} controls playsinline></video>
      {:else if anim && jugadas.modalOpen}
        {#key play.id}<PlayAnimation {anim} title={play.title} />{/key}
      {:else}
        <div class="play-frame-empty">
          <span class="play-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
          <span>{t('jugadas.videoSoon')}</span>
        </div>
      {/if}
    </div>
  {/if}
  <div class="modal-actions">
    <!-- Las admins pueden retocar la animación (también la de una jugada con vídeo). -->
    {#if play && canManagePlays() && animationOf(play)}
      <button class="btn-ghost" id="play-edit-anim-btn" onclick={() => editAnimation(play)}>{t('jugadas.editAnimation')}</button>
    {/if}
    <button class="btn" onclick={() => (jugadas.modalOpen = false)}>{t('att.close')}</button>
  </div>
</Modal>
