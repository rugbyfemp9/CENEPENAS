/* ================= MULTAS ================= */
// Tabla de multas del equipo (chips agrupados por motivo, modo edición), resumen
// personal ("Debes ..."), pagar una multa (con la petición de confirmación a la persona
// de Comi Tesoreria), modales de alta / edición / borrado, histórico de pagadas, el
// banner de Inicio y el total de la tarjeta de Vestuario.
//
// El array `fines` sigue declarado en el código antiguo (js/core/state.js), porque
// también lo leen y modifican secciones sin migrar (la Lista de partidos crea/quita las
// multas automáticas de "Retraso", el Tercer tiempo las de "Tercer tiempo", Jugadoras
// cuenta tarjetas...). No es reactivo: igual que antes, cada parte de la pantalla solo
// se vuelve a leer de ahí cuando se "pinta". Cada parte tiene su propio contador en
// `multas` (0 = todavía no se ha pintado nunca, y se queda vacía como el marcado
// original) que las funciones render*() incrementan, y el código antiguo las llama por
// appBridge.multas.
import { SvelteSet } from 'svelte/reactivity';
import { legacy } from '../../lib/legacy.js';
import { session } from '../../lib/session.svelte.js';
import { t } from '../../lib/i18n.svelte.js';
import { treasury, treasuryCommissionMembers } from '../tesoreria/tesoreria.svelte.js';

// Los 4 motivos fijos, cada uno con su importe
export const fineReasons = [
  { id: 'amarilla', label: 'Tarjeta amarilla', short: 'TA', amount: 5 },
  { id: 'roja', label: 'Tarjeta roja', short: 'TR', amount: 10 },
  { id: 'retraso', label: 'Retraso', short: 'R', amount: 2 },
  { id: 'tercer', label: 'Tercer tiempo', short: '3T', amount: 7 },
];
export const fineReasonById = Object.fromEntries(fineReasons.map((r) => [r.id, r]));

export const multas = $state({
  // Contadores de pintado de cada parte (ver arriba)
  table: 0,      // tabla "Multas del equipo"
  summary: 0,    // tarjeta "Tu situación" / "Debes"
  requests: 0,   // avisos "X te ha pagado su multa"
  banner: 0,     // banner de Inicio
  totals: 0,     // total de la tarjeta de Vestuario
  history: 0,    // histórico de multas pagadas
  // Modo edición de la tabla de multas: mientras está activo, un clic en una multa
  // abre el panel de editar/eliminar en vez de marcarla como pagada.
  editMode: false,
});

// Solo Comi Tesoreria puede dar de alta multas nuevas (el resto del equipo puede
// ver la lista, pagar las suyas y confirmar pagos recibidos con total normalidad).
export function canManageFines() {
  return session.isAdmin || session.comision === 'Comi Tesoreria';
}

// Tras iniciar sesión o editar el perfil (appBridge.sessionChanged() ya ha refrescado
// la sesión): los botones "Añadir multa" / "Editar multas" dependen solos de la sesión.
// Si deja de tener permiso mientras el modo edición estaba activo, se desactiva.
export function permissionsChanged() {
  if (!canManageFines() && multas.editMode) {
    multas.editMode = false;
    renderFinesTable();
  }
}

export function toggleFinesEditMode() {
  if (!canManageFines()) return;
  multas.editMode = !multas.editMode;
  renderFinesTable();
}

// ---- "Pintar" cada parte (ver comentario de arriba)
export function renderFinesTable() { multas.table++; }
export function renderFineConfirmRequests() { multas.requests++; }
export function renderMyFinesSummary() {
  // Independiente de la propia situación de multas: refresca los avisos de pago
  // pendientes de confirmar que le tocan a esta persona (si es de Comi Tesoreria).
  renderFineConfirmRequests();
  multas.summary++;
}
export function renderInicioFinesBanner() { multas.banner++; }
export function updateFinesSummaries() { multas.totals++; }
export function renderFinesHistory() { multas.history++; }

