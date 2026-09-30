<script>
  // Modal "Pagar multa": a quién de Comi Tesoreria se le ha pagado.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { payModal, closePayFineModal, confirmPayFine } from './multas.svelte.js';

  let select = $state();
  // Sin nadie en Comi Tesoreria (visto al abrir el modal) se oculta el desplegable y
  // se muestra el aviso en su lugar.
  const noMembers = $derived(!!payModal.members && payModal.members.length === 0);
</script>

<Modal id="pay-fine-modal" bind:open={payModal.open} boxStyle="max-width:380px;">
  <h3 style="margin-top:0;">{t('fines.payTitle')}</h3>
  <div class="modal-sub">{t('fines.payToWhom')}</div>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('fines.paidToLabel')}</span>
      {#key payModal.seq}
        <select id="pay-fine-responsible-input" bind:this={select} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy); background:var(--white);" style:display={noMembers ? 'none' : null}>{#each payModal.members || [] as p}<option value={p.id}>{p.name}</option>{/each}</select>
      {/key}
      <span id="pay-fine-responsible-empty" style="display:none; font-size:12px; font-weight:500; text-transform:none; letter-spacing:normal; color:var(--text-muted);" style:display={noMembers ? 'block' : 'none'}>{t('fines.noTreasuryPerson')}</span>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closePayFineModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={() => confirmPayFine(select?.value)}>{t('fines.confirmPayment')}</button>
  </div>
</Modal>
