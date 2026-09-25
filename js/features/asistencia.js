function renderEventList(){
  const box = document.getElementById('att-event-list');
  if(!box) return;

  // Un evento deja de contar como "próximo" en cuanto pasa su día (a partir de las
  // 23:59 de ese mismo día, hora local), comparando sólo la fecha (yyyy-mm-dd) sin
  // tener en cuenta la hora del evento.
  const todayIso = todayLocalIso();
  const relevantEvents = attEvents
    .filter(ev => attListMode === 'upcoming' ? attEventIso(ev) >= todayIso : attEventIso(ev) < todayIso)
    .filter(ev => attListFilters[attEventType(ev)])
    .sort((a, b) => attListMode === 'upcoming'
      ? attEventIso(a).localeCompare(attEventIso(b))   // próximos: del más cercano al más lejano
      : attEventIso(b).localeCompare(attEventIso(a))   // pasados: del más reciente al más antiguo
    );

  const groups = [];
  let currentKey = null;
  relevantEvents.forEach(ev => {
    const iso = attEventIso(ev);
    const [y, m] = iso.split('-');
    const key = `${y}-${m}`;
    if(key !== currentKey){
      const monthName = monthFullLabel(parseInt(m, 10) - 1);
      groups.push({ key, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + y, events: [] });
      currentKey = key;
    }
    groups[groups.length - 1].events.push(ev);
  });

  // Alterna entre "próximos" y "pasados"; se coloca a la altura de la primera fecha
  // del listado, alineado a la derecha.
  const toggleHtml = `
      <button class="att-history-toggle" onclick="toggleAttHistoryView()" aria-label="${attListMode === 'upcoming' ? t('att.viewPastAria') : t('att.viewUpcomingAria')}">
        <span id="att-history-toggle-label">${attListMode === 'upcoming' ? t('att.viewPast') : t('att.viewUpcoming')}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    `;

  if(!groups.length){
    box.innerHTML = `
        <div class="att-month-heading att-month-heading--with-toggle"><span></span>${toggleHtml}</div>
        <div class="att-roster-empty">${attListMode === 'upcoming' ? t('att.noUpcoming') : t('att.noPast')}</div>
      `;
    renderPartidosList();
    return;
  }

  box.innerHTML = groups.map((group, i) => `
      <div class="att-month-heading${i === 0 ? ' att-month-heading--with-toggle' : ''}">
        <span>${group.label}</span>${i === 0 ? toggleHtml : ''}
      </div>
      ${group.events.map(attEventCardHtml).join('')}
    `).join('');

  // Vestuario → Partidos usa los mismos datos, así que se mantiene sincronizado
  // cada vez que se repinta Asistencia (alta/edición/borrado de evento, RSVP, o
  // sincronización en tiempo real).
  renderPartidosList();
}

function setMyRsvp(eventId, status, btnEl){
  const ev = attEvents.find(e => e.id === eventId);
  if(!ev) return;

  const isUndo = ev.attendance.me === status;
  ev.attendance.me = isUndo ? 'pending' : status; // repetir = deshacer
  if(isUndo) ev.comments.me = '';

  // Efecto de corazones saliendo del botón: azules al confirmar, rotos al declinar
  if(!isUndo) spawnRsvpHeartBurst(btnEl, status);

  renderEventList();
  if(currentEventId === eventId) renderEventDetail();
  renderNextMatchBanner();
  renderProfile();

  // Guarda mi respuesta de forma compartida para que la vean todas las jugadoras
  saveMyAttendanceToStorage(eventId, ev.attendance.me, ev.comments.me);

  // Al declinar, pedimos justificación en un modal
  if(!isUndo && status === 'no'){
    openCommentModal(eventId, 'me');
  }
}

// ---- Asistencia compartida (Supabase, tabla att_attendance) ----
// Cada persona guarda su propia respuesta a un evento en una fila (event_id, user_id),
// con user_id = su ID real de Supabase Auth. No hace falta guardar el nombre: al
// pintar se usa rosterById, que ya trae los nombres reales desde la tabla "profiles".
async function saveMyAttendanceToStorage(eventId, status, comment){
  if(!currentAuthUserId) return; // sin sesión iniciada no hay dónde guardarlo

  if(status === 'pending'){
    // Deshacer = borrar mi fila, para que vuelva a aparecer "Sin contestar"
    const { error } = await supabaseClient.from('att_attendance')
      .delete().eq('event_id', eventId).eq('user_id', currentAuthUserId);
    if(error) console.error('No se ha podido deshacer la asistencia', error);
    return;
  }

  const { error } = await supabaseClient.from('att_attendance').upsert({
    event_id: eventId,
    user_id: currentAuthUserId,
    status,
    comment: comment || '',
    updated_at: new Date().toISOString()
  });
  if(error) console.error('No se ha podido guardar la asistencia', error);
}

