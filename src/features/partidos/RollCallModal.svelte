<script>
  // MODAL: LISTA (pasar lista en convocatoria)
  import Modal from '../../lib/Modal.svelte';
  import Avatar from '../../lib/Avatar.svelte';
  import { rollcall, closeRollCallModal, setRollCallMark, saveRollCall } from './rollcall.svelte.js';
</script>

<Modal id="rollcall-modal" bind:open={rollcall.open} boxStyle="max-width:440px;">
  <h3 style="margin-top:0;">Pasar lista</h3>
  <div class="modal-sub">Jugadoras confirmadas para el partido — marca quién ha llegado (✓) o falta/llega tarde (✗)</div>
  <div class="rollcall-summary" id="rollcall-summary">{rollcall.view ? rollcall.view.summary : ''}</div>
  <div id="rollcall-list" style="max-height:48vh; overflow-y:auto;">
    {#if rollcall.view?.empty}
      <div class="shopping-empty">Todavía no hay ninguna jugadora confirmada para este partido.</div>
    {:else if rollcall.view}
      {#each rollcall.view.rows as row}
        <div class="rollcall-row">
          <span class="avatar"><Avatar url={row.avatarUrl} fallback={row.initials} injured={row.injured} injuryIcon={row.injuryIcon} /></span>
          <div class="meta"><b>{row.name}</b></div>
          <div class="rollcall-toggle">
            <button type="button" class="v {row.mark === 'v' ? 'is-active' : ''}" onclick={() => setRollCallMark(row.id, 'v')} aria-label="Presente" title="Presente">✓</button>
            <button type="button" class="x {row.mark === 'x' ? 'is-active' : ''}" onclick={() => setRollCallMark(row.id, 'x')} aria-label="Falta o llega tarde" title="Falta o llega tarde">✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeRollCallModal}>Cancelar</button>
    <button class="btn" onclick={saveRollCall}>Guardar</button>
  </div>
</Modal>
