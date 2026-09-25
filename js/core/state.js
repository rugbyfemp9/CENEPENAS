// ---- Estado que usan renderizados llamados muy pronto en el arranque de la app:
// se declara aquí arriba para que ya exista cuando esas primeras llamadas se ejecuten,
// en vez de más abajo (donde estaban antes) provocando "Cannot access before initialization".
let fines = [];
let tricountModalParticipants = new Set();
// null cuando el modal de Tricount está en modo "nuevo gasto"; si no, el id del
// gasto que se está editando (ver openEditTricountModal/saveTricountExpense).
let editingTricountExpenseId = null;

const titles = {
  inicio: ['Inicio', 'Resumen general del club'],
  asistencia: ['Asistencia', 'Próximos entrenos y control de presencia'],
  'asistencia-detalle': ['Asistencia', 'Quién va a cada convocatoria'],
  vestuario: ['Vestuario', 'Multas, tercer tiempo, comisiones y perfil'],
  multas: ['Multas', 'Gestión de sanciones internas del equipo'],
  tricount: ['Tricount', 'Gastos compartidos entre el equipo'],
  liga: ['Liga', 'Clasificación y resultados de la Divisió d\'Honor Catalana AON'],
  tercer: ['Tercer tiempo', 'Elige un partido para ver su tercer tiempo'],
  'tercer-historial': ['Pasados', 'Tercers tiempos ya celebrados'],
  'tercer-detalle': ['Tercer tiempo', 'Organización del después de partido'],
  plantilla: ['Jugadoras', 'Lista de jugadoras y miembros del club'],
  fantasy: ['Fantasy', 'Prueba alineaciones de forma visual e interactiva'],
  galeria: ['Galería', 'Fotos del equipo'],
  gym: ['Gym', 'Rutina, tus marcas y el equipo'],
  partidos: ['Partidos', 'Todos los partidos de la temporada'],
  'partido-detalle': ['Partido', ''],
  'wellness-staff': ['Percepción del esfuerzo', 'Análisis de carga y estado físico por entrenamiento'],
  comisiones: ['Comisiones', 'Elige una comisión'],
  'comi-activitats': ['Comi Activitats', 'Comisión de actividades del club'],
  'comi-xarxes': ['Comi Xarxes', 'Comisión de redes sociales'],
  'comi-tercer-temps': ['Comi Tercer Temps', 'Comisión de tercer tiempo'],
  'comi-tesoreria': ['Comi Tesoreria', 'Ingresos y gastos del equipo'],
  'comi-gira': ['Comi Gira', 'Comisión de giras y viajes'],
  perfil: ['Mi perfil', 'Datos de tu cuenta']
};
// A qué pestaña de la nav inferior pertenece cada sección
const bottomTabOf = {
  inicio: 'inicio',
  asistencia: 'asistencia',
  'asistencia-detalle': 'asistencia',
  vestuario: 'vestuario',
  multas: 'vestuario',
  tricount: 'vestuario',
  liga: 'vestuario',
  tercer: 'vestuario',
  'tercer-historial': 'vestuario',
  'tercer-detalle': 'vestuario',
  plantilla: 'vestuario',
  fantasy: 'vestuario',
  galeria: 'vestuario',
  gym: 'vestuario',
  'gym-entrenamiento': 'vestuario',
  'gym-entrenamiento-dia': 'vestuario',
  'gym-equipo': 'vestuario',
  partidos: 'vestuario',
  'partido-detalle': 'vestuario',
  'wellness-staff': 'vestuario',
  comisiones: 'vestuario',
  'comi-activitats': 'vestuario',
  'comi-xarxes': 'vestuario',
  'comi-tercer-temps': 'vestuario',
  'comi-tesoreria': 'vestuario',
  'comi-gira': 'vestuario',
  perfil: 'perfil'
};

// Sidebar de escritorio: mismo destino final que el hub "Vestuario" de móvil, pero cada
// uno con su propio enlace directo. Las subpáginas resaltan el botón de su sección padre.
const sidebarTabOf = {
  inicio: 'inicio',
  asistencia: 'asistencia',
  'asistencia-detalle': 'asistencia',
  multas: 'multas',
  tercer: 'tercer',
  'tercer-historial': 'tercer',
  'tercer-detalle': 'tercer',
  comisiones: 'comisiones',
  'comi-activitats': 'comisiones',
  'comi-xarxes': 'comisiones',
  'comi-tercer-temps': 'comisiones',
  'comi-tesoreria': 'comisiones',
  'comi-gira': 'comisiones',
  tricount: 'tricount',
  liga: 'liga',
  fantasy: 'fantasy',
  galeria: 'galeria',
  gym: 'gym',
  'gym-entrenamiento': 'gym',
  'gym-entrenamiento-dia': 'gym',
  'gym-equipo': 'gym',
  partidos: 'partidos',
  'partido-detalle': 'partidos',
  'wellness-staff': 'wellness-staff',
  plantilla: 'plantilla',
  perfil: 'perfil'
};

/* ================= ASISTENCIA ================= */

// ---- Mi perfil ----
// Se declara aquí arriba (antes de canManageEvents/toggleAttAddButtonVisibility, que
// la usan) porque esas funciones se llaman de forma síncrona nada más cargar la
// página, y necesitan que myProfile ya exista en ese momento.
const myProfile = { name:'Tu nombre', mote:'', phone:'', comision:'', rango:'', posicion:'', rol:'', licencia:'', birthdate:'', avatarUrl:'' };

// Plantilla usada para repartir a los jugadores en las 3 pestañas de cada evento
const roster = [
  { id:'me', name:'Tú', pos:'', comision:'', rango:'', rol:'', birthdate:'', mote:'', injured:false, injuryIcon:'', rm:{} }
];
const rosterById = Object.fromEntries(roster.map(p => [p.id, p]));

// Usuario que ha iniciado sesión (más adelante vendrá de Supabase Auth)
const currentUserId = 'me';

// Eventos de asistencia (entrenos y partidos). "attendance" guarda el estado
// de cada jugador para ese evento: 'yes' | 'no' | 'pending'.
const attEvents = [];
