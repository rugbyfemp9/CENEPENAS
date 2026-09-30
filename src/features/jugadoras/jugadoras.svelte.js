/* ================= JUGADORAS ================= */
// ---- Jugadoras: miembros registrados, leídos en directo de la tabla profiles.
// Las tarjetas amarillas/rojas se muestran para cada jugadora usando su id real.
//
// Además de pintar la tabla, cargar la Plantilla es lo que rellena el roster compartido
// (roster / rosterById en src/lib/roster.js), que leen casi todas las secciones, y los grupos del Tercer tiempo (src/features/tercer-tiempo/groups.js).
// No son reactivos: igual que antes, cada tabla solo se vuelve a leer cuando se "pinta" (renderPlantillaTable /
// renderPlantillaStatsRows), que guarda aquí lo que se ve en ese momento.
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { myProfile, roster, rosterById } from '../../lib/roster.js';
import { computeDisplayNames, displayName, initials } from '../../lib/names.js';
import { effectiveRoleForPermissions } from '../../lib/permissions.js';
import { readCache, writeCache } from '../../lib/storage.js';
import { formatFullDate } from '../../lib/dates.js';
import { renderEventDetail } from '../asistencia/asistencia.svelte.js';
import { t, translate } from '../../lib/i18n.svelte.js';
import { refresh as refreshGym } from '../gym/gym.svelte.js';
import { refreshFantasyMatchesAndUI } from '../fantasy/fantasy.svelte.js';
import { finesState, renderFinesTable } from '../multas/multas.svelte.js';
import { renderProfile } from '../perfil/perfil.svelte.js';
import { renderRollCallList } from '../partidos/rollcall.svelte.js';
import { findRosterMatchForReportPlayer } from '../actas/actas.svelte.js';
import { thirdTimeGroups } from '../tercer-tiempo/groups.js';
import { renderThirdTime } from '../tercer-tiempo/tercer-tiempo.svelte.js';

// Etiqueta legible para el campo "posicion" ('delantera' | '3/4') en la tabla de
// Jugadoras y en Mi perfil (src/features/perfil).
export function posicionLabel(posicion) {
  if (posicion === 'delantera') return t('plantilla.posForward');
  if (posicion === '3/4') return '3/4';
  return '—';
}

// Filas de "profiles" (sin la cuenta admin). No es reactivo: solo se lee al pintar.
let plantillaData = [];
export function getPlantillaData() {
  return plantillaData;
}

export const plantilla = $state({
  sortBy: 'alfabetico', // 'alfabetico' | 'nacimiento' | 'comision' | 'tarjetas'
  positionFilter: '', // '' (todas) | 'delantera' | '3/4'
  statsSortBy: 'alfabetico', // 'alfabetico' | 'minutos' | 'ensayos' | 'tarjetas' | 'puntos'
  // ---- Toolbar "Datos" / "Estadísticas" de la sección Jugadoras ----
  activeTab: 'datos',
  sortMenuOpen: false,
  statsSortMenuOpen: false,
  // Lo que hay dentro de #plantilla-grid: { key, vars, colspan } = una fila con un
  // mensaje (al principio, "Cargando jugadoras…"); { rows } = la tabla.
  grid: { key: 'plantilla.loading', colspan: 7 },
  // La columna "Editar" solo se muestra (a la cuenta admin) una vez pintada la tabla.
  showActions: false,
  // Igual para #plantilla-stats-grid (siempre de 5 columnas).
  statsGrid: { key: 'plantilla.loadingStats' },
});

export async function loadPlantilla() {
  // Si hay una copia reciente guardada en este dispositivo se pinta al momento con
  // esa (ver readCache/writeCache en src/lib/storage.js), en vez de mostrar "Cargando…" cada
  // vez que se abre la app aunque la plantilla no haya cambiado nada.
  const cached = await readCache('profiles');
  if (cached) {
    applyPlantillaRows(cached.data);
  } else {
    plantilla.grid = { key: 'plantilla.loading', colspan: 7 };
  }

  const { data, error } = await supabase.from('profiles').select('*');

  if (error) {
    if (!cached) {
      plantilla.grid = { key: 'plantilla.loadErrorList', vars: { error: error.message }, colspan: 7 };
    }
    return;
  }

  writeCache('profiles', data);
  applyPlantillaRows(data);
}

