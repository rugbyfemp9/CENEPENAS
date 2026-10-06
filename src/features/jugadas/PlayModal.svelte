<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import { jugadas, openedPlay, categoryLabel, playTitle } from './jugadas.svelte.js';

  const play = $derived(openedPlay());
</script>

<Modal id="play-modal" bind:open={jugadas.modalOpen} boxStyle="max-width:640px;">
  {#if play}
    <h3>{playTitle(play)}</h3>
    <div class="modal-sub">{categoryLabel(play.category)}</div>
    <div class="play-frame">
      {#if play.video && jugadas.modalOpen}
        <video src={safeUrl(play.video)} poster={safeUrl(play.poster) || undefined} controls playsinline></video>
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
