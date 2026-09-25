<script>
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { expenseForm, closeAddTricountModal, saveTricountExpense, toggleTricountParticipant } from './tricount.svelte.js';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
</script>

<Modal id="add-tricount-modal" bind:open={expenseForm.open} boxStyle="max-width:400px;">
  <h3 style="margin-top:0;" id="tricount-modal-title">{expenseForm.title ?? t('tricount.newExpense')}</h3>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      <span>{t('tricount.concept')}</span>
      <input type="text" id="tricount-desc" placeholder={t('tricount.conceptPlaceholder')} bind:value={expenseForm.label} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('tricount.amount')}</span>
      <input type="number" id="tricount-amount" min="0" step="0.01" placeholder="0.00" bind:value={expenseForm.amount} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('tricount.date')}</span>
      <input type="date" id="tricount-date" bind:value={expenseForm.iso} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('tricount.paidByLabel')}</span>
      <select id="tricount-paidby" bind:value={expenseForm.paidBy} style={inputStyle}>
        {#each expenseForm.players as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <div>
      <div style="font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px;">{t('tricount.splitBetween')}</div>
      <div class="tricount-participants-list" id="tricount-participants-list">
        {#each expenseForm.players as p (p.id)}
          <label class="tricount-participant-row">
            <input type="checkbox" checked={expenseForm.participants.has(p.id)} onchange={() => toggleTricountParticipant(p.id)}>
            {p.name}
          </label>
        {/each}
      </div>
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeAddTricountModal}>{t('tricount.cancel')}</button>
    <button class="btn" id="tricount-modal-save-btn" onclick={saveTricountExpense}>{expenseForm.saveLabel ?? t('tricount.saveExpense')}</button>
  </div>
</Modal>
