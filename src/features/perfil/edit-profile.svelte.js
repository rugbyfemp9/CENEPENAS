// ---- Modal "Editar perfil" ----
// Cada persona edita el suyo propio; la cuenta admin también puede editar el de
// cualquier jugadora desde el botón "Editar" de Jugadoras.
import { supabase } from '../../lib/supabase.js';
import { auth } from '../../lib/session.svelte.js';
import { myProfile, rosterById, comisionesOf } from '../../lib/roster.js';
import { isPlayerRole } from '../../lib/permissions.js';
import { t } from '../../lib/i18n.svelte.js';
import { ROLE_OPTIONS, COMISION_OPTIONS } from '../../lib/roles.js';
import { loadPlantilla, getPlantillaData } from '../jugadoras/jugadoras.svelte.js';
import { renderProfile, refreshPermissionsEverywhere } from './perfil.svelte.js';

// Valores de las opciones de cada <select> del formulario (EditProfileModal.svelte).
const RANGO_VALUES = ['', 'veterana', 'novata', 'sang_de_fang'];
const POSICION_VALUES = ['', 'delantera', '3/4'];
const ROL_VALUES = ['', ...ROLE_OPTIONS.map((r) => r.value)];

// Lo que antes se leía del <select> del DOM: si el valor no es ninguna de sus
// opciones, no queda ninguna elegida y su value es ''.
function selectValue(value, values) {
  return values.includes(value) ? value : '';
}

export const editProfile = $state({
  open: false,
  // null = todavía no se ha abierto nunca ("Editar perfil", traducido por el modal).
  title: null,
  // Si "targetId" tiene valor, es la cuenta admin editando el perfil de otra jugadora
  // (viene del botón "Editar" de Jugadoras); si no, cada persona edita el suyo propio.
  targetId: null,
  name: '', mote: '', phone: '', birthdate: '', comisiones: [], rango: '', posicion: '', rol: '', licencia: '',
});

// Comisión / Rango / Posición solo tienen sentido para jugadoras: se ocultan
// por completo si el rol actual del formulario no lo es (igual que ya pasa
// en la vista de "Mi perfil"), y se actualizan al vuelo si cambias el rol.
export function editProfileEsJugadora() {
  return isPlayerRole(selectValue(editProfile.rol, ROL_VALUES));
}

export function openEditProfileModal(targetId) {
  editProfile.targetId = targetId || null;
  const source = editProfile.targetId ? getPlantillaData().find(p => p.id === editProfile.targetId) : null;

  editProfile.name = source
    ? [source.nombre, source.apellido].filter(Boolean).join(' ')
    : ((myProfile.name && myProfile.name !== 'Tu nombre') ? myProfile.name : '');
  editProfile.mote = source ? (source.mote || '') : (myProfile.mote ?? '');
  editProfile.phone = source ? (source.telefono || '') : (myProfile.phone ?? '');
  editProfile.birthdate = source ? (source.fecha_nacimiento || '') : (myProfile.birthdate ?? '');
  editProfile.comisiones = source ? comisionesOf(source) : [...(myProfile.comisiones || [])];
  editProfile.rango = source ? (source.rango || '') : (myProfile.rango ?? '');
  editProfile.posicion = source ? (source.posicion || '') : (myProfile.posicion ?? '');
  editProfile.rol = source ? (source.rol || '') : (myProfile.rol ?? '');
  editProfile.licencia = source ? (source.licencia || '') : (myProfile.licencia ?? '');

  editProfile.title = editProfile.targetId ? t('profile.editPlayerTitle') : t('profile.editTitle');
  editProfile.open = true;
}

export function closeEditProfileModal() {
  editProfile.open = false;
  editProfile.targetId = null;
}

