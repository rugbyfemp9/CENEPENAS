// Estado de Jugadas: qué categoría está filtrada y qué jugada se ve en el modal.
import { t } from '../../lib/i18n.svelte.js';
import { PLAYS } from './jugadas.js';

export const jugadas = $state({
  filter: 'all',   // 'all' | id de una categoría (ver CATEGORIES)
  modalOpen: false,
  openId: null,
});

export function setFilter(id) {
  jugadas.filter = id;
}

export function openPlay(id) {
  jugadas.openId = id;
  jugadas.modalOpen = true;
}

export function openedPlay() {
  return PLAYS.find((p) => p.id === jugadas.openId) || null;
}

export function playsOf(category) {
  return PLAYS.filter((p) => p.category === category);
}

export function categoryLabel(id) {
  return t('jugadas.cat.' + id);
}

export function playTitle(play) {
  return play.title || `${categoryLabel(play.category)} ${play.number}`;
}
