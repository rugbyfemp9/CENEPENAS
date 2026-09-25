import { mountAt, mountInto } from '../../lib/mount.js';
import GymHub from './GymHub.svelte';
import GymEntrenamiento from './GymEntrenamiento.svelte';
import GymDia from './GymDia.svelte';
import GymEquipo from './GymEquipo.svelte';
import GymRmModal from './GymRmModal.svelte';
import GymRmHistoryModal from './GymRmHistoryModal.svelte';
import GymCheckinModal from './GymCheckinModal.svelte';
import GymRoutineUploadModal from './GymRoutineUploadModal.svelte';
import {
  refresh, loadAfterLogin, loadGymWeeklyRoutine, loadGymRm, calculateGymQuickRm, loadGymAttendanceToday,
  resetGymRmCalcBanner, resetGymQuickCalc,
} from './gym.svelte.js';

export function install(bridge) {
  mountInto(GymHub, '#sec-gym');
  mountInto(GymEntrenamiento, '#sec-gym-entrenamiento');
  mountInto(GymDia, '#sec-gym-entrenamiento-dia');
  mountInto(GymEquipo, '#sec-gym-equipo');
  mountAt(GymRmModal, 'gym-rm-modal');
  mountAt(GymRmHistoryModal, 'gym-rm-history-modal');
  mountAt(GymCheckinModal, 'gym-checkin-modal');
  mountAt(GymRoutineUploadModal, 'gym-routine-upload-modal');

  bridge.gym = {
    // Al iniciar sesión (auth.js): ejercicios, marcas, rutina y asistencia de hoy, y
    // sus suscripciones en tiempo real.
    loadAfterLogin,
    // setSection: al entrar en cada pantalla del Gym se refresca su contenido de verdad
    // (no solo lo que ya había en memoria), por si ha cambiado desde otro dispositivo.
    onEnterTraining() {
      loadGymWeeklyRoutine(); // trae la rutina real de Supabase (ya dispara el archivado si toca)
      loadGymRm();
    },
    // La calculadora rápida vive al final de la tabla de cada día.
    onEnterDayDetail: calculateGymQuickRm,
    onEnterTeam() {
      loadGymAttendanceToday(); // trae la asistencia real de Supabase, no solo lo que había en memoria
      refresh();
    },
    // Al salir del detalle de un día se vacían las dos calculadoras.
    onLeaveDayDetail() {
      resetGymRmCalcBanner();
      resetGymQuickCalc();
    },
    // El código antiguo ha cambiado el roster (loadPlantilla, avatares) o el perfil
    // propio (rol → quién puede subir la rutina, añadir ejercicios generales...).
    refresh,
  };
}
