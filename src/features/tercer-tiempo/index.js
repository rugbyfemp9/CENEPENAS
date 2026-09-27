import { mountAt, mountInto } from '../../lib/mount.js';
import InicioTercerBanner from './InicioTercerBanner.svelte';
import TercerList from './TercerList.svelte';
import TercerHistorial from './TercerHistorial.svelte';
import TercerDetalle from './TercerDetalle.svelte';
import FoodSlotModal from './FoodSlotModal.svelte';
import GroupModal from './GroupModal.svelte';
import GroupsOverviewModal from './GroupsOverviewModal.svelte';
import SwapModal from './SwapModal.svelte';
import { renderThirdTime, subscribeToThirdTimeRealtime, onLangChange } from './tercer-tiempo.svelte.js';
import { loadThirdTimeCovers, loadThirdTimeDebts } from './covers.svelte.js';
import { loadThirdTimeFood } from './food.svelte.js';
import { startThirdTimeAutoFinesTimer } from './auto-fines.js';

export function install(bridge) {
  mountInto(InicioTercerBanner, '#inicio-tercer-banner');
  mountInto(TercerList, '#sec-tercer');
  mountInto(TercerHistorial, '#sec-tercer-historial');
  mountInto(TercerDetalle, '#sec-tercer-detalle');
  mountAt(FoodSlotModal, 'food-slot-modal');
  mountAt(GroupModal, 'tt-group-modal');
  mountAt(GroupsOverviewModal, 'tt-groups-overview-modal');
  mountAt(SwapModal, 'swap-modal');

  // Antes setLang() (js/core/i18n.js) volvía a pintar la tarjeta de Inicio, todo el
  // Tercer tiempo y la comida: se sigue haciendo al cambiar de idioma.
  window.addEventListener('app:langchange', onLangChange);

  bridge.tercerTiempo = {
    // Al arrancar (legacyBoot) y tras crear / editar / borrar un evento (eventos.js).
    render: renderThirdTime,
    // Al arrancar (legacyBoot): comprobación cada minuto de las multas automáticas 3T.
    startAutoFinesTimer: startThirdTimeAutoFinesTimer,
    // Al iniciar sesión (auth.js), ya con el id real fijado.
    loadCovers: loadThirdTimeCovers,
    loadDebts: loadThirdTimeDebts,
    loadFood: loadThirdTimeFood,
    subscribeRealtime: subscribeToThirdTimeRealtime,
  };
}
