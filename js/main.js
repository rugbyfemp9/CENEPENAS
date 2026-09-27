/* ================= ARRANQUE =================
   Todos los demás archivos de js/ solo declaran funciones y estado (más algún
   addEventListener). Lo que se ejecuta al arrancar la app vive aquí, dentro de
   legacyBoot(), en el mismo orden en que se ejecutaba cuando todo estaba en un único
   <script> de index.html.

   legacyBoot() la llama src/main.js (la parte en Svelte) cuando ya ha montado sus
   componentes y ha dejado listo window.appBridge, que es por donde este código llama
   a las secciones ya migradas. Si añades código que deba ejecutarse al arrancar,
   ponlo aquí y no suelto en el archivo de su sección. */
function legacyBoot(){
  appBridge.core.applyI18n();

  // Si ya había una sesión abierta (recarga de página), entramos directos sin pedir login
  appBridge.core.supabase.auth.getSession().then(({ data }) => {
    if(data.session){
      onAuthenticated(data.session.user);
    }
  });

  // Asistencia (Svelte): los entrenos de la temporada y el partido fijo contra Santboi
  // se generan aquí, en el mismo momento que antes, y luego se pinta la lista.
  appBridge.asistencia.initEvents();

  appBridge.asistencia.renderList();
  appBridge.partidos.renderNextMatchBanner();
  appBridge.wellness.renderReminderBanner();
  appBridge.asistencia.toggleAddButtonVisibility();
  // Los botones "Añadir multa" / "Editar multas" (Svelte) dependen solos de la sesión.

  appBridge.perfil.render();

  // Comi Tesoreria, Comi Tercer Temps y Tricount (Svelte) se pintan solas al montarse;
  // sus datos no se piden aquí al arrancar (se pedían de más en TODAS las sesiones,
  // aunque nadie entrara nunca en esas pestañas): setSection() los carga cada vez
  // que se entra de verdad en cada una.

  appBridge.avisos.refreshPinned();

  // Gym (Svelte) se pinta solo al montarse.

  appBridge.fantasy.init();
  // Tercer tiempo (Svelte): primer pintado y comprobación cada minuto de las multas 3T.
  appBridge.tercerTiempo.render();
  appBridge.tercerTiempo.startAutoFinesTimer();

  // Estado inicial del historial: la app siempre arranca en "Inicio", así que dejamos
  // esa como primera entrada (reemplazando la que ya puso el navegador al cargar la
  // URL) para que el primer "atrás" tenga con qué comparar.
  history.replaceState({ section: 'inicio' }, '', location.href);

  // Botón/gesto "atrás" del móvil (y también el de escritorio): en vez de salir de la
  // web, navega hacia atrás dentro de la propia app.
  //  1) Si hay algún modal abierto, el "atrás" solo lo cierra (no cambia de sección).
  //  2) Si no hay modal abierto, se vuelve a la sección anterior del historial.
  window.addEventListener('popstate', function(event){
    const openModal = document.querySelector('.modal-overlay.active');
    if(openModal){
      openModal.classList.remove('active');
      openModal.dispatchEvent(new Event('modal:close'));
      // Esta pulsada de "atrás" ya se ha consumido en cerrar el modal: reponemos la
      // entrada de historial para que la sección de debajo no cambie todavía.
      history.pushState(event.state || { section: 'inicio' }, '', location.href);
      return;
    }
    const id = (event.state && event.state.section) || 'inicio';
    setSection(id, { fromPopState: true });
  });
}
