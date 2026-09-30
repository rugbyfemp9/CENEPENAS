<script>
  // Contenido de un .avatar (el <span class="avatar"> lo pone quien lo usa): la foto si
  // existe o, si no, las iniciales/texto de reserva, más la insignia de lesión si
  // aplica. Mismo marcado que el antiguo avatarHtml() (js/core/avatars.js).
  import InjuryBadge from './InjuryBadge.svelte';
  import { safeUrl } from './url.js';

  let { url = '', fallback = '', injured = false, injuryIcon = '' } = $props();
</script>

{#if url}<img src={safeUrl(url)} alt="" loading="lazy">{:else}{fallback}{/if}<InjuryBadge {injured} {injuryIcon} />
