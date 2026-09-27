// "Fotos" de lo que muestra cada parte del Tercer tiempo, calculadas en el momento en
// que se pinta (renderThirdTime() en tercer-tiempo.svelte.js), igual que antes se
// generaba el HTML.
import { legacy } from '../../lib/legacy.js';
import { attEventIso, eventWhenDisplay, todayLocalIso, monthAbbrLabel } from '../../lib/dates.js';
import { t } from '../../lib/i18n.svelte.js';
import { thirdTimeCovers } from './covers.svelte.js';
import {
  thirdTimeGroups, thirdTimeGroupOf, thirdTimeMatches, thirdTimeCurrentMatch, thirdTimeEffectiveRoles,
} from './groups.js';

const name = (id) => legacy.displayName(legacy.rosterById[id]);

// Tarjeta de "Tercer tiempo" en Inicio: mismo componente visual (.tt-personal) que el
// banner de Vestuario, con tu rol para el próximo partido en casa y un botón para apuntarte.
export function buildInicioBanner() {
  const me = legacy.currentUserId;
  const title = t('tercer.title');
  const current = thirdTimeCurrentMatch();
  if (!current) return { cls: 'none', icon: null, title, text: t('tercer.none'), signupMatchId: null };

  const { match, index } = current;
  const myRoles = thirdTimeEffectiveRoles(me, match.id, index);
  const myGroup = thirdTimeGroupOf(me);
  const coveredAwayBy = thirdTimeCovers.find((c) => c.status === 'aceptado' && c.matchId === match.id && c.fromPlayerId === me);

  if (myRoles.has('cook') && myRoles.has('clean')) return { cls: 'cook', icon: 'cook', title, text: t('tercer.cookAndClean', { match: match.label }), signupMatchId: match.id };
  if (myRoles.has('cook')) return { cls: 'cook', icon: 'cook', title, text: t('tercer.cook', { match: match.label }), signupMatchId: match.id };
  if (myRoles.has('clean')) return { cls: 'clean', icon: 'clean', title, text: t('tercer.clean', { match: match.label }), signupMatchId: match.id };
  if (coveredAwayBy) return { cls: 'none', icon: null, title, text: t('tercer.freeCovered', { name: name(coveredAwayBy.toPlayerId) }), signupMatchId: null };
  if (myGroup) return { cls: 'none', icon: null, title, text: t('tercer.free', { match: match.label }), signupMatchId: null };
  return { cls: 'none', icon: null, title, text: t('tercer.noGroup'), signupMatchId: null };
}

// 🟢 Abierto = el partido "actual" (el próximo que queda, o el último si no queda ninguno);
// 🟡 Próximamente = partidos futuros más lejanos; 🔒 Cerrado = partidos ya pasados.
function tercerMatchStatus(ev, openMatchId, todayIso) {
  if (attEventIso(ev) < todayIso) return { code: 'closed', emoji: '🔒', label: t('tercer.statusClosed') };
  if (ev.id === openMatchId) return { code: 'open', emoji: '🟢', label: t('tercer.statusOpen') };
  return { code: 'soon', emoji: '🟡', label: t('tercer.statusSoon') };
}

// Rol de una jugadora para un partido, en las tres variantes que pide la tarjeta
function tercerMyRoleLabel(playerId, matchId, index) {
  const roles = thirdTimeEffectiveRoles(playerId, matchId, index);
  if (roles.has('cook')) return { text: t('tercer.roleCook'), cls: 'cook' };
  if (roles.has('clean')) return { text: t('tercer.roleClean'), cls: 'clean' };
  return { text: t('tercer.roleFree'), cls: 'free' };
}

// Fila de la lista / del histórico (MatchRow.svelte).
function matchRow(ev, index, status) {
  const role = tercerMyRoleLabel(legacy.currentUserId, ev.id, index);
  return {
    id: ev.id,
    date: ev.date,
    month: monthAbbrLabel(ev.month),
    rival: ev.label.replace(/^(Partido|Partit)\s+/i, ''),
    when: eventWhenDisplay(ev),
    roleText: role.text,
    roleCls: role.cls,
    statusCode: status.code,
    statusText: `${status.emoji} ${status.label}`,
  };
}

// Columna con los integrantes de un grupo (avatar + nombre). Se usa tanto en la vista
// vacía de Tercer tiempo como en el modal "Grupos del tercer tiempo".
export function groupPreviewCol(letter) {
  const memberIds = thirdTimeGroups[letter] || [];
  const rows = [];
  memberIds.forEach((id) => {
    const player = legacy.rosterById[id];
    if (!player) return;
    const shown = legacy.displayName(player);
    rows.push({ name: shown, avatar: { url: player.avatarUrl, fallback: legacy.initials(shown), injured: player.injured, injuryIcon: player.injuryIcon } });
  });
  return { title: t('tercer.groupLabel', { letter }), rows, empty: t('tercer.noPlayersInGroup') };
}

export function buildList() {
  const matches = thirdTimeMatches();
  const todayIso = todayLocalIso();
  // Los partidos ya jugados se archivan automáticamente a las 23:59 del mismo día
  // (en cuanto cambia la fecha local) y dejan de aparecer aquí; se consultan en "Pasados".
  const upcoming = matches
    .map((ev, index) => ({ ev, index }))
    .filter(({ ev }) => attEventIso(ev) >= todayIso);

  // Sin próximos partidos se muestran directamente los grupos en la página (y el
  // botón "grupo" se oculta, ver TercerList.svelte).
  if (upcoming.length === 0) {
    return { rows: [], emptyText: t('tercer.noMatchesGroups'), cols: [groupPreviewCol('A'), groupPreviewCol('B')] };
  }

  const openMatch = thirdTimeCurrentMatch();
  const openMatchId = openMatch ? openMatch.match.id : null;
  return { rows: upcoming.map(({ ev, index }) => matchRow(ev, index, tercerMatchStatus(ev, openMatchId, todayIso))) };
}

// Partidos en casa ya jugados: se listan aparte, del más reciente al más antiguo.
export function buildHistory() {
  const matches = thirdTimeMatches();
  const todayIso = todayLocalIso();
  const past = matches
    .map((ev, index) => ({ ev, index }))
    .filter(({ ev }) => attEventIso(ev) < todayIso)
    .reverse();

  if (past.length === 0) return { rows: [], emptyText: t('tercer.noHistoryYet') };
  const closed = { code: 'closed', emoji: '🔒', label: t('tercer.statusClosed') };
  return { rows: past.map(({ ev, index }) => matchRow(ev, index, closed)) };
}
