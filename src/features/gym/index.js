import { mountAt, mountInto } from '../../lib/mount.js';
import GymHub from './GymHub.svelte';
import GymEntrenamiento from './GymEntrenamiento.svelte';
import GymDia from './GymDia.svelte';
import GymEquipo from './GymEquipo.svelte';
import GymRmModal from './GymRmModal.svelte';
import GymRmHistoryModal from './GymRmHistoryModal.svelte';
import GymCheckinModal from './GymCheckinModal.svelte';
import GymRoutineUploadModal from './GymRoutineUploadModal.svelte';

export function install() {
  mountInto(GymHub, '#sec-gym');
  mountInto(GymEntrenamiento, '#sec-gym-entrenamiento');
  mountInto(GymDia, '#sec-gym-entrenamiento-dia');
  mountInto(GymEquipo, '#sec-gym-equipo');
  mountAt(GymRmModal, 'gym-rm-modal');
  mountAt(GymRmHistoryModal, 'gym-rm-history-modal');
  mountAt(GymCheckinModal, 'gym-checkin-modal');
  mountAt(GymRoutineUploadModal, 'gym-routine-upload-modal');
}
