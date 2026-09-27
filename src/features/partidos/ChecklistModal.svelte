<script>
  // MODAL: RECUERDA (qué llevar al partido)
  import Modal from '../../lib/Modal.svelte';
  import {
    checklist, checklistItems, closeMatchdayChecklistModal, addMatchdayChecklistItem,
    toggleMatchdayChecklistItem, deleteMatchdayChecklistItem,
  } from './checklist.svelte.js';
</script>

<Modal id="matchday-checklist-modal" bind:open={checklist.open} boxStyle="max-width:420px;">
  <h3 style="margin-top:0;">Qué llevar al partido</h3>
  <div class="modal-sub">Márcalo con la casilla cuando ya lo tengas listo</div>
  <div id="matchday-checklist-list" style="max-height:48vh; overflow-y:auto;">
    {#if checklist.mode === 'loading'}
      <div class="shopping-empty">Cargando…</div>
    {:else if checklist.mode === 'list'}
      {#key checklist.version}
        {#each checklistItems() as item}
          <label class="shopping-item {item.checked ? 'checked' : ''}">
            <input type="checkbox" checked={item.checked} onchange={() => toggleMatchdayChecklistItem(item.id)}>
            <span class="shopping-item-label">{item.label}</span>
            <button type="button" class="shopping-item-del" onclick={(event) => { event.preventDefault(); deleteMatchdayChecklistItem(item.id); }} aria-label="Eliminar" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
            </button>
          </label>
        {:else}
          <div class="shopping-empty">No hay nada en la lista. Añade lo que necesites llevar 👇</div>
        {/each}
        <div class="shopping-item-add">
          <button type="button" onclick={addMatchdayChecklistItem} aria-label="Añadir">+</button>
          <input type="text" id="matchday-checklist-input" placeholder="Añadir algo más…" onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addMatchdayChecklistItem(); } }}>
        </div>
      {/key}
    {/if}
  </div>
  <div class="modal-actions">
    <button class="btn" onclick={closeMatchdayChecklistModal}>Cerrar</button>
  </div>
</Modal>
