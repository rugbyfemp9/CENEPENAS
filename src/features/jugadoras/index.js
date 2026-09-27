import { mountInto } from '../../lib/mount.js';
import Jugadoras from './Jugadoras.svelte';
import {
  plantilla, loadPlantilla, subscribeToProfilesRealtime, loadPlantillaStats, onLangChange,
} from './jugadoras.svelte.js';

export function install(bridge) {
  mountInto(Jugadoras, '#sec-plantilla');

  // Antes setLang() (js/core/i18n.js) volvía a pintar la tabla y recargaba las
  // estadísticas si estaba abierta esa pestaña: se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', onLangChange);

  bridge.jugadoras = {
    // Al iniciar sesión (auth.js): recarga profiles,
    // que es lo que rellena roster/rosterById y los grupos del Tercer tiempo.
    load: loadPlantilla,
    subscribeRealtime: subscribeToProfilesRealtime,
    // Para refrescar las estadísticas cuando llega un acta nueva (actas.js).
    get activeTab() { return plantilla.activeTab; },
    loadStats: loadPlantillaStats,
  };
}
