// Avisos (Inicio).
//
// Los avisos se guardan en la tabla "notices" de Supabase (visible para todo el club)
// y hay dos tipos:
//  - "pinned": se queda fijado en la lista de Avisos hasta que quien lo creó lo borre
//    (solo a esa persona le aparece la papelera, al resto no).
//  - "banner": aparece como notificación arriba del todo de Inicio para todo el mundo,
//    con una "x" para cerrarla (cada persona la cierra solo para sí misma, como pasa
//    con el aviso de Fantasy).
import { legacy } from '../../lib/legacy.js';

export const notices = $state({
  status: 'idle',   // 'loading' mientras se pide la lista de avisos fijados
  pinned: [],       // { id, text, byName, dateLabel, mine }
  banners: [],      // notificaciones de arriba de Inicio todavía no cerradas aquí
});

export const noticeForm = $state({ open: false, type: 'pinned', text: '' });

const clean = (v) => (v && v !== 'undefined' ? v : '');
const newestFirst = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

// La lista de avisos y las notificaciones de arriba se refrescan casi siempre juntas
// (al iniciar sesión y al entrar en Inicio): si ya hay una petición en camino, la
// segunda espera a esa misma en vez de pedir la tabla "notices" otra vez.
// (Aquí no se usa la caché con caducidad: los avisos no tienen sincronización en
// directo propia, así que guardarlos unos minutos podría retrasar que se viera un
// aviso nuevo publicado por otra persona.)
let inFlight = null;
function fetchAllNotices() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const { data, error } = await legacy.supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    inFlight = null;
    if (error) { console.error('No se han podido cargar los avisos', error); return []; }
    return (data || []).map((row) => ({
      id: row.id,
      text: row.text,
      type: row.type,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      dateLabel: row.date_label,
    }));
  })();
  return inFlight;
}

export async function refreshPinned() {
  notices.status = 'loading';
  const all = await fetchAllNotices();
  const me = legacy.authUserId;
  // Los avisos antiguos (antes de existir los dos tipos) no tienen "type": se tratan
  // como fijados, para no perderlos.
  notices.pinned = all
    .filter((n) => n.type !== 'banner')
    .sort(newestFirst)
    .map((n) => ({ id: n.id, text: clean(n.text), byName: clean(n.createdByName), dateLabel: clean(n.dateLabel), mine: !!n.createdBy && n.createdBy === me }));
  notices.status = 'ok';
}

async function readDismissed() {
  try {
    const d = await legacy.storage.get('notices:dismissed-banners', false);
    if (d && d.value) return JSON.parse(d.value);
  } catch (e) { /* todavía no se ha cerrado ninguna */ }
  return [];
}

// Notificaciones arriba del todo de Inicio: se muestran todas las que no se hayan
// cerrado ya en este dispositivo (varias pueden convivir a la vez).
export async function refreshBanners() {
  const me = legacy.authUserId;
  if (!me) { notices.banners = []; return; }
  const banners = (await fetchAllNotices()).filter((n) => n.type === 'banner');
  if (!banners.length) { notices.banners = []; return; }
  const dismissed = await readDismissed();
  notices.banners = banners
    .filter((n) => !dismissed.includes(n.id))
    .sort(newestFirst)
    .map((n) => ({ id: n.id, text: clean(n.text), mine: !!n.createdBy && n.createdBy === me }));
}

export function refreshAll() {
  refreshPinned();
  refreshBanners();
}

// La "x" solo la oculta para quien la pulsa (cada dispositivo decide si ya la ha leído).
export async function dismissBanner(id) {
  const dismissed = await readDismissed();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    try { await legacy.storage.set('notices:dismissed-banners', JSON.stringify(dismissed), false); } catch (e) { /* si falla, se reintentará luego */ }
  }
  refreshBanners();
}

export async function deleteNotice(id) {
  try {
    const { error } = await legacy.supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    alert('No se ha podido eliminar el aviso.');
    return;
  }
  refreshPinned();
}

// Para quitar una notificación de verdad para todo el mundo, quien la creó tiene
// además una papelera, que sí la borra de Supabase de forma permanente.
export async function deleteBannerPermanently(id) {
  await deleteNotice(id);
  refreshBanners();
}

export function openAddNoticeModal() {
  noticeForm.text = '';
  noticeForm.type = 'pinned';
  noticeForm.open = true;
}

export async function saveNotice() {
  const text = noticeForm.text.trim();
  if (!text) {
    alert('Escribe el texto del aviso.');
    return;
  }
  const userId = legacy.authUserId;
  if (!userId) {
    alert('Inicia sesión para publicar un aviso.');
    return;
  }

  const now = new Date();
  const me = legacy.me;
  const row = {
    id: 'n' + now.getTime() + Math.random().toString(36).slice(2, 8),
    text,
    type: noticeForm.type,
    created_by: userId,
    created_by_name: me ? legacy.displayName(me) : (legacy.myProfile.name || 'Alguien'),
    date_label: now.getDate() + ' ' + legacy.monthAbbrLabel(now.getMonth()) + ' · ' +
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
  };

  try {
    const { error } = await legacy.supabase.from('notices').insert(row);
    if (error) throw error;
  } catch (e) {
    alert('No se ha podido publicar el aviso. Inténtalo de nuevo.');
    return;
  }

  noticeForm.open = false;
  refreshAll();
}
