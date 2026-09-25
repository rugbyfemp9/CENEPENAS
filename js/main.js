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
  applyI18n();

  // Si ya había una sesión abierta (recarga de página), entramos directos sin pedir login
  supabaseClient.auth.getSession().then(({ data }) => {
    if(data.session){
      onAuthenticated(data.session.user);
    }
  });

  attEvents.push(...generateAutoTrainings());

  // Partido añadido manualmente: CNPN (casa) vs Santboi, sábado 26/09/2026.
  attEvents.push({
    id: 'ce1',
    type: 'match',
    label: 'Partido vs Santboi',
    date: 26,
    month: 'Sep',
    iso: '2026-09-26',
    when: `${weekdayFullLabel(6)} ${formatShortDate('2026-09-26')} · ${HOME_VENUE.display} · 17:30h`,
    place: HOME_VENUE.display,
    placeMapsUrl: buildMapsSearchUrl(HOME_VENUE.mapsQuery),
    isHome: true,
    meetTime: '',
    startTime: '17:30h',
    endTime: '',
    attendance: Object.fromEntries(roster.map(p => [p.id, 'pending'])),
    comments: {}
  });

  renderEventList();
  renderNextMatchBanner();
  renderWellnessReminderBanner();
  toggleAttAddButtonVisibility();
  toggleFineAddButtonVisibility();

  renderProfile();

  // Comi Tesoreria, Comi Tercer Temps y Tricount (Svelte) se pintan solas al montarse;
  // sus datos no se piden aquí al arrancar (se pedían de más en TODAS las sesiones,
  // aunque nadie entrara nunca en esas pestañas): setSection() los carga cada vez
  // que se entra de verdad en cada una.

  appBridge.avisos.refreshPinned();

  // Gym (Svelte) se pinta solo al montarse.

  initFantasy();
  renderThirdTime();
  initThirdTimeFood();

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
