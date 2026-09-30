import { mountAt, mountInto } from '../../lib/mount.js';
import WellnessReminderBanner from './WellnessReminderBanner.svelte';
import WellnessModal from './WellnessModal.svelte';
import WellnessStaff from './WellnessStaff.svelte';
import StaffAlertModal from './StaffAlertModal.svelte';
import StaffPlayerHistoryModal from './StaffPlayerHistoryModal.svelte';
import { renderWellnessReminderBanner, refreshWellnessModalSub } from './wellness.svelte.js';
import { relabelWellnessStaffEvents } from './wellness-staff.svelte.js';

export function install() {
  mountAt(WellnessReminderBanner, 'wellness-reminder-banner');
  mountInto(WellnessStaff, '#sec-wellness-staff');
  mountAt(StaffAlertModal, 'wstaff-alert-modal');
  mountAt(StaffPlayerHistoryModal, 'wstaff-player-history-modal');
  mountAt(WellnessModal, 'wellness-modal');

  // Antes setLang() (js/core/i18n.js) volvía a calcular el banner de Inicio (con su
  // consulta a Supabase): se sigue haciendo al cambiar de idioma. También se traducen
  // las fechas del subtítulo del modal y del desplegable del panel de Staff.
  window.addEventListener('app:langchange', () => {
    renderWellnessReminderBanner();
    refreshWellnessModalSub();
    relabelWellnessStaffEvents();
  });
}