// Trae de Supabase la respuesta de TODAS las personas que ya han contestado a este
// evento, y la vuelca en ev.attendance / ev.comments (menos la mía, que ya la tengo
// en memoria más al día). Se llama justo antes de pintar el detalle de un evento.
async function loadEventAttendanceFromStorage(ev){
  const { data, error } = await supabaseClient.from('att_attendance')
    .select('user_id, status, comment').eq('event_id', ev.id);
  if(error || !data) return;

  data.forEach(row => {
    if(row.user_id === currentAuthUserId) return;
    ev.attendance[row.user_id] = row.status;
    if(row.comment) ev.comments[row.user_id] = row.comment;

    // Si esa persona todavía no está en el roster local (p.ej. la Plantilla no se ha
    // cargado aún en esta sesión), la añadimos con lo poco que sabemos de ella para
    // que se pueda pintar en la lista de Asistirán/No asistirán; loadPlantilla() la
    // completará con su nombre real en cuanto termine de cargar.
    if(!rosterById[row.user_id]){
      const newPlayer = {
        id:row.user_id, name:'Alguien', mote:'', pos:'', comision:'',
        avatarUrl:'', injured:false, injuryIcon:'', birthdate:'', rm:{}
      };
      rosterById[row.user_id] = newPlayer;
      roster.push(newPlayer);
    }
  });
}

// Se refresca en cuanto cualquier cuenta confirma, rechaza o deshace su respuesta a un
// evento (sea el que tengas abierto o cualquier otro): actualiza el contador del banner
// de Inicio, la lista de eventos y, si tienes ese evento abierto, su detalle — todo sin
// que nadie tenga que recargar la página.
let attAttendanceRealtimeSubscribed = false;
function subscribeToAttAttendanceRealtime(){
  if(attAttendanceRealtimeSubscribed) return;
  attAttendanceRealtimeSubscribed = true;
  supabaseClient
    .channel('att-attendance-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'att_attendance' }, payload => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if(!row || !row.event_id) return;
      const ev = attEvents.find(e => e.id === row.event_id);
      if(!ev) return;

      // No pisamos nuestra propia respuesta con la que acabamos de guardar: la tenemos
      // en memoria más al día que lo que tarde en llegar el propio evento realtime.
      if(row.user_id === currentAuthUserId) return;

      if(payload.eventType === 'DELETE'){
        delete ev.attendance[row.user_id];
        delete ev.comments[row.user_id];
      } else {
        ev.attendance[row.user_id] = row.status;
        if(row.comment) ev.comments[row.user_id] = row.comment;
        else delete ev.comments[row.user_id];
      }

      renderNextMatchBanner();
      if(typeof renderEventList === 'function' && document.getElementById('sec-asistencia')?.classList.contains('active')){
        renderEventList();
      }
      if(currentEventId === row.event_id) renderEventDetail();
    })
    .subscribe();
}

// Trae MI propia respuesta guardada a cada evento. Es necesaria porque
// loadEventAttendanceFromStorage() y el realtime de arriba ignoran a propósito las
// filas de la propia cuenta (para no pisar en plena sesión lo que se acaba de marcar),
// así que sin esto la respuesta propia solo vive en memoria y se "borra" visualmente
// en cuanto se refresca la página, aunque siga guardada en Supabase.
async function loadMyAttendanceFromStorage(){
  if(!currentAuthUserId) return;
  const { data, error } = await supabaseClient
    .from('att_attendance')
    .select('event_id, status, comment')
    .eq('user_id', currentAuthUserId);
  if(error || !data) return;

  data.forEach(row => {
    const ev = attEvents.find(e => e.id === row.event_id);
    if(!ev) return;
    ev.attendance.me = row.status;
    if(row.comment) ev.comments.me = row.comment;
  });
}

function spawnRsvpHeartBurst(btnEl, status){
  if(!btnEl || !btnEl.getBoundingClientRect) return;
  const rect = btnEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const emoji = status === 'yes' ? '💙' : '💔';
  const count = 5;
  for(let i = 0; i < count; i++){
    const el = document.createElement('span');
    el.className = 'rsvp-heart-burst';
    el.textContent = emoji;
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    el.style.fontSize = (17 + Math.random() * 9) + 'px';
    el.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 70) + 'px');
    el.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 40) + 'deg');
    el.style.animationDelay = (i * 55) + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