// Lo que se repinta después de cualquier cambio en las multas.
export function refreshAfterChange() {
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();
}

// Al cambiar de idioma se repintaba lo mismo que desde setLang() (js/core/i18n.js).
export function onLangChange() {
  renderInicioFinesBanner();
  renderMyFinesSummary();
  renderFinesTable();
  if (historyModal.open) renderFinesHistory();
}

// ---- Multas: leídas y guardadas en la tabla "fines" de Supabase, para que cualquier
// interacción (dar de alta, pagar, confirmar un pago, deshacer) se vea al momento desde
// cualquier dispositivo. Solo Comi Tesoreria puede dar de alta multas nuevas — eso se
// controla tanto aquí (ocultando el botón) como en Supabase con una política de RLS,
// que es la que de verdad impide el alta aunque alguien abra la consola del navegador.
function fineRowToLocal(row) {
  // La fila de Supabase usa el id real de auth.users; localmente "yo" siempre se
  // identifica como 'me', igual que en el resto de la app (roster, avatares, etc.).
  const authUserId = legacy.authUserId;
  const toLocalId = (id) => (id && id === authUserId ? 'me' : id);
  return {
    id: row.id,
    playerId: toLocalId(row.player_id),
    reasonId: row.reason_id,
    status: row.status,
    paidToId: row.paid_to_id ? toLocalId(row.paid_to_id) : null,
    autoMatchIso: row.auto_match_iso || null,
    paidAt: row.paid_at || null,
  };
}

export async function loadFines() {
  const { data, error } = await legacy.supabase
    .from('fines')
    .select('id, player_id, reason_id, status, paid_to_id, auto_match_iso, paid_at, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('No se pudieron cargar las multas', error);
    return;
  }
  legacy.fines = (data || []).map(fineRowToLocal);
  renderMyFinesSummary();
  renderInicioFinesBanner();
  renderFinesTable();
  renderFinesHistory();
  renderFineConfirmRequests();
  updateFinesSummaries();
  legacy.loadPlantilla();
}

// Inserta una multa nueva en Supabase y, si sale bien, sustituye su id local (temporal)
// por el id real que ha generado la base de datos.
export async function persistFineInsert(localId, fine) {
  const { data, error } = await legacy.supabase
    .from('fines')
    .insert({
      player_id: legacy.toRemotePlayerId(fine.playerId),
      reason_id: fine.reasonId,
      status: fine.status,
      paid_to_id: fine.paidToId ? legacy.toRemotePlayerId(fine.paidToId) : null,
      auto_match_iso: fine.autoMatchIso || null,
    })
    .select()
    .single();

  if (error) {
    alert('La multa se ha guardado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
    return;
  }
  const local = legacy.fines.find((f) => f.id === localId);
  if (local) local.id = data.id;
  renderFinesTable();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  updateFinesSummaries();
}

// Actualiza en Supabase una multa ya existente (pagar, confirmar, deshacer, o editar
// su jugadora/motivo).
async function persistFineUpdate(fineId, patch) {
  const remotePatch = {};
  if ('status' in patch) remotePatch.status = patch.status;
  if ('paidToId' in patch) remotePatch.paid_to_id = patch.paidToId ? legacy.toRemotePlayerId(patch.paidToId) : null;
  if ('playerId' in patch) remotePatch.player_id = legacy.toRemotePlayerId(patch.playerId);
  if ('reasonId' in patch) remotePatch.reason_id = patch.reasonId;

  const { error } = await legacy.supabase.from('fines').update(remotePatch).eq('id', fineId);
  if (error) {
    alert('El cambio se ha aplicado en la app, pero no se pudo sincronizar con Supabase: ' + error.message);
  }
}

// Elimina una multa por completo (deshacer): solo Comi Tesoreria puede hacerlo. Se usa
// sobre todo para las multas de "Retraso" que se generan solas al guardar la Lista del
// día de partido, por si alguien se marcó mal con "✕" por error.
// (Ahora mismo no la llama nadie: el borrado se hace desde el modal de edición.)
export async function deleteFine(fineId) {
  if (!canManageFines()) {
    alert('Solo Comi Tesoreria puede deshacer una multa.');
    return;
  }
  if (!confirm('¿Deshacer esta multa? Se eliminará por completo.')) return;

  legacy.fines = legacy.fines.filter((f) => f.id !== fineId);
  refreshAfterChange();

  const { data, error } = await legacy.supabase.from('fines').delete().eq('id', fineId).select();
  if (error) {
    alert('No se ha podido deshacer la multa en Supabase: ' + error.message);
    loadFines(); // por si acaso, recargamos el estado real desde el servidor
  } else if (!data || data.length === 0) {
    // Supabase no da error si el borrado no afecta a ninguna fila (p.ej. si una
    // política de RLS lo bloquea): por eso se comprueba aquí explícitamente. Si pasa,
    // recargamos desde el servidor para que la multa "fantasma" vuelva a aparecer
    // ahora (y no como sorpresa en el próximo refresh) y avisamos del motivo real.
    alert('La multa no se ha podido eliminar en Supabase (probablemente por permisos). Revisa la política de borrado de la tabla "fines".');
    loadFines();
  }
}

// Cualquier cambio en la tabla "fines" (lo haga quien lo haga, desde cualquier
// dispositivo) se recarga aquí al momento, sin tener que refrescar la página.
export function subscribeToFinesRealtime() {
  legacy.supabase
    .channel('fines-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fines' }, () => loadFines())
    .subscribe();
}

