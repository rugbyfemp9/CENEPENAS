// ---- Nota "Recuerda": qué llevar al partido (checklist personal, banner de Inicio) ----
// Privada de verdad: se guarda en Supabase con tu owner_id (política de seguridad propia,
// como en Fantasy), así que solo tú la ves y solo tú la editas, pero te sigue a cualquier
// dispositivo en el que inicies sesión.
//
// Como antes, la lista se vuelve a pintar entera (checklist.version) después de cada
// cambio, incluida la fila de "Añadir algo más…".
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';

const MATCHDAY_CHECKLIST_DEFAULTS = [
  'Botes tacos', 'Mijetes', 'Hombreres', 'Pantalons equipció', 'Leggins o samarreta interior',
  'Roba Interior', 'Bucal', 'Sabo o coses per a la ducha', 'Roba pa cambiarse', 'Toalla', 'Hawaiana',
];

export const checklist = $state({
  open: false,
  // null = todavía no se ha abierto nunca (caja vacía) | 'loading' | 'list'
  mode: null,
  version: 0,
});

let matchdayChecklistItems = [];
// Id del partido "de hoy" (lo fija renderNextMatchBanner() cuando toca jugar). Se usa
// solo para decidir si hay que desmarcar todas las casillas al abrir la lista: los
// propios elementos de la lista nunca dependen de esto, se quedan siempre.
let matchdayChecklistCurrentMatchId = null;
export function setChecklistMatchId(id) {
  matchdayChecklistCurrentMatchId = id;
}

export function checklistItems() {
  checklist.version; // dependencia: se repinta al cambiar la versión
  return matchdayChecklistItems;
}

// Carga tus elementos guardados (o te crea la lista básica de partida la primera vez),
// y si ha llegado un partido nuevo desde la última vez, desmarca todas las casillas.
async function loadMatchdayChecklist() {
  if (!auth.userId) return;

  const { data: items, error: itemsError } = await supabase
    .from('matchday_checklist_items')
    .select('id, label, checked, created_at')
    .eq('owner_id', auth.userId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('No se ha podido cargar la lista de qué llevar', itemsError);
    return;
  }

  if (!items || items.length === 0) {
    // Primera vez que abres la lista: la sembramos con los básicos, para no empezar
    // de una lista vacía. A partir de aquí son elementos normales, se pueden borrar.
    const defaultRows = MATCHDAY_CHECKLIST_DEFAULTS.map((label) => ({ owner_id: auth.userId, label, checked: false }));
    const { data: inserted, error: seedError } = await supabase
      .from('matchday_checklist_items')
      .insert(defaultRows)
      .select('id, label, checked, created_at');
    if (seedError) {
      console.error('No se ha podido crear la lista inicial de qué llevar', seedError);
      matchdayChecklistItems = [];
    } else {
      matchdayChecklistItems = inserted || [];
    }
  } else {
    matchdayChecklistItems = items;
  }

  // Si estamos en día de partido y es distinto del último partido para el que
  // marcamos casillas, las desmarcamos todas ahora (una sola vez por partido nuevo).
  if (matchdayChecklistCurrentMatchId) {
    const { data: state } = await supabase
      .from('matchday_checklist_state')
      .select('last_match_id')
      .eq('owner_id', auth.userId)
      .maybeSingle();

    if (!state || state.last_match_id !== matchdayChecklistCurrentMatchId) {
      if (matchdayChecklistItems.some((i) => i.checked)) {
        await supabase
          .from('matchday_checklist_items')
          .update({ checked: false })
          .eq('owner_id', auth.userId);
        matchdayChecklistItems.forEach((i) => { i.checked = false; });
      }
      await supabase
        .from('matchday_checklist_state')
        .upsert({ owner_id: auth.userId, last_match_id: matchdayChecklistCurrentMatchId });
    }
  }
}

function renderMatchdayChecklist() {
  checklist.mode = 'list';
  checklist.version++;
}

export async function addMatchdayChecklistItem() {
  const input = document.getElementById('matchday-checklist-input');
  const label = input.value.trim();
  if (!label) return;
  input.value = '';

  const { data, error } = await supabase
    .from('matchday_checklist_items')
    .insert({ owner_id: auth.userId, label, checked: false })
    .select('id, label, checked, created_at')
    .single();

  if (error) {
    console.error('No se ha podido añadir el elemento', error);
    alert('No se ha podido añadir. Inténtalo de nuevo.');
    return;
  }
  matchdayChecklistItems.push(data);
  renderMatchdayChecklist();
}

export async function toggleMatchdayChecklistItem(id) {
  const item = matchdayChecklistItems.find((i) => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  renderMatchdayChecklist();

  const { error } = await supabase
    .from('matchday_checklist_items')
    .update({ checked: item.checked })
    .eq('id', id);
  if (error) {
    console.error('No se ha podido guardar la casilla', error);
    item.checked = !item.checked; // revertimos si no se ha podido guardar
    renderMatchdayChecklist();
  }
}

export async function deleteMatchdayChecklistItem(id) {
  matchdayChecklistItems = matchdayChecklistItems.filter((i) => i.id !== id);
  renderMatchdayChecklist();

  const { error } = await supabase.from('matchday_checklist_items').delete().eq('id', id);
  if (error) console.error('No se ha podido borrar el elemento', error);
}

export async function openMatchdayChecklistModal() {
  checklist.mode = 'loading';
  checklist.open = true;
  await loadMatchdayChecklist();
  renderMatchdayChecklist();
}

export function closeMatchdayChecklistModal() {
  checklist.open = false;
}
