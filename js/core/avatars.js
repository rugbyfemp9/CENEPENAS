// Devuelve el contenido de un .avatar: la foto si existe, o si no las iniciales/texto de reserva,
// más la insignia de lesión si aplica. Lo usan las listas que siguen en el código antiguo
// (Asistencia, Lista de partidos, Tercer tiempo); las secciones ya migradas a Svelte
// (Jugadoras, Multas, Mi perfil...) usan src/lib/Avatar.svelte (mismo marcado).
function avatarHtml(url, fallbackText, injured, injuryIcon){
  const badge = injuryBadgeHtml(injured, injuryIcon);
  if(url) return `<img src="${url}" alt="" loading="lazy">` + badge;
  return escapeHtml(fallbackText) + badge;
}

// ---- Insignia de "lesionada" (botiquín) o "tocada" (🤕) en los avatares ----
function injuryBadgeHtml(injured, injuryIcon){
  if(!injured) return '';
  if(injuryIcon === 'tocada'){
    return `<span class="avatar-injured-badge icon-tocada" title="Tocada"><span class="emoji">🤕</span></span>`;
  }
  return `<span class="avatar-injured-badge" title="Lesionada"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M12 11v6M9 14h6"/></svg></span>`;
}