// Cada multa es una entrada individual: una jugadora + un motivo + un estado

const sumAmounts = (list) => list.reduce((sum, f) => sum + fineReasonById[f.reasonId].amount, 0);

// Total de multas pendientes de todo el equipo (tarjeta de Vestuario). Antes de
// pintarse por primera vez queda el texto de partida del marcado ("0 € pendientes").
export function vestuarioTotalText() {
  if (!multas.totals) return '0 € pendientes';
  const pending = legacy.fines.filter((f) => f.status === 'pendiente');
  return sumAmounts(pending) + ' € pendientes';
}

function myPendingFines() {
  return legacy.fines.filter((f) => f.playerId === legacy.currentUserId && f.status === 'pendiente');
}

// Tarjeta "Tu situación" / "Debes": null mientras no se ha pintado nunca.
export function myFinesSummary() {
  if (!multas.summary) return null;
  const myPending = myPendingFines();
  return {
    total: sumAmounts(myPending),
    rows: myPending.map((f) => {
      const r = fineReasonById[f.reasonId];
      return { id: f.id, label: r.label, amount: r.amount, awaiting: !!f.paidToId };
    }),
  };
}

// Banner de "Multas pendientes" en Inicio: mismo tamaño que el de Tercer tiempo,
// cambia de color/mensaje según lo que debe el usuario que ha iniciado sesión.
export function inicioFinesBanner() {
  if (!multas.banner) return null;
  const myPending = myPendingFines();
  const total = sumAmounts(myPending);
  if (myPending.length === 0) return { kind: 'ok', total };
  return { kind: total < 5 ? 'warn' : 'danger', total };
}

// Datos de avatar de una entrada del roster, tal como los pintaba avatarHtml().
function avatarOf(player, fallbackName) {
  return {
    url: player ? player.avatarUrl : '',
    fallback: legacy.initials(fallbackName),
    injured: player ? player.injured : false,
    injuryIcon: player ? player.injuryIcon : '',
  };
}

