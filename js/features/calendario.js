/* ================= CALENDARIO ================= */

// Los cumpleaños NO se guardan como lista aparte: se sincronizan automáticamente
// con la fecha de nacimiento ("birthdate", formato AAAA-MM-DD) que cada jugadora
// rellena en su perfil. Se ignora el año: solo se usa el día y el mes, así que el
// cumpleaños aparece cada año en el calendario sin tener que volver a crearlo.
function getBirthdayEvents(year){
  return roster
    .filter(p => p.birthdate)
    .map(p => {
      const monthDay = p.birthdate.slice(5); // "AAAA-MM-DD" -> "MM-DD"
      return { iso:`${year}-${monthDay}`, label:displayName(p), type:'birthday' };
    });
}

// Planes del club (tercer tiempo, etc.)
const calPlans = [];

// Eventos extra creados manualmente desde el botón "+" del calendario (reuniones, etc.)
let calCustomEvents = [];

// Genera un id único de verdad (no un simple contador local), para que dos personas
// creando un evento en dispositivos distintos casi a la vez nunca puedan chocar.
function generateCustomEventId(){
  return 'ce' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Los entrenos y partidos del calendario salen de attEvents (mismo origen que Asistencia)
const calMonthShort = { Ene:0, Feb:1, Mar:2, Abr:3, May:4, Jun:5, Jul:6, Ago:7, Sep:8, Oct:9, Nov:10, Dic:11 };
const calDayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
function attEventIso(ev){
  if(ev.iso) return ev.iso; // eventos generados automáticamente o creados a mano ya traen su iso
  const m = calMonthShort[ev.month];
  return `2026-${String(m+1).padStart(2,'0')}-${String(ev.date).padStart(2,'0')}`;
}
function attEventType(ev){
  return ev.type || ((ev.label.startsWith('Partido') || ev.label.startsWith('Partit')) ? 'match' : 'training');
}
// Emoji fijo asociado a la intensidad de un entreno: ✨ baja, 💪 media, 🔥 alta.
function trainingIntensityEmoji(intensity){
  return intensity === 'low' ? '✨' : intensity === 'medium' ? '💪' : intensity === 'high' ? '🔥' : '';
}
// Fecha de hoy en formato yyyy-mm-dd usando la hora LOCAL (no UTC), para que el
// corte de "evento pasado" caiga siempre a las 23:59 hora local del propio día.
function todayLocalIso(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatIsoDate(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return `${weekdayFullLabel(dt.getDay())} ${d} ${withDePrefix(monthFullLabel(m-1))}`;
}

function buildCalendarEvents(){
  const list = [];
  attEvents.forEach(ev => {
    const type = attEventType(ev) === 'meeting' ? 'plan' : attEventType(ev);
    list.push({
      id: ev.id,
      iso:attEventIso(ev), label:ev.label, type,
      place: ev.place || '',
      placeMapsUrl: ev.placeMapsUrl || '',
      meetTime: ev.meetTime, startTime: ev.startTime
    });
  });
  getBirthdayEvents(calYear).forEach(b => list.push(b));
  calPlans.forEach(p => list.push({ iso:p.iso, label:p.label, type:'plan', place:p.place, startTime:p.time }));
  calCustomEvents.forEach(c => list.push({ iso:c.iso, label:c.label, type:'plan', place:c.place, startTime:c.time }));
  return list;
}

const calMonthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// Traducido dinámicamente (en vez de un objeto fijo) para que cambie con el idioma activo.
function calTypeLabel(type){
  return { training:t('att.training'), match:t('att.match'), birthday:t('att.birthday'), plan:t('att.plan') }[type];
}
let calYear = 2026;
let calMonth = 7; // Agosto (0 = Enero)
const calFilters = { training:true, match:true, birthday:true, plan:true };
let calChipLookup = {};

function openCalendarModal(){
  document.getElementById('calendar-modal').classList.add('active');
  document.getElementById('cal-sidebar').classList.remove('open');
  document.getElementById('cal-hamburger').classList.remove('active');
  renderCalendarGrid();
}
function closeCalendarModal(){
  document.getElementById('calendar-modal').classList.remove('active');
}
function toggleCalSidebar(){
  document.getElementById('cal-sidebar').classList.toggle('open');
  document.getElementById('cal-hamburger').classList.toggle('active');
}
function calShiftMonth(delta){
  calMonth += delta;
  if(calMonth < 0){ calMonth = 11; calYear--; }
  if(calMonth > 11){ calMonth = 0; calYear++; }
  renderCalendarGrid();
}
function toggleCalFilter(type, checked){
  calFilters[type] = checked;
  document.getElementById('cal-filter-' + type).classList.toggle('dim', !checked);
  renderCalendarGrid();
}

function renderCalendarGrid(){
  document.getElementById('cal-month-label').textContent = monthFullLabel(calMonth) + ' ' + calYear;
  calChipLookup = {};

  const allEvents = buildCalendarEvents().filter(e => calFilters[e.type]);
  const eventsByDay = {};
  allEvents.forEach(e => {
    (eventsByDay[e.iso] = eventsByDay[e.iso] || []).push(e);
  });

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  // getDay(): 0=domingo..6=sábado → lo pasamos a semana que empieza en lunes
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const todayIso = new Date().toISOString().slice(0,10);

  let html = '';
  for(let i = 0; i < leadingBlanks; i++){
    html += '<div class="cal-day empty"></div>';
  }
  let chipCounter = 0;
  for(let d = 1; d <= daysInMonth; d++){
    const iso = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = eventsByDay[iso] || [];
    const isToday = iso === todayIso;
    html += `
        <div class="cal-day${isToday ? ' today' : ''}">
          <div class="num">${d}</div>
          ${dayEvents.map(e => {
            const chipId = 'chip' + (chipCounter++);
            calChipLookup[chipId] = e;
            const chipLabel = e.type === 'match' ? t('att.match') : e.label;
            return `<button class="cal-chip t-${e.type}" onclick="openEventPopover('${chipId}')">${escapeHtml(chipLabel)}</button>`;
          }).join('')}
        </div>
      `;
  }
  document.getElementById('cal-grid').innerHTML = html;
}
