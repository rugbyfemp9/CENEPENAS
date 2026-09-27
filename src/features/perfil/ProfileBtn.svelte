<script>
  // Botón "TÚ" de la barra superior (móvil): tu avatar, y lleva a Mi perfil.
  import { setSection } from '../../shell/navigation.svelte.js';
  import { perfil } from './perfil.svelte.js';
  import OwnAvatar from './OwnAvatar.svelte';
</script>

<button class="profile-btn" class:avatar-logo-fallback={perfil.avatar && !perfil.avatar.url} id="profile-btn" onclick={() => setSection('perfil')} aria-label="Ver mi perfil"><OwnAvatar /></button>