// Procesa las filas de "profiles" (vengan de la caché o recién traídas de Supabase)
// y actualiza roster/thirdTimeGroups y todo lo que depende de ellos. Separado de
// loadPlantilla() para poder pintar primero con la copia en caché y luego repetir
// exactamente lo mismo en cuanto llega la versión fresca de la red.
function applyPlantillaRows(data) {
  // La cuenta admin es solo de gestión: no debe aparecer en ningún listado, grupo
  // ni estadística de cara al resto del equipo.
  plantillaData = (data || []).filter((p) => !p.is_admin);
  if (!plantillaData.length) {
    plantilla.grid = { key: 'plantilla.noMembers', colspan: 6 };
    thirdTimeGroups.A = [];
    thirdTimeGroups.B = [];
    renderThirdTime();
    return;
  }

  // Sincroniza los grupos de tercer tiempo (y los datos básicos de cada persona)
  // con lo que hay guardado en Supabase, para que "Tercer tiempo" siempre muestre
  // a las jugadoras realmente registradas y en su grupo correcto.
  thirdTimeGroups.A = [];
  thirdTimeGroups.B = [];
  plantillaData.forEach((p) => {
    const esYo = p.id === auth.userId;
    const groupPlayerId = esYo ? 'me' : p.id;

    if (esYo) {
      rosterById['me'].avatarUrl = p.avatar_url || myProfile.avatarUrl || '';
      // Así, si cambias la foto de perfil desde otra sesión/dispositivo, también se
      // actualiza aquí en cuanto llega el cambio en tiempo real.
      myProfile.avatarUrl = p.avatar_url || myProfile.avatarUrl || '';
    } else {
      const fullNameForRoster = [p.nombre, p.apellido].filter(Boolean).join(' ') || p.mote || 'Sin nombre';
      if (rosterById[p.id]) {
        // Ya estaba en el roster de una carga anterior: se actualiza en el sitio
        Object.assign(rosterById[p.id], {
          name: fullNameForRoster, mote: p.mote || '', pos: p.rango || '', posicion: p.posicion || '', rol: p.rol || '', comision: p.comision || '', avatarUrl: p.avatar_url || '', birthdate: p.fecha_nacimiento || '', licencia: p.licencia || '',
        });
      } else {
        const newPlayer = {
          id: p.id, name: fullNameForRoster, mote: p.mote || '', pos: p.rango || '', posicion: p.posicion || '', rol: p.rol || '', comision: p.comision || '', avatarUrl: p.avatar_url || '', injured: false, injuryIcon: '', birthdate: p.fecha_nacimiento || '', licencia: p.licencia || '', rm: {},
        };
        rosterById[p.id] = newPlayer;
        roster.push(newPlayer);
      }
    }

    if (p.grupo_tercer_tiempo === 'A') thirdTimeGroups.A.push(groupPlayerId);
    else if (p.grupo_tercer_tiempo === 'B') thirdTimeGroups.B.push(groupPlayerId);
  });

  renderPlantillaTable();
  renderThirdTime();
  // Si ya estabas en la pestaña Fantasy cuando ha terminado de cargar la Plantilla,
  // se refresca sola para que aparezcan las jugadoras recién llegadas.
  if (document.getElementById('sec-fantasy')?.classList.contains('active')) {
    refreshFantasyMatchesAndUI();
  }

  // Cualquier avatar ya pintado en pantalla (el tuyo propio en el header/sidebar/perfil,
  // o el de cualquier compañera en asistencia, gym o multas) se repinta aquí con el dato
  // fresco, para que un cambio de foto de perfil llegue en directo sin recargar. Cada
  // función se protege sola si la vista correspondiente no está abierta ahora mismo.
  renderProfile();
  refreshGym(); // asistencia de hoy y ranking del Gym
  renderRollCallList();
  renderEventDetail();
  renderFinesTable();
}

