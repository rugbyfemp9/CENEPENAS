// Jugadas: el libro de jugadas del equipo, cada una con su animación/vídeo.
//
// De momento son marcadores de posición: todavía no hay vídeos. Cuando lleguen, a cada
// jugada se le pone su `video` (URL del vídeo) y, si se quiere, un `poster` (imagen de
// portada); el título deja de ser "Touch 1" y pasa a ser el nombre de la jugada.
// Para añadir una categoría nueva basta con sumarla a CATEGORIES (y su texto en
// src/lib/i18n/es.js y ca.js, 'jugadas.cat.<id>').

export const CATEGORIES = [
  { id: 'touch', emoji: '🙌' },
  { id: 'mele', emoji: '🤝' },
  { id: 'ataque', emoji: '⚡' },
  { id: 'defensa', emoji: '🛡️' },
  { id: 'patadas', emoji: '🦶' },
];

// title: null → se muestra "<categoría> <n>" (ver playTitle() en jugadas.svelte.js).
const placeholders = (category, count) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i + 1}`, category, number: i + 1, title: null, video: null, poster: null,
  }));

export const PLAYS = [
  ...placeholders('touch', 3),
  ...placeholders('mele', 2),
  ...placeholders('ataque', 3),
  ...placeholders('defensa', 2),
  ...placeholders('patadas', 2),
];
