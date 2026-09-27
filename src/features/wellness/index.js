import { mountAt, mountInto } from '../../lib/mount.js';
import WellnessReminderBanner from './WellnessReminderBanner.svelte';
import WellnessModal from './WellnessModal.svelte';
import WellnessStaff from './WellnessStaff.svelte';
import StaffAlertModal from './StaffAlertModal.svelte';
import StaffPlayerHistoryModal from './StaffPlayerHistoryModal.svelte';
import { openWellnessModal, renderWellnessReminderBanner } from './wellness.svelte.js';
import { onEnterStaffPanel, goToWellnessStaffAnalysis } from './wellness-staff.svelte.js';

export function install(bridge) {
  mountAt(WellnessReminderBanner, 'wellness-reminder-banner');
  mountInto(WellnessStaff, '#sec-wellness-staff');
  mountAt(StaffAlertModal, 'wstaff-alert-modal');
  mountAt(StaffPlayerHistoryModal, 'wstaff-player-history-modal');
  mountAt(WellnessModal, 'wellness-modal');

  // Antes setLang() (js/core/i18n.js) volvía a calcular el banner de Inicio (con su
  // consulta a Supabase): se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', () => renderWellnessReminderBanner());

  bridge.wellness = {
    // Botón 📊 del detalle de un evento (solo jugadoras, asistencia.js / index.html).
    openModal: openWellnessModal,
    // Banner "pendiente de valorar" de Inicio: al arrancar (legacyBoot) y tras
    // refrescar los eventos compartidos (eventos.js).
    renderReminderBanner: renderWellnessReminderBanner,
    // Botones 📊 de Cos Tècnic en las tarjetas (eventos.js) y en el detalle de un evento.
    goToStaffAnalysis: goToWellnessStaffAnalysis,
    // Al entrar en la sección, ya comprobado el permiso (navigation.js).
    onEnterStaffPanel,
  };
}
