// Jugadas: el libro de jugadas del equipo, cada una con su animación/vídeo.
//
// Las categorías y las jugadas viven en Supabase (tablas "play_categories" y "plays",
// que se crean a mano en el SQL Editor) y se añaden desde el Table Editor.
// Se cargan cada vez que se entra en la sección (setSection), por si han añadido
// alguna desde entonces; mientras tanto se pinta lo último que había en caché.
import { supabase } from '../../lib/supabase.js';
import { readCache, writeCache } from '../../lib/storage.js';
import { t, getLang } from '../../lib/i18n.svelte.js';

export const jugadas = $state({
  status: 'idle',  // 'idle' | 'loading' | 'ok' | 'error'
  categories: [],  // filas de play_categories, ya ordenadas
  plays: [],       // filas de plays, ya ordenadas
  filter: 'all',   // 'all' | id de una categoría
  modalOpen: false,
  openId: null,
});

export async function loadPlays() {
  const cached = await readCache('plays');
  if (cached && cached.data) {
    jugadas.categories = cached.data.categories;
    jugadas.plays = cached.data.plays;
    jugadas.status = 'ok';
  } else if (jugadas.status !== 'ok') {
    jugadas.status = 'loading';
  }

  const [cats, plays] = await Promise.all([
    supabase.from('play_categories').select('*').order('sort_order').order('id'),
    supabase.from('plays').select('*').order('sort_order').order('created_at'),
  ]);
  if (cats.error || plays.error) {
    console.error('No se han podido cargar las jugadas', cats.error || plays.error);
    if (jugadas.status !== 'ok') jugadas.status = 'error';
    return;
  }
  jugadas.categories = cats.data || [];
  jugadas.plays = plays.data || [];
  jugadas.status = 'ok';
  // Si la categoría filtrada ya no existe, se vuelve a "Todas".
  if (jugadas.filter !== 'all' && !jugadas.categories.some((c) => c.id === jugadas.filter)) jugadas.filter = 'all';
  writeCache('plays', { categories: jugadas.categories, plays: jugadas.plays });
}

export function setFilter(id) {
  jugadas.filter = id;
}

export function openPlay(id) {
  jugadas.openId = id;
  jugadas.modalOpen = true;
}

export function openedPlay() {
  return jugadas.plays.find((p) => p.id === jugadas.openId) || null;
}

export function playsOf(categoryId) {
  return jugadas.plays.filter((p) => p.category_id === categoryId);
}

// Nombre de una categoría en el idioma activo (name_ca vacío → name_es). El t() solo
// está para que se vuelva a pintar al cambiar de idioma.
export function categoryName(categoryId) {
  t('nav.jugadas');
  const c = jugadas.categories.find((x) => x.id === categoryId);
  if (!c) return '';
  return (getLang() === 'ca' && c.name_ca) || c.name_es;
}
