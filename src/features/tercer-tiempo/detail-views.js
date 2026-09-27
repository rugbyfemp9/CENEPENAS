// "Fotos" del detalle de un partido (título, banner personal + recuadro del grupo y
// "Tus cambios de turno"), calculadas al pintar, como en views.js.
import { legacy } from '../../lib/legacy.js';
import { currentUserId, rosterById } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { t } from '../../lib/i18n.svelte.js';
import { thirdTimeCovers, thirdTimeDebts } from './covers.svelte.js';
import {
  thirdTimeGroupOf, thirdTimeActiveMatch, thirdTimeRolesForIndex, thirdTimeEffectiveRoles, thirdTimeEventLabel,
} from './groups.js';

const name = (id) => displayName(rosterById[id]);

// Título del detalle: "Tercer tiempo · <partido>".
export function buildDetailTitle() {
  const current = thirdTimeActiveMatch();
  return current ? t('tercer.detailTitleWithMatch', { match: current.match.label }) : t('tercer.title');
}

// Banner personal del detalle (PersonalBanner.svelte). kind:
//   'noMatch'  — no hay ningún partido en casa
//   'cook' / 'clean' — con icono; actions: 'wrapped' (dentro de .tt-personal-actions) o
//                'bare' (el botón suelto, como estaba en la variante de limpiar)
//   'none'     — sin icono ni botón
//   'noGroup'  — ver PersonalBanner.svelte (marcado original mal cerrado)
export function buildPersonalBanner() {
  const me = currentUserId;
  const current = thirdTimeActiveMatch();
  if (!current) return { kind: 'noMatch', text: t('tercer.noMatchForGroups') };

  const { match, index } = current;
  const { cookGroup } = thirdTimeRolesForIndex(index);
  const myGroup = thirdTimeGroupOf(me);
  const myRoles = thirdTimeEffectiveRoles(me, match.id, index);

  const coveredAwayBy = thirdTimeCovers.find((c) => c.status === 'aceptado' && c.matchId === match.id && c.fromPlayerId === me);
  const coveringFor = thirdTimeCovers.filter((c) => c.status === 'aceptado' && c.matchId === match.id && c.toPlayerId === me);
  const hasPendingOutgoing = thirdTimeCovers.some((c) => c.status === 'pendiente' && c.matchId === match.id && c.fromPlayerId === me);

  let noteExtra = '';
  if (coveringFor.length) {
    noteExtra = ' · cubres a ' + coveringFor.map((c) => name(c.fromPlayerId)).join(', ');
  }
  const groupLine = `${t('tercer.groupLabel', { letter: myGroup })} · ${match.label}`;
  const box = { cookGroup, hint: t('tercer.viewMembers') };
  // NOTA: también en partidos ya pasados se ofrece "No puedo asistir".
  const swapText = hasPendingOutgoing ? null : t('tercer.cantAttend');

  let personal;
  if (myRoles.has('cook') && myRoles.has('clean')) {
    personal = { kind: 'cook', title: t('tercer.roleCookAndClean'), text: groupLine + noteExtra, actions: 'wrapped', swapText };
  } else if (myRoles.has('cook')) {
    personal = { kind: 'cook', title: t('tercer.roleCook'), text: groupLine + noteExtra, actions: 'wrapped', swapText };
  } else if (myRoles.has('clean')) {
    personal = { kind: 'clean', title: t('tercer.roleClean'), text: groupLine + noteExtra, actions: 'bare', swapText };
  } else if (coveredAwayBy) {
    personal = { kind: 'none', title: t('tercer.coveredByMsg', { name: name(coveredAwayBy.toPlayerId) }), text: groupLine };
  } else if (hasPendingOutgoing) {
    personal = { kind: 'none', title: t('tercer.swapPendingConfirm'), text: groupLine };
  } else {
    personal = { kind: 'noGroup', title: t('tercer.noGroup') };
  }
  return { kind: 'match', personal, box };
}

// "Tus cambios de turno": solicitudes recibidas / enviadas y favores pendientes.
export function buildSwapSummary() {
  const me = currentUserId;
  const incoming = thirdTimeCovers.filter((c) => c.status === 'pendiente' && c.toPlayerId === me);
  const outgoing = thirdTimeCovers.filter((c) => c.status === 'pendiente' && c.fromPlayerId === me);
  const owedToMe = thirdTimeDebts.filter((d) => !d.settled && d.owedTo === me);
  const iOwe = thirdTimeDebts.filter((d) => !d.settled && d.owedBy === me);

  const title = t('tercer.yourSwaps');
  if (incoming.length === 0 && outgoing.length === 0 && owedToMe.length === 0 && iOwe.length === 0) {
    return { title, emptyText: t('tercer.noSwapsPending'), items: [] };
  }

  const items = [];
  incoming.forEach((c) => {
    items.push({
      kind: 'incoming', coverId: c.id,
      title: t('tercer.incomingRequest', { name: name(c.fromPlayerId) }), text: thirdTimeEventLabel(c.matchId),
      rejectText: t('tercer.reject'), acceptText: t('tercer.accept'),
    });
  });
  outgoing.forEach((c) => {
    items.push({
      kind: 'badge', badgeCls: 'badge warn', badgeText: t('fines.pendingBadge'),
      title: t('tercer.outgoingWaiting', { name: name(c.toPlayerId) }), text: thirdTimeEventLabel(c.matchId),
    });
  });
  owedToMe.forEach((d) => {
    items.push({
      kind: 'badge', badgeCls: 'badge info', badgeText: t('tercer.toCollectBadge'),
      title: t('tercer.owedToMeMsg', { name: name(d.owedBy) }), text: t('tercer.owedToMeSub'),
    });
  });
  iOwe.forEach((d) => {
    items.push({
      kind: 'badge', badgeCls: 'badge bad', badgeText: t('fines.pendingBadge'),
      title: t('tercer.iOweMsg', { name: name(d.owedTo) }), text: t('tercer.iOweSub'),
    });
  });
  return { title, emptyText: null, items };
}
