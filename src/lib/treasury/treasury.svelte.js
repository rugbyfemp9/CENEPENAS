// Tesorería de una comisión: la usan Comi Tesoreria (tabla "treasury_entries") y
// Comi Tercer Temps (tabla "tercer_treasury_entries"), que siguen exactamente el mismo
// patrón: saldo total, tabla de movimientos, modo edición, modal "Añadir movimiento",
// desglose por integrante y confirmación antes de borrar.
//
// Cada movimiento: fecha (iso), concepto, tipo ('ingreso'|'gasto') e importe (siempre
// positivo). Se guardan en Supabase para que estén sincronizados entre todo el mundo;
// la lista arranca vacía hasta que load() traiga lo que haya guardado.
//
// Los movimientos se guardan en un array normal (no reactivo) y la tabla se pinta a
// partir de una copia que se rehace en render(), igual que hacía el código antiguo
// con innerHTML: así, mientras se edita la tabla, escribir en una celda solo cambia el
// dato (y el saldo, si es el importe), sin reordenar las filas ni reescribir el campo
// que se está tecleando. Las filas se reordenan en el siguiente render() (al cambiar
// un tipo, borrar, añadir o pulsar "Hecho").
import { legacy } from '../legacy.js';
import { formatEuro } from '../format.js';

const netOf = (entries) => entries.reduce((sum, e) => sum + (e.type === 'ingreso' ? e.amount : -e.amount), 0);

// El banner del saldo usa un guion normal para los negativos (las filas, "−").
export const balanceLabel = (n) => (n < 0 ? '-' : '') + formatEuro(Math.abs(n));

/**
 * @param {{
 *   table: string,
 *   canManage: () => boolean,
 *   members: () => any[],   // personas de la plantilla que son de la comisión
 *   messages: { loadError: string, addError: string, persistError: string, noMembersNoEntries: string },
 * }} options
 */
