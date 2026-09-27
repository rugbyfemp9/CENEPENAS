import { mountAt, mountInto } from '../../lib/mount.js';
import Perfil from './Perfil.svelte';
import ProfileBtn from './ProfileBtn.svelte';
import EditProfileModal from './EditProfileModal.svelte';
import AvatarAdjustModal from './AvatarAdjustModal.svelte';
import { renderProfile, setEmail } from './perfil.svelte.js';

export function install(bridge) {
  mountAt(ProfileBtn, 'profile-btn');
  mountInto(Perfil, '#sec-perfil');
  mountAt(EditProfileModal, 'edit-profile-modal');
  mountAt(AvatarAdjustModal, 'avatar-adjust-modal');

  // Antes setLang() (js/core/i18n.js) volvía a llamar a renderProfile() (que también
  // recalcula las estadísticas): se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', () => renderProfile());

  bridge.perfil = {
    // Tras iniciar sesión (auth.js), al arrancar (legacyBoot), al entrar en Perfil
    // (navigation.js) y al cambiar asistencias o eventos (asistencia.js, eventos.js).
    render: renderProfile,
    // Email de la cuenta, al iniciar sesión (auth.js).
    setEmail,
  };
}
