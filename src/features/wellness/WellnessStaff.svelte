<script>
  // WELLNESS / RPE — COS TÈCNIC: vista d'anàlisi agregada de tot l'equip. Només
  // visible per a rols de gestió (ver canViewWellnessStaff(), src/lib/permissions.js):
  // setSection() redirige a Vestuario si alguien intenta entrar a mano.
  import { t } from '../../lib/i18n.svelte.js';
  import { legacy } from '../../lib/legacy.js';
  import { staff, setWellnessStaffSubtab } from './wellness-staff.svelte.js';
  import StaffSession from './StaffSession.svelte';
  import StaffHistory from './StaffHistory.svelte';
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="back-link" onclick={() => legacy.setSection('vestuario')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg> <span>{t('fines.backLabel')}</span></div>
<div class="section-head"><h2>{t('nav.wellnessStaff')}</h2></div>

<!-- Subpestañas: análisis de una sesión concreta vs. histórico/tendencias de todo
     el equipo (ver setWellnessStaffSubtab()). -->
<div class="wstaff-subtabs">
  <button class="wstaff-subtab" class:active={staff.subtab === 'session'} id="wstaff-subtab-btn-session" onclick={() => setWellnessStaffSubtab('session')}>{t('wstaff.subtabSession')}</button>
  <button class="wstaff-subtab" class:active={staff.subtab === 'history'} id="wstaff-subtab-btn-history" onclick={() => setWellnessStaffSubtab('history')}>{t('wstaff.subtabHistory')}</button>
</div>

<!-- PESTAÑA 1: ANÁLISIS DE LA SESIÓN (vista diaria de un entreno/partido concreto) -->
<div class="wstaff-tab-panel" class:active={staff.subtab === 'session'} id="wstaff-tab-session">
  <StaffSession />
</div>

<!-- PESTAÑA 2: HISTÓRICO Y TENDENCIAS (Fase 2 — evolución de todo el equipo) -->
<div class="wstaff-tab-panel" class:active={staff.subtab === 'history'} id="wstaff-tab-history">
  <StaffHistory />
</div>
