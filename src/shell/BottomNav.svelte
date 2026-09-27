<script>
  // NAV INFERIOR — solo visible en móvil.
  import { t } from '../lib/i18n.svelte.js';
  import { nav, setSection } from './navigation.svelte.js';
</script>

<nav class="bottom-nav">
  <button class:active={nav.bottomTab === 'inicio'} data-tab="inicio" onclick={() => setSection('inicio')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"/></svg>
    <span>{t('nav.inicio')}</span>
  </button>
  <button class:active={nav.bottomTab === 'asistencia'} data-tab="asistencia" onclick={() => setSection('asistencia')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    <span>{t('nav.asistencia')}</span>
  </button>
  <button class:active={nav.bottomTab === 'vestuario'} data-tab="vestuario" onclick={() => setSection('vestuario')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.5 21l-1-9.5a3 3 0 00-2-2.7L14 7V5.5a2 2 0 10-4 0V7l-3.5 1.8a3 3 0 00-2 2.7L3.5 21M12 7v3l-2 2M12 10l2 2"/></svg>
    <span>{t('vestuario.title')}</span>
  </button>
  <button class:active={nav.bottomTab === 'perfil'} data-tab="perfil" onclick={() => setSection('perfil')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
    <span>{t('nav.perfilShort')}</span>
  </button>
</nav>
