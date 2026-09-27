<script>
  // Elegir qué tipo de evento añadir (cada uno abre el modal con su preconfiguración).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { addTypeModal, closeAttAddTypeModal, openAddEventModal } from './editor.svelte.js';
</script>

<Modal id="att-add-type-modal" bind:open={addTypeModal.open} boxStyle="max-width:360px;">
  <h3 style="margin-top:0;">{t('att.addEventTitle')}</h3>
  <div class="modal-sub">{t('att.addEventSub')}</div>
  <div style="display:flex; flex-direction:column; gap:10px; margin:14px 0 4px;">
    <button class="att-type-option" onclick={() => openAddEventModal('training')}>
      <span class="ic t-training"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5l11 11M4 20l3.5-1 9-9 .5-3.5L20.5 3 21 6.5l-3.5 3.5-9 9L4 20z"/></svg></span>
      <span class="txt"><b>{t('att.training')}</b><span>{t('att.trainingDesc')}</span></span>
    </button>
    <button class="att-type-option" onclick={() => openAddEventModal('match')}>
      <span class="ic t-match"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M6 12h12M12 6v12"/></svg></span>
      <span class="txt"><b>{t('att.match')}</b><span>{t('att.matchDesc')}</span></span>
    </button>
    <button class="att-type-option" onclick={() => openAddEventModal('meeting')}>
      <span class="ic t-plan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M17 8a3 3 0 100-6M22 20c0-2.6-2.1-4.8-5-5.6"/></svg></span>
      <span class="txt"><b>{t('att.meeting')}</b><span>{t('att.meetingDesc')}</span></span>
    </button>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeAttAddTypeModal}>{t('att.cancel')}</button>
  </div>
</Modal>
