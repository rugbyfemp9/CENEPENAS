// Mapas de las secciones de la app (antes en js/core/state.js).

// NOTE: estos títulos/subtítulos no se pintan en ningún sitio (el título del documento
// nunca cambia y la barra superior de móvil solo dice "CNPENAS"). Se dejan tal cual.
export const titles = {
  inicio: ['Inicio', 'Resumen general del club'],
  asistencia: ['Asistencia', 'Próximos entrenos y control de presencia'],
  'asistencia-detalle': ['Asistencia', 'Quién va a cada convocatoria'],
  vestuario: ['Vestuario', 'Multas, tercer tiempo, comisiones y perfil'],
  multas: ['Multas', 'Gestión de sanciones internas del equipo'],
  tricount: ['Tricount', 'Gastos compartidos entre el equipo'],
  liga: ['Liga', 'Clasificación y resultados de la Divisió d\'Honor Catalana Femenina'],
  tercer: ['Tercer tiempo', 'Elige un partido para ver su tercer tiempo'],
  'tercer-historial': ['Pasados', 'Tercers tiempos ya celebrados'],
  'tercer-detalle': ['Tercer tiempo', 'Organización del después de partido'],
  plantilla: ['Jugadoras', 'Lista de jugadoras y miembros del club'],
  fantasy: ['Fantasy', 'Prueba alineaciones de forma visual e interactiva'],
  jugadas: ['Jugadas', 'Animaciones y vídeos de las jugadas del equipo'],
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
// NOTE: "test" no está en la lista, así que en Test no queda ninguna pestaña activa.
export const bottomTabOf = {
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
  jugadas: 'vestuario',
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
export const sidebarTabOf = {
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
  jugadas: 'jugadas',
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
