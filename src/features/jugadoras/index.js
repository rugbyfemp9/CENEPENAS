import { mountInto } from '../../lib/mount.js';
import Jugadoras from './Jugadoras.svelte';
import { onLangChange } from './jugadoras.svelte.js';

export function install() {
  mountInto(Jugadoras, '#sec-plantilla');

  // Antes setLang() (js/core/i18n.js) volvía a pintar la tabla y recargaba las
  // estadísticas si estaba abierta esa pestaña: se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', onLangChange);
}
