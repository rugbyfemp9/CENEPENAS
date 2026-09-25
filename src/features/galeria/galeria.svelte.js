// Estado y datos de la Galería.
//
// Las fotos viven fuera de la app, en álbumes compartidos de Google Photos: aquí solo
// guardamos temporada + álbum (título, portada y el enlace al álbum). Al pulsar un álbum
// se abre ese enlace en una pestaña nueva (o en la app de Google Photos si está instalada).
// La lista completa se guarda en Supabase (tabla "gallery_data", fila única id='current')
// para que quede sincronizada al momento en todas las cuentas. DEFAULT_SEASONS es solo el
// contenido de partida, por si todavía no hay ninguna fila guardada.
import { legacy } from '../../lib/legacy.js';
import { session } from '../../lib/session.svelte.js';
import { t } from '../../lib/i18n.svelte.js';

const DEFAULT_SEASONS = [
  {
    id:'2024-2025', label:'Temporada 2024/2025',
    cover:'assets/img/p3.jpg',
    albums:[
      {
        id:'2425-album-1', title:'GIPSY KINGS 24/05/25', cover:'assets/img/gipsy.jpg',
        url:'https://photos.app.goo.gl/Xj8rz5eonE3ubCqF6'
      },
      {
        id:'2425-album-2', title:'CNPN vs BARÇA COPA CTALANA', cover:'assets/img/barça.jpg',
        url:'https://photos.app.goo.gl/u1DWJbtyEKh1GQYYA'
      },
      {
        id:'2425-album-3', title:'CELLEBRACIÓ DE LA FINAL', cover:'assets/img/celebracio.jpg',
        url:'https://photos.app.goo.gl/FUaxqZ4XwYkUbfiT9'
      },
      {
        id:'2425-album-4', title:'FINAL', cover:'assets/img/final1.jpg',
        url:'https://photos.app.goo.gl/SdYcvVyNjjJR8NC19'
      },
      {
        id:'2425-album-5', title:'SEMIFINAL CNPN VS BADALONA', cover:'assets/img/semibad.jpg',
        url:'https://photos.app.goo.gl/LP9zdinQcvDksvYK9'
      },
      {
        id:'2425-album-6', title:'FOTOS OFICIALS', cover:'assets/img/tempo3.jpg',
        url:'https://photos.app.goo.gl/ZT7C22f97YM8qPqF6'
      },
      {
        id:'2425-album-7', title:'CNPN VS TARRAGONA', cover:'assets/img/t2.jpg',
        url:'https://photos.app.goo.gl/4wooraddPHw3hmHr7'
      },
      {
        id:'2425-album-8', title:'HOSPI VS CNPN', cover:'assets/img/hospy.jpg',
        url:'https://photos.app.goo.gl/NLHp5omRa8CuAYaa8'
      },
      {
        id:'2425-album-9', title:'TARRAGONA VS CNPN', cover:'assets/img/t1.jpg',
        url:'https://photos.app.goo.gl/nCGSN8TuafkZasKe9'
      },
      {
        id:'2425-album-10', title:'CEU VS CNPN', cover:'assets/img/ceu.jpg',
        url:'https://photos.app.goo.gl/KW62peZyz6CdwrMk7'
      },
      {
        id:'2425-album-11', title:'GÓTICS VS CNPN', cover:'assets/img/hallow.jpg',
        url:'https://photos.app.goo.gl/vES2gpuG7YLspyRz8'
      },
      {
        id:'2425-album-12', title:'CORNE VS CNPN', cover:'assets/img/diad.jpg',
        url:'https://photos.app.goo.gl/m3gUssBc8C289uKL8'
      },
    ]
  },
  {
    id:'2025-2026', label:'Temporada 2025/2026',
    cover:'assets/img/tempo1.jpg',
    albums:[
      {
        id:'2526-album-1', title:'FOTOS OFICIALS', cover:'assets/img/tempo1.jpg',
        url:'https://photos.app.goo.gl/wijjKGhGhmwGFzFi9'
      },
      {
        id:'2526-album-2', title:'FENIX vs CNPN', cover:'assets/img/fenix.jpg',
        url:'https://photos.app.goo.gl/5SbYq6zeUUCXp84x6'
      },
      {
        id:'2526-album-3', title:'CNPN VS CORNECRUC COPA', cover:'assets/img/corne.jpg',
        url:'https://photos.app.goo.gl/ecnjvpwExg4eGMmz8'
      },
      {
        id:'2526-album-4', title:'CNPN vs UNIZAR', cover:'assets/img/unizar.jpg',
        url:'https://photos.app.goo.gl/edSEyxiPhvhyUMTd7'
      },
      {
        id:'2526-album-5', title:'CNPN vs ANDORRA', cover:'assets/img/andorra.jpg',
        url:'https://photos.app.goo.gl/46MXdtpjwLfZNDih8'
      },
      {
        id:'2526-album-6', title:'FINAL DHC', cover:'assets/img/final.jpg',
        url:'https://photos.app.goo.gl/V9AKCsg9T98HxCCa7'
      }
    ]
  },
  {
    id:'2026-2027', label:'Temporada 2026/2027', current:true,
    cover:'assets/img/rugby.jpg',
    albums:[
    ]
  }
];

export const galeria = $state({
  seasons: DEFAULT_SEASONS,
  view: 'seasons',          // 'seasons' | 'albums'
  activeSeasonId: null,
  addModalOpen: false,
});

