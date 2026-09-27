// Duración en minutos de la sesión, a partir de sus horas de inicio/fin (guardadas
// como texto "20:30h"/"22:00h" en att_events). Si falta alguna de las dos horas, se
// asume una sesión de 60 minutos para poder calcular igualmente la carga (sRPE).
export function wellnessStaffEventMinutes(ev) {
  const parseToMinutes = (str) => {
    if (!str) return null;
    const parts = String(str).replace(/h$/, '').split(':').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };
  const start = ev ? parseToMinutes(ev.startTime) : null;
  const end = ev ? parseToMinutes(ev.endTime) : null;
  if (start == null || end == null) return 60;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60; // por si el entreno cruza la medianoche
  return diff;
}