// Avisos, en la sección de Multas, para la persona de Comi Tesoreria a la que se ha
// marcado como pagada una multa: debe confirmar antes de que se dé por buena.
export function fineConfirmRequests() {
  if (!multas.requests) return [];
  const rosterById = legacy.rosterById;
  return legacy.fines
    .filter((f) => f.status === 'pendiente' && f.paidToId === legacy.currentUserId)
    .map((f) => {
      const payer = rosterById[f.playerId];
      const reason = fineReasonById[f.reasonId];
      const payerName = payer ? legacy.displayName(payer) : t('sharedLineup.someone');
      return { id: f.id, payerName, avatar: payer ? avatarOf(payer, payerName) : null, label: reason.label, amount: reason.amount };
    });
}

// Tabla "Multas del equipo": null mientras no se ha pintado nunca.
export function finesTable() {
  if (!multas.table) return null;
  const fines = legacy.fines;
  const rosterById = legacy.rosterById;
  const editMode = multas.editMode;

  // Se obtienen directamente de las multas ya guardadas (no del roster), para que
  // cualquier jugadora con una multa pendiente aparezca aquí, incluida una misma.
  const playerIdsWithFines = [...new Set(fines.filter((f) => f.status === 'pendiente').map((f) => f.playerId))];

  return playerIdsWithFines.map((playerId) => {
    // NOTA: antes, si la jugadora de una multa no estaba en el roster, esto petaba
    // ("Cannot read properties of undefined (reading 'avatarUrl')") y la tabla se
    // quedaba sin pintar; ahora se pinta la fila igual, como "Alguien".
    const player = rosterById[playerId];
    const name = player ? legacy.displayName(player) : t('sharedLineup.someone');
    const playerFines = fines.filter((f) => f.playerId === playerId);
    const pending = playerFines.filter((f) => f.status === 'pendiente');
    const total = sumAmounts(pending);

    // Se agrupan las multas pendientes por motivo, así que si hay varias del mismo
    // tipo (p.ej. 2 tarjetas rojas) se muestra un único símbolo con el recuento
    // delante ("2TR") en vez de repetir el símbolo una vez por multa.
    const pendingByReason = pending.reduce((acc, f) => {
      (acc[f.reasonId] = acc[f.reasonId] || []).push(f);
      return acc;
    }, {});
    const chips = Object.entries(pendingByReason).map(([reasonId, group]) => {
      const r = fineReasonById[reasonId];
      const count = group.length;
      // Al hacer clic se actúa sobre una multa que todavía no se haya marcado como
      // pagada (si todas están ya a la espera de confirmación, se usa la primera).
      const target = group.find((f) => !f.paidToId) || group[0];
      const anyAwaiting = group.some((f) => f.paidToId);
      const label = (count > 1 ? `${count}${r.short}` : r.short) + (anyAwaiting ? ' ⏳' : '');
      const editTitle = count > 1
        ? t('fines.chipEditMulti', { count, label: r.label, amount: r.amount })
        : t('fines.chipEditSingle', { label: r.label, amount: r.amount });
      const payTitle = (count > 1
        ? t('fines.chipPayMulti', { count, label: r.label, amount: r.amount })
        : t('fines.chipPaySingle', { label: r.label, amount: r.amount }))
        + (anyAwaiting ? ` ${t('fines.chipSomeAwaiting')}` : '');
      return { reasonId, label, targetId: target.id, title: editMode ? editTitle : payTitle };
    });

    return { playerId, name, avatar: avatarOf(player, name), chips, total };
  });
}

// En modo edición (solo Comi Tesoreria), un clic abre el panel de editar/eliminar
// esa multa; fuera de ese modo, un clic la marca como pagada, como siempre.
export function onFineChipClick(fineId) {
  if (multas.editMode) openEditFineModal(fineId);
  else toggleFinePaid(fineId);
}