// Cualquier alta, baja o cambio de un perfil (nombre, mote, rango, y sobre todo la
// foto de perfil) se recarga aquí al momento en todas las cuentas conectadas, igual
// que ya pasa con la rutina, las marcas o la asistencia al gym.
export function subscribeToProfilesRealtime() {
  supabase
    .channel('profiles-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadPlantilla())
    .subscribe();
}

export function setPlantillaPositionFilter(value) {
  plantilla.positionFilter = value;
  renderPlantillaTable();
}

// Repinta la tabla de Jugadoras con el orden elegido, sin volver a pedir los datos a Supabase.
export function renderPlantillaTable() {
  const isAdmin = !!auth.isAdmin;
  plantilla.showActions = isAdmin;
  const data = plantilla.positionFilter
    ? plantillaData.filter((p) => p.posicion === plantilla.positionFilter)
    : plantillaData;
  if (!data.length) {
    plantilla.grid = { key: 'plantilla.noPlayersPosition', colspan: 7 };
    return;
  }

  // Nombre a mostrar para cada jugadora, calculado sobre TODO el grupo que se ve en esta
  // tabla, para poder desambiguar nombres de pila repetidos (jerarquía: mote > nombre de
  // pila > nombre de pila + inicial del primer apellido si hay más de una con el mismo).
  const jugadorasDisplayNames = computeDisplayNames(data.map((p) => ({
    id: p.id,
    name: [p.nombre, p.apellido].filter(Boolean).join(' ') || translate('plantilla.noName'),
    mote: p.mote,
  })));

  // Antes solo se contaban las tarjetas de la propia usuaria logueada, así que al resto
  // de jugadoras nunca les aparecían aunque tuvieran multas de "TR"/"TA". Ahora se cuenta
  // para cada jugadora usando su id real en "fines" (que es 'me' para la propia usuaria
  // y el id de Supabase para las demás).
  const fines = finesState.list;
  const me = rosterById['me'];
  const rows = data.map((p) => {
    const fullName = [p.nombre, p.apellido].filter(Boolean).join(' ') || p.mote || translate('plantilla.noName');
    const shownName = jugadorasDisplayNames.get(p.id) || fullName;
    const esJugadora = effectiveRoleForPermissions(p.rol) === 'jugadora';
    const esYo = p.id === auth.userId;
    const finesPlayerId = esYo ? 'me' : p.id;
    const yellowCount = fines.filter((f) => f.playerId === finesPlayerId && f.reasonId === 'amarilla').length;
    const redCount = fines.filter((f) => f.playerId === finesPlayerId && f.reasonId === 'roja').length;
    return { p, shownName, esJugadora, esYo, yellowCount, redCount, cardsTotal: yellowCount + redCount };
  });

  plantilla.grid = {
    rows: sortPlantillaRows(rows).map(({ p, shownName, esJugadora, esYo }) => ({
      id: p.id,
      shownName,
      avatar: {
        url: p.avatar_url,
        fallback: initials(shownName),
        injured: esYo ? me.injured : false,
        injuryIcon: esYo ? me.injuryIcon : '',
      },
      birthdate: p.fecha_nacimiento ? formatFullDate(p.fecha_nacimiento) : '',
      rol: p.rol,
      esJugadora,
      rango: p.rango,
      posicion: p.posicion,
      comision: p.comision,
      licencia: p.licencia,
      editable: isAdmin,
    })),
  };
}

// Suma, para cada jugadora ya registrada en la app (cruzando por perfil, licencia o
// nombre — igual que en el acta de cada partido), los minutos jugados, ensayos, puntos
// y tarjetas de TODAS las actas de partido guardadas hasta ahora.
export async function loadPlantillaStats() {
  const cached = await readCache('match_report_players_own_team');
  if (cached) {
    renderPlantillaStatsRows(cached.data);
  } else {
    plantilla.statsGrid = { key: 'plantilla.loadingStats' };
  }

  const { data, error } = await supabase
    .from('match_report_players')
    .select('profile_id, license_number, player_name, minutes_played, tries_count, points, match_report_cards(id)')
    .eq('is_own_team', true);

  if (error) {
    if (!cached) {
      plantilla.statsGrid = { key: 'plantilla.statsLoadError', vars: { error: error.message } };
    }
    return;
  }

  writeCache('match_report_players_own_team', data || []);
  renderPlantillaStatsRows(data);
}

// Agrupa las filas de match_report_players (vengan de la caché o recién traídas de
// Supabase) por jugadora y pinta la tabla de Estadísticas. Separado de
// loadPlantillaStats() para poder pintar primero con la copia en caché y luego
// repetir lo mismo en cuanto llega la versión fresca de la red.
function renderPlantillaStatsRows(data) {
  const statsByProfileId = {};
  (data || []).forEach((row) => {
    const matched = findRosterMatchForReportPlayer(row);
    if (!matched || !matched.id) return; // solo jugadoras con perfil/cuenta en la app

    if (!statsByProfileId[matched.id]) {
      statsByProfileId[matched.id] = { profile: matched, minutes: 0, tries: 0, points: 0, cards: 0 };
    }
    const s = statsByProfileId[matched.id];
    s.minutes += row.minutes_played || 0;
    s.tries += row.tries_count || 0;
    s.points += row.points || 0;
    s.cards += (row.match_report_cards || []).length;
  });

  const rows = Object.values(statsByProfileId);
  if (!rows.length) {
    plantilla.statsGrid = { key: 'plantilla.noMatchReports' };
    return;
  }

  sortPlantillaStatsRows(rows);

  plantilla.statsGrid = {
    rows: rows.map((s) => ({
      avatar: { url: s.profile.avatarUrl, fallback: initials(s.profile.name), injured: false, injuryIcon: '' },
      name: s.profile.name,
      minutes: s.minutes,
      tries: s.tries,
      points: s.points,
      cards: s.cards,
    })),
  };
}

function sortPlantillaRows(rows) {
  const arr = rows.slice();
  if (plantilla.sortBy === 'nacimiento') {
    arr.sort((a, b) => {
      const da = a.p.fecha_nacimiento, db = b.p.fecha_nacimiento;
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
  } else if (plantilla.sortBy === 'comision') {
    arr.sort((a, b) => {
      const ca = a.p.comision || '', cb = b.p.comision || '';
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return ca.localeCompare(cb, 'es');
    });
  } else if (plantilla.sortBy === 'tarjetas') {
    arr.sort((a, b) => b.cardsTotal - a.cardsTotal);
  } else {
    arr.sort((a, b) => a.shownName.localeCompare(b.shownName, 'es'));
  }
  return arr;
}

export function togglePlantillaSortMenu() {
  plantilla.sortMenuOpen = !plantilla.sortMenuOpen;
}
export function closePlantillaSortMenu() {
  plantilla.sortMenuOpen = false;
}
export function setPlantillaSort(sortBy) {
  plantilla.sortBy = sortBy;
  closePlantillaSortMenu();
  renderPlantillaTable();
}

// Orden de la pestaña "Estadísticas": mismo patrón que el de "Datos" (arriba), pero
// con su propio botón/menú y sus propios criterios (de más a menos minutos, ensayos,
// tarjetas o puntos).
function sortPlantillaStatsRows(rows) {
  if (plantilla.statsSortBy === 'minutos') rows.sort((a, b) => b.minutes - a.minutes);
  else if (plantilla.statsSortBy === 'ensayos') rows.sort((a, b) => b.tries - a.tries);
  else if (plantilla.statsSortBy === 'tarjetas') rows.sort((a, b) => b.cards - a.cards);
  else if (plantilla.statsSortBy === 'puntos') rows.sort((a, b) => b.points - a.points);
  else rows.sort((a, b) => displayName(a.profile).localeCompare(displayName(b.profile), 'es'));
  return rows;
}
export function togglePlantillaStatsSortMenu() {
  plantilla.statsSortMenuOpen = !plantilla.statsSortMenuOpen;
}
export function closePlantillaStatsSortMenu() {
  plantilla.statsSortMenuOpen = false;
}
export function setPlantillaStatsSort(sortBy) {
  plantilla.statsSortBy = sortBy;
  closePlantillaStatsSortMenu();
  loadPlantillaStats();
}

export function setPlantillaTab(tab) {
  plantilla.activeTab = tab;

  // Se recargan cada vez que se entra en la pestaña (por si algo cambió mientras no la
  // tenías abierta), y además se mantienen frescas en vivo mientras la tienes abierta,
  // gracias a la suscripción realtime de match_report_players.
  if (tab === 'estadisticas') {
    loadPlantillaStats();
  }
}

// Antes setLang() (js/core/i18n.js) volvía a pintar la tabla (los nombres de quien no
// tiene nombre salen de t('plantilla.noName')) y recargaba las estadísticas si estaba
// abierta esa pestaña: se sigue haciendo al cambiar de idioma.
export function onLangChange() {
  if (plantillaData.length) renderPlantillaTable();
  if (plantilla.activeTab === 'estadisticas') loadPlantillaStats();
}
