// Preconfiguraciones por tipo de evento, usadas al abrir el modal "Añadir evento"
// "placeRequired" marca si el campo Lugar es obligatorio para ese tipo (los partidos sí lo son).
// Los textos usan claves i18n (resueltas con t() al abrir el modal) en vez de
// literales fijos, para que las preconfiguraciones salgan también en catalán.
const newEventPresets = {
  training: { modalTitleKey:'att.newTraining', titlePlaceholderKey:'att.training', titleValueKey:'att.training', showMeet:false, startLabelKey:'att.start', place:'CEM Mar Bella', meet:'', start:'20:30', end:'22:00', placeRequired:false, isHome:true },
  match:    { modalTitleKey:'att.newMatch', titlePlaceholderKey:'att.matchTitlePlaceholder', titleValueKey:null, showMeet:true, startLabelKey:'att.start', place:'', meet:'', start:'17:30', end:'', placeRequired:true },
  meeting:  { modalTitleKey:'att.newMeeting', titlePlaceholderKey:'att.meetingTitlePlaceholder', titleValueKey:null, showMeet:false, startLabelKey:'att.timeOptional', place:'Sala del club', meet:'', start:'', end:'', placeRequired:false }
};

// Sede fija para la opción rápida "🏠 Casa": siempre enlaza con el CEM Mar Bella,
// independientemente de lo que se haya escrito antes en el campo Lugar.
const HOME_VENUE = {
  display: 'CEM Mar Bella',
  mapsQuery: 'CEM Mar Bella, Av. del Litoral, Barcelona'
};

let pendingPlaceMapsQuery = '';
// Marca si el lugar elegido para el partido que se está creando es la Casa (CEM Mar Bella).
// Solo se pone a true al pulsar el botón 🏠 Casa; escribir a mano lo desmarca.
let pendingIsHome = false;

// El campo Lugar funciona como un buscador enlazado con Google Maps: lo que se escribe
// se usa como término de búsqueda (p.ej. "campo de rugby vallecas") y se genera un enlace
// directo a esa ubicación en Maps, sin necesidad de elegir de una lista.
function buildMapsSearchUrl(query){
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}
function updatePlaceMapsPreview(){
  const preview = document.getElementById('place-maps-preview');
  const query = pendingPlaceMapsQuery.trim();
  if(!query){
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }
  preview.style.display = 'flex';
  preview.innerHTML = `<a class="place-maps-link" href="${buildMapsSearchUrl(query)}" target="_blank" rel="noopener">📍 Ver "${escapeHtml(query)}" en Google Maps</a>`;
}
function onPlaceInput(){
  pendingPlaceMapsQuery = document.getElementById('new-event-place').value;
  pendingIsHome = false;
  document.getElementById('place-home-btn').classList.remove('selected');
  updatePlaceMapsPreview();
}
function selectHomePlace(){
  document.getElementById('new-event-place').value = HOME_VENUE.display;
  pendingPlaceMapsQuery = HOME_VENUE.mapsQuery;
  pendingIsHome = true;
  document.getElementById('place-home-btn').classList.add('selected');
  updatePlaceMapsPreview();
}

function openAttAddTypeModal(){
  document.getElementById('att-add-type-modal').classList.add('active');
}
function closeAttAddTypeModal(){
  document.getElementById('att-add-type-modal').classList.remove('active');
}

// Intensidad seleccionada en el modal de crear/editar evento (solo aplica a entrenos)
let pendingEventIntensity = null;
function setEventIntensityPicker(value){
  pendingEventIntensity = value;
  ['low','medium','high'].forEach(k => {
    document.getElementById('intensity-btn-' + k).classList.toggle('selected', value === k);
  });
}
function selectEventIntensity(value){
  // Volver a pulsar la misma opción la deselecciona (queda sin intensidad marcada)
  setEventIntensityPicker(pendingEventIntensity === value ? null : value);
}

