// Jugadas: el libro de jugadas del equipo, cada una con su animación/vídeo.
//
// Las categorías y las jugadas viven en Supabase (tablas "play_categories" y "plays",
// que se crean a mano en el SQL Editor) y se añaden desde el Table Editor.
// Se cargan cada vez que se entra en la sección (setSection), por si han añadido
// alguna desde entonces; mientras tanto se pinta lo último que había en caché.
// Las admins pueden añadir jugadas con el botón "+": el vídeo se sube al bucket
// "plays" de Supabase Storage y la jugada guarda su URL pública. Una jugada también
// puede ser una animación de pizarra (columna "animation", ver board.js).
import { supabase } from '../../lib/supabase.js';
import { readCache, writeCache } from '../../lib/storage.js';
import { session } from '../../lib/session.svelte.js';
import { t, getLang } from '../../lib/i18n.svelte.js';
import { normalizeAnimation } from './board.js';

const VIDEO_BUCKET = 'plays';
// El mismo límite que tiene el bucket: así se avisa antes de subir nada.
export const MAX_VIDEO_MB = 50;

export const jugadas = $state({
  status: 'idle',  // 'idle' | 'loading' | 'ok' | 'error'
  categories: [],  // filas de play_categories, ya ordenadas
  plays: [],       // filas de plays, ya ordenadas
  filter: 'all',   // 'all' | id de una categoría
  modalOpen: false,
  openId: null,
  addModalOpen: false,
  formKey: 0,      // cambia en cada apertura del modal para vaciar el <input type="file">
});

// kind: 'video' (se sube un vídeo) o 'animation' (se sigue en el editor de pizarra).
export const playForm = $state({ kind: 'video', categoryId: '', title: '', description: '', file: null, saving: false });

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

// La animación de una jugada (columna "animation"), ya revisada; null si no tiene o
// si lo guardado no se puede pintar.
export function animationOf(play) {
  return play ? normalizeAnimation(play.animation) : null;
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

// ---- Añadir una jugada (solo admins) ----
export function canManagePlays() {
  return session.isAdmin;
}

export function openAddPlayModal() {
  if (!canManagePlays()) return;
  playForm.categoryId = jugadas.filter !== 'all' ? jugadas.filter : (jugadas.categories[0]?.id || '');
  playForm.kind = 'video';
  playForm.title = '';
  playForm.description = '';
  playForm.file = null;
  playForm.saving = false;
  jugadas.formKey++;
  jugadas.addModalOpen = true;
}

function videoExtension(file) {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(file.name || '');
  if (fromName) return fromName[1].toLowerCase();
  return (file.type.split('/')[1] || 'mp4').toLowerCase();
}

export async function saveNewPlay() {
  if (!canManagePlays() || playForm.saving) return false;
  const title = playForm.title.trim();
  const description = playForm.description.trim();
  const file = playForm.file;
  if (!playForm.categoryId || !title) {
    alert(t('jugadas.alertMissingFields'));
    return false;
  }
  if (file && !file.type.startsWith('video/')) {
    alert(t('jugadas.alertNotVideo'));
    return false;
  }
  if (file && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    alert(t('jugadas.alertTooBig', { max: MAX_VIDEO_MB }));
    return false;
  }

  playForm.saving = true;
  let path = null;
  let videoUrl = null;
  if (file) {
    path = `${crypto.randomUUID()}.${videoExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (uploadError) {
      console.error('No se ha podido subir el vídeo', uploadError);
      alert(t('jugadas.alertUploadError', { error: uploadError.message }));
      playForm.saving = false;
      return false;
    }
    videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Al final de su categoría.
  const sortOrder = Math.max(0, ...playsOf(playForm.categoryId).map((p) => p.sort_order || 0)) + 10;
  const { data, error } = await supabase
    .from('plays')
    .insert({
      category_id: playForm.categoryId, title, description: description || null,
      video_url: videoUrl, sort_order: sortOrder,
    })
    .select()
    .single();
  playForm.saving = false;
  if (error) {
    console.error('No se ha podido guardar la jugada', error);
    // Que no quede un vídeo huérfano en el bucket.
    if (path) supabase.storage.from(VIDEO_BUCKET).remove([path]);
    alert(t('jugadas.alertSaveError', { error: error.message }));
    return false;
  }

  jugadas.plays.push(data);
  writeCache('plays', { categories: jugadas.categories, plays: jugadas.plays });
  jugadas.addModalOpen = false;
  return true;
}
