<script>
  // COMISIONES: hub con una tarjeta por comisión.
  import { t } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';
</script>

<section class="section" class:active={nav.current === 'comisiones'} id="sec-comisiones">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="back-link" onclick={() => setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
  <div class="section-head"><h2>{t('nav.comisiones')}</h2></div>
  <div class="vestuario-grid">
    <button class="vest-card i-comi-activitats" onclick={() => setSection('comi-activitats')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-5 2 2-5 5-2z"/></svg></div>
      <div class="txt"><b>Comi Activitats</b></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-comi-xarxes" onclick={() => setSection('comi-xarxes')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.2 10.8l6.6-3.6M8.2 13.2l6.6 3.6"/></svg></div>
      <div class="txt"><b>Comi Xarxes</b></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-comi-tercer-temps" onclick={() => setSection('comi-tercer-temps')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9h9v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"/><path d="M14 11h2a2 2 0 012 2v1a2 2 0 01-2 2h-2"/><path d="M5 9c0-2 .8-3.2 2-4 .8.8 2 .8 2 0 .8.8 2 .8 2 0 1.2.8 2 2 2 4"/></svg></div>
      <div class="txt"><b>Comi Tercer Temps</b></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-comi-tesoreria" onclick={() => setSection('comi-tesoreria')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4c0 1.5 1.2 2.5 3 2.5s3-1 3-2.5"/><path d="M7.5 6.5C5.5 9 4 12 4 15a6 6 0 006 6h4a6 6 0 006-6c0-3-1.5-6-3.5-8.5h-9z"/><path d="M12 12v5M10.3 14h3.4"/></svg></div>
      <div class="txt"><b>Comi Tesoreria</b></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-comi-gira" onclick={() => setSection('comi-gira')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div>
      <div class="txt"><b>Comi Gira</b></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
  </div>
</section>
