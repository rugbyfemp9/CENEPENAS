// Fechas y etiquetas de fecha de toda la app (antes js/core/dates.js y la parte de
// fechas de js/features/calendario.js).
//
// ---- Traducción de fechas (día de la semana, mes, abreviatura de mes) ----
// El dato guardado (ev.month tipo 'Sep', el índice de día/mes) se queda siempre en
// español por dentro, para no romper el resto de la lógica que lo compara/parsea
// (ver calMonthShort más abajo); estas funciones solo traducen lo que se VE.
// Leen el idioma activo en el momento de llamarlas (no son reactivas por sí solas).
import { legacy } from './legacy.js';

export const autoMonthAbbr = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const autoMonthFull = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const autoWeekdayFull = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const monthAbbrNames = { es: autoMonthAbbr, ca: ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ag','Set','Oct','Nov','Des'] };
// A partir de la abreviatura en castellano que guardan los eventos (ev.month, p.ej. 'Sep').
export function monthAbbrLabel(esAbbr) {
  const i = autoMonthAbbr.indexOf(esAbbr);
  return i === -1 ? esAbbr : (monthAbbrNames[legacy.lang] || monthAbbrNames.es)[i];
}
const weekdayFullNames = { es: autoWeekdayFull, ca: ['Diumenge','Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte'] };
export function weekdayFullLabel(dayIndex) {
  return (weekdayFullNames[legacy.lang] || weekdayFullNames.es)[dayIndex];
}
const monthFullNames = { es: autoMonthFull, ca: ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'] };
export function monthFullLabel(monthIndex) {
  return (monthFullNames[legacy.lang] || monthFullNames.es)[monthIndex];
}
// En catalán "de" se elide en "d'" delante de vocal: "23 d'agost" (no "23 de agost").
export function withDePrefix(word) {
  return (legacy.lang === 'ca' && /^[aeiouàèéíòóú]/i.test(word)) ? "d'" + word : 'de ' + word;
}

// Formatea una fecha ISO (yyyy-mm-dd) como dd/mm/aa
export function formatShortDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
// yyyy-mm-dd → dd/mm/aaaa
export function formatFullDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
// "Sábado 26 de septiembre"
export function formatIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${weekdayFullLabel(dt.getDay())} ${d} ${withDePrefix(monthFullLabel(m - 1))}`;
}
// Fecha de hoy en formato yyyy-mm-dd usando la hora LOCAL (no UTC), para que el
// corte de "evento pasado" caiga siempre a las 23:59 hora local del propio día.
export function todayLocalIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Fechas de los eventos de Asistencia ----
const calMonthShort = { Ene:0, Feb:1, Mar:2, Abr:3, May:4, Jun:5, Jul:6, Ago:7, Sep:8, Oct:9, Nov:10, Dic:11 };
export function attEventIso(ev) {
  if (ev.iso) return ev.iso; // eventos generados automáticamente o creados a mano ya traen su iso
  const m = calMonthShort[ev.month];
  return `2026-${String(m + 1).padStart(2, '0')}-${String(ev.date).padStart(2, '0')}`;
}
export function attEventType(ev) {
  return ev.type || ((ev.label.startsWith('Partido') || ev.label.startsWith('Partit')) ? 'match' : 'training');
}
// Emoji fijo asociado a la intensidad de un entreno: ✨ baja, 💪 media, 🔥 alta.
export function trainingIntensityEmoji(intensity) {
  return intensity === 'low' ? '✨' : intensity === 'medium' ? '💪' : intensity === 'high' ? '🔥' : '';
}
// Fecha corta + día de la semana de un evento, recalculada siempre en el idioma
// activo (a diferencia de ev.when, que es un texto ya formateado que se guarda tal
// cual en Supabase para no romper el esquema, pero que ya no se usa para mostrar).
export function eventWeekdayDateLabel(ev) {
  const [y, m, d] = ev.iso.split('-').map(Number);
  return `${weekdayFullLabel(new Date(y, m - 1, d).getDay())} ${formatShortDate(ev.iso)}`;
}
// Línea completa "cuándo" de un evento (día · lugar · hora), recalculada en vivo a
// partir de sus datos crudos (iso, place, startTime, endTime) para que cambie de
// idioma junto con el resto de la app en vez de quedarse fija en el idioma con el
// que se creó el evento.
export function eventWhenDisplay(ev) {
  let out = eventWeekdayDateLabel(ev);
  if (ev.place) out += ` · ${ev.place}`;
  if (ev.startTime) {
    const start = ev.startTime.replace(/h$/, '');
    const end = ev.endTime ? ev.endTime.replace(/h$/, '') : '';
    out += ` · ${start}${end ? ' - ' + end : ''}h`;
  }
  return out;
}

// Wellness/RPE, banner de Inicio y botones 📊 de Asistencia/Eventos.
// Un entreno se considera "finalizado" si su fecha ya pasó, o si es hoy pero su hora
// de fin (o de inicio, si no hay hora de fin) ya ha pasado.
export function hasEventEnded(ev, now) {
  const nowRef = now || new Date();
  const todayIso = todayLocalIso();
  const iso = attEventIso(ev);
  if (iso < todayIso) return true;
  if (iso > todayIso) return false;
  const timeStr = (ev.endTime || ev.startTime || '').replace(/h$/, '');
  if (!timeStr) return false;
  const [hh, mm] = timeStr.split(':').map(Number);
  const eventMoment = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate(), hh || 0, mm || 0);
  return nowRef >= eventMoment;
}
