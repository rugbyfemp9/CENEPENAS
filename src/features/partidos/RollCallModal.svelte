<script>
  // MODAL: LISTA (pasar lista en convocatoria)
  import Modal from '../../lib/Modal.svelte';
  import Avatar from '../../lib/Avatar.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { rollcall, closeRollCallModal, setRollCallMark, saveRollCall } from './rollcall.svelte.js';
</script>

<Modal id="rollcall-modal" bind:open={rollcall.open} boxStyle="max-width:440px;">
  <h3 style="margin-top:0;">{t('rollcall.title')}</h3>
  <div class="modal-sub">{t('rollcall.sub')}</div>
  <div class="rollcall-summary" id="rollcall-summary">{rollcall.view && !rollcall.view.empty ? t('rollcall.summary', { marked: rollcall.view.marked, total: rollcall.view.total }) : ''}</div>
  <div id="rollcall-list" style="max-height:48vh; overflow-y:auto;">
    {#if rollcall.view?.empty}
      <div class="shopping-empty">{t('rollcall.empty')}</div>
    {:else if rollcall.view}
      {#each rollcall.view.rows as row}
        <div class="rollcall-row">
          <span class="avatar"><Avatar url={row.avatarUrl} fallback={row.initials} injured={row.injured} injuryIcon={row.injuryIcon} /></span>
          <div class="meta"><b>{row.name}</b></div>
          <div class="rollcall-toggle">
            <button type="button" class="v {row.mark === 'v' ? 'is-active' : ''}" onclick={() => setRollCallMark(row.id, 'v')} aria-label={t('rollcall.present')} title={t('rollcall.present')}>✓</button>
            <button type="button" class="x {row.mark === 'x' ? 'is-active' : ''}" onclick={() => setRollCallMark(row.id, 'x')} aria-label={t('rollcall.absentOrLate')} title={t('rollcall.absentOrLate')}>✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeRollCallModal}>{t('rollcall.cancel')}</button>
    <button class="btn" onclick={saveRollCall}>{t('rollcall.save')}</button>
  </div>
</Modal>
