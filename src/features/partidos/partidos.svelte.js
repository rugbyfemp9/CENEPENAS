// Banner "Próximo partido" de Inicio, Vestuario → Partidos (lista) y la pantalla
// propia de un partido (su acta: src/features/actas).
//
// Los eventos (attEvents, con sus respuestas en ev.attendance, src/features/asistencia)
// no son reactivos: el banner guarda una "foto" de lo que tiene que mostrar cada vez
// que se pinta (renderNextMatchBanner()) y la lista se vuelve a leer cuando sube
// partidosList.version.
import { setSection } from '../../shell/navigation.svelte.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso, attEventType, eventWhenDisplay, todayLocalIso, monthAbbrLabel } from '../../lib/dates.js';
import { openEventDetail } from '../asistencia/asistencia.svelte.js';
import { actas, renderMatchReport, loadMatchReport } from '../actas/actas.svelte.js';
import { setNextMatchTullidesEventId } from '../tullidas/tullidas.svelte.js';
import { setChecklistMatchId } from './checklist.svelte.js';

// Próximo partido (hoy incluido), o undefined.
export function findNextMatch(todayIso = todayLocalIso()) {
  return attEvents
    .filter((ev) => attEventType(ev) === 'match' && attEventIso(ev) >= todayIso)
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)))[0];
}

// ---- Banner "Próximo partido" (cabecera de Inicio) ----
export const nextMatchBanner = $state({
  // 'none' (también antes de pintarse por primera vez) | 'gameDay' | 'upcoming'
  kind: 'none',
  label: '',
  when: '',
  confirmed: 0,
  showCta: false,
  // Partido que abre el botón "Confirmar" (el de la última vez que se mostró).
  ctaMatchId: null,
  showStatus: false,
  // Texto y color del estado: como antes, solo cambian al mostrar "Confirmada"/"Rechazada".
  statusKey: '',
  statusClass: '',
});

export function renderNextMatchBanner() {
  const b = nextMatchBanner;
  const todayIso = todayLocalIso();
  const nextMatch = findNextMatch(todayIso);

  if (!nextMatch) {
    b.kind = 'none';
    return;
  }

  setNextMatchTullidesEventId(nextMatch.id);

  const isGameDay = attEventIso(nextMatch) === todayIso;
  b.label = nextMatch.label;
  b.when = nextMatch.when;
  b.confirmed = Object.values(nextMatch.attendance).filter((s) => s === 'yes').length;

  if (isGameDay) {
    b.kind = 'gameDay';
    setChecklistMatchId(nextMatch.id);
    return;
  }
  b.kind = 'upcoming';

  const myStatus = nextMatch.attendance.me;
  if (myStatus === 'yes') {
    b.showCta = false;
    b.showStatus = true;
    b.statusKey = 'nextMatch.statusConfirmed';
    b.statusClass = 'ok';
  } else if (myStatus === 'maybe') {
    b.showCta = false;
    b.showStatus = true;
    b.statusKey = 'nextMatch.statusMaybe';
    b.statusClass = 'warn';
  } else if (myStatus === 'no') {
    b.showCta = false;
    b.showStatus = true;
    b.statusKey = 'nextMatch.statusRejected';
    b.statusClass = 'bad';
  } else {
    b.showStatus = false;
    b.showCta = true;
    b.ctaMatchId = nextMatch.id;
  }
}

export function goToNextMatch() {
  const nextMatch = findNextMatch();
  if (nextMatch) openEventDetail(nextMatch.id);
}

// NOTE: antes el botón "Confirmar" recibía su onclick por código, que sustituía al del
// marcado (con event.stopPropagation()): el clic llega también al banner, así que se
// abre el detalle dos veces (aquí y en goToNextMatch()). Se mantiene igual.
export function onNextMatchCtaClick() {
  const id = nextMatchBanner.ctaMatchId;
  openEventDetail(id);
}

// ---- Vestuario → Partidos ----
// Una tarjeta por cada partido que haya en Eventos (mismo origen que
// Asistencia/Calendario), sin filtrar por fecha. Usa el mismo aspecto que la tarjeta
// de Asistencia (con RSVP), pero al tocarla abre la pantalla propia de Partidos en vez
// del detalle de Asistencia.
export const partidosList = $state({ version: 0 });

export function renderPartidosList() {
  partidosList.version++;
}

// null = todavía no se ha pintado nunca (la lista se queda vacía).
export function partidosListView() {
  if (!partidosList.version) return null;
  return attEvents
    .filter((ev) => attEventType(ev) === 'match')
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)))
    .map((ev) => ({
      id: ev.id,
      date: ev.date,
      month: monthAbbrLabel(ev.month),
      label: ev.label,
      when: eventWhenDisplay(ev),
    }));
}

// ---- Pantalla propia de un partido ----
// De momento solo el acta (licencias, titulares/suplentes, cambios y minutos,
// ensayos/transformaciones y tarjetas), leída del PDF con la función Edge
// "process-match-report-pdf".
export const partidoDetalle = $state({
  currentId: null,
  // null = el título por defecto ("Partido", traducido).
  title: null,
});

export function openPartidoDetail(eventId) {
  partidoDetalle.currentId = eventId;
  const ev = attEvents.find((e) => e.id === eventId);
  partidoDetalle.title = ev ? ev.label : null;
  setSection('partido-detalle');
  if (actas.reports[eventId] !== undefined) {
    renderMatchReport(eventId); // ya la teníamos en caché de esta sesión: se pinta al momento
  }
  loadMatchReport(eventId); // y de todos modos se refresca contra Supabase por si ha cambiado
}

// Al cambiar de idioma.
export function onLangChange() {
  renderNextMatchBanner();
  renderPartidosList();
  // NOTE: el título del detalle tenía data-i18n, así que applyI18n() lo devolvía al
  // texto por defecto ("Partido"/"Partit") al cambiar de idioma. Se mantiene igual.
  partidoDetalle.title = null;
}
