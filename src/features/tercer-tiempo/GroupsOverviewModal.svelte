<script>
  // Modal "Grupos del tercer tiempo": integrantes de cada grupo, sin ligar a un partido.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import GroupPreviewCol from './GroupPreviewCol.svelte';
  import { groupsOverviewModal, closeThirdTimeGroupsOverviewModal } from './tercer-tiempo.svelte.js';
</script>

<Modal id="tt-groups-overview-modal" bind:open={groupsOverviewModal.open} boxStyle="max-width:440px;">
  <h3 style="margin-top:0;">{t('tercer.groupsOverviewTitle')}</h3>
  <div class="modal-sub">{t('tercer.groupsOverviewSub')}</div>
  <div class="tt-groups-preview" id="tt-groups-overview-list">{#each groupsOverviewModal.cols as col}<GroupPreviewCol {col} />{/each}</div>
  <div class="modal-actions">
    <button class="btn" onclick={closeThirdTimeGroupsOverviewModal}>{t('att.close')}</button>
  </div>
</Modal>
