<script>
  // Sidebar de escritorio: marca, selector de idioma ES / CAT y un enlace directo por
  // sección. El botón activo del selector de idioma lo marca applyI18n() (src/lib/i18n.svelte.js).
  import Crest from './Crest.svelte';
  import { t } from '../lib/i18n.svelte.js';
  import { setLang } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';
  import { visibility } from './visibility.svelte.js';
</script>

<aside class="sidebar">
  <div class="brand">
    <Crest />
    <div class="name"><b>CNPENAS</b><span>{t('brand.subtitle')}</span></div>
  </div>
  <div class="lang-switch" role="group" aria-label="Idioma / Idioma">
    <button type="button" data-lang="es" onclick={() => setLang('es')}>ES</button>
    <button type="button" data-lang="ca" onclick={() => setLang('ca')}>CAT</button>
  </div>
  <nav class="nav">
    <button class:active={nav.sidebarTab === 'inicio'} data-section="inicio" onclick={() => setSection('inicio')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7M5 10v9a1 1 0 001 1h4v-4v6h4a1 1 0 001-1v-9"/></svg>
      <span>{t('nav.inicio')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'asistencia'} data-section="asistencia" onclick={() => setSection('asistencia')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      <span>{t('nav.asistencia')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'multas'} data-section="multas" onclick={() => setSection('multas')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h12M4 14h9M18.4 6.4A9 9 0 1 0 18.4 17.6"/></svg>
      <span>{t('nav.multas')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'tercer'} data-section="tercer" id="sidebar-tercer" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('tercer')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9h9v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9z"/><path d="M14 11h2a2 2 0 012 2v1a2 2 0 01-2 2h-2"/><path d="M5 9c0-2 .8-3.2 2-4 .8.8 2 .8 2 0 .8.8 2 .8 2 0 1.2.8 2 2 2 4"/></svg>
      <span>{t('nav.tercer')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'comisiones'} data-section="comisiones" id="sidebar-comisiones" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('comisiones')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 3h10a2 2 0 012 2v14a2 2 0 01-2 2H9M9 3v18"/></svg>
      <span>{t('nav.comisiones')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'tricount'} data-section="tricount" id="sidebar-tricount" style:display={visibility.staffPagesHidden ? 'none' : null} onclick={() => setSection('tricount')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2z"/><path d="M9 7h6M9 11h6"/></svg>
      <span>{t('nav.tricount')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'liga'} data-section="liga" onclick={() => setSection('liga')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3"/></svg>
      <span>{t('nav.liga')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'fantasy'} data-section="fantasy" onclick={() => setSection('fantasy')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><g transform="rotate(-40 12 12)"><ellipse cx="12" cy="12" rx="9.5" ry="5.5"/><path d="M4.5 12h15"/><path d="M9 9.8v4.4M12 9.3v5.4M15 9.8v4.4"/></g></svg>
      <span>{t('nav.fantasy')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'jugadas'} data-section="jugadas" onclick={() => setSection('jugadas')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6.5 7.5l3 3M9.5 7.5l-3 3"/><circle cx="16.5" cy="16.5" r="2"/><path d="M8 15c2.5 0 5-2 6.5-5.5"/><path d="M12 9.5l2.5.5.5-2.5"/></svg>
      <span>{t('nav.jugadas')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'galeria'} data-section="galeria" onclick={() => setSection('galeria')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="M21 15l-5-5-9 9"/></svg>
      <span>{t('nav.galeria')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'plantilla'} data-section="plantilla" onclick={() => setSection('plantilla')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      <span>{t('nav.plantilla')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'gym'} data-section="gym" onclick={() => setSection('gym')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5l11 11M4 8l3-3 2 2-3 3-2-2zM15 17l3-3 2 2-3 3-2-2zM2 10l2-2M12 20l2-2M9.5 9.5l1.5-1.5M13 13l1.5-1.5"/></svg>
      <span>{t('nav.gym')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'partidos'} data-section="partidos" onclick={() => setSection('partidos')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="15" r="2.3"/><path d="M12 10v3M9.5 14l1.3 1.3M14.5 14l-1.3 1.3"/></svg>
      <span>{t('nav.partidos')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'wellness-staff'} data-section="wellness-staff" id="sidebar-wellness-staff" style:display={visibility.wellnessStaff ? null : 'none'} onclick={() => setSection('wellness-staff')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
      <span>{t('nav.wellnessStaff')}</span>
    </button>
    <button class:active={nav.sidebarTab === 'perfil'} data-section="perfil" onclick={() => setSection('perfil')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      <span>{t('nav.perfil')}</span>
    </button>
  </nav>
  <div class="footer-note">{t('footer.season')}</div>
</aside>