export function toggleFinePaid(fineId) {
  const f = legacy.fines.find((x) => x.id === fineId);
  if (!f) return;
  if (f.status === 'pendiente') {
    if (f.paidToId) {
      const responsible = legacy.rosterById[f.paidToId];
      alert(t('fines.alreadyPaidWaiting', { name: responsible ? legacy.displayName(responsible) : t('sharedLineup.someone') }));
      return;
    }
    openPayFineModal(fineId);
    return;
  }
  // Des-marcar una multa ya pagada no genera ningún movimiento, solo la vuelve a dejar pendiente
  f.status = 'pendiente';
  f.paidToId = null;
  persistFineUpdate(f.id, { status: 'pendiente', paidToId: null });
  refreshAfterChange();
}

// ---- Pagar una multa

export const payModal = $state({
  open: false,
  fineId: null,
  // Personas de Comi Tesoreria que se ofrecen (se fijan al abrir el modal); null
  // mientras no se ha abierto nunca.
  members: null,
  // Se incrementa en cada apertura para volver a crear el <select> (y que quede
  // elegida la primera opción, como al rellenarlo de nuevo con innerHTML).
  seq: 0,
});

export function payMyFine(fineId) {
  openPayFineModal(fineId);
}

export function openPayFineModal(fineId) {
  const f = legacy.fines.find((x) => x.id === fineId);
  if (!f) return;
  payModal.fineId = fineId;
  payModal.members = treasuryCommissionMembers().map((p) => ({ id: p.id, name: legacy.displayName(p) }));
  payModal.seq++;
  payModal.open = true;
}

export function closePayFineModal() {
  payModal.open = false;
  payModal.fineId = null;
}

function paidConcept(f) {
  const player = legacy.rosterById[f.playerId];
  const reason = fineReasonById[f.reasonId];
  return `Multa (${reason.label})${player ? ' — ' + legacy.displayName(player) : ''}`;
}

// selectedValue: lo elegido en el desplegable "Se le ha pagado a".
export function confirmPayFine(selectedValue) {
  const f = legacy.fines.find((x) => x.id === payModal.fineId);
  if (!f) return;

  const members = treasuryCommissionMembers();
  const responsibleId = members.length ? selectedValue : null;
  if (members.length && !responsibleId) {
    alert('Elige a quién de Comi Tesoreria se le ha pagado.');
    return;
  }

  if (responsibleId) {
    // No se da por pagada todavía: queda a la espera de que esa persona de Comi
    // Tesoreria confirme que de verdad ha recibido el pago (ver fineConfirmRequests).
    f.paidToId = responsibleId;
    persistFineUpdate(f.id, { paidToId: responsibleId });
    closePayFineModal();
    renderMyFinesSummary();
    renderInicioFinesBanner();
    renderFinesTable();
    updateFinesSummaries();
    return;
  }

  // No hay nadie en Comi Tesoreria a quien pedirle confirmación: se da el pago
  // por bueno directamente, como antes.
  // NOTA: paid_at solo se guarda en local (persistFineUpdate no lo envía a Supabase).
  f.status = 'pagada';
  f.paidAt = legacy.todayIso();
  persistFineUpdate(f.id, { status: 'pagada', paidToId: null, paid_at: f.paidAt });
  treasury.addEntry({
    iso: legacy.todayIso(),
    concept: paidConcept(f),
    type: 'ingreso',
    amount: fineReasonById[f.reasonId].amount,
    responsibleId: null,
  });

  closePayFineModal();
  renderMyFinesSummary();
  renderInicioFinesBanner();
  renderFinesTable();
  updateFinesSummaries();
}

// Responde a un aviso de "X te ha pagado su multa": si se confirma, la multa pasa
// a pagada de verdad y el ingreso se añade a Comi Tesoreria; si no, la multa vuelve
// a quedar pendiente de pago, sin nadie asignado.
export function respondFineConfirmation(fineId, accepted) {
  const f = legacy.fines.find((x) => x.id === fineId);
  if (!f) return;

  if (accepted) {
    f.status = 'pagada';
    f.paidAt = legacy.todayIso();
    persistFineUpdate(f.id, { status: 'pagada', paid_at: f.paidAt });
    treasury.addEntry({
      iso: legacy.todayIso(),
      concept: paidConcept(f),
      type: 'ingreso',
      amount: fineReasonById[f.reasonId].amount,
      // NOTA: quien confirma es "yo", así que aquí va 'me' (el id local), no su id real.
      responsibleId: f.paidToId,
    });
  } else {
    f.paidToId = null;
    persistFineUpdate(f.id, { paidToId: null });
  }

  renderMyFinesSummary();
  renderInicioFinesBanner();
  renderFinesTable();
  updateFinesSummaries();
}

