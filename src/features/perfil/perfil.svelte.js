/* ================= MI PERFIL ================= */
// Datos propios (banner, tabla, estadísticas), la marca de lesión y la foto de perfil.
//
// Los datos viven en src/lib/roster.js: myProfile y el roster (rosterById.me), y los
// rellena el inicio de sesión (src/shell/auth.svelte.js) y la carga de
// la Plantilla (src/features/jugadoras). No son reactivos: igual que antes, lo que se ve
// solo cambia cuando alguien llama a renderProfile() (al arrancar, al iniciar sesión, al
// entrar en Perfil...), que guarda aquí lo que toca mostrar en ese momento.
import { supabase } from '../../lib/supabase.js';
import { currentUserId, myProfile, myRosterEntry } from '../../lib/roster.js';
import { effectiveRoleForPermissions } from '../../lib/permissions.js';
import { attEvents, attSelection } from '../asistencia/events.js';
import { attEventIso, attEventType, todayLocalIso, formatFullDate } from '../../lib/dates.js';
import { renderEventDetail, toggleAttAddButtonVisibility } from '../asistencia/asistencia.svelte.js';
import { t } from '../../lib/i18n.svelte.js';
import { refreshSession } from '../../lib/session.svelte.js';
import { refresh as refreshGym } from '../gym/gym.svelte.js';
import {
  renderFinesTable, renderFinePlayerGrid, renderFineConfirmRequests, permissionsChanged as finesPermissionsChanged,
} from '../multas/multas.svelte.js';
import { treasury } from '../tesoreria/tesoreria.svelte.js';
import { tercerTreasury } from '../comi-tercer-temps/comi-tercer-temps.svelte.js';
import { loadPlantilla, posicionLabel } from '../jugadoras/jugadoras.svelte.js';
import { renderRollCallList } from '../partidos/rollcall.svelte.js';
import { normalizeRosterName } from '../actas/actas.svelte.js';
import { renderThirdTimeFood } from '../tercer-tiempo/food.svelte.js';

export const perfil = $state({
  // Lo que pintó el último renderProfile(); null = todavía no se ha pintado nunca (se ve
  // el marcado inicial: "Tu nombre", "Configura tu rol"...).
  view: null,
  // Avatar propio (Mi perfil y botón "TÚ" de la barra superior): { url, injured, injuryIcon }.
  avatar: null,
  // Botón de la marca de lesión: { active, tocada }.
  injuryBtn: { active: false, tocada: false },
  // Lo rellena el inicio de sesión (auth.js) con el email de la cuenta.
  email: '—',
  matches: '0',
  attendance: '—',
  injuryPickerOpen: false,
  // Qué opción del desplegable sale marcada: se calcula solo al abrirlo.
  injuryPickerSelected: { botiquin: false, tocada: false },
  avatarMenuOpen: false,
  // Mientras se sube una foto se desactiva el botón de editarla.
  uploading: false,
});

// Abre/cierra el pequeño desplegable con las dos opciones (botiquín / 🤕)
export function toggleInjuryPicker() {
  const me = myRosterEntry();
  const isOpening = !perfil.injuryPickerOpen;
  perfil.injuryPickerOpen = isOpening;
  if (isOpening && me) {
    perfil.injuryPickerSelected = {
      botiquin: me.injured && me.injuryIcon !== 'tocada',
      tocada: me.injured && me.injuryIcon === 'tocada',
    };
  }
}
export function closeInjuryPicker() {
  perfil.injuryPickerOpen = false;
}

// Elegir una opción del desplegable: si ya estaba marcada esa misma opción, la quita
// (igual que el toggle de antes); si no, la marca con ese icono.
// Ojo: la marca solo vive en memoria (rosterById.me), no se guarda en Supabase.
export function chooseInjuryIcon(icon) {
  const me = myRosterEntry();
  if (!me) return;

  if (me.injured && me.injuryIcon === icon) {
    me.injured = false;
    me.injuryIcon = '';
  } else {
    me.injured = true;
    me.injuryIcon = icon;
  }

  perfil.injuryPickerOpen = false;
  perfil.injuryBtn = { active: me.injured, tocada: me.injured && me.injuryIcon === 'tocada' };
  perfil.avatar = { url: myProfile.avatarUrl, injured: me.injured, injuryIcon: me.injuryIcon };

  // Refresca cualquier otra vista que ya esté pintando avatares del roster,
  // para que la insignia aparezca al momento en todas las interacciones donde salga su perfil.
  renderFinesTable();
  renderFinePlayerGrid();
  loadPlantilla();
  if (attSelection.currentEventId) renderEventDetail();
}