export function createTreasury({ table, canManage, members, messages }) {
  let entries = [];

  const view = $state({
    balance: 0,
    editMode: false,
    rows: [],             // copia ordenada de los movimientos, rehecha en render()
    // El botón "Editar"/"Hecho" solo cambia al pulsarlo (si se pierde el permiso con
    // el modo edición activo, se sale del modo edición pero el botón no se toca).
    editBtnActive: false,
    editBtnLabel: null,   // null = el texto traducido de "comi.edit"
  });
  const addForm = $state({ open: false, iso: '', concept: '', type: 'ingreso', amount: '', members: null, responsibleId: '' });
  const breakdown = $state({ open: false, rows: [] });
  const deleteConfirm = $state({ open: false, targetId: null });

  // Al cambiar de idioma, el texto del botón vuelve a ser la traducción de "Editar"
  // aunque el modo edición siga activo (como hacía applyI18n() con data-i18n).
  window.addEventListener('app:langchange', () => { view.editBtnLabel = null; });

  function rowToEntry(row) {
    return { id: row.id, iso: row.iso, concept: row.concept, type: row.type, amount: Number(row.amount), responsibleId: row.responsible_id };
  }

  function render() {
    view.balance = netOf(entries);
    const rosterById = legacy.rosterById;
    view.rows = [...entries].sort((a, b) => b.iso.localeCompare(a.iso)).map((e) => ({
      id: e.id, iso: e.iso, concept: e.concept, type: e.type, amount: e.amount,
      responsible: e.responsibleId && rosterById[e.responsibleId] ? legacy.displayName(rosterById[e.responsibleId]) : '',
    }));
  }

  function toggleEditMode() {
    if (!canManage()) return;
    view.editMode = !view.editMode;
    view.editBtnActive = view.editMode;
    view.editBtnLabel = view.editMode ? 'Hecho' : 'Editar';
    render();

    // Al pulsar "Hecho" (salir del modo edición) se guardan los cambios para todo el equipo
    if (!view.editMode) {
      persist();
    }
  }

  // Trae los movimientos guardados en Supabase (todo el mundo ve los mismos).
  async function load() {
    const { data, error } = await legacy.supabase
      .from(table)
      .select('*')
      .order('iso', { ascending: false });
    if (error) { console.error(messages.loadError, error); return; }
    entries = (data || []).map(rowToEntry);
    render();
  }

  // Añade un movimiento nuevo directamente en Supabase (usado tanto desde el modal
  // "Añadir movimiento" como cuando se genera solo, p.ej. al pagar una multa).
  async function addEntry({ iso, concept, type, amount, responsibleId }) {
    const { data, error } = await legacy.supabase
      .from(table)
      .insert({ iso, concept, type, amount, responsible_id: responsibleId || null })
      .select()
      .single();
    if (error) { console.error(messages.addError, error); return null; }
    const entry = rowToEntry(data);
    entries.push(entry);
    render();
    return entry;
  }

  // Guarda de golpe todos los cambios hechos en modo edición (fechas, conceptos,
  // importes o tipo tocados directamente en la tabla).
  async function persist() {
    if (!entries.length) return;
    const rows = entries.map((e) => ({
      id: e.id, iso: e.iso, concept: e.concept, type: e.type, amount: e.amount, responsible_id: e.responsibleId || null,
    }));
    const { error } = await legacy.supabase.from(table).upsert(rows);
    if (error) console.error(messages.persistError, error);
  }

  function updateField(id, field, rawValue) {
    if (!canManage()) return;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    if (field === 'amount') {
      const n = parseFloat(rawValue);
      entry.amount = isNaN(n) ? 0 : n;
      view.balance = netOf(entries);
    } else {
      entry[field] = rawValue;
    }
  }

  function toggleEntryType(id) {
    if (!canManage()) return;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.type = entry.type === 'ingreso' ? 'gasto' : 'ingreso';
    render();
  }

  function openDeleteConfirm(id) {
    if (!canManage()) return;
    deleteConfirm.targetId = id;
    deleteConfirm.open = true;
  }
  function closeDeleteConfirm() {
    deleteConfirm.open = false;
    deleteConfirm.targetId = null;
  }
  async function confirmDelete() {
    if (!deleteConfirm.targetId || !canManage()) return;
    const id = deleteConfirm.targetId;
    entries = entries.filter((e) => e.id !== id);
    closeDeleteConfirm();
    render();
    const { error } = await legacy.supabase.from(table).delete().eq('id', id);
    if (error) console.error('No se pudo eliminar el movimiento', error);
  }

  function openBreakdown() {
    const rosterById = legacy.rosterById;
    // Cuánto ha movido cada persona: suma de ingresos menos gastos de los movimientos
    // que ella registró, más un recuento de cuántos movimientos son suyos.
    const rows = members().map((p) => {
      const own = entries.filter((e) => e.responsibleId === p.id);
      return { id: p.id, name: p.name, mote: p.mote, net: netOf(own), count: own.length, injured: p.injured, injuryIcon: p.injuryIcon, avatarUrl: p.avatarUrl };
    });

    // Movimientos sin responsable asignado (por ejemplo, los que ya había antes de
    // añadir este campo), para que el desglose siga cuadrando con el saldo total.
    const unassigned = entries.filter((e) => !e.responsibleId || !rosterById[e.responsibleId]);
    if (unassigned.length) {
      rows.push({ name: 'Sin responsable asignado', net: netOf(unassigned), count: unassigned.length, unassigned: true });
    }

    const rowsDisplayNames = legacy.computeDisplayNames(rows.filter((r) => !r.unassigned));
    breakdown.rows = rows.map((r) => {
      const shownName = r.unassigned ? r.name : (rowsDisplayNames.get(r.id) || r.name);
      return {
        unassigned: !!r.unassigned,
        shownName,
        initials: legacy.initials(shownName),
        avatarUrl: r.avatarUrl, injured: r.injured, injuryIcon: r.injuryIcon,
        count: r.count,
        netClass: r.net > 0 ? 'pos' : (r.net < 0 ? 'neg' : 'zero'),
        sign: r.net > 0 ? '+' : (r.net < 0 ? '−' : ''),
        net: r.net,
      };
    });
    breakdown.open = true;
  }
  function closeBreakdown() {
    breakdown.open = false;
  }

  function setType(type) {
    addForm.type = type;
  }

  function openAdd() {
    if (!canManage()) return;
    addForm.iso = legacy.todayIso();
    addForm.concept = '';
    addForm.amount = '';
    setType('ingreso');
    // Las opciones del desplegable "Responsable" se fijan al abrir el modal; por
    // defecto queda elegida la primera.
    addForm.members = members().map((p) => ({ id: p.id, name: legacy.displayName(p) }));
    addForm.responsibleId = addForm.members.length ? addForm.members[0].id : '';
    addForm.open = true;
  }
  function closeAdd() {
    addForm.open = false;
  }
  async function save() {
    if (!canManage()) return;
    const iso = addForm.iso;
    const concept = String(addForm.concept).trim();
    const type = addForm.type;
    const amount = parseFloat(addForm.amount);
    const responsibleId = members().length ? addForm.responsibleId : null;

    if (!iso || !concept || !amount || amount <= 0) {
      alert('Rellena la fecha, el concepto y un importe válido.');
      return;
    }

    const entry = await addEntry({ iso, concept, type, amount, responsibleId });
    if (!entry) {
      alert('No se ha podido guardar el movimiento. Inténtalo de nuevo.');
      return;
    }
    closeAdd();
  }

  // Tras iniciar sesión o editar el perfil: si ya no se puede gestionar la tesorería
  // con el modo edición activo, se sale de él (sin guardar).
  function permissionsChanged() {
    if (!canManage() && view.editMode) {
      view.editMode = false;
      render();
    }
  }

  return {
    view, addForm, breakdown, deleteConfirm, messages, canManage,
    render, load, addEntry, members,
    toggleEditMode, updateField, toggleEntryType,
    openDeleteConfirm, closeDeleteConfirm, confirmDelete,
    openBreakdown, closeBreakdown,
    setType, openAdd, closeAdd, save,
    permissionsChanged,
  };
}