// ---- Histórico de multas pagadas: se abre con el icono de reloj de "Multas del
// equipo" y lista todo lo que ya está marcado como pagado (lo que desaparece de la
// tabla principal en cuanto se paga, queda archivado aquí en vez de perderse).
export const historyModal = $state({ open: false });

export function openFinesHistoryModal() {
  renderFinesHistory();
  historyModal.open = true;
}
export function closeFinesHistoryModal() {
  historyModal.open = false;
}

// null mientras no se ha pintado nunca.
export function finesHistory() {
  if (!multas.history) return null;
  const rosterById = legacy.rosterById;
  return legacy.fines
    .filter((f) => f.status === 'pagada')
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
    .map((f) => {
      const player = rosterById[f.playerId];
      const reason = fineReasonById[f.reasonId];
      const paidTo = f.paidToId ? rosterById[f.paidToId] : null;
      return {
        avatar: { url: player ? player.avatarUrl : '', fallback: legacy.initials(player ? legacy.displayName(player) : '?'), injured: false, injuryIcon: '' },
        name: player ? legacy.displayName(player) : t('sharedLineup.someone'),
        reasonLabel: reason ? reason.label : '',
        amount: reason ? reason.amount : '',
        paidToName: paidTo ? legacy.displayName(paidTo) : null,
        date: f.paidAt ? legacy.formatFullDate(f.paidAt) : '—',
      };
    });
}

// ---- Buscador de jugadora (modales de alta y de edición)

// Estado de un buscador: el texto de la casilla, si hay una jugadora fijada (clase
// has-selection) y el desplegable de resultados (se calcula al escribir / enfocar,
// como antes, no en directo).
function createPlayerSearch() {
  return { query: '', hasSelection: false, resultsOpen: false, results: [] };
}

// Fuente única de datos del buscador: todo el roster ya registrado y activo en la
// app (rosterById, alimentado desde Supabase por loadPlantilla), incluida la propia
// usuaria ('me'), para poder ponerse una multa a una misma. Nunca se genera ni
// inventa ninguna jugadora ficticia.
function getFinePlayerPool() {
  return Object.values(legacy.rosterById);
}