export function renderProfile() {
  const me = myRosterEntry();
  perfil.avatar = { url: myProfile.avatarUrl, injured: me && me.injured, injuryIcon: me && me.injuryIcon };
  perfil.injuryBtn = { active: !!(me && me.injured), tocada: !!(me && me.injured && me.injuryIcon === 'tocada') };

  const moteRoleParts = [myProfile.mote, myProfile.rol].filter(Boolean);
  perfil.view = {
    adjustDisabled: !myProfile.avatarUrl,
    name: (myProfile.name && myProfile.name !== 'Tu nombre') ? myProfile.name : t('profile.defaultName'),
    moteRole: moteRoleParts.length ? moteRoleParts.join(' · ') : t('profile.setUpRole'),
    phone: myProfile.phone || '—',
    birthdate: myProfile.birthdate ? formatFullDate(myProfile.birthdate) : '—',
    comision: myProfile.comision || '—',
    rango: myProfile.rango || '—',
    posicion: posicionLabel(myProfile.posicion),
    // Comisión, Rango y Posición son datos propios de jugadoras (a Capitana se la
    // trata como jugadora en toda la app, ver effectiveRoleForPermissions): si el rol
    // es otro (entrenador/a, delegado/a, directiva...) esas filas no se muestran.
    esJugadora: effectiveRoleForPermissions(myProfile.rol) === 'jugadora',
    rol: myProfile.rol || '—',
    licencia: myProfile.licencia || '—',
    licenciaHero: myProfile.licencia ? t('profile.licenseHero', { num: myProfile.licencia }) : '',
  };

  // Partidos jugados: se calcula aparte, cruzando las actas guardadas por nombre o
  // licencia (ver loadProfileMatchesPlayedStat), porque necesita consultar Supabase.
  loadProfileMatchesPlayedStat();

  // % de asistencia a entrenos: entrenos ya realizados hasta hoy (pasados), sobre
  // cuántos de ellos marcaste "Asistiré"
  const todayIso = todayLocalIso();
  const pastTrainings = attEvents.filter(ev =>
    attEventType(ev) === 'training' && attEventIso(ev) <= todayIso
  );
  const attendedTrainings = pastTrainings.filter(ev => ev.attendance && ev.attendance[currentUserId] === 'yes').length;
  perfil.attendance = pastTrainings.length
    ? Math.round((attendedTrainings / pastTrainings.length) * 100) + '%'
    : '—';
}

// Partidos jugados: en vez de basarse en tus "Asistiré" de Asistencia (que no
// reflejan si de verdad saliste a jugar), se cuentan las actas de partido guardadas
// en las que apareces — cruzando cada fila de match_report_players por tu número de
// licencia o, si no coincide, por tu nombre (normalizado, sin tildes/mayúsculas).
// Si apareces en 3 actas distintas, son 3 partidos jugados.
export async function loadProfileMatchesPlayedStat() {
  const { data, error } = await supabase
    .from('match_report_players')
    .select('match_id, license_number, player_name')
    .eq('is_own_team', true);

  if (error) {
    console.error('No se han podido cargar los partidos jugados', error);
    perfil.matches = '—';
    return;
  }

  const myLicense = (myProfile.licencia || '').toString().trim();
  const myName = normalizeRosterName(myProfile.name);

  const matchIds = new Set();
  (data || []).forEach(row => {
    const rowLicense = (row.license_number || '').toString().trim();
    const isMe =
      (myLicense && rowLicense && rowLicense === myLicense) ||
      (myName && normalizeRosterName(row.player_name) === myName);
    if (isMe) matchIds.add(row.match_id);
  });

  perfil.matches = String(matchIds.size);
}

export function setEmail(email) {
  perfil.email = email;
}

// Refresca cualquier vista que ya esté pintando avatares del roster (aunque no
// esté abierta ahora mismo, sus funciones de render tienen sus propias guardas y
// no hacen nada si su pantalla no está en el DOM), para que la foto nueva (o su
// ausencia, tras borrarla) aparezca al momento en toda la app sin recargar.
export function refreshAvatarEverywhere() {
  renderFinesTable();
  renderFinePlayerGrid();
  renderFineConfirmRequests();
  renderRollCallList();
  refreshGym();
  loadPlantilla();
  if (attSelection.currentEventId) renderEventDetail();
}

// Tras editar el perfil propio: el rol y la comisión pueden cambiar qué botones ves en
// el resto de la app (añadir evento, multa, álbum, subir rutina...).
export function refreshPermissionsEverywhere() {
  toggleAttAddButtonVisibility();
  refreshSession();
  finesPermissionsChanged();
  treasury.permissionsChanged();
  tercerTreasury.permissionsChanged();
  refreshGym();
  renderThirdTimeFood();
}
