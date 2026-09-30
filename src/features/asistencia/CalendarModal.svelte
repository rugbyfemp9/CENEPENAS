<script>
  // Calendario mensual: filtros (barra lateral), navegación por meses y cuadrícula.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import {
    cal, getGridView, closeCalendarModal, toggleCalSidebar, calShiftMonth, toggleCalFilter, openEventPopover,
  } from './calendar.svelte.js';
  import { openAddEventModal } from './editor.svelte.js';

  const g = $derived(getGridView());
  const filterItems = [
    { type: 'training', key: 'att.trainings' },
    { type: 'match', key: 'att.matches' },
    { type: 'birthday', key: 'att.birthdays' },
    { type: 'plan', key: 'att.plans' },
  ];
  const weekdays = ['att.weekdayMon', 'att.weekdayTue', 'att.weekdayWed', 'att.weekdayThu', 'att.weekdayFri', 'att.weekdaySat', 'att.weekdaySun'];
</script>

<Modal id="calendar-modal" bind:open={() => cal.open, (v) => { if (v) cal.open = true; else closeCalendarModal(); }} boxClass="cal-modal-box">
  <div class="cal-modal-head">
    <div class="head-left">
      <button class="cal-hamburger-btn" id="cal-hamburger" class:active={cal.sidebarOpen} onclick={toggleCalSidebar} aria-label={t('att.showFilters')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <h3>{t('att.calendarTitle')}</h3>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <button class="cal-hamburger-btn" onclick={() => openAddEventModal()} aria-label={t('att.addEvent')} title={t('att.addEvent')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <button class="modal-close" onclick={closeCalendarModal}>✕</button>
    </div>
  </div>
  <div class="cal-modal-body">
    <div class="cal-modal-sidebar" id="cal-sidebar" class:open={cal.sidebarOpen}>
      <div class="cal-filter-label">{t('att.viewLabel')}</div>
      {#each filterItems as item}
        <label class="cal-filter-item" id="cal-filter-{item.type}" class:dim={cal.dim[item.type]}>
          <input type="checkbox" checked={cal.filters[item.type]} onchange={(e) => toggleCalFilter(item.type, e.currentTarget.checked)}>
          <span class="dot t-{item.type}"></span> <span>{t(item.key)}</span>
        </label>
      {/each}
    </div>
    <div class="cal-modal-main">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick={() => calShiftMonth(-1)}>‹</button>
        <div class="cal-month-label" id="cal-month-label">{g ? g.label : t('att.calendarDefaultMonth')}</div>
        <button class="cal-nav-btn" onclick={() => calShiftMonth(1)}>›</button>
      </div>
      <div class="cal-weekdays">
        {#each weekdays as key}<span>{t(key)}</span>{/each}
      </div>
      <div class="cal-grid" id="cal-grid">
        {#if g}
          {#each { length: g.blanks } as _}<div class="cal-day empty"></div>{/each}
          {#each g.days as day}
            <div class="cal-day" class:today={day.today}>
              <div class="num">{day.d}</div>
              {#each day.chips as chip}
                <button class="cal-chip t-{chip.type}" onclick={() => openEventPopover(chip.chipId)}>{chip.label}</button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</Modal>
