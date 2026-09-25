// ==================================================================
// WELLNESS / RPE — COS TÈCNIC: vista de análisis agregado de todo el equipo para un
// entrenamiento concreto (tabla "attendance_wellness" cruzada con el roster y con la
// duración del entrenamiento en "attEvents"). Solo para roles de gestión: ver
// STAFF_WELLNESS_ROLES y canViewWellnessStaff(). El módulo de valoración individual de
// cada jugadora (RPE_LEVELS, openWellnessModal...) está más arriba y no se toca.
// ==================================================================
const STAFF_WELLNESS_ROLES = ['entrenador/a', 'delegado/a', 'directiva', 'fisio'];

function canViewWellnessStaff(){
  return isAdmin || STAFF_WELLNESS_ROLES.includes(effectiveRoleForPermissions(myProfile.rol));
}

// Muestra/oculta tanto la tarjeta de Vestuario (móvil) como el botón directo del
// sidebar (escritorio); se llama justo después de conocer el rol real, en
// onAuthenticated(), igual que el resto de toggles de visibilidad por rol.
function toggleWellnessStaffCardVisibility(){
  const allowed = canViewWellnessStaff();
  const card = document.getElementById('vest-card-wellness-staff');
  if(card) card.style.display = allowed ? '' : 'none';
  const sidebarBtn = document.getElementById('sidebar-wellness-staff');
  if(sidebarBtn) sidebarBtn.style.display = allowed ? '' : 'none';
}

// "Tercer tiempo", "Comisiones" y "Tricount" son cosas del día a día de las jugadoras
// (organizar la comida de después del partido, apuntarse a una comisión, repartir
// gastos compartidos): el Cos Tècnic (mismo criterio que Wellness/RPE, ver
// canViewWellnessStaff()) no las necesita y no debe verlas ni en el sidebar, ni en el
// hub de Vestuario, ni en sus banners de Inicio. Los IDs de sección de cada página se
// usan también en setSection() para redirigir si alguien del Cos Tècnic entra a mano.
const STAFF_HIDDEN_SECTIONS = [
  'tercer', 'tercer-historial', 'tercer-detalle',
  'comisiones', 'comi-activitats', 'comi-xarxes', 'comi-tercer-temps', 'comi-tesoreria', 'comi-gira',
  'tricount'
];

// Se llama justo después de conocer el rol real, en onAuthenticated(), igual que el
// resto de toggles de visibilidad por rol.
function toggleStaffOnlyPagesVisibility(){
  const hideForStaff = canViewWellnessStaff();
  ['sidebar-tercer', 'sidebar-comisiones', 'sidebar-tricount'].forEach(id => {
    const btn = document.getElementById(id);
    if(btn) btn.style.display = hideForStaff ? 'none' : '';
  });
  ['vest-card-tercer', 'vest-card-comisiones', 'vest-card-tricount'].forEach(id => {
    const card = document.getElementById(id);
    if(card) card.style.display = hideForStaff ? 'none' : '';
  });
  ['inicio-tercer-banner', 'inicio-tricount-banner'].forEach(id => {
    const banner = document.getElementById(id);
    if(banner) banner.style.display = hideForStaff ? 'none' : '';
  });
}

