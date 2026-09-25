// Idioma reactivo para los componentes de Svelte. El diccionario y t() siguen en
// public/js/core/i18n.js; setLang() avisa con el evento "app:langchange" y aquí se
// guarda el idioma en un $state, así que todo lo que llame a t() en una plantilla
// se vuelve a pintar solo al cambiar de idioma.
import { legacy } from './legacy.js';

const state = $state({ lang: legacy.lang });

window.addEventListener('app:langchange', (e) => { state.lang = e.detail; });

export function t(key, vars) {
  state.lang; // dependencia reactiva
  return legacy.t(key, vars);
}
