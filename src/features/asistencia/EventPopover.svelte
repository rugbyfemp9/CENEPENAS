<script>
  // Popover con el detalle de un evento (o cumpleaños) del calendario.
  import Modal from '../../lib/Modal.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import {
    eventPopover as p, closeEventPopover, editEventFromPopover, deleteEventFromPopover,
  } from './calendar.svelte.js';
</script>

<Modal id="event-info-modal" bind:open={() => p.open, (v) => { if (v) p.open = true; else closeEventPopover(); }} boxStyle="max-width:340px;">
  <button type="button" class="eventpop-close" onclick={closeEventPopover} aria-label={t('att.close')} title={t('att.close')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <div class="eventpop-date" id="eventpop-date">{p.date}</div>
  <div class="eventpop-head-row">
    <h3 id="eventpop-title">{p.title ?? t('att.eventInfoTitle')}</h3>
    <span class={p.typeClass} id="eventpop-type">{p.typeText ?? t('att.training')}</span>
  </div>
  <div class="eventpop-meta" id="eventpop-meta">{#if p.meta}{#if p.meta.place}{#if p.meta.placeMapsUrl}<div class="eventpop-meta-line">📍 <a class="att-detail-location-link" href={safeUrl(p.meta.placeMapsUrl)} target="_blank" rel="noopener">{p.meta.place}</a></div>{:else}<div class="eventpop-meta-line">📍 {p.meta.place}</div>{/if}{/if}{#if p.meta.meet || p.meta.start}<div class="eventpop-meta-line eventpop-meta-times">{#if p.meta.meet}<span>{p.meta.meet}</span>{/if}{#if p.meta.start}<span>{p.meta.start}</span>{/if}</div>{/if}{/if}</div>
  <div class="eventpop-actions" id="eventpop-actions" style:display={p.meta ? (p.showActions ? 'flex' : 'none') : null}>
    <button class="btn-ghost" onclick={editEventFromPopover}>{t('att.edit')}</button>
    <button class="btn-danger" onclick={deleteEventFromPopover}>{t('att.delete')}</button>
  </div>
</Modal>