function openAddEventModal(type){
  editingEventId = null;
  pendingNewEventType = type || 'meeting';
  const preset = newEventPresets[pendingNewEventType];

  document.getElementById('event-delete-btn').style.display = 'none';
  closeAttAddTypeModal();

  document.getElementById('add-event-modal-title').textContent = t(preset.modalTitleKey);
  const titleInput = document.getElementById('new-event-title');
  titleInput.placeholder = t(preset.titlePlaceholderKey);
  titleInput.value = preset.titleValueKey ? t(preset.titleValueKey) : '';
  document.getElementById('new-event-date').value = '';
  document.getElementById('new-event-meet-time').value = preset.meet;
  document.getElementById('new-event-time').value = preset.start;
  document.getElementById('new-event-end-time').value = preset.end;
  const placeInput = document.getElementById('new-event-place');
  placeInput.value = preset.place;
  placeInput.required = !!preset.placeRequired;
  document.getElementById('field-place-label-text').textContent = t('att.place') + (preset.placeRequired ? '' : t('att.optionalSuffix'));
  document.getElementById('place-home-btn').classList.toggle('selected', !!preset.isHome);
  document.getElementById('field-place-hint').style.display = pendingNewEventType === 'match' ? 'block' : 'none';
  pendingPlaceMapsQuery = preset.isHome ? HOME_VENUE.mapsQuery : preset.place;
  pendingIsHome = !!preset.isHome;
  updatePlaceMapsPreview();
  document.getElementById('field-start-time-label').textContent = t(preset.startLabelKey);
  document.getElementById('field-meet-time').style.display = preset.showMeet ? '' : 'none';
  // Si el tipo de evento no lleva convocatoria (entreno o reunión), se vacía el campo
  // aunque estuviera oculto: así nunca se guarda una hora de convocatoria residual.
  if(!preset.showMeet) document.getElementById('new-event-meet-time').value = '';

  document.getElementById('field-intensity').style.display = pendingNewEventType === 'training' ? '' : 'none';
  setEventIntensityPicker(null);

  document.getElementById('add-event-modal').classList.add('active');
}
function openEditEventModal(eventId){
  const ev = attEvents.find(e => e.id === eventId);
  if(!ev) return;

  editingEventId = eventId;
  pendingNewEventType = attEventType(ev);
  const preset = newEventPresets[pendingNewEventType] || newEventPresets.meeting;

  document.getElementById('add-event-modal-title').textContent = t('att.editEvent');
  document.getElementById('event-delete-btn').style.display = 'flex';
  const titleInput = document.getElementById('new-event-title');
  titleInput.placeholder = t(preset.titlePlaceholderKey);
  titleInput.value = ev.label;
  document.getElementById('new-event-date').value = attEventIso(ev);
  document.getElementById('new-event-meet-time').value = (ev.meetTime || '').replace('h', '');
  document.getElementById('new-event-time').value = (ev.startTime || '').replace('h', '');
  document.getElementById('new-event-end-time').value = (ev.endTime || '').replace('h', '');
  const placeInput = document.getElementById('new-event-place');
  placeInput.value = ev.place || '';
  placeInput.required = !!preset.placeRequired;
  document.getElementById('field-place-label-text').textContent = t('att.place') + (preset.placeRequired ? '' : t('att.optionalSuffix'));
  document.getElementById('place-home-btn').classList.toggle('selected', !!ev.isHome);
  document.getElementById('field-place-hint').style.display = pendingNewEventType === 'match' ? 'block' : 'none';
  pendingPlaceMapsQuery = ev.place || '';
  pendingIsHome = !!ev.isHome;
  updatePlaceMapsPreview();
  document.getElementById('field-start-time-label').textContent = t(preset.startLabelKey);
  document.getElementById('field-meet-time').style.display = preset.showMeet ? '' : 'none';
  // Si el tipo de evento no lleva convocatoria (entreno o reunión), se vacía el campo
  // aunque el evento ya tuviera una hora de convocatoria guardada de antes.
  if(!preset.showMeet) document.getElementById('new-event-meet-time').value = '';

  document.getElementById('field-intensity').style.display = pendingNewEventType === 'training' ? '' : 'none';
  setEventIntensityPicker(ev.intensity || null);

  document.getElementById('add-event-modal').classList.add('active');
}
function closeAddEventModal(){
  document.getElementById('add-event-modal').classList.remove('active');
  editingEventId = null;
}
function saveNewEvent(){
  const type = pendingNewEventType || 'meeting';
  const title = document.getElementById('new-event-title').value.trim();
  const date = document.getElementById('new-event-date').value;
  const meetTime = document.getElementById('new-event-meet-time').value;
  const startTime = document.getElementById('new-event-time').value;
  const endTime = document.getElementById('new-event-end-time').value;
  const place = document.getElementById('new-event-place').value.trim();

  if(!title || !date){
    alert(t('att.alertTitleDate'));
    return;
  }
  if(type === 'match' && !place){
    alert(t('att.alertPlaceRequired'));
    return;
  }

  const d = new Date(date + 'T00:00:00');
  const when = `${weekdayFullLabel(d.getDay())} ${formatShortDate(date)}`
    + (place ? ` · ${place}` : '')
    + (startTime ? ` · ${startTime}${endTime ? ' - ' + endTime : ''}h` : '');

  const sharedFields = {
    label:title,
    date:d.getDate(),
    month:autoMonthAbbr[d.getMonth()],
    iso:date,
    when,
    place,
    placeMapsUrl: pendingPlaceMapsQuery.trim() ? buildMapsSearchUrl(pendingPlaceMapsQuery.trim()) : '',
    isHome: pendingIsHome,
    meetTime: meetTime ? meetTime + 'h' : '',
    startTime: startTime ? startTime + 'h' : '',
    endTime: endTime ? endTime + 'h' : '',
    intensity: type === 'training' ? pendingEventIntensity : null
  };

  if(editingEventId){
    // Modo edición: actualizamos el evento existente sin tocar asistencia ni comentarios ya guardados
    const ev = attEvents.find(e => e.id === editingEventId);
    if(ev){
      Object.assign(ev, sharedFields);
      saveEventToStorage(ev);
    }
  } else {
    const newEvent = { id:generateCustomEventId(), type, comments:{}, ...sharedFields };
    // Entrenos y partidos llevan control de asistencia del equipo; las reuniones no.
    newEvent.attendance = (type === 'training' || type === 'match')
      ? Object.fromEntries(roster.map(p => [p.id, 'pending']))
      : {};
    attEvents.push(newEvent);
    saveEventToStorage(newEvent);
  }

  renderEventList();
  if(currentEventId === editingEventId) renderEventDetail();

  closeAddEventModal();
  renderCalendarGrid();
  renderThirdTime();
  renderNextMatchBanner();
  renderProfile();
  initFantasy();
}