// El comentario/justificación de asistencia es siempre sobre uno mismo: nadie puede
// abrir el modal para comentar/editar la de otra persona (ver también el botón, que
// ya solo se pinta para la propia fila en attRosterRowHtml).
function openCommentModal(eventId, playerId){
  if(playerId !== currentUserId) return;
  const ev = attEvents.find(e => e.id === eventId);
  const player = rosterById[playerId];
  if(!ev || !player) return;

  commentModalCtx = { eventId, playerId };
  document.getElementById('comment-modal-title').textContent = t('att.justifyAbsence');
  document.getElementById('comment-modal-sub').textContent = `${ev.label} · ${eventWhenDisplay(ev)}`;
  document.getElementById('comment-modal-textarea').value = ev.comments[playerId] || '';
  document.getElementById('comment-modal').classList.add('active');
  setTimeout(() => document.getElementById('comment-modal-textarea').focus(), 0);
}

function closeCommentModal(){
  document.getElementById('comment-modal').classList.remove('active');
  commentModalCtx = null;
}

function saveCommentModal(){
  if(!commentModalCtx) return;
  const { eventId, playerId } = commentModalCtx;
  if(playerId !== currentUserId) return;
  const ev = attEvents.find(e => e.id === eventId);
  if(!ev) return;

  ev.comments[playerId] = document.getElementById('comment-modal-textarea').value.trim();
  closeCommentModal();
  renderEventList();
  if(currentEventId === eventId) renderEventDetail();

  // Es siempre mi propia justificación (ver guarda arriba): se actualiza también en
  // el guardado compartido.
  saveMyAttendanceToStorage(eventId, ev.attendance.me, ev.comments.me);
}

async function openEventDetail(eventId){
  currentEventId = eventId;
  currentAttTab = 'yes';

  // Si es un entreno con intensidad marcada, se oculta la insignia antes del primer
  // pintado para que la lluvia de emojis "aterrice" en ella al terminar, en vez de
  // aparecer ya fija desde el primer instante.
  const openedEv = attEvents.find(e => e.id === eventId);
  const openedEmoji = openedEv && attEventType(openedEv) === 'training' ? trainingIntensityEmoji(openedEv.intensity) : '';
  pendingIntensityReveal = !!openedEmoji;

  renderEventDetail();
  setSection('asistencia-detalle');

  if(openedEmoji) spawnIntensityBurst(openedEmoji);

  // Carga las respuestas de todas las jugadoras guardadas de forma compartida y
  // vuelve a pintar (si seguimos en el mismo evento cuando termina de llegar).
  const ev = attEvents.find(e => e.id === eventId);
  if(ev){
    await loadEventAttendanceFromStorage(ev);
    if(currentEventId === eventId) renderEventDetail();
  }
}

// "Floating Reaction" a pantalla completa al entrar en un entreno con intensidad
// marcada (suben de abajo hacia arriba, cada uno con su propia velocidad, balanceo
// lateral, rotación y pulso de tamaño, y se desdibujan al llegar arriba), y a
// continuación deja el emoji fijo en la insignia de la cabecera (ver renderEventDetail).
let pendingIntensityReveal = false;
function spawnIntensityBurst(emoji){
  pendingIntensityReveal = true;
  const count = 46;
  let maxDelay = 0;
  for(let i = 0; i < count; i++){
    const el = document.createElement('span');
    el.className = 'intensity-burst-emoji';
    el.textContent = emoji;
    const fontSize = 20 + Math.random() * 22;
    // Duración variada a propósito: unos suben mucho más rápido que otros, para que
    // no parezca una sola oleada uniforme sino reacciones sueltas (nunca tan corta
    // que se note a saltos por pocos fotogramas).
    const duration = 0.65 + Math.random() * 0.85;
    const delay = Math.round(Math.random() * 280);
    maxDelay = Math.max(maxDelay, delay + duration * 1000);
    // Rotación y pico de escala propios de cada emoji, para que la trayectoria de
    // cada uno se note distinta (el desplazamiento en sí es siempre recto, vertical).
    const scalePeak = (1.05 + Math.random() * 0.35).toFixed(2);
    el.style.left = Math.random() * 96 + 'vw';
    el.style.fontSize = fontSize + 'px';
    el.style.setProperty('--fall', (window.innerHeight + 80) + 'px');
    el.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 320) + 'deg');
    el.style.setProperty('--scale-peak', scalePeak);
    el.style.setProperty('--dur', duration + 's');
    el.style.animationDelay = delay + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), delay + duration * 1000 + 200);
  }
  // Cuando termina la lluvia, el emoji se "asienta" fijo en la insignia de la cabecera
  setTimeout(() => {
    pendingIntensityReveal = false;
    const badge = document.getElementById('att-detail-intensity-badge');
    if(badge && badge.textContent) badge.classList.add('show');
  }, maxDelay + 100);
}

