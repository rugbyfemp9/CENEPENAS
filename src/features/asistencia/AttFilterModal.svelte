<script>
  // Filtrar la lista de Asistencia por tipo de evento.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { attList, toggleAttListFilter } from './asistencia.svelte.js';
</script>

<Modal id="att-filter-modal" bind:open={attList.filterModalOpen} boxStyle="max-width:320px;">
  <h3 style="margin-top:0;">{t('att.filterEventsTitle')}</h3>
  <div class="modal-sub">{t('att.filterEventsSub')}</div>
  <div style="display:flex; flex-direction:column; gap:4px; margin:14px 0 4px;">
    <label class="cal-filter-item">
      <input type="checkbox" checked={attList.filters.training} onchange={(e) => toggleAttListFilter('training', e.currentTarget.checked)}>
      <span class="dot t-training"></span> <span>{t('att.trainings')}</span>
    </label>
    <label class="cal-filter-item">
      <input type="checkbox" checked={attList.filters.match} onchange={(e) => toggleAttListFilter('match', e.currentTarget.checked)}>
      <span class="dot t-match"></span> <span>{t('att.matches')}</span>
    </label>
    <label class="cal-filter-item">
      <input type="checkbox" checked={attList.filters.meeting} onchange={(e) => toggleAttListFilter('meeting', e.currentTarget.checked)}>
      <span class="dot t-plan"></span> <span>{t('att.meetings')}</span>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={() => { attList.filterModalOpen = false; }}>{t('att.close')}</button>
  </div>
</Modal>