// ---- Eliminar evento (desde el modal de edición) ----
let pendingDeleteEventId = null;

function openDeleteEventConfirm(){
  if(!editingEventId) return;
  pendingDeleteEventId = editingEventId;
  document.getElementById('delete-event-confirm-modal').classList.add('active');
}
function closeDeleteEventConfirm(){
  document.getElementById('delete-event-confirm-modal').classList.remove('active');
  pendingDeleteEventId = null;
}
function confirmDeleteEvent(){
  if(!pendingDeleteEventId) return;
  const idx = attEvents.findIndex(e => e.id === pendingDeleteEventId);
  if(idx !== -1) attEvents.splice(idx, 1);
  deleteEventFromStorage(pendingDeleteEventId);

  // Si estábamos viendo el detalle del evento borrado, volvemos a la lista de Asistencia.
  if(currentEventId === pendingDeleteEventId){
    currentEventId = null;
    setSection('asistencia');
  }

  pendingDeleteEventId = null;
  document.getElementById('delete-event-confirm-modal').classList.remove('active');
  closeAddEventModal();

  renderEventList();
  renderCalendarGrid();
  renderThirdTime();
  renderNextMatchBanner();
  initFantasy();
}

// Evento que se está mostrando ahora mismo en el popover del calendario (null si es
// un cumpleaños u otro elemento que no se puede editar/eliminar desde aquí).
let eventpopEventId = null;

