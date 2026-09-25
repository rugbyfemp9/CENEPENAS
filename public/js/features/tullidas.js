// ---- "Tullidas": lista de jugadoras apuntadas para vendaje antes de un partido ----
// Tabla en Supabase (créala si todavía no existe):
//
//   create table if not exists match_injuries (
//     id uuid primary key default gen_random_uuid(),
//     event_id text not null,
//     user_id uuid not null,
//     player_name text not null,
//     note text not null,
//     created_at timestamptz not null default now()
//   );
//
// Cache en memoria: { [eventId]: [ {id, user_id, player_name, note, created_at}, ... ] }
const tullidesByEventId = {};
let tullidesRealtimeSubscribed = false;
// Id del próximo partido, para poder abrir "Tullidas" desde el banner de Inicio sin
// tener que entrar antes al detalle del evento (se actualiza en renderNextMatchBanner).
let nextMatchTullidesEventId = null;

function tullidesRowHtml(row){
  const isMine = row.user_id === currentAuthUserId;
  return `
      <div class="tullides-row" data-tullides-id="${row.id}">
        <div class="meta">
          <b>${escapeHtml(row.player_name)}</b>
          <span>${escapeHtml(row.note)}</span>
        </div>
        ${isMine ? `<button class="del" onclick="removeTullidesItem('${row.id}')" aria-label="${t('att.delete')}" title="${t('att.delete')}">✕</button>` : ''}
      </div>
    `;
}

function renderTullidesList(){
  const list = document.getElementById('tullides-list');
  if(!list) return;
  const rows = tullidesByEventId[currentEventId] || [];
  list.innerHTML = rows.length
    ? rows.map(tullidesRowHtml).join('')
    : `<div class="att-roster-empty">${t('att.tullidesEmpty')}</div>`;
}

async function loadTullidesForEvent(eventId){
  const { data, error } = await supabaseClient
    .from('match_injuries')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending:true });
  if(error){
    console.error('No se ha podido cargar la lista de tullidas', error);
    return;
  }
  tullidesByEventId[eventId] = data || [];
  if(currentEventId === eventId) renderTullidesList();
}

function openTullidesModal(){
  const ev = attEvents.find(e => e.id === currentEventId);
  if(!ev) return;
  document.getElementById('tullides-modal-sub').textContent = `${ev.label} · ${eventWhenDisplay(ev)}`;
  document.getElementById('tullides-input').value = '';
  renderTullidesList();
  document.getElementById('tullides-modal').classList.add('active');
  loadTullidesForEvent(currentEventId);
  setTimeout(() => document.getElementById('tullides-input').focus(), 0);
}

// Atajo para abrir "Tullidas" del próximo partido desde el banner de Inicio, sin
// pasar antes por su detalle. Solo cambia currentEventId si hace falta (si ya
// estabas viendo el detalle de otro evento, no lo pisa innecesariamente).
function openTullidesModalForNextMatch(){
  if(!nextMatchTullidesEventId) return;
  currentEventId = nextMatchTullidesEventId;
  openTullidesModal();
}

function closeTullidesModal(){
  document.getElementById('tullides-modal').classList.remove('active');
}

// Al apuntarse, el nombre sale solo (el de la propia cuenta): no hace falta escribirlo,
// solo qué vendaje se necesita.
async function addTullidesItem(){
  const input = document.getElementById('tullides-input');
  const note = input.value.trim();
  if(!note || !currentEventId || !currentAuthUserId) return;

  const row = {
    event_id: currentEventId,
    user_id: currentAuthUserId,
    player_name: displayName(rosterById['me']) || myProfile.name || 'Alguien',
    note
  };

  const { data, error } = await supabaseClient.from('match_injuries').insert(row).select().single();
  if(error){
    console.error('No se ha podido guardar en la lista de tullidas', error);
    return;
  }

  if(!tullidesByEventId[currentEventId]) tullidesByEventId[currentEventId] = [];
  tullidesByEventId[currentEventId].push(data);
  input.value = '';
  renderTullidesList();
  input.focus();
}

async function removeTullidesItem(id){
  const { error } = await supabaseClient
    .from('match_injuries')
    .delete()
    .eq('id', id)
    .eq('user_id', currentAuthUserId); // solo se puede borrar la propia fila
  if(error){
    console.error('No se ha podido borrar de la lista de tullidas', error);
    return;
  }
  const rows = tullidesByEventId[currentEventId];
  if(rows){
    const i = rows.findIndex(r => r.id === id);
    if(i !== -1) rows.splice(i, 1);
  }
  renderTullidesList();
}

// Sincroniza en directo la lista en cuanto cualquier persona se apunta, edita o se
// borra de "Tullidas" (esté abierto el modal o no, para tener siempre la caché al día).
function subscribeToTullidesRealtime(){
  if(tullidesRealtimeSubscribed) return;
  tullidesRealtimeSubscribed = true;
  supabaseClient
    .channel('tullides-sync')
    .on('postgres_changes', { event:'*', schema:'public', table:'match_injuries' }, payload => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      if(!row || !row.event_id) return;
      if(!tullidesByEventId[row.event_id]) tullidesByEventId[row.event_id] = [];
      const rows = tullidesByEventId[row.event_id];

      if(payload.eventType === 'DELETE'){
        const i = rows.findIndex(r => r.id === row.id);
        if(i !== -1) rows.splice(i, 1);
      } else {
        const i = rows.findIndex(r => r.id === row.id);
        if(i !== -1) rows[i] = row; else rows.push(row);
      }

      if(currentEventId === row.event_id) renderTullidesList();
    })
    .subscribe();
}
