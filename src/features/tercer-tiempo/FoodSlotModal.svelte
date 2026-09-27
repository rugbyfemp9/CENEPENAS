<script>
  // Modal para apuntarse a una categoría de comida (una misma, o a una compañera).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    foodModal, toggleFoodTeammatePicker, onFoodTeammateChange, closeFoodSlotModal, confirmFoodSlot,
  } from './food.svelte.js';
</script>

<Modal id="food-slot-modal" bind:open={foodModal.open} boxStyle="max-width:360px;">
  <div class="food-modal-head">
    <h3 style="margin:0;" id="food-slot-modal-title">{foodModal.title}</h3>
    <button class="food-modal-teammate-btn" class:active={foodModal.pickerOpen} onclick={toggleFoodTeammatePicker} title={t('tercer.pickTeammate')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 11a4 4 0 10-8 0 4 4 0 008 0z"/><path d="M3 21c0-4 3.4-7 7-7"/><path d="M18 8v6M21 11h-6"/></svg>
    </button>
  </div>
  <div class="modal-sub" id="food-slot-modal-sub">{foodModal.sub ?? t('tercer.foodSubSelf')}</div>

  <div id="food-teammate-picker" style="display:none; margin-top:10px;" style:display={foodModal.pickerOpen ? 'block' : 'none'}>
    <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;">
      <span>{t('tercer.assignTo')}</span>
      <select id="food-teammate-select" bind:value={foodModal.selected} onchange={(e) => onFoodTeammateChange(e.currentTarget.value)} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy); background:var(--white);">{#each foodModal.options as p}<option value={p.id}>{p.name}</option>{/each}</select>
    </label>
  </div>

  <label style="display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-top:10px;">
    <span>{t('tercer.whatBring')}</span>
    <input type="text" id="food-slot-input" bind:value={foodModal.detail} placeholder={t('tercer.foodPlaceholder')} style="font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);">
  </label>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeFoodSlotModal}>{t('att.cancel')}</button>
    <button class="btn" id="food-slot-confirm-btn" onclick={confirmFoodSlot}>{foodModal.confirmText}</button>
  </div>
</Modal>