function openEventPopover(chipId){
  const e = calChipLookup[chipId];
  if(!e) return;

  eventpopEventId = e.id || null;

  document.getElementById('eventpop-date').textContent = formatIsoDate(e.iso);
  document.getElementById('eventpop-type').textContent = calTypeLabel(e.type);
  document.getElementById('eventpop-type').className = 'eventpop-type t-' + e.type;
  document.getElementById('eventpop-title').textContent = e.label;

  let metaHtml = '';
  if(e.place){
    metaHtml += e.placeMapsUrl
      ? `<div class="eventpop-meta-line">📍 <a class="att-detail-location-link" href="${e.placeMapsUrl}" target="_blank" rel="noopener">${escapeHtml(e.place)}</a></div>`
      : `<div class="eventpop-meta-line">📍 ${escapeHtml(e.place)}</div>`;
  }
  if(e.meetTime || e.startTime){
    metaHtml += `<div class="eventpop-meta-line eventpop-meta-times">`;
    if(e.meetTime) metaHtml += `<span>⏰ ${t('att.meet')} ${e.meetTime}</span>`;
    if(e.startTime) metaHtml += `<span>🏁 ${t('att.ko')} ${e.startTime}</span>`;
    metaHtml += `</div>`;
  }
  document.getElementById('eventpop-meta').innerHTML = metaHtml;

  // Los cumpleaños (y cualquier otro elemento sin id real detrás) no se pueden
  // editar ni eliminar desde aquí, así que se ocultan esos botones.
  document.getElementById('eventpop-actions').style.display = eventpopEventId ? 'flex' : 'none';

  document.getElementById('event-info-modal').classList.add('active');
}
function closeEventPopover(){
  document.getElementById('event-info-modal').classList.remove('active');
  eventpopEventId = null;
}
function editEventFromPopover(){
  if(!eventpopEventId) return;
  const id = eventpopEventId;
  closeEventPopover();
  openEditEventModal(id);
}
function deleteEventFromPopover(){
  if(!eventpopEventId) return;
  editingEventId = eventpopEventId;
  closeEventPopover();
  openDeleteEventConfirm();
}

