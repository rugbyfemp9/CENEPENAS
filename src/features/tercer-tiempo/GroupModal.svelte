<script>
  // Modal de un grupo: sus integrantes y qué ha apuntado cada una para comer.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { groupModal, closeThirdTimeGroupModal } from './tercer-tiempo.svelte.js';
</script>

<Modal id="tt-group-modal" bind:open={groupModal.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;" id="tt-group-modal-title">{groupModal.letter ? t('tercer.groupLabel', { letter: groupModal.letter }) : t('tercer.groupModalDefaultTitle')}</h3>
  <div class="modal-sub" id="tt-group-modal-sub">{groupModal.letter ? (groupModal.matchLabel ? t('tercer.groupOrgWithMatch', { match: groupModal.matchLabel }) : t('tercer.groupOrg')) : ''}</div>
  <div class="tt-roster-list" id="tt-group-modal-list">
    {#each groupModal.rows as r}
      <div class="tt-roster-row{r.ready ? '' : ' pending'}">
        <span class="dot {r.ready ? 'ready' : 'pending'}"></span>
        <div class="info"><b>{r.name}</b><span>{r.pos}</span></div>
        <div class="dish">{r.dish ?? t('tercer.notSignedUp')}</div>
      </div>
    {/each}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={closeThirdTimeGroupModal}>{t('att.close')}</button>
  </div>
</Modal>
