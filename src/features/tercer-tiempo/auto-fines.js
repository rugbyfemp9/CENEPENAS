// Multas automáticas de "Tercer tiempo" (3T).
import { finesState, persistFineInsert, refreshAfterChange } from '../multas/multas.svelte.js';
import { legacy } from '../../lib/legacy.js';
import { thirdTimeCurrentMatch, thirdTimeEffectiveMembers } from './groups.js';
import { isThirdTimeDay, findFoodEntryForPlayer } from './food.svelte.js';

// Recuento automático: el domingo del partido a las 22:00h, a quien le tocaba cocinar
// y se marcó con ✕ (no trajo lo prometido) o se quedó en amarillo (no se apuntó a nada)
// se le pone una multa de 7€ en Multas. Se comprueba que no se le haya puesto ya para
// este mismo partido, para no duplicarla si se repite la comprobación.
// NOTA: las pone la app de cualquiera que la tenga abierta a esa hora, no solo la de
// Comi Tercer Temps.
export function checkThirdTimeAutoFines() {
  if (!isThirdTimeDay()) return;
  if (new Date().getHours() < 22) return;

  const current = thirdTimeCurrentMatch();
  if (!current) return;
  const { match, index } = current;
  const matchIso = legacy.attEventIso(match);
  // Se usan los miembros reales (ya ajustados por cambios de turno aceptados), no el
  // grupo fijo en bruto: quien haya sido cubierta no debe multarse, y quien haya
  // cubierto a otra sí responde por esa tarea
  const memberIds = thirdTimeEffectiveMembers('cook', match.id, index);

  let changed = false;
  memberIds.forEach((id) => {
    const found = findFoodEntryForPlayer(id);
    // Se le pone multa si marcaron que no lo trajo (✕), o si nunca se apuntó a nada (amarillo)
    const shouldFine = found ? found.entry.status === 'missing' : true;
    if (!shouldFine) return;

    const alreadyFined = finesState.list.some((f) => f.playerId === id && f.reasonId === 'tercer' && f.autoMatchIso === matchIso);
    if (alreadyFined) return;

    const tempId = crypto.randomUUID();
    const newFine = { id: tempId, playerId: id, reasonId: 'tercer', status: 'pendiente', autoMatchIso: matchIso };
    finesState.list.push(newFine);
    persistFineInsert(tempId, newFine);
    changed = true;
  });

  if (changed) {
    refreshAfterChange();
  }
}

// Por si se deja la pestaña abierta y el reloj cruza las 22:00h, se vuelve a
// comprobar cada minuto si hay que poner alguna multa automática.
export function startThirdTimeAutoFinesTimer() {
  setInterval(checkThirdTimeAutoFines, 60000);
}
