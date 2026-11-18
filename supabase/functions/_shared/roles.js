// Roles y comisiones: los valores tal cual se guardan en profiles.rol y en
// commission_memberships.commission (una fila por persona y comisión). Vive aquí,
// junto a las funciones de Supabase, para que la app (vía src/lib/roles.js) y los
// avisos push (reminders.js) usen la misma lista.
// Sin imports a propósito.
//
// Quién puede hacer qué con cada rol/comisión está en src/lib/permissions.js.

export const ROLES = {
  player: 'jugadora',
  captain: 'Capitana',
  // Una jugadora que además puede gestionarlo todo. Solo lo da otra admin.
  admin: 'admin',
  coach: 'entrenador/a',
  delegate: 'delegado/a',
  board: 'directiva',
  physio: 'fisio',
};

// Orden de los <select> de rol (registro y "Editar perfil"), con su texto traducido.
export const ROLE_OPTIONS = [
  { value: ROLES.player, label: 'role.player' },
  { value: ROLES.captain, label: 'role.captain' },
  { value: ROLES.admin, label: 'role.admin' },
  { value: ROLES.coach, label: 'role.coach' },
  { value: ROLES.delegate, label: 'role.delegate' },
  { value: ROLES.board, label: 'role.board' },
  { value: ROLES.physio, label: 'role.physio' },
];

// Juegan: Capitana y admin son jugadoras con permisos extra, nunca un rol aparte.
export const PLAYER_ROLES = [ROLES.player, ROLES.captain, ROLES.admin];

// Cos Tècnic: ven el panel de Wellness/RPE del equipo y no ven las páginas del día a
// día de las jugadoras (Tercer temps, Comisiones, Tricount).
export const STAFF_ROLES = [ROLES.coach, ROLES.delegate, ROLES.board, ROLES.physio];

export const COMISIONES = {
  activitats: 'Comi Activitats',
  xarxes: 'Comi Xarxes',
  tercerTemps: 'Comi Tercer Temps',
  tesoreria: 'Comi Tesoreria',
  gira: 'Comi Gira',
};

// Orden de los <select> de comisión (registro y "Editar perfil").
export const COMISION_OPTIONS = [
  COMISIONES.activitats, COMISIONES.xarxes, COMISIONES.tercerTemps, COMISIONES.tesoreria, COMISIONES.gira,
];