function attEventCardHtml(ev){
  const type = attEventType(ev);
  if(type === 'meeting'){
    // Las reuniones no tienen pantalla de detalle a la que entrar (no llevan roster de
    // asistencia), así que aquí sí se mantiene el lápiz en la propia tarjeta: es la
    // única forma de editarlas.
    const editBtn = canManageEvents() ? `<button class="att-event-edit-btn" onclick="event.stopPropagation(); openEditEventModal('${ev.id}')" aria-label="${t('att.editEvent')}" title="${t('att.editEvent')}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>` : '';
    return `
        <div class="att-event" style="cursor:default;">
          ${editBtn}
          <div class="left">
            <div class="cal-date"><div class="d">${ev.date}</div><div class="m">${monthAbbrLabel(ev.month)}</div></div>
            <div class="info">
              <b>${ev.label}</b>
              <span>${escapeHtml(eventWhenDisplay(ev))}</span>
            </div>
          </div>
        </div>
      `;
  }
  const my = ev.attendance.me;
  const rsvpLabel = my === 'yes'
    ? `<span class="rsvp-state ok">${t('att.confirmedState')}</span>`
    : my === 'no'
      ? `<span class="rsvp-state bad">${t('att.declinedState')}</span>`
      : '';
  const intensityEmoji = type === 'training' ? trainingIntensityEmoji(ev.intensity) : '';
  // Botón 📊 de acceso directo al Panel de Análisis Wellness/RPE de este evento
  // concreto: solo Cos Tècnic, y solo si el evento ya existe en ese panel (mismo
  // criterio que populateWellnessStaffEventSelect(): ya ha terminado).
  const wellnessStaffBtn = (canViewWellnessStaff() && hasEventEnded(ev))
    ? `<button class="wstaff-quicklink" onclick="event.stopPropagation(); goToWellnessStaffAnalysis('${ev.id}')" aria-label="${t('wstaff.quickAccessButton')}" title="${t('wstaff.quickAccessButton')}">📊</button>`
    : '';
  return `
      <div class="att-event ${type === 'match' ? 'att-event--match' : ''}" onclick="openEventDetail('${ev.id}')">
        <div class="left">
          <div class="cal-date"><div class="d">${ev.date}</div><div class="m">${monthAbbrLabel(ev.month)}</div></div>
          <div class="info">
            <b>${ev.label}${intensityEmoji ? ` <span class="att-event-intensity">${intensityEmoji}</span>` : ''}</b>
            <span>${escapeHtml(eventWhenDisplay(ev))}</span>
            ${rsvpLabel}
          </div>
        </div>
        <div class="actions">
          ${wellnessStaffBtn}
          <button class="decline ${my === 'no' ? 'is-active' : ''}" onclick="event.stopPropagation(); setMyRsvp('${ev.id}','no',this)">${t('att.decline')}</button>
          <button class="confirm ${my === 'yes' ? 'is-active' : ''}" onclick="event.stopPropagation(); setMyRsvp('${ev.id}','yes',this)">${t('att.confirm')}</button>
        </div>
      </div>
    `;
}

// Filtro de tipos visibles en la lista de Asistencia (botón de embudo, arriba de la lista)
const attListFilters = { training:true, match:true, meeting:true };
// 'upcoming' = próximos eventos (por defecto); 'history' = eventos ya pasados
let attListMode = 'upcoming';
function toggleAttHistoryView(){
  attListMode = attListMode === 'upcoming' ? 'history' : 'upcoming';
  renderEventList();
}
function toggleAttListFilter(type, checked){
  attListFilters[type] = checked;
  renderEventList();
}
function openAttFilterModal(){
  document.getElementById('att-filter-modal').classList.add('active');
}
function closeAttFilterModal(){
  document.getElementById('att-filter-modal').classList.remove('active');
}

// ---- Eventos compartidos (Supabase, tabla att_events) ----
// Los entrenos automáticos de la temporada NO necesitan guardarse: su id es la fecha y
// se generan igual en cualquier sesión. Pero los que crea o edita a mano el delegado/a
// (entrenos sueltos, partidos, reuniones) se guardan aquí para que aparezcan igual en
// el dispositivo de cualquier persona.
function eventMetaForStorage(ev){
  return {
    id: ev.id, type: ev.type, label: ev.label, date: ev.date, month: ev.month, iso: ev.iso,
    when_text: ev.when, place: ev.place, place_maps_url: ev.placeMapsUrl, is_home: ev.isHome,
    meet_time: ev.meetTime, start_time: ev.startTime, end_time: ev.endTime, intensity: ev.intensity || null
  };
}
// Vuelve a montar un evento en el formato que usa la app a partir de una fila de la tabla
function eventFromStorageRow(row){
  return {
    id: row.id, type: row.type, label: row.label, date: row.date, month: row.month, iso: row.iso,
    when: row.when_text, place: row.place, placeMapsUrl: row.place_maps_url, isHome: row.is_home,
    meetTime: row.meet_time, startTime: row.start_time, endTime: row.end_time, intensity: row.intensity || null
  };
}

async function saveEventToStorage(ev){
  const { error } = await supabaseClient.from('att_events').upsert(eventMetaForStorage(ev));
  if(error) console.error('No se ha podido guardar el evento', error);
}

