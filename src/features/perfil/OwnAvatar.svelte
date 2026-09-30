<script>
  // Contenido del avatar propio (Mi perfil / barra superior). Igual que Avatar.svelte,
  // pero si no hay foto subida, en vez de iniciales se muestra el escudo del club entero
  // (sin recortar y sin el cuadrado de color de fondo detrás: eso lo quita la clase
  // .avatar-logo-fallback que pone quien lo usa). Antes del primer renderProfile() se
  // ve el texto inicial "TÚ".
  import InjuryBadge from '../../lib/InjuryBadge.svelte';
  import { t } from '../../lib/i18n.svelte.js';
  import { safeUrl } from '../../lib/url.js';
  import { perfil } from './perfil.svelte.js';
</script>

{#if perfil.avatar}{#if perfil.avatar.url}<img src={safeUrl(perfil.avatar.url)} alt="">{:else}<img src="assets/img/logo.png" alt="">{/if}<InjuryBadge injured={perfil.avatar.injured} injuryIcon={perfil.avatar.injuryIcon} />{:else}{t('profile.meShort')}{/if}
