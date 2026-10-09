<script>
  // Tarjeta de un evento en la lista de Asistencia (las reuniones, sin RSVP ni detalle).
  import { openEventDetail } from './asistencia.svelte.js';
  import { setMyRsvp } from './attendance.svelte.js';
  import { openEditEventModal } from './editor.svelte.js';
  import { goToWellnessStaffAnalysis } from '../wellness/wellness-staff.svelte.js';

  let { card } = $props();
</script>

{#if card.type === 'meeting'}
  <div class="att-event" style="cursor:default;">
    {#if card.editLabel}
      <button class="att-event-edit-btn" onclick={(event) => { event.stopPropagation(); openEditEventModal(card.id); }} aria-label={card.editLabel} title={card.editLabel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
    {/if}
    <div class="left">
      <div class="cal-date"><div class="d">{card.date}</div><div class="m">{card.month}</div></div>
      <div class="info">
        <b>{card.label}</b>
        <span>{card.when}</span>
      </div>
    </div>
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="att-event {card.type === 'match' ? 'att-event--match' : ''}" onclick={() => openEventDetail(card.id)}>
    <div class="left">
      <div class="cal-date"><div class="d">{card.date}</div><div class="m">{card.month}</div></div>
      <div class="info">
        <b>{card.label}{#if card.intensity}{' '}<span class="att-event-intensity">{card.intensity}</span>{/if}</b>
        <span>{card.when}</span>
        {#if card.my === 'yes'}
          <span class="rsvp-state ok">{card.rsvpLabel}</span>
        {:else if card.my === 'maybe'}
          <span class="rsvp-state warn">{card.rsvpLabel}</span>
        {:else if card.my === 'no'}
          <span class="rsvp-state bad">{card.rsvpLabel}</span>
        {/if}
      </div>
    </div>
    <div class="actions">
      {#if card.staffLabel}
        <button class="wstaff-quicklink" onclick={(event) => { event.stopPropagation(); goToWellnessStaffAnalysis(card.id); }} aria-label={card.staffLabel} title={card.staffLabel}>📊</button>
      {/if}
      <button class="decline {card.my === 'no' ? 'is-active' : ''}" onclick={(event) => { event.stopPropagation(); setMyRsvp(card.id, 'no', event.currentTarget); }}>{card.declineLabel}</button>
      <button class="maybe {card.my === 'maybe' ? 'is-active' : ''}" onclick={(event) => { event.stopPropagation(); setMyRsvp(card.id, 'maybe', event.currentTarget); }}>{card.maybeLabel}</button>
      <button class="confirm {card.my === 'yes' ? 'is-active' : ''}" onclick={(event) => { event.stopPropagation(); setMyRsvp(card.id, 'yes', event.currentTarget); }}>{card.confirmLabel}</button>
    </div>
  </div>
{/if}
