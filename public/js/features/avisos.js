// ---- Avisos (Inicio) ----
// Los avisos se guardan en almacenamiento compartido (visible para todo el mundo),
// no solo en este dispositivo, y hay dos tipos:
//  - "pinned": se queda fijado en la lista de Avisos hasta que quien lo creó lo borre
//    (solo a esa persona le aparece la "x" de borrar, al resto no).
//  - "banner": aparece como notificación arriba del todo de Inicio para todo el mundo,
//    con una "x" para cerrarla (cada persona la cierra solo para sí misma, como pasa
//    con el aviso de Fantasy).
let pendingNoticeType = 'pinned';

function setNoticeType(type){
  pendingNoticeType = type;
  document.querySelectorAll('#notice-type-quick button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('notice-type-hint').textContent = type === 'banner'
    ? 'Aparece arriba del todo para todo el mundo, con una "x" para cerrarla.'
    : 'Se queda fijado en "Avisos" hasta que tú lo borres.';
}

// Trae todos los avisos guardados (de cualquier tipo y de cualquier persona).
// Viven en la tabla "notices" de Supabase (compartida para todo el club),
// no en window.storage, que solo funciona dentro de Claude.ai.
// renderNotices() y renderInicioTopNotices() piden cada una por su cuenta los
// avisos, y las dos se llaman casi siempre juntas (al iniciar sesión y al entrar en
// Inicio) — sin este control, cada una de esas veces se pedía la tabla "notices" DOS
// veces en paralelo. noticesFetchPromise hace que la segunda llamada, si la primera
// todavía está en camino, espere a esa misma petición en vez de lanzar otra igual.
// (Aquí no se usa la caché con caducidad de más arriba: los avisos no tienen
// sincronización en directo propia, así que guardarlos unos minutos podría retrasar
// que se viera un aviso nuevo publicado por otra persona.)
let noticesFetchPromise = null;
async function fetchAllNotices(){
  if(noticesFetchPromise) return noticesFetchPromise;

  noticesFetchPromise = (async () => {
    const { data, error } = await supabaseClient
      .from('notices')
      .select('*')
      .order('created_at', { ascending:false });
    noticesFetchPromise = null;
    if(error){ console.error('No se han podido cargar los avisos', error); return []; }
    return (data || []).map(row => ({
      id: row.id,
      text: row.text,
      type: row.type,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      dateLabel: row.date_label
    }));
  })();

  return noticesFetchPromise;
}

async function renderNotices(){
  const list = document.getElementById('notices-list');
  if(!list) return;
  list.innerHTML = `<div class="notices-empty">${escapeHtml(t('notices.loading'))}</div>`;

  const all = await fetchAllNotices();
  // Los avisos antiguos (antes de existir los dos tipos) no tienen "type": se tratan
  // como fijados, para no perderlos.
  const pinned = all
    .filter(n => n.type !== 'banner')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if(!pinned.length){
    list.innerHTML = `<div class="notices-empty">${escapeHtml(t('notices.empty'))}</div>`;
    return;
  }

  list.innerHTML = pinned.map(n => {
    const text = (n.text && n.text !== 'undefined') ? n.text : '';
    const byName = (n.createdByName && n.createdByName !== 'undefined') ? n.createdByName : '';
    const dateLabel = (n.dateLabel && n.dateLabel !== 'undefined') ? n.dateLabel : '';
    return `
        <div class="notice-card">
          <div class="notice-body">
            <div class="notice-text">${escapeHtml(text)}</div>
            <div class="notice-date">${byName ? escapeHtml(byName) + ' · ' : ''}${escapeHtml(dateLabel)}</div>
          </div>
          ${n.createdBy && n.createdBy === currentAuthUserId ? `
          <button class="notice-delete-btn" onclick="deleteNotice('${n.id}')" aria-label="${escapeHtml(t('notices.delete'))}" title="${escapeHtml(t('notices.delete'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>` : ''}
        </div>
      `;
  }).join('');
}

// Notificaciones arriba del todo de Inicio: se muestran todas las que no se hayan
// cerrado ya en este dispositivo (varias pueden convivir a la vez).
async function renderInicioTopNotices(){
  const box = document.getElementById('inicio-top-notices');
  if(!box) return;
  if(!currentAuthUserId){ box.innerHTML = ''; return; }

  const all = await fetchAllNotices();
  const banners = all.filter(n => n.type === 'banner');
  if(!banners.length){ box.innerHTML = ''; return; }

  let dismissed = [];
  try{
    const d = await window.storage.get('notices:dismissed-banners', false);
    if(d && d.value) dismissed = JSON.parse(d.value);
  }catch(e){ /* todavía no se ha cerrado ninguna */ }

  const visible = banners
    .filter(n => !dismissed.includes(n.id))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  box.innerHTML = visible.map(n => {
    const text = (n.text && n.text !== 'undefined') ? n.text : '';
    const canDelete = n.createdBy && n.createdBy === currentAuthUserId;
    return `
      <div class="inicio-top-notice-banner">
        <div class="icon">📢</div>
        <div class="txt">${escapeHtml(text)}</div>
        ${canDelete ? `
        <button type="button" class="dismiss" onclick="deleteTopNoticePermanently('${n.id}')" aria-label="${escapeHtml(t('notices.delete'))}" title="${escapeHtml(t('notices.delete'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>` : ''}
        <button type="button" class="dismiss" onclick="dismissTopNotice('${n.id}')" aria-label="Cerrar aviso" title="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

// El botón "x" solo lo oculta para quien lo pulsa (cada dispositivo decide si ya lo ha
// leído). Para poder quitarlo de verdad para todo el mundo, quien lo creó tiene además
// este botón de papelera, que sí lo borra de Supabase de forma permanente.
async function deleteTopNoticePermanently(id){
  await deleteNotice(id);
  renderInicioTopNotices();
}

async function dismissTopNotice(id){
  let dismissed = [];
  try{
    const d = await window.storage.get('notices:dismissed-banners', false);
    if(d && d.value) dismissed = JSON.parse(d.value);
  }catch(e){ /* todavía no había ninguna cerrada */ }

  if(!dismissed.includes(id)){
    dismissed.push(id);
    try{ await window.storage.set('notices:dismissed-banners', JSON.stringify(dismissed), false); }catch(e){ /* si falla, se reintentará luego */ }
  }
  renderInicioTopNotices();
}

function openAddNoticeModal(){
  document.getElementById('notice-text-input').value = '';
  pendingNoticeType = 'pinned';
  setNoticeType('pinned');
  document.getElementById('add-notice-modal').classList.add('active');
}
function closeAddNoticeModal(){
  document.getElementById('add-notice-modal').classList.remove('active');
}
async function saveNotice(){
  const text = document.getElementById('notice-text-input').value.trim();
  if(!text){
    alert('Escribe el texto del aviso.');
    return;
  }
  if(!currentAuthUserId){
    alert('Inicia sesión para publicar un aviso.');
    return;
  }

  const now = new Date();
  const id = 'n' + now.getTime() + Math.random().toString(36).slice(2, 8);
  const me = rosterById[currentUserId];
  const notice = {
    id,
    text,
    type: pendingNoticeType,
    createdBy: currentAuthUserId,
    createdByName: me ? displayName(me) : (myProfile.name || 'Alguien'),
    createdAt: now.toISOString(),
    dateLabel: now.getDate() + ' ' + monthAbbrLabel(autoMonthAbbr[now.getMonth()]) + ' · ' +
               String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  };

  try{
    const { error } = await supabaseClient.from('notices').insert({
      id: notice.id,
      text: notice.text,
      type: notice.type,
      created_by: notice.createdBy,
      created_by_name: notice.createdByName,
      date_label: notice.dateLabel
    });
    if(error) throw error;
  }catch(e){
    alert('No se ha podido publicar el aviso. Inténtalo de nuevo.');
    return;
  }

  closeAddNoticeModal();
  renderNotices();
  renderInicioTopNotices();
}
async function deleteNotice(id){
  try{
    const { error } = await supabaseClient.from('notices').delete().eq('id', id);
    if(error) throw error;
  }catch(e){
    alert('No se ha podido eliminar el aviso.');
    return;
  }
  renderNotices();
}