async function deleteEventFromStorage(eventId){
  const { error: e1 } = await supabaseClient.from('att_events').delete().eq('id', eventId);
  if(e1) console.error('No se ha podido borrar el evento', e1);
  // Limpiamos también las respuestas de asistencia guardadas para ese evento, para no
  // dejar filas huérfanas en la tabla.
  const { error: e2 } = await supabaseClient.from('att_attendance').delete().eq('event_id', eventId);
  if(e2) console.error('No se han podido borrar las respuestas del evento', e2);

  // Si el partido tenía un acta subida, hay que borrarla también. Si no lo hiciéramos,
  // esas filas de match_report_players se quedarían "huérfanas": no aparecerían en
  // ningún acta visible (el partido ya no existe), pero "Jugadoras → Estadísticas" las
  // seguiría sumando igualmente, dando minutos/tarjetas de más sin explicación aparente.
  const { data: orphanPlayers, error: ePlayersSelect } = await supabaseClient
    .from('match_report_players')
    .select('id')
    .eq('match_id', eventId);
  if(ePlayersSelect) console.error('No se ha podido comprobar el acta del evento borrado', ePlayersSelect);

  const orphanPlayerIds = (orphanPlayers || []).map(p => p.id);
  if(orphanPlayerIds.length){
    const { error: eCards } = await supabaseClient
      .from('match_report_cards')
      .delete()
      .in('match_report_player_id', orphanPlayerIds);
    if(eCards) console.error('No se han podido borrar las tarjetas del acta del evento borrado', eCards);
  }

  const { error: ePlayers } = await supabaseClient
    .from('match_report_players')
    .delete()
    .eq('match_id', eventId);
  if(ePlayers) console.error('No se ha podido borrar las jugadoras del acta del evento borrado', ePlayers);

  const { error: eReport } = await supabaseClient
    .from('match_reports')
    .delete()
    .eq('id', eventId);
  if(eReport) console.error('No se ha podido borrar la cabecera del acta del evento borrado', eReport);

  // Y la lista de "Tullidas" de ese evento, para no dejar tampoco filas huérfanas ahí.
  const { error: eTullides } = await supabaseClient
    .from('match_injuries')
    .delete()
    .eq('event_id', eventId);
  if(eTullides) console.error('No se ha podido borrar la lista de tullidas del evento borrado', eTullides);
  delete tullidesByEventId[eventId];
}

// Trae todos los eventos creados/editados a mano por cualquier persona y los añade
// (o actualiza, si ya existían) en attEvents. Se llama al iniciar sesión y cada vez
// que se entra en Asistencia, para no depender de que el creador siga conectado.
async function loadSharedEventsFromStorage(){
  const { data, error } = await supabaseClient.from('att_events').select('*');
  if(error || !data) return;

  data.forEach(row => {
    const meta = eventFromStorageRow(row);
    const existing = attEvents.find(e => e.id === meta.id);
    if(existing){
      // Ya lo teníamos (p.ej. lo creamos nosotras mismas): solo refrescamos sus
      // datos de calendario, sin tocar la asistencia/comentarios ya cargados.
      Object.assign(existing, meta);
    } else {
      const newEvent = { ...meta, comments:{} };
      newEvent.attendance = (meta.type === 'training' || meta.type === 'match')
        ? Object.fromEntries(roster.map(p => [p.id, 'pending']))
        : {};
      attEvents.push(newEvent);
    }
  });
}

// Refresca los eventos compartidos y todo lo que depende de attEvents; se usa al
// entrar en Asistencia y al iniciar sesión.
async function refreshSharedEventsAndUI(){
  await loadSharedEventsFromStorage();
  await loadMyAttendanceFromStorage();
  renderEventList();
  renderCalendarGrid();
  renderNextMatchBanner();
  if(typeof renderWellnessReminderBanner === 'function') renderWellnessReminderBanner();
}
