<script>
  // Sección "Jugadoras" (sec-plantilla): cabecera con el botón de actualizar, pestañas
  // "Datos" / "Estadísticas" y sus dos paneles.
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { plantilla, loadPlantilla, setPlantillaTab } from './jugadoras.svelte.js';
  import PlantillaDatos from './PlantillaDatos.svelte';
  import PlantillaStats from './PlantillaStats.svelte';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head">
  <h2>{t('plantilla.title')}</h2>
  <div style="display:flex; gap:8px;">
    <button class="cal-open-btn" onclick={() => loadPlantilla()} aria-label={t('plantilla.refresh')} title={t('plantilla.refresh')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></svg>
    </button>
  </div>
</div>
<div class="gym-day-group-tabs">
  <button class="gym-day-group-tab" class:active={plantilla.activeTab === 'datos'} data-plantilla-tab="datos" onclick={() => setPlantillaTab('datos')}>{t('plantilla.tabData')}</button>
  <button class="gym-day-group-tab" class:active={plantilla.activeTab === 'estadisticas'} data-plantilla-tab="estadisticas" onclick={() => setPlantillaTab('estadisticas')}>{t('plantilla.tabStats')}</button>
</div>

<PlantillaDatos />

<PlantillaStats />
