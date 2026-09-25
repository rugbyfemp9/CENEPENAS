<script>
  // Confirmación antes de eliminar un movimiento. Los textos llegan de fuera porque en
  // Comi Tesoreria están traducidos y en Comi Tercer Temps van siempre en castellano.
  import Modal from '../Modal.svelte';

  let { treasury, id, title, message, no, yes } = $props();
  const confirm = $derived(treasury.deleteConfirm);
</script>

<Modal {id} bind:open={confirm.open} boxStyle="max-width:340px; text-align:center;">
  <h3 style="margin-top:0;">{title}</h3>
  <p class="modal-sub" style="margin-bottom:20px;">{message}</p>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={treasury.closeDeleteConfirm}>{no}</button>
    <button class="btn" style="background:var(--bad);" onclick={treasury.confirmDelete}>{yes}</button>
  </div>
</Modal>
