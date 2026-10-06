<script>
  // VESTUARIO (hub — punto de entrada en móvil a multas / tercer tiempo / jugadores / calendario)
  // NOTE: el subtítulo de "Tercer tiempo" es fijo ("Próximo: 23 de agosto"), no sale del próximo partido.
  import { t } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';
  import { visibility } from './visibility.svelte.js';
</script>

<section class="section" class:active={nav.current === 'vestuario'} id="sec-vestuario">
  <div class="section-head"><h2>{t('vestuario.title')}</h2></div>
  <div class="vestuario-grid">
    <button class="vest-card i-gym" onclick={() => setSection('gym')}>
      <div class="ic emoji">🏋️</div>
      <div class="txt"><b>{t('nav.gym')}</b><span>{t('vestuario.gym.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-multas" onclick={() => setSection('multas')}>
      <div class="ic emoji">💰</div>
      <div class="txt"><b>{t('nav.multas')}</b><span data-mount="vest-multas-total"></span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-tercer" id="vest-card-tercer" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('tercer')}>
      <div class="ic emoji">🍻</div>
      <div class="txt"><b>{t('nav.tercer')}</b><span>{t('vestuario.tercer.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-plantilla" onclick={() => setSection('plantilla')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
      <div class="txt"><b>{t('nav.plantilla')}</b><span>{t('vestuario.plantilla.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-galeria" onclick={() => setSection('galeria')}>
      <div class="ic emoji">🖼️</div>
      <div class="txt"><b>{t('nav.galeria')}</b><span>{t('vestuario.galeria.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-comisiones" id="vest-card-comisiones" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('comisiones')}>
      <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 3h10a2 2 0 012 2v14a2 2 0 01-2 2H9M9 3v18"/></svg></div>
      <div class="txt"><b>{t('nav.comisiones')}</b><span>{t('vestuario.comisiones.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-liga" onclick={() => setSection('liga')}>
      <div class="ic emoji">🏆</div>
      <div class="txt"><b>{t('nav.liga')}</b><span>{t('vestuario.liga.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-tricount" id="vest-card-tricount" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('tricount')}>
      <div class="ic emoji">🧾</div>
      <div class="txt"><b>{t('tricount.title')}</b><span id="vest-tricount-summary">{t('tricount.vestSubtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-fantasy" onclick={() => setSection('fantasy')}>
      <div class="ic emoji">🏉</div>
      <div class="txt"><b>{t('nav.fantasy')}</b><span>{t('vestuario.fantasy.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-jugadas" onclick={() => setSection('jugadas')}>
      <div class="ic emoji">📋</div>
      <div class="txt"><b>{t('nav.jugadas')}</b><span>{t('vestuario.jugadas.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-partidos" onclick={() => setSection('partidos')}>
      <div class="ic emoji">🏟️</div>
      <div class="txt"><b>{t('nav.partidos')}</b><span>{t('vestuario.partidos.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-wellness-staff" id="vest-card-wellness-staff" style:display={visibility.wellnessStaff ? null : 'none'} onclick={() => setSection('wellness-staff')}>
      <div class="ic emoji">📊</div>
      <div class="txt"><b>{t('nav.wellnessStaff')}</b><span>{t('vestuario.wellnessStaff.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
    <button class="vest-card i-test" onclick={() => setSection('test')}>
      <div class="ic emoji">🧪</div>
      <div class="txt"><b>{t('nav.test')}</b><span>{t('vestuario.test.subtitle')}</span></div>
      <div class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>
  </div>
</section>
