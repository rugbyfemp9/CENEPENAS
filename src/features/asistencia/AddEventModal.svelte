<script>
  // Alta / edición de un evento (entreno, partido o reunión, según la preconfiguración elegida).
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    eventForm as f, closeAddEventModal, saveNewEvent, openDeleteEventConfirm, selectEventIntensity,
  } from './editor.svelte.js';
  import PlaceField from './PlaceField.svelte';

  const labelStyle = 'display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em;';
  const inputStyle = "font-family:'Roboto',sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1.5px solid var(--line); color:var(--navy);";
</script>

<Modal id="add-event-modal" bind:open={() => f.open, (v) => { if (v) f.open = true; else closeAddEventModal(); }} boxStyle="max-width:380px; position:relative;">
  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
    <h3 style="margin-top:0;" id="add-event-modal-title">{f.title ?? t('att.newEventTitle')}</h3>
    <button type="button" class="event-delete-btn" id="event-delete-btn" style:display={f.showDelete ? 'flex' : 'none'} onclick={openDeleteEventConfirm} aria-label={t('att.deleteEventTitle')} title={t('att.deleteEventTitle')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
    </button>
  </div>
  <div class="field-group" style="display:flex; flex-direction:column; gap:12px; margin:14px 0 18px;">
    <label style={labelStyle}>
      <span>{t('att.eventTitleLabel')}</span>
      <input type="text" id="new-event-title" placeholder={f.titlePlaceholder} bind:value={f.titleValue} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span>{t('att.eventDateLabel')}</span>
      <input type="date" id="new-event-date" bind:value={f.date} style={inputStyle}>
    </label>
    <label id="field-meet-time" style={labelStyle} style:display={f.showMeet ? null : 'none'}>
      <span>{t('att.meetTimeLabel')}</span>
      <input type="time" id="new-event-meet-time" bind:value={f.meetTime} style={inputStyle}>
    </label>
    <label style={labelStyle}>
      <span id="field-start-time-label">{f.startLabel ?? t('att.timeOptional')}</span>
      <input type="time" id="new-event-time" bind:value={f.time} style={inputStyle}>
    </label>
    <label id="field-end-time" style={labelStyle}>
      <span>{t('att.eventEndTimeLabel')}</span>
      <input type="time" id="new-event-end-time" bind:value={f.endTime} style={inputStyle}>
    </label>
    <PlaceField {labelStyle} />
    <label id="field-intensity" style={labelStyle} style:display={f.showIntensity ? null : 'none'}>
      <span>{t('att.intensityLabel')}</span>
      <div class="intensity-picker">
        <button type="button" id="intensity-btn-low" class:selected={f.intensity === 'low'} onclick={() => selectEventIntensity('low')} title={t('att.intensityLow')}>✨</button>
        <button type="button" id="intensity-btn-medium" class:selected={f.intensity === 'medium'} onclick={() => selectEventIntensity('medium')} title={t('att.intensityMedium')}>💪</button>
        <button type="button" id="intensity-btn-high" class:selected={f.intensity === 'high'} onclick={() => selectEventIntensity('high')} title={t('att.intensityHigh')}>🔥</button>
      </div>
    </label>
  </div>
  <div class="modal-actions">
    <button class="btn-ghost" onclick={closeAddEventModal}>{t('att.cancel')}</button>
    <button class="btn" onclick={saveNewEvent}>{t('att.save')}</button>
  </div>
</Modal>
