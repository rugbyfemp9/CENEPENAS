/* ================= TERCER TIEMPO — GRUPOS FIJOS ================= */
// Grupos A/B, qué grupo cocina / limpia en cada partido en casa y los roles reales de
// cada jugadora (ajustados por los cambios de turno aceptados).
import { legacy } from '../../lib/legacy.js';
import { roster } from '../../lib/roster.js';
import { attEvents } from '../asistencia/events.js';
import { attEventIso, attEventType, todayLocalIso } from '../../lib/dates.js';
import { thirdTimeCovers } from './covers.svelte.js';

// División fija de la plantilla en dos grupos. La rellena la carga de la Plantilla
// (src/features/jugadoras) a partir de profiles.grupo_tercer_tiempo.
export const thirdTimeGroups = {
  A: [],
  B: [],
};
export function thirdTimeGroupOf(playerId) {
  if (thirdTimeGroups.A.includes(playerId)) return 'A';
  if (thirdTimeGroups.B.includes(playerId)) return 'B';
  return null;
}
// Los partidos (no los entrenos) marcan el ritmo: en cada partido, un grupo cocina
// y el otro limpia, y se van alternando en orden cronológico.
// El tercer tiempo lo organiza siempre el equipo local, así que solo entran aquí los
// partidos jugados en casa (isHome === true). Los partidos ya existentes que no tienen
// el campo isHome definido (creados antes de esta función) se siguen tratando como
// partidos en casa para no perder sus pestañas de tercer tiempo ya creadas.
export function thirdTimeMatches() {
  return attEvents
    .filter((ev) => attEventType(ev) === 'match' && ev.isHome !== false)
    .slice()
    .sort((a, b) => attEventIso(a).localeCompare(attEventIso(b)));
}
// El "partido de esta semana" para el banner: el próximo que quede, o si no queda
// ninguno por delante, el último que hubo.
export function thirdTimeCurrentMatch() {
  const matches = thirdTimeMatches();
  if (matches.length === 0) return null;
  const todayIso = todayLocalIso();
  const upcoming = matches.find((ev) => attEventIso(ev) >= todayIso);
  return { match: upcoming || matches[matches.length - 1], index: matches.indexOf(upcoming || matches[matches.length - 1]) };
}
// Grupo A cocina en los partidos de índice par, grupo B en los impares (y al revés
// para limpiar) — así se van alternando partido a partido durante toda la temporada.
export function thirdTimeRolesForIndex(index) {
  const cookGroup = index % 2 === 0 ? 'A' : 'B';
  const cleanGroup = cookGroup === 'A' ? 'B' : 'A';
  return { cookGroup, cleanGroup };
}

// Partido cuyo detalle se está viendo ahora mismo (se fija al entrar desde la lista).
// Si no hay ninguno seleccionado, se usa el partido "actual" automático.
let selectedTercerMatchId = null;
export function selectTercerMatch(matchId) {
  selectedTercerMatchId = matchId;
}
export function thirdTimeActiveMatch() {
  if (selectedTercerMatchId) {
    const matches = thirdTimeMatches();
    const idx = matches.findIndex((m) => m.id === selectedTercerMatchId);
    if (idx >= 0) return { match: matches[idx], index: idx };
  }
  return thirdTimeCurrentMatch();
}

// Roles reales de una jugadora para un partido: su grupo de base, menos lo que haya
// cedido a otra persona, más lo que haya asumido cubriendo a alguien
export function thirdTimeEffectiveRoles(playerId, matchId, index) {
  const { cookGroup, cleanGroup } = thirdTimeRolesForIndex(index);
  const group = thirdTimeGroupOf(playerId);
  const roles = new Set();
  if (group === cookGroup) roles.add('cook');
  if (group === cleanGroup) roles.add('clean');

  const coveredAway = thirdTimeCovers.find((c) => c.status === 'aceptado' && c.matchId === matchId && c.fromPlayerId === playerId);
  if (coveredAway) roles.clear();

  thirdTimeCovers
    .filter((c) => c.status === 'aceptado' && c.matchId === matchId && c.toPlayerId === playerId)
    .forEach((c) => {
      const fromGroup = thirdTimeGroupOf(c.fromPlayerId);
      if (fromGroup === cookGroup) roles.add('cook');
      if (fromGroup === cleanGroup) roles.add('clean');
    });

  return roles;
}

// Todas las jugadoras que de verdad tienen un rol concreto en un partido (grupo base
// ya ajustado por los cambios de turno aceptados) — se usa para las multas automáticas
export function thirdTimeEffectiveMembers(role, matchId, index) {
  return roster.map((p) => p.id).filter((id) => thirdTimeEffectiveRoles(id, matchId, index).has(role));
}

export function thirdTimeEventLabel(matchId) {
  const ev = attEvents.find((e) => e.id === matchId);
  return ev ? ev.label : '';
}
