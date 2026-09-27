<script>
  // MODAL: CREAR/EDITAR ACTA A MANO
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import ActaBuilderRow from './ActaBuilderRow.svelte';
  import {
    actaBuilder, builderRows, addActaBuilderRow, closeMatchReportBuilderModal, saveActaBuilder,
  } from './builder.svelte.js';
</script>

<Modal id="match-report-builder-modal" bind:open={actaBuilder.open} boxStyle="max-width:960px;">
  <h3 style="margin-top:0;">{t('partido.createManual')}</h3>
  <p class="modal-sub" style="margin-bottom:14px;">{t('partido.manualSub')}</p>
  <div style="overflow-x:auto; margin:0 0 10px;">
    <table class="gym-exercise-table" id="acta-builder-table">
      <thead>
        <tr>
          <th>{t('partido.colNum')}</th>
          <th>{t('partido.colPlayer')}</th>
          <th>{t('partido.colMinIn')}</th>
          <th>{t('partido.colMinOut')}</th>
          <th>A</th>
          <th>T</th>
          <th>CC</th>
          <th>{t('partido.colCards')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="acta-builder-rows">
        {#key actaBuilder.version}
          {#each builderRows() as row, i}<ActaBuilderRow {row} {i} />{/each}
        {/key}
      </tbody>
    </table>
  </div>
  <button class="btn-ghost" type="button" onclick={addActaBuilderRow}>{t('partido.addPlayer')}</button>
  <div id="acta-builder-status" style="font-size:12.5px; color:{actaBuilder.statusColor}; margin-top:12px;">{actaBuilder.status}</div>
  <div class="modal-actions">
    <button class="btn-ghost" id="acta-builder-cancel-btn" onclick={closeMatchReportBuilderModal} disabled={actaBuilder.busy}>{t('att.cancel')}</button>
    <button class="btn" id="acta-builder-save-btn" onclick={saveActaBuilder} disabled={actaBuilder.busy}>{t('partido.saveActa')}</button>
  </div>
</Modal>