export async function saveProfileEdits() {
  const name = editProfile.name.trim();
  const mote = editProfile.mote.trim();
  const phone = editProfile.phone.trim();
  const birthdate = editProfile.birthdate;
  // Solo comisiones que existen, en el orden de siempre.
  const comisiones = COMISION_OPTIONS.filter((c) => editProfile.comisiones.includes(c));
  const rango = selectValue(editProfile.rango, RANGO_VALUES);
  const posicion = selectValue(editProfile.posicion, POSICION_VALUES);
  const rol = selectValue(editProfile.rol, ROL_VALUES);
  const licencia = editProfile.licencia.trim();

  // Si el rol final no es jugadora, estos campos van ocultos en el formulario:
  // se guardan vacíos aunque el <select> conserve un valor antiguo por debajo.
  const esJugadoraFinal = isPlayerRole(rol);
  const comisionesFinal = esJugadoraFinal ? comisiones : [];
  const rangoFinal = esJugadoraFinal ? rango : '';
  const posicionFinal = esJugadoraFinal ? posicion : '';

  const editingSelf = !editProfile.targetId;
  const targetId = editProfile.targetId || auth.userId;
  // Comisiones que tenía antes de guardar, para saber qué filas añadir y cuáles quitar.
  const comisionesBefore = editingSelf
    ? [...(myProfile.comisiones || [])]
    : comisionesOf(getPlantillaData().find((p) => p.id === targetId));

  if (editingSelf) {
    const meRow = rosterById['me'];
    myProfile.name = name || 'Tu nombre';
    myProfile.mote = mote;
    myProfile.phone = phone;
    myProfile.birthdate = birthdate;
    myProfile.comisiones = [...comisionesFinal];
    myProfile.rango = rangoFinal;
    myProfile.posicion = posicionFinal;
    myProfile.rol = rol;
    myProfile.licencia = licencia;
    // El roster es lo que consultan otras secciones (como Comi Tesoreria y Jugadoras)
    // para saber quién está en cada comisión, así que lo mantenemos sincronizado con el perfil.
    meRow.name = myProfile.name;
    meRow.mote = myProfile.mote;
    meRow.comisiones = [...myProfile.comisiones];
    meRow.rango = myProfile.rango;
    meRow.posicion = myProfile.posicion;
    meRow.rol = myProfile.rol;
    meRow.licencia = myProfile.licencia;
    meRow.birthdate = myProfile.birthdate;
    renderProfile();
    // El rol y la comisión pueden cambiar qué botones ves en el resto de la app
    // (añadir evento, multa, álbum, subir rutina...): se refrescan todos aquí mismo,
    // sin esperar a la próxima vez que se inicie sesión.
    refreshPermissionsEverywhere();
  }

  // Guarda también los cambios en la tabla profiles de Supabase, para que no se
  // pierdan al recargar la página o al volver a consultar la Plantilla. Si es la
  // cuenta admin editando a otra jugadora, se guarda en la fila de esa jugadora
  // (lo permite la política de Supabase para el rol admin).
  if (targetId) {
    const nameParts = name.split(/\s+/).filter(Boolean);
    const nombre = nameParts[0] || '';
    const apellido = nameParts.slice(1).join(' ');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        nombre,
        apellido,
        mote,
        telefono: phone || null,
        fecha_nacimiento: birthdate || null,
        rango: rangoFinal || null,
        posicion: posicionFinal || null,
        rol: rol || null,
        licencia: licencia || null,
      })
      .eq('id', targetId);

    if (updateError) {
      alert(t('profile.alertSaveError', { error: updateError.message }));
    }

    // Comisiones: una fila por comisión en "commission_memberships". Solo se tocan las
    // que cambian (se añaden las nuevas y se quitan las que ya no están).
    const added = comisionesFinal.filter((c) => !comisionesBefore.includes(c));
    const removed = comisionesBefore.filter((c) => !comisionesFinal.includes(c));
    const membershipErrors = [];
    if (added.length) {
      const { error } = await supabase.from('commission_memberships')
        .upsert(added.map((commission) => ({ profile_id: targetId, commission })), { onConflict: 'profile_id,commission', ignoreDuplicates: true });
      if (error) membershipErrors.push(error.message);
    }
    if (removed.length) {
      const { error } = await supabase.from('commission_memberships')
        .delete().eq('profile_id', targetId).in('commission', removed);
      if (error) membershipErrors.push(error.message);
    }
    if (membershipErrors.length) {
      alert(t('profile.alertSaveError', { error: membershipErrors.join(' / ') }));
    }
  }

  loadPlantilla();
  closeEditProfileModal();
}
