<script>
  // Comentario / justificación de la propia respuesta a un evento.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { commentModal, closeCommentModal, saveCommentModal } from './attendance.svelte.js';
</script>

<Modal id="comment-modal" bind:open={() => commentModal.open, (v) => { if (v) commentModal.open = true; else closeCommentModal(); }}>
  <h3 id="comment-modal-title">{commentModal.title ?? t('att.comment')}</h3>
  <div class="modal-sub" id="comment-modal-sub">{commentModal.sub}</div>
  <textarea id="comment-modal-textarea" placeholder={t('att.commentPlaceholder')} bind:value={commentModal.text}></textarea>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeCommentModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveCommentModal}>{t('att.saveGeneric')}</button>
  </div>
</Modal>
