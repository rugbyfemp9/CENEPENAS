<script>
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head"><h2>{t('nav.gym')}</h2></div>

<!-- Navegación por 2 tarjetones: cada uno abre su propia pantalla completa -->
<div class="gym-tab-cards">
  <button class="gym-tab-card" data-gym-tab="entrenamiento" onclick={() => legacy.setSection('gym-entrenamiento')}>
    <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5l11 11M4 9l3-3M17 20l3-3M2 11l3-3 3 3-3 3-3-3zM16 5l3-3 3 3-3 3-3-3z"/></svg></div>
    <b>{t('gym.myTraining')}</b>
    <span>{t('gym.myTrainingSubtitle')}</span>
  </button>
  <button class="gym-tab-card" data-gym-tab="equipo" onclick={() => legacy.setSection('gym-equipo')}>
    <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M17 8a3 3 0 100-6M22 20c0-2.6-2.1-4.8-5-5.6"/></svg></div>
    <b>{t('gym.team')}</b>
    <span>{t('gym.teamSubtitle')}</span>
  </button>
</div>
