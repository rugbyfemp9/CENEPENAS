// ---- Jerarquía de visualización del nombre de una jugadora, para toda la app ----
// 1) Si tiene mote, se muestra solo el mote.
// 2) Si no tiene mote, se muestra solo su nombre de pila.
// 3) Si dos o más jugadoras sin mote comparten nombre de pila, se añade la inicial
//    de su primer apellido para diferenciarlas (p.ej. "Marta R." y "Marta G.").
function firstNameOf(fullName){
  return (fullName || '').trim().split(/\s+/)[0] || '';
}
function surnameInitialOf(fullName){
  const parts = (fullName || '').trim().split(/\s+/);
  return parts.length > 1 && parts[1] ? parts[1].charAt(0).toUpperCase() + '.' : '';
}
// Calcula, para un conjunto de jugadoras ({id, name, mote}), el texto que le
// corresponde mostrar a cada una. Devuelve un Map id -> texto a mostrar.
// Se le pasa siempre el grupo completo dentro del que hay que desambiguar
// (todo el roster, o la lista concreta que se esté pintando en ese momento).
function computeDisplayNames(players){
  const result = new Map();
  const noMote = [];
  players.forEach(p => {
    if(p.mote) result.set(p.id, p.mote);
    else noMote.push(p);
  });

  const byFirstName = {};
  noMote.forEach(p => {
    const fn = firstNameOf(p.name) || 'Sin nombre';
    (byFirstName[fn] = byFirstName[fn] || []).push(p);
  });

  Object.entries(byFirstName).forEach(([fn, group]) => {
    if(group.length === 1){
      result.set(group[0].id, fn);
    } else {
      group.forEach(p => {
        const initial = surnameInitialOf(p.name);
        result.set(p.id, initial ? `${fn} ${initial}` : fn);
      });
    }
  });

  return result;
}
// Atajo para una sola jugadora del roster global (desambigua contra todo rosterById).
// Para listas concretas más amplias o distintas (p.ej. la tabla de Jugadoras recién
// cargada de Supabase), usa computeDisplayNames() directamente sobre esa lista.
function displayName(player){
  if(!player) return '';
  if(player.mote) return player.mote;
  const map = computeDisplayNames(Object.values(rosterById));
  return map.get(player.id) || firstNameOf(player.name) || player.name || '';
}
