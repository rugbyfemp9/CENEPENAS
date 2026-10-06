// ================= NAVEGACIÓN ENTRE SECCIONES =================
// (antes js/core/navigation.js y el arranque del historial de js/main.js)
//
// Cada vez que cambiamos de sección se añade una entrada al historial del navegador.
// Así, al pulsar "atrás" en el móvil, en vez de salir de la web se vuelve a la
// sección anterior dentro de la app. Solo se sale de verdad cuando ya no queda
// ninguna sección anterior en el historial (o sea, al llegar a la primera).
//
// `nav` dice qué sección está activa y qué botón del sidebar y de la nav inferior se
// resalta; las secciones (src/shell/Section.svelte) y los menús lo leen.
import { flushSync } from 'svelte';
import { bottomTabOf, sidebarTabOf } from './sections.js';
import { canViewWellnessStaff, STAFF_HIDDEN_SECTIONS } from '../lib/permissions.js';
import { auth } from '../lib/session.svelte.js';
import { showSeasons, loadGalleryData } from '../features/galeria/galeria.svelte.js';
import { refreshFantasyMatchesAndUI, checkInicioSharedLineupBanner } from '../features/fantasy/fantasy.svelte.js';
import { refreshSharedEventsAndUI } from '../features/asistencia/asistencia.svelte.js';
import { refreshAll as refreshNotices } from '../features/avisos/avisos.svelte.js';
import { renderProfile } from '../features/perfil/perfil.svelte.js';
import {
  refresh as refreshGym, loadGymWeeklyRoutine, loadGymRm, calculateGymQuickRm, loadGymAttendanceToday,
  resetGymRmCalcBanner, resetGymQuickCalc,
} from '../features/gym/gym.svelte.js';
import { renderPartidosList } from '../features/partidos/partidos.svelte.js';
import { onEnterStaffPanel } from '../features/wellness/wellness-staff.svelte.js';
import { treasury } from '../features/tesoreria/tesoreria.svelte.js';
import { loadShoppingItems, tercerTreasury } from '../features/comi-tercer-temps/comi-tercer-temps.svelte.js';
import { loadExpenses, loadSettlements } from '../features/tricount/tricount.svelte.js';
import { loadPlays } from '../features/jugadas/jugadas.svelte.js';

export const nav = $state({
  // La app siempre arranca en "Inicio".
  current: 'inicio',
  sidebarTab: 'inicio',
  bottomTab: 'inicio',
});

