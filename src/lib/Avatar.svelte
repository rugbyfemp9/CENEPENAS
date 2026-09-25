<script>
  // Contenido de un .avatar (el <span class="avatar"> lo pone quien lo usa): la foto si
  // existe o, si no, las iniciales/texto de reserva, más la insignia de lesión si
  // aplica. Mismo marcado que avatarHtml() en public/js/features/perfil.js.
  import { safeUrl } from './url.js';

  let { url = '', fallback = '', injured = false, injuryIcon = '' } = $props();
</script>

{#if url}<img src={safeUrl(url)} alt="" loading="lazy">{:else}{fallback}{/if}{#if injured}{#if injuryIcon === 'tocada'}<span class="avatar-injured-badge icon-tocada" title="Tocada"><span class="emoji">🤕</span></span>{:else}<span class="avatar-injured-badge" title="Lesionada"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M12 11v6M9 14h6"/></svg></span>{/if}{/if}
