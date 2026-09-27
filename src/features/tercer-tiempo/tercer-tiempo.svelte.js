/* ================= TERCER TIEMPO ================= */
// Lista de próximos partidos en casa, histórico, detalle de un partido (banner
// personal, cambios de turno, comida), tarjeta de Inicio y modales de grupos.
//
// Los datos de los que depende (attEvents, en src/features/asistencia/events.js; roster en el código antiguo; cambios de
// turno, deudas y comida en covers.svelte.js / food.svelte.js) no son reactivos: igual
// que antes, cada parte de la pantalla guarda una "foto" de lo que tiene que mostrar
// cada vez que se pinta con renderThirdTime() (null = todavía no se ha pintado nunca, y
// se queda vacía como el marcado original). El código antiguo la llama por
// appBridge.tercerTiempo.render tras cambiar los eventos.
import { legacy } from '../../lib/legacy.js';
import { supabase } from '../../lib/supabase.js';
import { rosterById } from '../../lib/roster.js';
import { displayName } from '../../lib/names.js';
import { t } from '../../lib/i18n.svelte.js';
import { resolveThirdTimeDebts, loadThirdTimeCovers, loadThirdTimeDebts } from './covers.svelte.js';
import { loadThirdTimeFood, findFoodEntryForPlayer, renderThirdTimeFood, foodModal } from './food.svelte.js';
import { thirdTimeGroups, thirdTimeActiveMatch, selectTercerMatch } from './groups.js';
import { buildInicioBanner, buildList, buildHistory, groupPreviewCol } from './views.js';
import { buildDetailTitle, buildPersonalBanner, buildSwapSummary } from './detail-views.js';

export const tercer = $state({
  inicio: null,   // tarjeta de Inicio
  list: null,     // lista de próximos partidos
  history: null,  // "Pasados"
  detailTitle: null,
  banner: null,   // banner personal + recuadro del grupo del detalle
  summary: null,  // "Tus cambios de turno"
});

// Antes de pintar, se devuelven solos los favores pendientes que toquen (y se guardan
// en Supabase): por eso cualquier repintado puede escribir.
export function renderThirdTime() {
  resolveThirdTimeDebts();
  tercer.list = buildList();
  tercer.history = buildHistory();
  tercer.detailTitle = buildDetailTitle();
  tercer.banner = buildPersonalBanner();
  tercer.summary = buildSwapSummary();
  tercer.inicio = buildInicioBanner();
}

// Entra en el detalle de un partido concreto desde la lista de Tercer tiempo (o su histórico)
let tercerDetailOrigin = 'tercer';
export function openTercerDetail(matchId, origin) {
  selectTercerMatch(matchId);
  tercerDetailOrigin = origin === 'tercer-historial' ? 'tercer-historial' : 'tercer';
  renderThirdTime();
  legacy.setSection('tercer-detalle');
}
export function backFromTercerDetalle() {
  legacy.setSection(tercerDetailOrigin);
}

// ---- Modal "Grupos del tercer tiempo" (integrantes de cada grupo, sin ligar a un partido)
export const groupsOverviewModal = $state({ open: false, cols: [] });

export function openThirdTimeGroupsOverviewModal() {
  groupsOverviewModal.cols = [groupPreviewCol('A'), groupPreviewCol('B')];
  groupsOverviewModal.open = true;
}
export function closeThirdTimeGroupsOverviewModal() {
  groupsOverviewModal.open = false;
}

// ---- Modal de un grupo: sus integrantes y qué ha apuntado cada una (fijado al abrirlo)
export const groupModal = $state({ open: false, title: 'Grupo', sub: '', rows: [] });

export function openThirdTimeGroupModal(groupLetter) {
  const memberIds = thirdTimeGroups[groupLetter] || [];
  const current = thirdTimeActiveMatch();
  const matchLabel = current ? current.match.label : '';

  groupModal.title = t('tercer.groupLabel', { letter: groupLetter });
  groupModal.sub = matchLabel
    ? t('tercer.groupOrgWithMatch', { match: matchLabel })
    : t('tercer.groupOrg');

  const rows = [];
  memberIds.forEach((id) => {
    const player = rosterById[id];
    if (!player) return;
    const found = findFoodEntryForPlayer(id);
    // NOTA: el rango propio sale vacío (la entrada 'me' del roster no lo tiene).
    rows.push({
      ready: !!found,
      name: displayName(player),
      pos: String(player.pos),
      dish: found ? `${found.category.emoji} ${found.entry.detail}` : t('tercer.notSignedUp'),
    });
  });
  groupModal.rows = rows;
  groupModal.open = true;
}
export function closeThirdTimeGroupModal() {
  groupModal.open = false;
}

// Cualquier cambio en cambios de turno, deudas o comida del tercer tiempo (lo haga
// quien lo haga, desde cualquier dispositivo) se recarga aquí al momento.
export function subscribeToThirdTimeRealtime() {
  supabase
    .channel('third-time-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'third_time_covers' }, () => loadThirdTimeCovers())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'third_time_debts' }, () => loadThirdTimeDebts())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'third_time_food' }, () => loadThirdTimeFood())
    .subscribe();
}

// Al cambiar de idioma se repintaba lo mismo que desde setLang() (js/core/i18n.js):
// la tarjeta de Inicio, todo el Tercer tiempo y la comida. Además, el subtítulo del
// modal de comida llevaba data-i18n="tercer.foodSubSelf" y applyI18n() lo volvía a
// poner aunque estuviera apuntando a una compañera.
export function onLangChange() {
  renderThirdTime();
  renderThirdTimeFood();
  foodModal.sub = null;
}
