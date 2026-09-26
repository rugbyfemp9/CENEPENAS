<script>
  // Rejilla de los 4 motivos (multi-selección) de los modales de alta y de edición.
  import { fineReasons, toggleReason } from './multas.svelte.js';

  let { modal, id } = $props();
</script>

<div class="fine-reason-grid" {id}>{#each fineReasons as r (r.id)}
  <button class="fine-reason-box {modal.reasonIds.has(r.id) ? 'selected' : ''}" data-reason={r.id} onclick={() => toggleReason(modal, r.id)} title={r.label}>
    <b>{r.short}</b>
    <span>{r.amount} €</span>
  </button>
{/each}</div>
