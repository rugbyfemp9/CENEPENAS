<script>
  // Asistencia: cabecera (filtro, calendario, añadir evento) y lista de eventos agrupada por mes.
  import { t } from '../../lib/i18n.svelte.js';
  import { attList, getListView, toggleAttHistoryView } from './asistencia.svelte.js';
  import { openCalendarModal } from './calendar.svelte.js';
  import { openAttAddTypeModal } from './editor.svelte.js';
  import EventCard from './EventCard.svelte';

  const v = $derived(getListView());
</script>

{#snippet historyToggle()}
  <button class="att-history-toggle" onclick={toggleAttHistoryView} aria-label={v.toggleAria}>
    <span id="att-history-toggle-label">{v.toggleLabel}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
  </button>
{/snippet}

<div class="section-head">
  <h2>{t('nav.asistencia')}</h2>
  <div style="display:flex; align-items:center; gap:8px;">
    <button class="cal-open-btn" onclick={() => { attList.filterModalOpen = true; }} aria-label={t('att.filterEvents')} title={t('att.filterEvents')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>
    </button>
    <button class="cal-open-btn" onclick={openCalendarModal} aria-label={t('att.viewCalendar')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
    </button>
    <!-- Sólo visible para roles con permiso de gestión (ver toggleAttAddButtonVisibility) -->
    <button class="cal-open-btn" id="att-add-event-btn" onclick={openAttAddTypeModal} aria-label={t('att.addEvent')} title={t('att.addEvent')} style:display={attList.canAdd ? null : 'none'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
    </button>
  </div>
</div>
<div id="att-event-list">
  {#if v}
    {#each v.groups as group, i}
      <div class={i === 0 ? 'att-month-heading att-month-heading--with-toggle' : 'att-month-heading'}>
        <span>{group.label}</span>{#if i === 0}{@render historyToggle()}{/if}
      </div>
      {#each group.events as card}
        <EventCard {card} />
      {/each}
    {:else}
      <div class="att-month-heading att-month-heading--with-toggle"><span></span>{@render historyToggle()}</div>
      <div class="att-roster-empty">{v.emptyText}</div>
    {/each}
  {/if}
</div>
