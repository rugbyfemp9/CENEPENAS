// ---- Entrenos automáticos de la temporada 2026-2027 ----
// Lunes, miércoles y viernes de 20:30 a 22:00, del 1 de septiembre de 2026 al 31 de mayo
// de 2027, saltando festivos nacionales y festivos de Barcelona (calendarios laborales
// oficiales de España y del Ayuntamiento de Barcelona para 2026 y 2027).
//
// Estos entrenos no se guardan en Supabase: cada móvil los genera igual al abrir la app
// (src/features/asistencia/events.js). La función de Supabase que manda los recordatorios
// (supabase/functions/training-reminders) necesita exactamente la misma lista, así que
// las dos la sacan de aquí. Sin imports, para que lo puedan cargar tanto Vite como Deno.
export const SEASON = {
  firstDay: '2026-09-01',
  lastDay: '2027-05-31',
  weekdays: [1, 3, 5], // 1 = lunes, 3 = miércoles, 5 = viernes
  meetTime: '20:15h',
  startTime: '20:30h',
  endTime: '22:00h',
  place: 'CEM Mar Bella',
  mapsQuery: 'CEM Mar Bella, Av. del Litoral, Barcelona',
};

export const seasonHolidays = new Set([
  '2026-09-11', // Diada Nacional de Catalunya
  '2026-09-24', // La Mercè (festivo local de Barcelona)
  '2026-10-12', // Fiesta Nacional de España
  '2026-11-01', // Todos los Santos
  '2026-12-06', // Día de la Constitución
  '2026-12-08', // La Inmaculada Concepción
  '2026-12-25', // Navidad
  '2026-12-26', // Sant Esteve
  '2027-01-01', // Año Nuevo
  '2027-01-06', // Reyes
  '2027-03-26', // Viernes Santo
  '2027-03-29', // Lunes de Pascua Florida
  '2027-05-17', // Pascua Granada (festivo local de Barcelona)
]);

// Días (YYYY-MM-DD) con entreno automático, en orden. Se recorre el calendario en UTC
// para que el resultado no dependa de la zona horaria de quien lo ejecute.
export function autoTrainingDates() {
  const dates = [];
  const end = Date.parse(SEASON.lastDay + 'T00:00:00Z');
  for (let t = Date.parse(SEASON.firstDay + 'T00:00:00Z'); t <= end; t += 86_400_000) {
    const day = new Date(t);
    const iso = day.toISOString().slice(0, 10);
    if (SEASON.weekdays.includes(day.getUTCDay()) && !seasonHolidays.has(iso)) dates.push(iso);
  }
  return dates;
}

// Id del entreno automático de ese día (lo usan att_attendance y att_events).
export const autoTrainingId = (iso) => 'auto-' + iso;
