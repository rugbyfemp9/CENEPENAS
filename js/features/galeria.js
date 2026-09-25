/* ================= GALERÍA ================= */
// Las fotos viven fuera de la app, en álbumes compartidos de Google Photos: aquí solo
// guardamos temporada + álbum (título, portada y el enlace al álbum). Al pulsar un álbum
// se abre ese enlace en una pestaña nueva (o en la app de Google Photos si está instalada).
// La lista completa se guarda en Supabase (tabla "gallery_data", fila única id='current')
// para que quede sincronizada al momento en todas las cuentas. Este array es solo el
// contenido de partida, por si todavía no hay ninguna fila guardada.
let gallerySeasons = [
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

let galeriaView = 'seasons';       // 'seasons' | 'albums'
let galeriaActiveSeasonId = null;

function galeriaCurrentSeason(){
  return gallerySeasons.find(s => s.id === galeriaActiveSeasonId) || null;
}

// Las fotos se movieron de "foto/" a "assets/img/" (y sus extensiones pasaron a
// minúsculas, p.ej. "gipsy.JPG" → "gipsy.jpg"). Las portadas ya guardadas en Supabase
// pueden seguir apuntando a la ruta antigua, así que se traducen al pintarlas.
function galleryCoverUrl(cover){
  const m = /^foto\/(.+)\.([A-Za-z]+)$/.exec(cover || '');
  return m ? `assets/img/${m[1]}.${m[2].toLowerCase()}` : cover;
}

// Muestra únicamente la vista de nivel actual (temporadas / álbumes)
function galeriaShowView(view){
  galeriaView = view;
  document.getElementById('galeria-seasons-view').style.display = view === 'seasons' ? '' : 'none';
  document.getElementById('galeria-albums-view').style.display = view === 'albums' ? '' : 'none';

  const backLabel = document.getElementById('galeria-back-label');
  if(view === 'seasons'){
    document.getElementById('galeria-title').textContent = t('nav.galeria');
    backLabel.textContent = t('fines.backLabel');
  } else {
    const season = galeriaCurrentSeason();
    document.getElementById('galeria-title').textContent = season ? season.label : t('galeria.albumsFallbackTitle');
    backLabel.textContent = t('galeria.backSeasons');
  }
}

// El botón "‹ Atrás" sube un nivel; desde Álbumes vuelve a Temporadas, y desde
// Temporadas ya sale de la Galería hacia Vestuario
function galeriaGoBack(){
  if(galeriaView === 'albums'){
    galeriaActiveSeasonId = null;
    galeriaShowView('seasons');
  } else {
    setSection('vestuario');
  }
}

// ---- Nivel 1: temporadas ----
function renderGallerySeasons(){
  // De más reciente a menos reciente (la temporada actual, primero del todo).
  // El id sigue el formato "AAAA-AAAA", así que ordenar el texto al revés basta.
  const orderedSeasons = [...gallerySeasons].sort((a, b) => b.id.localeCompare(a.id));
  document.getElementById('galeria-seasons-view').innerHTML = orderedSeasons.map(s => `
      <button class="season-card" onclick="openGallerySeason('${s.id}')">
        <div class="season-card-cover" style="background-image:url('${galleryCoverUrl(s.cover)}');"></div>
        <div class="season-card-overlay">
          <div class="season-card-title">${escapeHtml(s.label)}</div>
          <div class="season-card-sub">${escapeHtml(s.albums.length === 1 ? t('galeria.albumCountOne', {count: s.albums.length}) : t('galeria.albumCountMany', {count: s.albums.length}))}</div>
          ${s.current ? `<div class="season-card-current">${escapeHtml(t('galeria.currentSeason'))}</div>` : ''}
        </div>
      </button>
    `).join('');
}
function openGallerySeason(seasonId){
  galeriaActiveSeasonId = seasonId;
  renderGalleryAlbums();
  galeriaShowView('albums');
}

// ---- Nivel 2: álbumes de la temporada elegida ----
// Cada álbum es un enlace real a Google Photos: se abre en pestaña nueva (o en la
// app de Google Photos si el enlace se toca desde el móvil y la app está instalada).
function renderGalleryAlbums(){
  const season = galeriaCurrentSeason();
  const box = document.getElementById('galeria-albums-view');
  if(!season || !season.albums.length){
    box.innerHTML = `<div class="gallery-empty">${escapeHtml(t('galeria.noAlbumsSeason'))}</div>`;
    return;
  }
  box.innerHTML = season.albums.map(a => `
      <a class="album-card" href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t('galeria.openInGooglePhotos'))}">
        <img src="${galleryCoverUrl(a.cover)}" alt="${escapeHtml(a.title)}" loading="lazy">
        <div class="cap">
          <b>${escapeHtml(a.title)}</b>
          <span>${escapeHtml(t('galeria.viewInGooglePhotos'))}
            <span class="ext-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></span>
          </span>
        </div>
      </a>
    `).join('');
}

// ---- Añadir álbum nuevo (temporada existente o nueva + título + portada + enlace) ----
function slugify(text){
  return (text || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function openAddAlbumModal(){
  if(!canManageGallery()){
    alert(t('galeria.onlyCommiXarxesAdd'));
    return;
  }
  const select = document.getElementById('album-season-input');
  select.innerHTML = gallerySeasons.map(s => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('')
    + `<option value="__new__">${escapeHtml(t('galeria.newSeasonOption'))}</option>`;
  select.value = galeriaActiveSeasonId && gallerySeasons.some(s => s.id === galeriaActiveSeasonId)
    ? galeriaActiveSeasonId : (gallerySeasons[gallerySeasons.length - 1] ? gallerySeasons[gallerySeasons.length - 1].id : '__new__');
  document.getElementById('album-new-season-input').value = '';
  document.getElementById('album-title-input').value = '';
  document.getElementById('album-cover-input').value = '';
  document.getElementById('album-url-input').value = '';
  toggleNewSeasonField();
  document.getElementById('add-album-modal').classList.add('active');
}
function toggleNewSeasonField(){
  const isNew = document.getElementById('album-season-input').value === '__new__';
  document.getElementById('album-new-season-wrap').style.display = isNew ? 'flex' : 'none';
}
function closeAddAlbumModal(){
  document.getElementById('add-album-modal').classList.remove('active');
}
function saveNewAlbum(){
  if(!canManageGallery()){
    alert(t('galeria.onlyCommiXarxesAdd'));
    return;
  }
  const seasonSel = document.getElementById('album-season-input').value;
  const title = document.getElementById('album-title-input').value.trim();
  const cover = document.getElementById('album-cover-input').value.trim();
  const url = document.getElementById('album-url-input').value.trim();

  if(!title || !url){
    alert(t('galeria.titleUrlRequired'));
    return;
  }

  let season;
  if(seasonSel === '__new__'){
    const newLabel = document.getElementById('album-new-season-input').value.trim();
    if(!newLabel){
      alert(t('galeria.newSeasonNameRequired'));
      return;
    }
    const newId = slugify(newLabel) || ('temporada-' + Date.now());
    season = { id:newId, label:newLabel, cover:'https://picsum.photos/seed/' + newId + '/700/400', albums:[] };
    gallerySeasons.push(season);
  } else {
    season = gallerySeasons.find(s => s.id === seasonSel);
    if(!season) return;
  }

  const albumId = season.id + '-' + (slugify(title) || Date.now());
  season.albums.push({
    id: albumId, title, url,
    cover: cover || ('https://picsum.photos/seed/' + albumId + '/600/600')
  });

  closeAddAlbumModal();
  renderGallerySeasons();
  galeriaActiveSeasonId = season.id;
  renderGalleryAlbums();
  galeriaShowView('albums');

  // Se guarda en Supabase para que el álbum nuevo aparezca al momento en todas las
  // cuentas, no solo en la de quien lo ha añadido.
  saveGalleryData();
}

// ---- Sincronización con Supabase (tabla "gallery_data", fila única id='current') ----
// Solo Comi Xarxes puede añadir álbumes nuevos; el resto del equipo puede ver todos
// los álbumes con total normalidad.
function canManageGallery(){
  const me = rosterById[currentUserId];
  return isAdmin || !!(me && me.comision === 'Comi Xarxes');
}
function toggleAddAlbumButtonVisibility(){
  const btn = document.getElementById('add-album-btn');
  if(btn) btn.style.display = canManageGallery() ? '' : 'none';
}

async function loadGalleryData(){
  const cached = await readCache('gallery_data');
  if(cached && Array.isArray(cached.data)){
    gallerySeasons = cached.data;
    renderGallerySeasons();
    if(galeriaView === 'albums') renderGalleryAlbums();
  }

  const { data, error } = await supabaseClient
    .from('gallery_data')
    .select('*')
    .eq('id', 'current')
    .maybeSingle();
  if(error){
    console.error('No se ha podido cargar la galería desde Supabase', error);
    return;
  }
  if(data && Array.isArray(data.seasons)){
    gallerySeasons = data.seasons;
    writeCache('gallery_data', gallerySeasons);
    renderGallerySeasons();
    if(galeriaView === 'albums') renderGalleryAlbums();
  }
}

async function saveGalleryData(){
  const { error } = await supabaseClient.from('gallery_data').upsert({
    id: 'current',
    seasons: gallerySeasons,
    updated_at: new Date().toISOString()
  });
  if(error){
    console.error('No se ha podido guardar la galería en Supabase', error);
    alert(t('galeria.saveSyncError', {error: error.message}));
  }
}

// Cualquier cambio en la galería (lo haga Comi Xarxes desde cualquier dispositivo)
// se recarga aquí al momento, sin tener que refrescar la página.
function subscribeToGalleryRealtime(){
  supabaseClient
    .channel('gallery-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'gallery_data' }, () => loadGalleryData())
    .subscribe();
}