function renderEventDetail(){
  const ev = attEvents.find(e => e.id === currentEventId);
  if(!ev) return;

  document.getElementById('att-detail-title').textContent = ev.label;
  document.getElementById('att-detail-daynum').textContent = ev.date;
  document.getElementById('att-detail-monthabbr').textContent = monthAbbrLabel(ev.month);
  document.getElementById('att-detail-edit-btn').style.display = canManageEvents() ? '' : 'none';
  // El botón de "Tullidas" solo tiene sentido en partidos, y lo puede usar cualquier
  // jugadora (no hace falta permiso de gestión: cada una se apunta a sí misma).
  document.getElementById('att-detail-tullides-btn').style.display = attEventType(ev) === 'match' ? '' : 'none';
  // Wellness / RPE: solo visible para el rol jugadora (ver canUseWellness); también
  // recoloca los botones de la cabecera según cuáles queden visibles.
  toggleAttWellnessButtonVisibility();
  // Botón 📊 de Cos Tècnic (entrenador/a, delegado/a, directiva, fisio, admin) para ir
  // directos al análisis Wellness/RPE de este evento concreto, si ya ha terminado.
  toggleAttWellnessStaffButtonVisibility(ev);

  const whenDate = eventWeekdayDateLabel(ev);
  const whenLocation = ev.place || '';
  document.getElementById('att-detail-when').textContent = whenDate || '';
  const locationEl = document.getElementById('att-detail-location');
  // Solo en los partidos a domicilio se añade el icono ✈️; en casa no lleva ningún emoji.
  const locationIcon = attEventType(ev) === 'match' && !ev.isHome ? '✈️ ' : '';
  if(whenLocation && ev.placeMapsUrl){
    locationEl.innerHTML = `${locationIcon}<a class="att-detail-location-link" href="${ev.placeMapsUrl}" target="_blank" rel="noopener">${escapeHtml(whenLocation)}</a>`;
  } else {
    locationEl.textContent = whenLocation ? `${locationIcon}${whenLocation}` : '';
  }
  document.getElementById('att-detail-meet').textContent = ev.meetTime || '—';
  document.getElementById('att-detail-start').textContent = ev.startTime || '—';

  // En los entrenos no mostramos "Convocatoria" ni el título "Inicio": solo la hora, a secas.
  const isTraining = attEventType(ev) === 'training';
  document.getElementById('att-detail-meet-item').style.display = isTraining ? 'none' : '';
  document.getElementById('att-detail-start-label').style.display = isTraining ? 'none' : '';

  const intensityBadge = document.getElementById('att-detail-intensity-badge');
  const intensityEmoji = isTraining ? trainingIntensityEmoji(ev.intensity) : '';
  intensityBadge.textContent = intensityEmoji;
  // La insignia solo se revela "asentada" tras la animación de entrada (ver
  // openEventDetail); si no hay animación en marcha (p. ej. al volver de editar
  // el evento) se muestra directamente.
  if(!intensityEmoji){
    intensityBadge.classList.remove('show');
  } else if(!pendingIntensityReveal){
    intensityBadge.classList.add('show');
  }

  const myStatus = ev.attendance.me;
  document.getElementById('att-detail-confirm-btn').classList.toggle('is-active', myStatus === 'yes');
  document.getElementById('att-detail-decline-btn').classList.toggle('is-active', myStatus === 'no');

  // Se recorre siempre el roster completo (todas las jugadoras registradas ahora
  // mismo en la app), no solo las claves que ya hubiera en ev.attendance: así,
  // cualquiera que no haya contestado "confirmar" ni "declinar" cae automáticamente
  // en "Sin contestar", aunque se haya dado de alta después de crearse el evento.
  const buckets = { yes:[], no:[], pending:[] };
  roster.forEach(player => {
    const status = ev.attendance[player.id];
    if(status === 'yes' || status === 'no') buckets[status].push(player);
    else buckets.pending.push(player);
  });

  document.getElementById('att-count-yes').textContent = buckets.yes.length;
  document.getElementById('att-count-no').textContent = buckets.no.length;
  document.getElementById('att-count-pending').textContent = buckets.pending.length;

  ['yes','no','pending'].forEach(key => {
    const list = document.getElementById('att-roster-' + key);
    if(key === 'yes'){
      renderAttRosterYesGrouped(ev, buckets.yes, list);
      return;
    }
    list.innerHTML = buckets[key].length
      ? buckets[key].map(p => attRosterRowHtml(ev, p)).join('')
      : `<div class="att-roster-empty">${t('att.nobodyYet')}</div>`;
  });

  setAttTab(currentAttTab);
}