// Normaliza texto para comparar ignorando mayúsculas y tildes/diacríticos.
function normalizeFineSearchText(str) {
  return (str || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function closePlayerSearchResults(search) {
  search.results = [];
  search.resultsOpen = false;
}

// results: lista de jugadoras encontradas, o null para "Sin coincidencias".
function renderPlayerSearchResults(search) {
  const query = normalizeFineSearchText(search.query);

  if (!query) {
    closePlayerSearchResults(search);
    return;
  }

  const pool = getFinePlayerPool();
  // Jerarquía visual estándar de la app para desambiguar (mote > nombre de pila >
  // nombre de pila + inicial del apellido si hay nombres duplicados).
  const displayNames = legacy.computeDisplayNames(pool);

  const matches = pool.filter((p) => {
    const shown = displayNames.get(p.id) || p.name || '';
    return [p.name, p.mote, shown].some((txt) => normalizeFineSearchText(txt).includes(query));
  });

  if (!matches.length) {
    search.results = null;
    search.resultsOpen = true;
    return;
  }

  search.results = matches.map((p) => {
    const shown = displayNames.get(p.id) || p.name || 'Sin nombre';
    return { id: p.id, shown, avatar: { url: p.avatarUrl, fallback: legacy.initials(shown), injured: p.injured, injuryIcon: p.injuryIcon } };
  });
  search.resultsOpen = true;
}

// Al escribir se invalida cualquier jugadora fijada anteriormente: solo queda
// confirmada de nuevo cuando se elige explícitamente una fila del desplegable.
export function onPlayerSearchInput(modal, value) {
  modal.search.query = value;
  modal.playerId = null;
  modal.search.hasSelection = false;
  renderPlayerSearchResults(modal.search);
}

export function onPlayerSearchFocus(modal) {
  renderPlayerSearchResults(modal.search);
}

// Fija la jugadora sancionada: guarda su id, deja su nombre en la casilla a modo
// de confirmación visual y cierra el desplegable de resultados.
export function selectPlayer(modal, playerId) {
  const player = legacy.rosterById[playerId];
  if (!player) return;
  modal.playerId = playerId;
  modal.search.query = legacy.displayName(player);
  modal.search.hasSelection = true;
  closePlayerSearchResults(modal.search);
}

// Antes renderFinePlayerGrid(): se llama desde otros puntos de la app (subida/borrado
// de foto de perfil, cambios en "tocada/lesionada"…) para refrescar cualquier vista
// que esté pintando avatares del roster; aquí repinta el desplegable de búsqueda si
// está abierto, para que los avatares se actualicen al momento.
export function renderFinePlayerGrid() {
  if (fineModal.search.resultsOpen) renderPlayerSearchResults(fineModal.search);
}

export function toggleReason(modal, reasonId) {
  if (modal.reasonIds.has(reasonId)) modal.reasonIds.delete(reasonId);
  else modal.reasonIds.add(reasonId);
}

export function reasonsTotal(reasonIds) {
  return [...reasonIds].reduce((sum, id) => sum + fineReasonById[id].amount, 0);
}

// --- Modal de alta de multa ---
export const fineModal = $state({
  open: false,
  playerId: null,
  reasonIds: new SvelteSet(),
  search: createPlayerSearch(),
});

export function openFineModal() {
  if (!canManageFines()) {
    alert(t('fines.onlyTreasuryAdd'));
    return;
  }
  fineModal.playerId = null;
  fineModal.reasonIds = new SvelteSet();
  fineModal.search.query = '';
  fineModal.search.hasSelection = false;
  closePlayerSearchResults(fineModal.search);
  fineModal.open = true;
}

export function closeFineModal() {
  fineModal.open = false;
  closePlayerSearchResults(fineModal.search);
}

export function saveFine() {
  if (!canManageFines()) {
    alert(t('fines.onlyTreasuryAdd'));
    return;
  }
  if (!fineModal.playerId || fineModal.reasonIds.size === 0) {
    alert(t('fines.choosePlayerReason'));
    return;
  }
  fineModal.reasonIds.forEach((reasonId) => {
    const tempId = crypto.randomUUID();
    const newFine = { id: tempId, playerId: fineModal.playerId, reasonId, status: 'pendiente', paidToId: null };
    legacy.fines.push(newFine);
    persistFineInsert(tempId, newFine);
  });
  closeFineModal();
  refreshAfterChange();
  legacy.loadPlantilla();
}

// ---- Editar multa: mismo patrón que el modal de alta, pero centrado en una
// jugadora ya existente. La rejilla de motivos es multi-selección: "Eliminar multa"
// borra todas las multas pendientes de esa jugadora cuyo motivo esté marcado (si un
// motivo marcado no tiene multa, simplemente no pasa nada con él). "Guardar cambios"
// sigue sirviendo para renombrar una multa concreta a otra jugadora/motivo, y por
// eso solo funciona cuando hay exactamente un motivo marcado.
export const editFineModal = $state({
  open: false,
  fineId: null,
  playerId: null,
  reasonIds: new SvelteSet(),
  search: createPlayerSearch(),
});

export function openEditFineModal(fineId) {
  if (!canManageFines()) {
    alert('Solo Comi Tesoreria puede editar multas.');
    return;
  }
  const fines = legacy.fines;
  const fine = fines.find((f) => f.id === fineId);
  if (!fine) return;

  editFineModal.fineId = fineId;
  editFineModal.playerId = fine.playerId;
  // Se preseleccionan todos los motivos por los que esta jugadora tiene ahora mismo
  // una multa pendiente, para que la rejilla refleje su situación real de partida.
  editFineModal.reasonIds = new SvelteSet(
    fines.filter((f) => f.playerId === fine.playerId && f.status === 'pendiente').map((f) => f.reasonId),
  );

  const player = legacy.rosterById[fine.playerId];
  editFineModal.search.query = player ? legacy.displayName(player) : '';
  editFineModal.search.hasSelection = true;
  closePlayerSearchResults(editFineModal.search);

  editFineModal.open = true;
}

export function closeEditFineModal() {
  editFineModal.open = false;
  closePlayerSearchResults(editFineModal.search);
}

export async function saveEditFine() {
  if (!canManageFines()) {
    alert(t('fines.onlyTreasuryEdit'));
    return;
  }
  if (!editFineModal.playerId || editFineModal.reasonIds.size !== 1) {
    alert(t('fines.editSaveHint'));
    return;
  }
  const newReasonId = [...editFineModal.reasonIds][0];
  const fine = legacy.fines.find((f) => f.id === editFineModal.fineId);
  if (!fine) return;

  fine.playerId = editFineModal.playerId;
  fine.reasonId = newReasonId;

  const idToUpdate = editFineModal.fineId;
  closeEditFineModal();
  refreshAfterChange();
  legacy.loadPlantilla();

  await persistFineUpdate(idToUpdate, { playerId: editFineModal.playerId, reasonId: newReasonId });
}

// Borra todas las multas PENDIENTES de la jugadora elegida cuyo motivo esté marcado
// en la rejilla. Si un motivo marcado no tiene ninguna multa para esa jugadora, se
// ignora sin más — no se crea ni se avisa, simplemente no hay nada que borrar.
export async function deleteFineFromEditModal() {
  if (!canManageFines()) {
    alert(t('fines.onlyTreasuryDelete'));
    return;
  }
  if (!editFineModal.playerId) {
    alert(t('fines.choosePlayer'));
    return;
  }
  if (editFineModal.reasonIds.size === 0) {
    alert(t('fines.chooseReasonToDelete'));
    return;
  }

  const toDelete = legacy.fines.filter((f) =>
    f.playerId === editFineModal.playerId &&
    f.status === 'pendiente' &&
    editFineModal.reasonIds.has(f.reasonId),
  );

  if (toDelete.length === 0) {
    closeEditFineModal();
    return;
  }
  if (!confirm(toDelete.length === 1 ? t('fines.deleteConfirmOne') : t('fines.deleteConfirmMany', { count: toDelete.length }))) return;

  closeEditFineModal();

  const idsToDelete = toDelete.map((f) => f.id);
  legacy.fines = legacy.fines.filter((f) => !idsToDelete.includes(f.id));
  refreshAfterChange();

  const { data, error } = await legacy.supabase.from('fines').delete().in('id', idsToDelete).select();
  if (error) {
    alert(t('fines.deleteError', { error: error.message }));
    loadFines();
  } else if (!data || data.length < idsToDelete.length) {
    // Supabase no da error si el borrado no afecta a ninguna fila (p.ej. si una
    // política de RLS lo bloquea), solo devuelve menos filas de las esperadas.
    // Se recarga desde el servidor para que cualquier multa "fantasma" vuelva a
    // aparecer ahora mismo (y no como sorpresa en el próximo refresh).
    alert('Alguna multa no se ha podido eliminar en Supabase (probablemente por permisos). Revisa la política de borrado de la tabla "fines".');
    loadFines();
  }
}