// Duración en minutos de la sesión, a partir de sus horas de inicio/fin (guardadas
// como texto "20:30h"/"22:00h" en att_events). Si falta alguna de las dos horas, se
// asume una sesión de 60 minutos para poder calcular igualmente la carga (sRPE).
function wellnessStaffEventMinutes(ev){
  const parseToMinutes = (str) => {
    if(!str) return null;
    const parts = String(str).replace(/h$/, '').split(':').map(Number);
    if(parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };
  const start = ev ? parseToMinutes(ev.startTime) : null;
  const end = ev ? parseToMinutes(ev.endTime) : null;
  if(start == null || end == null) return 60;
  let diff = end - start;
  if(diff <= 0) diff += 24 * 60; // por si el entreno cruza la medianoche
  return diff;
}

let wellnessStaffSelectedEventId = null;
// Marcado por goToWellnessStaffAnalysis() para que, al entrar en la página (ver
// setSection() → id === 'wellness-staff'), se abra ese entreno concreto en vez del
// más reciente por defecto.
let wellnessStaffPendingEventId = null;

// Rellena el desplegable con los entrenamientos y partidos ya sucedidos (los eventos
// futuros no entran: todavía no pueden tener valoraciones, y las reuniones tampoco,
// porque no llevan Wellness/RPE), del más reciente al más antiguo, y carga
// automáticamente el que estuviera seleccionado (p.ej. desde el botón 📊 de una
// tarjeta, ver goToWellnessStaffAnalysis()) o, si no había ninguno, el más reciente.
function populateWellnessStaffEventSelect(){
  const select = document.getElementById('wstaff-event-select');
  if(!select) return;

  const now = new Date();
  const pastEvents = attEvents
    .filter(ev => attEventType(ev) !== 'meeting' && hasEventEnded(ev, now))
    .sort((a, b) => attEventIso(b).localeCompare(attEventIso(a)) || (b.startTime || '').localeCompare(a.startTime || ''));

  if(!pastEvents.length){
    select.innerHTML = `<option value="">${t('wstaff.noEvents')}</option>`;
    wellnessStaffSelectedEventId = null;
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }

  const previousSelection = wellnessStaffSelectedEventId;
  select.innerHTML = pastEvents
    .map(ev => `<option value="${ev.id}">${escapeHtml(ev.label)} · ${escapeHtml(eventWhenDisplay(ev))}</option>`)
    .join('');

  const stillExists = previousSelection && pastEvents.some(ev => ev.id === previousSelection);
  const eventId = stillExists ? previousSelection : pastEvents[0].id;
  select.value = eventId;
  onWellnessStaffEventChange(eventId);
}

// Acceso directo desde la tarjeta de un entreno/partido (botón 📊, solo Staff): deja
// marcado ese evento como el que hay que seleccionar y navega al panel, que lo
// recogerá en populateWellnessStaffEventSelect() de camino (llamada desde setSection()).
function goToWellnessStaffAnalysis(eventId){
  if(!canViewWellnessStaff()) return;
  wellnessStaffPendingEventId = eventId;
  setSection('wellness-staff');
}

function onWellnessStaffEventChange(eventId){
  wellnessStaffSelectedEventId = eventId || null;
  if(!eventId){
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }
  loadWellnessStaffData(eventId);
}

// Trae de Supabase todas las filas de "attendance_wellness" del entrenamiento elegido
// (una por jugadora que ya lo haya valorado), las cruza con su nombre (roster, ya
// cargado en memoria) y con la duración del entrenamiento (attEvents) para calcular
// su carga (sRPE = RPE × minutos de sesión), y repinta alertas + tabla.
async function loadWellnessStaffData(eventId){
  const tbody = document.getElementById('wstaff-table-body');
  const emptyState = document.getElementById('wstaff-empty-state');
  if(tbody) tbody.innerHTML = '';
  if(emptyState) emptyState.style.display = 'none';

  const { data, error } = await supabaseClient.from('attendance_wellness')
    .select('user_id, rpe, sleep_hours, mood, has_discomfort, discomfort_detail')
    .eq('event_id', eventId);

  // Si mientras cargaba se cambió de entreno en el desplegable, esta respuesta ya no
  // corresponde a lo que se está mirando: se descarta para no pisar nada.
  if(wellnessStaffSelectedEventId !== eventId) return;

  if(error){
    console.error('No se han podido cargar los datos de Wellness del entrenamiento', error);
    renderWellnessStaffAlerts([]);
    renderWellnessStaffTable([]);
    return;
  }

  const ev = attEvents.find(e => e.id === eventId);
  const minutes = wellnessStaffEventMinutes(ev);

  const rows = (data || []).map(row => {
    const player = rosterById[row.user_id];
    return {
      userId: row.user_id,
      name: player ? displayName(player) : (row.user_id || '—'),
      rpe: row.rpe != null ? Number(row.rpe) : null,
      sleepHours: row.sleep_hours || null,
      mood: row.mood != null ? Number(row.mood) : null,
      hasDiscomfort: !!row.has_discomfort,
      discomfortDetail: row.discomfort_detail || '',
      load: row.rpe != null ? Number(row.rpe) * minutes : null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  renderWellnessStaffAlerts(rows);
  renderWellnessStaffTable(rows);
}

const WELLNESS_STAFF_MOOD_EMOJI = { 1:'😞', 2:'🙁', 3:'😐', 4:'🙂', 5:'😄' };

// Bloque de alertas rápidas: tres tarjetas que se recalculan sobre las filas ya
// cargadas del entreno seleccionado (no hacen ninguna consulta propia). Las tarjetas
// solo muestran el número de jugadoras; la lista con los nombres se guarda aquí y se
// pinta en un modal aparte al hacer clic (ver openWellnessAlertModal).
const wstaffAlertData = {
  discomfort: { rows: [], formatter: r => `<div class="row"><b>${escapeHtml(r.name)}</b>${r.discomfortDetail ? ` — <span>${escapeHtml(r.discomfortDetail)}</span>` : ''}</div>` },
  sleep:      { rows: [], formatter: r => `<div class="row"><b>${escapeHtml(r.name)}</b></div>` },
  load:       { rows: [], formatter: r => `<div class="row"><b>${escapeHtml(r.name)}</b> <span>RPE ${r.rpe}</span></div>` },
};

function renderWellnessStaffAlerts(rows){
  wstaffAlertData.discomfort.rows = rows.filter(r => r.hasDiscomfort);
  wstaffAlertData.sleep.rows = rows.filter(r => r.sleepHours === 'lt6');
  wstaffAlertData.load.rows = rows.filter(r => r.rpe != null && r.rpe >= 8);

  const setCount = (countId, list) => {
    const countEl = document.getElementById(countId);
    if(countEl) countEl.textContent = list.length;
  };
  setCount('wstaff-alert-discomfort-count', wstaffAlertData.discomfort.rows);
  setCount('wstaff-alert-sleep-count', wstaffAlertData.sleep.rows);
  setCount('wstaff-alert-load-count', wstaffAlertData.load.rows);

  // Si el modal ya está abierto (p.ej. cambiando de entreno con el modal a la vista),
  // se refresca con los datos nuevos en lugar de dejarlo desactualizado.
  if(wstaffAlertModalOpenKind) openWellnessAlertModal(wstaffAlertModalOpenKind);
}

const WSTAFF_ALERT_META = {
  discomfort: { icon:'🔴', titleKey:'wstaff.alertDiscomfortTitle' },
  sleep:      { icon:'🟡', titleKey:'wstaff.alertSleepTitle' },
  load:       { icon:'🔥', titleKey:'wstaff.alertLoadTitle' },
};
let wstaffAlertModalOpenKind = null;

// Abre el modal con la lista completa de jugadoras de una alerta concreta
// ('discomfort' | 'sleep' | 'load'), tal como se pintaba antes directamente
// en la tarjeta.
function openWellnessAlertModal(kind){
  const meta = WSTAFF_ALERT_META[kind];
  const entry = wstaffAlertData[kind];
  if(!meta || !entry) return;

  wstaffAlertModalOpenKind = kind;
  document.getElementById('wstaff-alert-modal-icon').textContent = meta.icon;
  document.getElementById('wstaff-alert-modal-title').textContent = t(meta.titleKey);
  document.getElementById('wstaff-alert-modal-count').textContent =
    `${entry.rows.length} ${entry.rows.length === 1 ? t('wstaff.alertModalPlayerSingular') : t('wstaff.alertModalPlayerPlural')}`;

  const listEl = document.getElementById('wstaff-alert-modal-list');
  listEl.innerHTML = entry.rows.map(entry.formatter).join('');

  document.getElementById('wstaff-alert-modal').classList.add('active');
}
function closeWellnessAlertModal(){
  wstaffAlertModalOpenKind = null;
  document.getElementById('wstaff-alert-modal').classList.remove('active');
}

function wellnessStaffSleepPillHtml(sleepHours){
  if(!sleepHours) return `<span class="wstaff-sleep-pill none">${t('wstaff.noSleep')}</span>`;
  const cls = sleepHours === 'lt6' ? 'lt6' : sleepHours === 'gt8' ? 'gt8' : 'mid';
  const label = sleepHours === 'lt6' ? t('att.wellnessSleepLt6') : sleepHours === 'gt8' ? t('att.wellnessSleepGt8') : t('att.wellnessSleep78');
  return `<span class="wstaff-sleep-pill ${cls}">${label}</span>`;
}

// Tabla global del entrenamiento: una fila por jugadora, con el color de intensidad
// del RPE reutilizado de RPE_LEVELS (el mismo que ve la propia jugadora en su modal).
function renderWellnessStaffTable(rows){
  const tbody = document.getElementById('wstaff-table-body');
  const emptyState = document.getElementById('wstaff-empty-state');
  if(!tbody) return;

  if(!rows.length){
    tbody.innerHTML = '';
    if(emptyState) emptyState.style.display = '';
    return;
  }
  if(emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = rows.map(r => {
    const level = r.rpe != null ? wellnessRpeLevel(r.rpe) : null;
    const rpeHtml = level
      ? `<span class="wstaff-rpe-pill" style="background:${level.color};">${r.rpe}</span>`
      : `<span class="muted-cell">—</span>`;
    const moodHtml = r.mood != null ? (WELLNESS_STAFF_MOOD_EMOJI[r.mood] || '—') : t('wstaff.noMood');
    const loadHtml = r.load != null ? Math.round(r.load) : '—';
    const discomfortHtml = r.hasDiscomfort
      ? `<span class="discomfort-yes">${escapeHtml(r.discomfortDetail || t('att.wellnessYes'))}</span>`
      : `<span class="discomfort-no">${t('wstaff.noDiscomfort')}</span>`;
    return `
        <tr>
          <td class="col-player"><b>${escapeHtml(r.name)}</b></td>
          <td class="num">${wellnessStaffSleepPillHtml(r.sleepHours)}</td>
          <td class="num">${moodHtml}</td>
          <td class="num">${rpeHtml}</td>
          <td class="num">${loadHtml}</td>
          <td>${discomfortHtml}</td>
        </tr>`;
  }).join('');
}

// ==================================================================
// WELLNESS / RPE — COS TÈCNIC — PESTAÑA 2: HISTÓRICO Y TENDENCIAS. Carga acumulada
// semanal (para detectar picos de sobrecarga) y evolución de los últimos 30 días
// (equipo o jugadora concreta), a partir de las mismas filas de "attendance_wellness"
// cruzadas con "att_events" (fecha y duración) y "profiles"/roster (nombres). Todo
// este bloque comparte permiso con la Pestaña 1: ver canViewWellnessStaff().
// ==================================================================

// Subpestañas: solo cambia qué panel se ve, no vuelve a consultar Supabase (los datos
// de las dos pestañas se cargan juntos al entrar en la sección, ver setSection()).
let wellnessStaffSubtab = 'session';
function setWellnessStaffSubtab(tab){
  wellnessStaffSubtab = tab;
  document.getElementById('wstaff-subtab-btn-session')?.classList.toggle('active', tab === 'session');
  document.getElementById('wstaff-subtab-btn-history')?.classList.toggle('active', tab === 'history');
  document.getElementById('wstaff-tab-session')?.classList.toggle('active', tab === 'session');
  document.getElementById('wstaff-tab-history')?.classList.toggle('active', tab === 'history');
}

// ---- Utilidades de fechas en local (evitan los desfases de zona horaria de
// trabajar directamente con ISO strings y Date.parse) ----
function wellnessIsoToLocalDate(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function wellnessLocalDateToIso(date){
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function wellnessAddDaysIso(iso, delta){
  const d = wellnessIsoToLocalDate(iso);
  d.setDate(d.getDate() + delta);
  return wellnessLocalDateToIso(d);
}
function wellnessMondayIso(iso){
  const d = wellnessIsoToLocalDate(iso);
  const dow = d.getDay(); // 0=domingo..6=sábado
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return wellnessLocalDateToIso(d);
}
function wellnessShortDateLabel(iso){
  const d = wellnessIsoToLocalDate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const WSTAFF_WEEKS_BACK = 6; // ventana de la tabla de carga semanal
const WSTAFF_EVO_DAYS = 30;  // ventana del gráfico de evolución

// Últimas WSTAFF_WEEKS_BACK semanas (lunes a domingo), de la más antigua a "esta
// semana", para que la tabla se lea de izquierda (pasado) a derecha (ahora).
function wellnessBuildWeekBuckets(){
  const currentMonday = wellnessMondayIso(todayLocalIso());
  const buckets = [];
  for(let i = WSTAFF_WEEKS_BACK - 1; i >= 0; i--){
    const startIso = wellnessAddDaysIso(currentMonday, -7 * i);
    const endIso = wellnessAddDaysIso(startIso, 6);
    buckets.push({ startIso, endIso, label: `${wellnessShortDateLabel(startIso)}–${wellnessShortDateLabel(endIso)}` });
  }
  return buckets;
}

// Filas ya procesadas (una por jugadora y entreno/partido) que alimentan tanto la
// tabla de carga semanal como el gráfico de evolución, para no repetir la consulta.
let wellnessHistoryRawRows = [];
let wellnessEvoSelectedPlayer = 'team';

// Trae de Supabase todas las valoraciones de los últimos WSTAFF_WEEKS_BACK semanas
// (cruzadas con la fecha y duración de cada entreno/partido, ya en memoria en
// attEvents) y repinta la tabla de carga semanal + el gráfico de evolución.
async function loadWellnessHistoryData(){
  if(!canViewWellnessStaff()) return;

  const buckets = wellnessBuildWeekBuckets();
  const rangeStartIso = buckets[0].startIso;
  const now = new Date();
  const relevantEvents = attEvents.filter(ev =>
    attEventType(ev) !== 'meeting' && hasEventEnded(ev, now) && attEventIso(ev) >= rangeStartIso
  );

  if(!relevantEvents.length){
    wellnessHistoryRawRows = [];
    renderWellnessWeeklyTable(buckets, []);
    populateWellnessEvoPlayerSelect();
    renderWellnessEvolutionForSelection();
    return;
  }

  const eventIds = relevantEvents.map(ev => ev.id);
  const { data, error } = await supabaseClient.from('attendance_wellness')
    .select('user_id, event_id, rpe, sleep_hours, has_discomfort')
    .in('event_id', eventIds);

  if(error){
    console.error('No se han podido cargar los datos históricos de Wellness', error);
    wellnessHistoryRawRows = [];
    renderWellnessWeeklyTable(buckets, []);
    populateWellnessEvoPlayerSelect();
    renderWellnessEvolutionForSelection();
    return;
  }

  wellnessHistoryRawRows = (data || []).map(row => {
    const ev = relevantEvents.find(e => e.id === row.event_id);
    if(!ev) return null;
    const minutes = wellnessStaffEventMinutes(ev);
    return {
      userId: row.user_id,
      iso: attEventIso(ev),
      rpe: row.rpe != null ? Number(row.rpe) : null,
      sleepHours: row.sleep_hours || null,
      hasDiscomfort: !!row.has_discomfort,
      load: row.rpe != null ? Number(row.rpe) * minutes : null
    };
  }).filter(Boolean);

  renderWellnessWeeklyTable(buckets, wellnessHistoryRawRows);
  populateWellnessEvoPlayerSelect();
  renderWellnessEvolutionForSelection();
}

// CARGA ACUMULADA SEMANAL: una fila por jugadora con el sumatorio de sRPE de las 3
// últimas semanas (de la más reciente a la más antigua) + el total acumulado de toda
// la ventana cargada. El detalle semana a semana completo (más allá de estas 3) se
// consulta aparte, por jugadora, con el botón de historial (ver
// openWellnessPlayerHistoryModal()).
const WSTAFF_WEEK_COLS_SHOWN = 3;

function renderWellnessWeeklyTable(buckets, rows){
  const theadRow = document.getElementById('wstaff-week-thead');
  const tbody = document.getElementById('wstaff-week-tbody');
  const emptyState = document.getElementById('wstaff-week-empty');
  if(!tbody) return;

  // Solo las últimas WSTAFF_WEEK_COLS_SHOWN semanas, mostradas de la más reciente
  // (junto al Total) a la más antigua.
  const shownBuckets = buckets.slice(-WSTAFF_WEEK_COLS_SHOWN).reverse();

  if(theadRow){
    theadRow.innerHTML = `<th>${t('wstaff.colPlayer')}</th>` +
      `<th class="num">${t('wstaff.weekTotal')}</th>` +
      shownBuckets.map(b => `<th class="num">${b.label}</th>`).join('') +
      `<th class="num">${t('wstaff.weekHistoryCol')}</th>`;
  }

  const players = roster
    .filter(p => effectiveRoleForPermissions(p.rol) === 'jugadora')
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));

  const bodyRows = players.map(p => {
    const sumForBucket = (b) => Math.round(
      rows.filter(r => r.userId === p.id && r.load != null && r.iso >= b.startIso && r.iso <= b.endIso)
        .reduce((acc, r) => acc + r.load, 0)
    );
    const allSums = buckets.map(sumForBucket);
    const grandTotal = allSums.reduce((a, b) => a + b, 0);
    if(!grandTotal) return null; // sin ninguna valoración en toda la ventana: no aporta nada a la tabla

    const shownSums = shownBuckets.map(sumForBucket);
    const cellsHtml = shownSums.map((val, i) => {
      // el "anterior" de cada celda, para el resaltado de picos, es la semana previa en
      // el tiempo (siguiente en este array, porque va de más reciente a más antigua)
      const prev = i < shownSums.length - 1 ? shownSums[i + 1] : null;
      let cls = '';
      if(prev && val){
        const ratio = val / prev;
        if(ratio >= 1.3) cls = 'spike';
        else if(ratio >= 1.1) cls = 'rising';
      }
      return `<td class="num wstaff-week-cell ${cls}">${val || '—'}</td>`;
    }).join('');

    return `<tr>
        <td class="col-player"><b>${escapeHtml(displayName(p))}</b></td>
        <td class="num"><b>${grandTotal}</b></td>
        ${cellsHtml}
        <td class="num"><button type="button" class="wstaff-history-btn" onclick="openWellnessPlayerHistoryModal('${p.id}')" data-i18n-attr="aria-label:wstaff.weekHistoryBtn,title:wstaff.weekHistoryBtn" aria-label="${t('wstaff.weekHistoryBtn')}" title="${t('wstaff.weekHistoryBtn')}">📄</button></td>
      </tr>`;
  }).filter(Boolean);

  if(!bodyRows.length){
    tbody.innerHTML = '';
    if(emptyState) emptyState.style.display = '';
    return;
  }
  if(emptyState) emptyState.style.display = 'none';
  tbody.innerHTML = bodyRows.join('');
}

// HISTORIAL COMPLETO DE UNA JUGADORA: a diferencia de la tabla de arriba (limitada a
// la ventana de WSTAFF_WEEKS_BACK semanas), esto consulta TODAS sus valoraciones en
// Supabase sin restricción de fecha, las cruza con attEvents (que guarda toda la
// temporada en memoria, no solo esa ventana) y las agrupa por semana.
async function openWellnessPlayerHistoryModal(playerId){
  const player = rosterById[playerId];
  document.getElementById('wstaff-player-history-name').textContent = player ? displayName(player) : '—';
  const listEl = document.getElementById('wstaff-player-history-list');
  listEl.innerHTML = '';
  document.getElementById('wstaff-player-history-modal').classList.add('active');

  const { data, error } = await supabaseClient.from('attendance_wellness')
    .select('event_id, rpe').eq('user_id', playerId);

  if(error){
    console.error('No se ha podido cargar el historial completo de la jugadora', error);
    listEl.innerHTML = `<div class="wstaff-alert-empty">${t('wstaff.historyNoData')}</div>`;
    return;
  }

  const byWeekStart = {};
  (data || []).forEach(row => {
    if(row.rpe == null) return;
    const ev = attEvents.find(e => e.id === row.event_id);
    if(!ev) return;
    const iso = attEventIso(ev);
    const load = Number(row.rpe) * wellnessStaffEventMinutes(ev);
    const weekStart = wellnessMondayIso(iso);
    byWeekStart[weekStart] = (byWeekStart[weekStart] || 0) + load;
  });

  const weekStarts = Object.keys(byWeekStart).sort().reverse(); // más reciente primero
  listEl.innerHTML = weekStarts.length
    ? weekStarts.map(startIso => {
        const endIso = wellnessAddDaysIso(startIso, 6);
        const label = `${wellnessShortDateLabel(startIso)}–${wellnessShortDateLabel(endIso)}`;
        return `<div class="row"><b>${label}</b> <span>${Math.round(byWeekStart[startIso])}</span></div>`;
      }).join('')
    : `<div class="wstaff-alert-empty">${t('wstaff.historyNoData')}</div>`;
}
function closeWellnessPlayerHistoryModal(){
  document.getElementById('wstaff-player-history-modal').classList.remove('active');
}

// EVOLUCIÓN INDIVIDUAL / EQUIPO: rellena el desplegable con "Equipo (media)" +
// todas las jugadoras del roster, conservando la selección anterior si sigue existiendo.
function populateWellnessEvoPlayerSelect(){
  const select = document.getElementById('wstaff-evo-player-select');
  if(!select) return;

  const players = roster
    .filter(p => effectiveRoleForPermissions(p.rol) === 'jugadora')
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));

  const previous = wellnessEvoSelectedPlayer;
  select.innerHTML = `<option value="team">${t('wstaff.evoTeamOption')}</option>` +
    players.map(p => `<option value="${p.id}">${escapeHtml(displayName(p))}</option>`).join('');

  wellnessEvoSelectedPlayer = (previous === 'team' || players.some(p => p.id === previous)) ? previous : 'team';
  select.value = wellnessEvoSelectedPlayer;
}

function onWellnessEvoPlayerChange(playerId){
  wellnessEvoSelectedPlayer = playerId || 'team';
  renderWellnessEvolutionForSelection();
}

// Recalcula los puntos del gráfico (uno por día valorado en los últimos 30 días) a
// partir de wellnessHistoryRawRows: o bien la propia jugadora elegida, o la media del
// equipo entre quienes hayan valorado cada día.
function renderWellnessEvolutionForSelection(){
  const cutoffIso = wellnessAddDaysIso(todayLocalIso(), -(WSTAFF_EVO_DAYS - 1));
  const recentRows = wellnessHistoryRawRows.filter(r => r.iso >= cutoffIso && r.rpe != null);

  let points;
  if(wellnessEvoSelectedPlayer === 'team'){
    const byDate = {};
    recentRows.forEach(r => {
      if(!byDate[r.iso]) byDate[r.iso] = { sumRpe: 0, count: 0, load: 0, discomfort: 0, sleepBad: 0 };
      const b = byDate[r.iso];
      b.sumRpe += r.rpe;
      b.count++;
      b.load += r.load || 0;
      if(r.hasDiscomfort) b.discomfort++;
      if(r.sleepHours === 'lt6') b.sleepBad++;
    });
    points = Object.keys(byDate).sort().map(iso => {
      const b = byDate[iso];
      return { iso, rpe: b.sumRpe / b.count, load: b.load, hasDiscomfort: b.discomfort > 0, sleepBad: b.sleepBad > 0 };
    });
  } else {
    points = recentRows
      .filter(r => r.userId === wellnessEvoSelectedPlayer)
      .sort((a, b) => a.iso.localeCompare(b.iso))
      .map(r => ({ iso: r.iso, rpe: r.rpe, load: r.load, hasDiscomfort: r.hasDiscomfort, sleepBad: r.sleepHours === 'lt6' }));
  }

  renderWellnessEvoChart(points);
  renderWellnessEvoSummary(points);
}

// Gráfico de líneas dibujado a mano en SVG (sin librerías externas): RPE de 0 a 10 en
// el eje Y, una sesión valorada por punto en el eje X, coloreado con la misma escala
// Borg CR-10 de RPE_LEVELS. Un puntito rojo encima del punto marca los días con
// molestias físicas.
function renderWellnessEvoChart(points){
  const wrap = document.getElementById('wstaff-evo-chart');
  const emptyState = document.getElementById('wstaff-evo-chart-empty');
  if(!wrap) return;

  if(!points.length){
    wrap.innerHTML = '';
    if(emptyState) emptyState.style.display = '';
    return;
  }
  if(emptyState) emptyState.style.display = 'none';

  const W = 680, H = 200, padL = 26, padR = 12, padT = 16, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const n = points.length;
  const xPos = i => n === 1 ? padL + innerW / 2 : padL + (innerW * i / (n - 1));
  const yPos = v => padT + innerH - (Math.max(0, Math.min(10, v)) / 10) * innerH;

  const gridLines = [0, 5, 10].map(v => `
      <line x1="${padL}" y1="${yPos(v).toFixed(1)}" x2="${W - padR}" y2="${yPos(v).toFixed(1)}" stroke="var(--line)" stroke-width="1" />
      <text x="2" y="${(yPos(v) + 3.5).toFixed(1)}" font-size="9" fill="var(--text-muted)">${v}</text>
    `).join('');

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(p.rpe).toFixed(1)}`).join(' ');

  const dots = points.map((p, i) => {
    const level = wellnessRpeLevel(Math.round(p.rpe));
    const discomfortDot = p.hasDiscomfort
      ? `<circle cx="${xPos(i).toFixed(1)}" cy="${(yPos(p.rpe) - 9).toFixed(1)}" r="3" fill="var(--bad)"><title>${t('wstaff.evoDiscomfortMarker')}</title></circle>`
      : '';
    return `<circle cx="${xPos(i).toFixed(1)}" cy="${yPos(p.rpe).toFixed(1)}" r="4" fill="${level.color}" stroke="#fff" stroke-width="1.4"><title>${wellnessShortDateLabel(p.iso)} · RPE ${p.rpe.toFixed(1)}</title></circle>${discomfortDot}`;
  }).join('');

  const labelIdxs = n <= 6 ? points.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const labels = labelIdxs.map(i => `
      <text x="${xPos(i).toFixed(1)}" y="${H - 6}" font-size="9" fill="var(--text-muted)" text-anchor="middle">${wellnessShortDateLabel(points[i].iso)}</text>
    `).join('');

  wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}">
        ${gridLines}
        <path d="${linePath}" fill="none" stroke="var(--sky)" stroke-width="2" />
        ${dots}
        ${labels}
      </svg>
    `;
}

// Insignias-resumen encima del gráfico: sesiones valoradas, RPE medio, carga total,
// y recuentos de mal descanso / molestias en la ventana de 30 días.
function renderWellnessEvoSummary(points){
  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  const totalLoad = points.reduce((acc, p) => acc + (p.load || 0), 0);
  const avgRpe = points.length ? points.reduce((acc, p) => acc + p.rpe, 0) / points.length : null;

  setText('wstaff-evo-sum-sessions', points.length);
  setText('wstaff-evo-sum-avgrpe', avgRpe != null ? avgRpe.toFixed(1) : '—');
  setText('wstaff-evo-sum-load', Math.round(totalLoad));
  setText('wstaff-evo-sum-sleep', points.filter(p => p.sleepBad).length);
  setText('wstaff-evo-sum-discomfort', points.filter(p => p.hasDiscomfort).length);
}
