import { mountAt, mountInto } from '../../lib/mount.js';
import Perfil from './Perfil.svelte';
import ProfileBtn from './ProfileBtn.svelte';
import EditProfileModal from './EditProfileModal.svelte';
import AvatarAdjustModal from './AvatarAdjustModal.svelte';
import { renderProfile } from './perfil.svelte.js';

export function install() {
  mountAt(ProfileBtn, 'profile-btn');
  mountInto(Perfil, '#sec-perfil');
  mountAt(EditProfileModal, 'edit-profile-modal');
  mountAt(AvatarAdjustModal, 'avatar-adjust-modal');

  // Antes setLang() (js/core/i18n.js) volvía a llamar a renderProfile() (que también
  // recalcula las estadísticas): se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', () => renderProfile());
}
