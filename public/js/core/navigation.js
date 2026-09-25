// ================= NAVEGACIÓN CON EL BOTÓN "ATRÁS" DEL MÓVIL =================
// Cada vez que cambiamos de sección se añade una entrada al historial del navegador.
// Así, al pulsar "atrás" en el móvil, en vez de salir de la web se vuelve a la
// sección anterior dentro de la app. Solo se sale de verdad cuando ya no queda
// ninguna sección anterior en el historial (o sea, al llegar a la primera).

function setSection(id, opts){
  opts = opts || {};
  const prevActive = document.querySelector('.section.active');
  const prevId = prevActive ? prevActive.id.replace(/^sec-/, '') : null;

  // Registra el cambio en el historial del navegador, salvo que este cambio de
  // sección venga ya del propio botón "atrás" (evento popstate) — en ese caso el
  // historial ya se ha movido solo y no hay que añadir nada más.
  if(!opts.fromPopState && id !== prevId){
    history.pushState({ section: id }, '', location.href);
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');

  // Al salir del detalle de un día del Gym se vacía la calculadora de %RM avanzada
  // (inputs, resultado y banner), para que no arrastre valores de un ejercicio a
  // otro la próxima vez que se entre. No hace nada si ya estaba vacía.
  if(prevId === 'gym-entrenamiento-dia' && id !== 'gym-entrenamiento-dia'){
    if(typeof resetGymRmCalcBanner === 'function') resetGymRmCalcBanner();
    if(typeof resetGymQuickCalc === 'function') resetGymQuickCalc();
  }

  // Al entrar en Galería desde fuera, siempre se empieza por las temporadas, y se
  // recarga por si Comi Xarxes ha añadido algún álbum desde otra cuenta.
  if(id === 'galeria') appBridge.galeria.onEnter();

  // Al entrar en Fantasy, se refresca el desplegable de partidos y el banquillo de
  // disponibles por si han llegado partidos nuevos o jugadoras nuevas desde que se
  // cargó la página (los datos de Supabase llegan de forma asíncrona).
  if(id === 'fantasy' && typeof refreshFantasyMatchesAndUI === 'function'){
    refreshFantasyMatchesAndUI();
  }

  // Al entrar en Asistencia, se traen los entrenos/partidos que haya creado o editado
  // cualquier otra persona desde otro dispositivo, y se refresca la lista.
  if(id === 'asistencia' && typeof refreshSharedEventsAndUI === 'function'){
    refreshSharedEventsAndUI();
  }

  // Al entrar en Inicio, se comprueba si hay alguna alineación de Fantasy que alguien
  // haya compartido contigo desde que cargaste la página, para mostrar el avisito.
  if(id === 'inicio' && typeof checkInicioSharedLineupBanner === 'function'){
    checkInicioSharedLineupBanner();
  }

  // Al entrar en Inicio también se refrescan los avisos, por si alguien ha publicado
  // uno nuevo (fijado o notificación) desde otro dispositivo.
  if(id === 'inicio'){
    appBridge.avisos.refreshAll();
  }

  // Al entrar en Perfil, se recalculan las estadísticas (partidos jugados, % de
  // asistencia...) por si algo se ha escapado de refrescarse desde otra pantalla.
  if(id === 'perfil'){
    renderProfile();
  }

  // Al entrar en cada pantalla del Gym se refresca su contenido de verdad (no solo
  // se vuelve a pintar lo que ya había en memoria), por si ha cambiado desde otro
  // dispositivo: rutina subida, marca registrada, alguien se ha apuntado...
  if(id === 'gym-entrenamiento'){
    loadGymWeeklyRoutine(); // trae la rutina real de Supabase (ya dispara el archivado si toca)
    loadGymRm();
  }
  // La calculadora rápida vive ahora al final de la tabla de cada día (no en la
  // vista general), así que se refresca al entrar en el detalle del día.
  if(id === 'gym-entrenamiento-dia'){
    calculateGymQuickRm();
  }
  if(id === 'gym-equipo'){
    loadGymAttendanceToday(); // trae la asistencia real de Supabase, no solo lo que había en memoria
    renderGymRanking();
  }
  // Al entrar en Vestuario → Partidos se repinta con los eventos que haya ahora
  // mismo (por si se han creado o editado partidos desde que se cargó la página).
  if(id === 'partidos'){
    renderPartidosList();
  }

  // Wellness / RPE equipo: solo Cos Tècnic (ver canViewWellnessStaff()). Si alguien
  // sin permiso llega aquí a mano (URL, atrás del navegador...), se le redirige a
  // Vestuario en vez de dejar la pantalla vacía o a medio cargar.
  if(id === 'wellness-staff'){
    if(!canViewWellnessStaff()){
      setSection('vestuario');
      return;
    }
    setWellnessStaffSubtab('session');
    // Al entrar en esta página, se muestra siempre por defecto la sesión más reciente
    // (salvo que se venga de un acceso directo a un entreno concreto, ver
    // goToWellnessStaffAnalysis(), que deja marcado wellnessStaffPendingEventId).
    if(wellnessStaffPendingEventId){
      wellnessStaffSelectedEventId = wellnessStaffPendingEventId;
      wellnessStaffPendingEventId = null;
    } else {
      wellnessStaffSelectedEventId = null;
    }
    populateWellnessStaffEventSelect();
    loadWellnessHistoryData();
  }

  // "Tercer tiempo", "Comisiones" y "Tricount": son cosas de las jugadoras, el Cos
  // Tècnic no las ve (ver toggleStaffOnlyPagesVisibility()). Si alguien de Cos Tècnic
  // llega aquí a mano (URL, atrás del navegador...), se le redirige a Vestuario.
  if(STAFF_HIDDEN_SECTIONS.includes(id) && canViewWellnessStaff()){
    setSection('vestuario');
    return;
  }

  // Al entrar en las comisiones con datos guardados en Supabase, se recargan por si
  // han cambiado desde otro dispositivo.
  if(id === 'comi-tesoreria'){
    appBridge.tesoreria.load();
  }
  if(id === 'comi-tercer-temps'){
    appBridge.comiTercerTemps.loadShoppingItems();
    appBridge.comiTercerTemps.loadTreasury();
  }
  if(id === 'tricount'){
    appBridge.tricount.loadExpenses();
    appBridge.tricount.loadSettlements();
  }

  // Sidebar de escritorio: cada sección tiene su propio enlace directo (igual que el
  // hub "Vestuario" de móvil, pero desplegado); las subpáginas resaltan a su padre.
  const sidebarTab = sidebarTabOf[id] || id;
  document.querySelectorAll('.nav button[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sidebarTab);
  });

  // Nav inferior de móvil: agrupa multas/tercer/jugadores/calendario bajo "Vestuario"
  const tab = bottomTabOf[id] || id;
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  window.scrollTo({top:0, behavior:'instant'});
}