export function setSection(id, opts) {
  opts = opts || {};
  const prevId = nav.current;

  // Registra el cambio en el historial del navegador, salvo que este cambio de
  // sección venga ya del propio botón "atrás" (evento popstate) — en ese caso el
  // historial ya se ha movido solo y no hay que añadir nada más.
  if (!opts.fromPopState && id !== prevId) {
    history.pushState({ section: id }, '', location.href);
  }

  // La sección nueva se muestra ya (flushSync), antes de sus ganchos de entrada, igual
  // que cuando se le ponía la clase "active" a mano.
  // NOTE: como antes, una sección que no existe deja la app sin ninguna sección activa
  // (la entrada de historial ya se ha añadido) y lanza un error.
  const exists = !!document.getElementById('sec-' + id);
  nav.current = exists ? id : null;
  flushSync();
  if (!exists) throw new TypeError(`No existe la sección "sec-${id}"`);

  // Al salir del detalle de un día del Gym se vacía la calculadora de %RM avanzada
  // (inputs, resultado y banner), para que no arrastre valores de un ejercicio a
  // otro la próxima vez que se entre. No hace nada si ya estaba vacía.
  if (prevId === 'gym-entrenamiento-dia' && id !== 'gym-entrenamiento-dia') {
    resetGymRmCalcBanner();
    resetGymQuickCalc();
  }

  // Al entrar en Galería desde fuera, siempre se empieza por las temporadas, y se
  // recarga por si Comi Xarxes ha añadido algún álbum desde otra cuenta.
  if (id === 'galeria') {
    showSeasons();
    loadGalleryData();
  }

  // Al entrar en Fantasy, se refresca el desplegable de partidos y el banquillo de
  // disponibles por si han llegado partidos nuevos o jugadoras nuevas desde que se
  // cargó la página (los datos de Supabase llegan de forma asíncrona).
  if (id === 'fantasy') {
    refreshFantasyMatchesAndUI();
  }

  // Al entrar en Asistencia, se traen los entrenos/partidos que haya creado o editado
  // cualquier otra persona desde otro dispositivo, y se refresca la lista.
  if (id === 'asistencia') {
    refreshSharedEventsAndUI();
  }

  // Al entrar en Inicio, se comprueba si hay alguna alineación de Fantasy que alguien
  // haya compartido contigo desde que cargaste la página, para mostrar el avisito.
  if (id === 'inicio') {
    checkInicioSharedLineupBanner();
  }

  // Al entrar en Inicio también se refrescan los avisos, por si alguien ha publicado
  // uno nuevo (fijado o notificación) desde otro dispositivo.
  if (id === 'inicio') {
    refreshNotices();
  }

  // Al entrar en Perfil, se recalculan las estadísticas (partidos jugados, % de
  // asistencia...) por si algo se ha escapado de refrescarse desde otra pantalla.
  if (id === 'perfil') {
    renderProfile();
  }

  // Al entrar en cada pantalla del Gym se refresca su contenido de verdad (no solo
  // se vuelve a pintar lo que ya había en memoria), por si ha cambiado desde otro
  // dispositivo: rutina subida, marca registrada, alguien se ha apuntado...
  if (id === 'gym-entrenamiento') {
    loadGymWeeklyRoutine(); // trae la rutina real de Supabase (ya dispara el archivado si toca)
    loadGymRm();
  }
  // La calculadora rápida vive ahora al final de la tabla de cada día (no en la
  // vista general), así que se refresca al entrar en el detalle del día.
  if (id === 'gym-entrenamiento-dia') {
    calculateGymQuickRm();
  }
  if (id === 'gym-equipo') {
    loadGymAttendanceToday(); // trae la asistencia real de Supabase, no solo lo que había en memoria
    refreshGym(); // y el ranking
  }
  // Al entrar en Vestuario → Partidos se repinta con los eventos que haya ahora
  // mismo (por si se han creado o editado partidos desde que se cargó la página).
  if (id === 'partidos') {
    renderPartidosList();
  }

  // Jugadas: se traen de Supabase cada vez que se entra, por si han añadido alguna.
  if (id === 'jugadas') {
    loadPlays();
  }

  // Wellness / RPE equipo: solo Cos Tècnic (ver canViewWellnessStaff()). Si alguien
  // sin permiso llega aquí a mano (URL, atrás del navegador...), se le redirige a
  // Vestuario en vez de dejar la pantalla vacía o a medio cargar.
  if (id === 'wellness-staff') {
    if (!canViewWellnessStaff()) {
      setSection('vestuario');
      return;
    }
    // Pestaña "Sesión", sesión más reciente (o la del acceso directo 📊) e histórico:
    // lo hace el panel (src/features/wellness/).
    onEnterStaffPanel();
  }

  // "Tercer tiempo", "Comisiones" y "Tricount": son cosas de las jugadoras, el Cos
  // Tècnic no las ve (ver src/shell/visibility.svelte.js). Si alguien de Cos Tècnic
  // llega aquí a mano (URL, atrás del navegador...), se le redirige a Vestuario.
  // NOTE: la entrada de historial de la página prohibida se queda, así que "atrás"
  // vuelve a caer en ella y redirige otra vez a Vestuario.
  if (STAFF_HIDDEN_SECTIONS.includes(id) && canViewWellnessStaff()) {
    setSection('vestuario');
    return;
  }

  // Al entrar en las comisiones con datos guardados en Supabase, se recargan por si
  // han cambiado desde otro dispositivo.
  if (id === 'comi-tesoreria') {
    treasury.load();
  }
  if (id === 'comi-tercer-temps') {
    loadShoppingItems();
    tercerTreasury.load();
  }
  if (id === 'tricount') {
    loadExpenses();
    loadSettlements();
  }

  // Sidebar de escritorio: cada sección tiene su propio enlace directo (igual que el
  // hub "Vestuario" de móvil, pero desplegado); las subpáginas resaltan a su padre.
  nav.sidebarTab = sidebarTabOf[id] || id;

  // Nav inferior de móvil: agrupa multas/tercer/jugadores/calendario bajo "Vestuario"
  nav.bottomTab = bottomTabOf[id] || id;
  flushSync();

  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Estado inicial del historial y botón "atrás" (antes al final de legacyBoot()).
export function installHistory() {
  // La app siempre arranca en "Inicio", así que dejamos esa como primera entrada
  // (reemplazando la que ya puso el navegador al cargar la URL) para que el primer
  // "atrás" tenga con qué comparar.
  history.replaceState({ section: 'inicio' }, '', location.href);

  // Botón/gesto "atrás" del móvil (y también el de escritorio): en vez de salir de la
  // web, navega hacia atrás dentro de la propia app.
  //  1) Si hay algún modal abierto, el "atrás" solo lo cierra (no cambia de sección).
  //  2) Si no hay modal abierto, se vuelve a la sección anterior del historial.
  window.addEventListener('popstate', function (event) {
    // Con la app ya abierta, tocar una notificación solo le cambia el # (ver
    // openSectionFromHash): no es un "atrás", así que no se vuelve a Inicio.
    if (openSectionFromHash()) return;

    const openModal = document.querySelector('.modal-overlay.active');
    if (openModal) {
      openModal.classList.remove('active');
      // src/lib/Modal.svelte escucha este evento para cerrarse también por dentro.
      openModal.dispatchEvent(new Event('modal:close'));
      // Esta pulsada de "atrás" ya se ha consumido en cerrar el modal: reponemos la
      // entrada de historial para que la sección de debajo no cambie todavía.
      // NOTE: al reponerla se pierde la entrada de "adelante" (se sustituye por el
      // estado de la sección anterior).
      history.pushState(event.state || { section: 'inicio' }, '', location.href);
      return;
    }
    const id = (event.state && event.state.section) || 'inicio';
    setSection(id, { fromPopState: true });
  });
}

// Las notificaciones de "aún no has respondido" abren la app en ./#asistencia (sw.js,
// o el listener de la app nativa en src/lib/push.svelte.js). Si la app estaba cerrada,
// lo mira onAuthenticated() al iniciar sesión; si ya estaba abierta, solo cambia el #
// (sin recargar) y llega aquí por el popstate. Sin sesión todavía se deja el # para
// onAuthenticated(). Devuelve true si ha entrado en Asistencia.
export function openSectionFromHash() {
  if (location.hash !== '#asistencia' || !auth.userId) return false;
  // Quitamos el # de la entrada que ha creado la notificación, que pasa a ser la de
  // la sección en la que estabas (para que "atrás" vuelva ahí).
  history.replaceState({ section: nav.current || 'inicio' }, '', location.pathname + location.search);
  const openModal = document.querySelector('.modal-overlay.active');
  if (openModal) {
    openModal.classList.remove('active');
    openModal.dispatchEvent(new Event('modal:close'));
  }
  setSection('asistencia');
  return true;
}

// Mientras cualquier <select> de la app tiene el foco (su panel puede estar desplegado),
// ocultamos el menú inferior fijo para que no lo tape con su franja oscura en móvil.
export function watchSelectFocus() {
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'SELECT') document.body.classList.add('select-open');
  });
  document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'SELECT') document.body.classList.remove('select-open');
  });
}
