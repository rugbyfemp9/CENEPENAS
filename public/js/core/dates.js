// ---- Generación automática de entrenos — temporada 2026-2027 ----
// Lunes, miércoles y viernes de 20:30 a 22:00, del 1 de septiembre de 2026 al 31 de mayo
// de 2027, saltando festivos nacionales y festivos de Barcelona (calendarios laborales
// oficiales de España y del Ayuntamiento de Barcelona para 2026 y 2027).
const seasonHolidays = new Set([
  '2026-09-11', // Diada Nacional de Catalunya
  '2026-09-24', // La Mercè (festivo local de Barcelona)
  '2026-10-12', // Fiesta Nacional de España
  '2026-11-01', // Todos los Santos
  '2026-12-06', // Día de la Constitución
  '2026-12-08', // La Inmaculada Concepción
  '2026-12-25', // Navidad
  '2026-12-26', // Sant Esteve
  '2027-01-01', // Año Nuevo
  '2027-01-06', // Reyes
  '2027-03-26', // Viernes Santo
  '2027-03-29', // Lunes de Pascua Florida
  '2027-05-17'  // Pascua Granada (festivo local de Barcelona)
]);
const autoMonthAbbr = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const autoMonthFull = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const autoWeekdayFull = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// ---- Traducción de fechas (día de la semana, mes, abreviatura de mes) ----
// El dato guardado (ev.month tipo 'Sep', el índice de día/mes) se queda siempre en
// español por dentro, para no romper el resto de la lógica que lo compara/parsea
// (ver calMonthShort más abajo); estas funciones solo traducen lo que se VE.
const monthAbbrNames = { es: autoMonthAbbr, ca: ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ag','Set','Oct','Nov','Des'] };
function monthAbbrLabel(esAbbr){
  const i = autoMonthAbbr.indexOf(esAbbr);
  return i === -1 ? esAbbr : (monthAbbrNames[currentLang] || monthAbbrNames.es)[i];
}
const weekdayFullNames = { es: autoWeekdayFull, ca: ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'] };
function weekdayFullLabel(dayIndex){
  return (weekdayFullNames[currentLang] || weekdayFullNames.es)[dayIndex];
}
const monthFullNames = { es: autoMonthFull, ca: ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'] };
function monthFullLabel(monthIndex){
  return (monthFullNames[currentLang] || monthFullNames.es)[monthIndex];
}
// En catalán "de" se elide en "d'" delante de vocal: "23 d'agost" (no "23 de agost").
function withDePrefix(word){
  return (currentLang === 'ca' && /^[aeiouàèéíòóú]/i.test(word)) ? "d'" + word : 'de ' + word;
}

// Formatea una fecha ISO (yyyy-mm-dd) como dd/mm/aa
function formatShortDate(iso){
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
// Etiqueta legible para el campo "posicion" ('delantera' | '3/4'), tanto en Mi
// perfil como en la tabla y el filtro de Jugadoras.
function posicionLabel(posicion){
  if(posicion === 'delantera') return t('plantilla.posForward');
  if(posicion === '3/4') return '3/4';
  return '—';
}
function formatFullDate(iso){
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function weekdayFromIso(iso){
  const [y, m, d] = iso.split('-').map(Number);
  return weekdayFullLabel(new Date(y, m - 1, d).getDay());
}
// Fecha corta + día de la semana de un evento, recalculada siempre en el idioma
// activo (a diferencia de ev.when, que es un texto ya formateado que se guarda tal
// cual en Supabase para no romper el esquema, pero que ya no se usa para mostrar).
function eventWeekdayDateLabel(ev){
  const [y, m, d] = ev.iso.split('-').map(Number);
  return `${weekdayFullLabel(new Date(y, m - 1, d).getDay())} ${formatShortDate(ev.iso)}`;
}
// Línea completa "cuándo" de un evento (día · lugar · hora), recalculada en vivo a
// partir de sus datos crudos (iso, place, startTime, endTime) para que cambie de
// idioma junto con el resto de la app en vez de quedarse fija en el idioma con el
// que se creó el evento.
function eventWhenDisplay(ev){
  let out = eventWeekdayDateLabel(ev);
  if(ev.place) out += ` · ${ev.place}`;
  if(ev.startTime){
    const start = ev.startTime.replace(/h$/, '');
    const end = ev.endTime ? ev.endTime.replace(/h$/, '') : '';
    out += ` · ${start}${end ? ' - ' + end : ''}h`;
  }
  return out;
}

function generateAutoTrainings(){
  const events = [];
  const start = new Date(2026, 8, 1);  // 1 de septiembre de 2026
  const end   = new Date(2027, 4, 31); // 31 de mayo de 2027
  for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)){
    const dow = d.getDay(); // 1 = lunes, 3 = miércoles, 5 = viernes
    if(dow !== 1 && dow !== 3 && dow !== 5) continue;
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(seasonHolidays.has(iso)) continue;
    events.push({
      id: 'auto-' + iso,
      label: 'Entreno',
      type: 'training',
      date: d.getDate(),
      month: autoMonthAbbr[d.getMonth()],
      iso,
      when: `${weekdayFullLabel(dow)} ${formatShortDate(iso)} · CEM Mar Bella · 20:30 - 22:00h`,
      place: 'CEM Mar Bella',
      placeMapsUrl: buildMapsSearchUrl('CEM Mar Bella, Av. del Litoral, Barcelona'),
      isHome: true,
      meetTime: '20:15h',
      startTime: '20:30h',
      endTime: '22:00h',
      attendance: Object.fromEntries(roster.map(p => [p.id, 'pending'])),
      comments: {}
    });
  }
  return events;
}