export function currentSeason() {
  return galeria.seasons.find((s) => s.id === galeria.activeSeasonId) || null;
}

// Solo Comi Xarxes (o la cuenta de administración) puede añadir álbumes nuevos; el
// resto del equipo puede ver todos los álbumes con total normalidad.
export function canManageGallery() {
  return session.isAdmin || session.comision === 'Comi Xarxes';
}

// Las fotos se movieron de "foto/" a "assets/img/" (y sus extensiones pasaron a
// minúsculas, p.ej. "gipsy.JPG" → "gipsy.jpg"). Las portadas ya guardadas en Supabase
// pueden seguir apuntando a la ruta antigua, así que se traducen al pintarlas.
export function coverUrl(cover) {
  const m = /^foto\/(.+)\.([A-Za-z]+)$/.exec(cover || '');
  return m ? `assets/img/${m[1]}.${m[2].toLowerCase()}` : cover;
}

export function showSeasons() {
  galeria.activeSeasonId = null;
  galeria.view = 'seasons';
}

export function openSeason(seasonId) {
  galeria.activeSeasonId = seasonId;
  galeria.view = 'albums';
}

// El botón "‹ Atrás" sube un nivel; desde Álbumes vuelve a Temporadas, y desde
// Temporadas ya sale de la Galería hacia Vestuario
export function goBack() {
  if (galeria.view === 'albums') showSeasons();
  else legacy.setSection('vestuario');
}

export function slugify(text) {
  return (text || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

// Añade un álbum (a una temporada existente o a una nueva) y lo guarda en Supabase.
// Devuelve false si falta algún dato (y ya ha avisado con un alert).
export function addAlbum({ seasonId, newSeasonLabel, title, cover, url }) {
  if (!canManageGallery()) {
    alert(t('galeria.onlyCommiXarxesAdd'));
    return false;
  }
  if (!title || !url) {
    alert(t('galeria.titleUrlRequired'));
    return false;
  }

  let season;
  if (seasonId === '__new__') {
    if (!newSeasonLabel) {
      alert(t('galeria.newSeasonNameRequired'));
      return false;
    }
    const newId = slugify(newSeasonLabel) || ('temporada-' + Date.now());
    galeria.seasons.push({ id: newId, label: newSeasonLabel, cover: 'https://picsum.photos/seed/' + newId + '/700/400', albums: [] });
    season = galeria.seasons[galeria.seasons.length - 1];
  } else {
    season = galeria.seasons.find((s) => s.id === seasonId);
    if (!season) return false;
  }

  const albumId = season.id + '-' + (slugify(title) || Date.now());
  season.albums.push({
    id: albumId, title, url,
    cover: cover || ('https://picsum.photos/seed/' + albumId + '/600/600'),
  });

  openSeason(season.id);

  // Se guarda en Supabase para que el álbum nuevo aparezca al momento en todas las
  // cuentas, no solo en la de quien lo ha añadido.
  saveGalleryData();
  return true;
}

// ---- Sincronización con Supabase (tabla "gallery_data", fila única id='current') ----
export async function loadGalleryData() {
  const cached = await legacy.readCache('gallery_data');
  if (cached && Array.isArray(cached.data)) galeria.seasons = cached.data;

  const { data, error } = await legacy.supabase
    .from('gallery_data')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();
  if (error) {
    console.error('No se ha podido cargar la galería desde Supabase', error);
    return;
  }
  if (data && Array.isArray(data.seasons)) {
    galeria.seasons = data.seasons;
    legacy.writeCache('gallery_data', data.seasons);
  }
}

async function saveGalleryData() {
  const { error } = await legacy.supabase.from('gallery_data').upsert({
    id: 'current',
    seasons: $state.snapshot(galeria.seasons),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('No se ha podido guardar la galería en Supabase', error);
    alert(t('galeria.saveSyncError', { error: error.message }));
  }
}

// Cualquier cambio en la galería (lo haga Comi Xarxes desde cualquier dispositivo)
// se recarga aquí al momento, sin tener que refrescar la página.
export function subscribeToGalleryRealtime() {
  legacy.supabase
    .channel('gallery-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_data' }, () => loadGalleryData())
    .subscribe();
}

// ---- Formulario "Añadir álbum" ----
export const albumForm = $state({ seasonId: '', newSeasonLabel: '', title: '', cover: '', url: '' });

export function openAddAlbumModal() {
  if (!canManageGallery()) {
    alert(t('galeria.onlyCommiXarxesAdd'));
    return;
  }
  const last = galeria.seasons[galeria.seasons.length - 1];
  albumForm.seasonId = galeria.activeSeasonId && galeria.seasons.some((s) => s.id === galeria.activeSeasonId)
    ? galeria.activeSeasonId : (last ? last.id : '__new__');
  albumForm.newSeasonLabel = '';
  albumForm.title = '';
  albumForm.cover = '';
  albumForm.url = '';
  galeria.addModalOpen = true;
}

export function saveNewAlbum() {
  const ok = addAlbum({
    seasonId: albumForm.seasonId,
    newSeasonLabel: albumForm.newSeasonLabel.trim(),
    title: albumForm.title.trim(),
    cover: albumForm.cover.trim(),
    url: albumForm.url.trim(),
  });
  if (ok) galeria.addModalOpen = false;
}
