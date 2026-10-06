<script>
  // Confirmar antes de eliminar una jugada (solo admins). Se abre desde el modal de la
  // jugada, que se cierra mientras tanto; "No" vuelve a él.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { jugadas, openedPlay, cancelDeletePlay, confirmDeletePlay } from './jugadas.svelte.js';

  const play = $derived(openedPlay());
</script>

<Modal id="delete-play-modal" bind:open={() => jugadas.deleteOpen, (v) => { if (v) jugadas.deleteOpen = true; else cancelDeletePlay(); }} boxStyle="max-width:360px; text-align:center;">
  <h3 style="margin-top:0;">{t('jugadas.deleteTitle')}</h3>
  <p class="modal-sub" style="margin-bottom:6px;"><b>{play ? play.title : ''}</b></p>
  <p class="modal-sub" style="margin-bottom:20px;">{play && play.video_url ? t('jugadas.deleteConfirmVideo') : t('jugadas.deleteConfirm')}</p>
  <div class="modal-actions" style="justify-content:center;">
    <button class="btn-ghost" onclick={cancelDeletePlay} disabled={jugadas.deleting}>{t('att.no')}</button>
    <button class="btn" id="delete-play-confirm-btn" style="background:var(--bad);" onclick={confirmDeletePlay} disabled={jugadas.deleting}>
      {jugadas.deleting ? t('jugadas.deleting') : t('att.yesDelete')}
    </button>
  </div>
</Modal>