// El comentario/justificación de asistencia es de cada una sobre sí misma: nadie
// puede crear ni editar el comentario de una compañera, aunque sea entrenador/a o
// delegado/a (esto es distinto del botón "Editar evento", que sí es de gestión).
function attRosterRowHtml(ev, p){
  const comment = ev.comments[p.id];
  const isMe = p.id === currentUserId;
  return `
      <div class="att-roster-row">
        <div class="avatar">${avatarHtml(p.avatarUrl, initials(displayName(p)), p.injured, p.injuryIcon)}</div>
        <div class="meta">
          <b>${escapeHtml(displayName(p))}</b>
          ${comment ? `<span class="comment">${escapeHtml(comment)}</span>` : ''}
        </div>
        ${isMe ? `<button class="att-comment-btn" onclick="openCommentModal('${ev.id}','${p.id}')">${comment ? t('att.edit') : t('att.addComment')}</button>` : ''}
      </div>
    `;
}

// La lista de "Asistirán" se organiza así:
//   Jugadoras (total) → Delanteras (total) y 3/4 (total) [incluye a Capitana, igual
//   que el resto de la app: effectiveRoleForPermissions la trata como jugadora]
//   Un grupo aparte por cada rol que no sea jugadora (Entrenador/a, Delegado/a...),
//   con el nombre de ese rol tal cual y su propio contador.
// Cada categoría (posición o rol) solo aparece en cuanto hay alguien de esa categoría
// que ha confirmado asistencia — no se muestran categorías vacías de antemano.
function renderAttRosterYesGrouped(ev, players, list){
  if(!players.length){
    list.innerHTML = `<div class="att-roster-empty">${t('att.nobodyYet')}</div>`;
    return;
  }

  const groupHtml = (label, group, isSubgroup) => `
      <div class="att-roster-group${isSubgroup ? ' is-subgroup' : ''}">
        <div class="att-roster-group-title">${escapeHtml(label)} <span class="count">${group.length}</span></div>
        ${group.map(p => attRosterRowHtml(ev, p)).join('')}
      </div>
    `;

  const jugadoras = players.filter(p => effectiveRoleForPermissions(p.rol) === 'jugadora');
  const delanteras = jugadoras.filter(p => p.posicion === 'delantera');
  const tresCuartos = jugadoras.filter(p => p.posicion === '3/4');
  const sinPosicion = jugadoras.filter(p => p.posicion !== 'delantera' && p.posicion !== '3/4');

  let html = '';
  if(jugadoras.length){
    html += `
        <div class="att-roster-group">
          <div class="att-roster-group-title">${t('nav.plantilla')} <span class="count">${jugadoras.length}</span></div>
          ${delanteras.length ? groupHtml(t('att.forwards'), delanteras, true) : ''}
          ${tresCuartos.length ? groupHtml('3/4', tresCuartos, true) : ''}
          ${sinPosicion.length ? groupHtml(t('att.noPositionAssigned'), sinPosicion, true) : ''}
        </div>
      `;
  }

  // El resto: un grupo por cada rol distinto que haya votado que sí, en el orden en
  // que va apareciendo (Entrenador/a, Delegado/a, Directiva, o cualquier otro).
  const otros = players.filter(p => effectiveRoleForPermissions(p.rol) !== 'jugadora');
  const rolesVistos = [];
  otros.forEach(p => {
    const rolLabel = p.rol || t('att.noRoleAssigned');
    if(!rolesVistos.includes(rolLabel)) rolesVistos.push(rolLabel);
  });
  rolesVistos.forEach(rolLabel => {
    html += groupHtml(rolLabel, otros.filter(p => (p.rol || t('att.noRoleAssigned')) === rolLabel), false);
  });

  list.innerHTML = html;
}

function setAttTab(tab){
  currentAttTab = tab;
  document.querySelectorAll('.att-tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.attTab === tab);
  });
  document.querySelectorAll('.att-roster').forEach(r => {
    r.classList.toggle('active', r.dataset.attRoster === tab);
  });
}
