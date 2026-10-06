<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import { jugadas, openedPlay, categoryName } from './jugadas.svelte.js';

  const play = $derived(openedPlay());
  const videoUrl = $derived(play ? safeUrl(play.video_url) : '');
</script>

<Modal id="play-modal" bind:open={jugadas.modalOpen} boxStyle="max-width:640px;">
  {#if play}
    <h3>{play.title}</h3>
    <div class="modal-sub">{categoryName(play.category_id)}</div>
    {#if play.description}<p class="play-description">{play.description}</p>{/if}
    <div class="play-frame">
      <!-- El <video> solo existe con el modal abierto, para que deje de sonar al cerrarlo.
           Las jugadas no tienen subtítulos (son animaciones sin voz). -->
      {#if videoUrl && jugadas.modalOpen}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={videoUrl} poster={safeUrl(play.poster_url) || undefined} controls playsinline></video>
      {:else}
        <div class="play-frame-empty">
          <span class="play-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
          <span>{t('jugadas.videoSoon')}</span>
        </div>
      {/if}
    </div>
  {/if}
  <div class="modal-actions">
    <button class="btn" onclick={() => (jugadas.modalOpen = false)}>{t('att.close')}</button>
  </div>
</Modal>
