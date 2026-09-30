// ---- Recordatorios de asistencia: qué se avisa, a quién y con qué texto ----
// Lógica pura (sin red ni base de datos) de supabase/functions/training-reminders, para
// poder probarla sola. Cada vez que se ejecuta la función:
//   1. remindableEvents(): entrenos y partidos que empiezan en las próximas 24 h;
//   2. pickRecipients(): jugadoras con notificaciones activadas que aún no han dicho ni
//      que sí ni que no, y a las que todavía no se ha avisado de ese evento;
//   3. reminderText() / fcmMessage(): el aviso, siempre en catalán.
import { autoTrainingDates, autoTrainingId, SEASON } from './season.js';

export const TIME_ZONE = 'Europe/Madrid';
export const REMIND_WITHIN_MS = 24 * 60 * 60 * 1000;

// Solo se avisa a las jugadoras (Capitana incluida), nunca al staff.
export const PLAYER_ROLES = ['jugadora', 'Capitana'];

// Tipos de evento con control de asistencia (las reuniones no llevan).
const REMINDED_TYPES = ['training', 'match'];

// "20:30h" / "20:30" / "9:05h" → "20:30"; cualquier otra cosa → null.
export function parseTime(text) {
  const m = /^\s*(\d{1,2})[:.](\d{2})/.exec(text || '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

// Diferencia (ms) entre la hora de Madrid y la UTC en ese instante (+1 h o +2 h).
function madridOffsetMs(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - (ms - (ms % 1000));
}

// Instante (ms UTC) de un día y hora de Madrid, p.ej. ('2026-10-05', '20:30').
export function madridInstant(iso, hhmm) {
  const [y, mo, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let ms = asUtc - madridOffsetMs(asUtc);
  // Cerca de un cambio de hora el primer cálculo puede usar el desfase equivocado
  const again = asUtc - madridOffsetMs(ms);
  if (again !== ms) ms = again;
  return ms;
}

// Día (YYYY-MM-DD) en Madrid de un instante.
export function madridDate(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

// Entrenos automáticos de la temporada + eventos guardados en att_events (filas con
// id, type, label, iso, start_time, meet_time). Una fila con el mismo id que un entreno
// automático lo sustituye (es ese entreno editado), igual que en
// loadSharedEventsFromStorage() de la app. Devuelve los entrenos y partidos que empiezan
// en (ahora, ahora + 24 h], con su instante de inicio en startsAt.
export function remindableEvents(storedRows, nowMs) {
  const byId = new Map();
  for (const iso of autoTrainingDates()) {
    byId.set(autoTrainingId(iso), { id: autoTrainingId(iso), type: 'training', label: 'Entreno', iso, time: parseTime(SEASON.startTime) });
  }
  for (const row of storedRows || []) {
    byId.set(row.id, {
      id: row.id, type: row.type, label: row.label || '', iso: row.iso,
      // Sin hora de inicio se usa la de convocatoria; sin ninguna, no se sabe cuándo avisar.
      time: parseTime(row.start_time) || parseTime(row.meet_time),
    });
  }

  const events = [];
  for (const ev of byId.values()) {
    if (!REMINDED_TYPES.includes(ev.type) || !ev.time || !/^\d{4}-\d{2}-\d{2}$/.test(ev.iso || '')) continue;
    const startsAt = madridInstant(ev.iso, ev.time);
    if (startsAt > nowMs && startsAt <= nowMs + REMIND_WITHIN_MS) events.push({ ...ev, startsAt });
  }
  return events.sort((a, b) => a.startsAt - b.startsAt);
}

// A quién hay que avisar de cada evento. Entradas (filas de Supabase):
//   players        [{ id }]                          perfiles con rol de jugadora
//   answers        [{ event_id, user_id, status }]   att_attendance ('yes' | 'no')
//   alreadySent    [{ event_id, user_id }]           att_reminders_sent
//   subscriptions  [{ profile_id, fcm_token, platform }]  push_subscriptions
// Devuelve [{ event, userId, devices: [{ token, platform }] }].
export function pickRecipients({ events, players, answers, alreadySent, subscriptions }) {
  const key = (eventId, userId) => `${eventId}|${userId}`;
  const answered = new Set((answers || []).filter((a) => a.status === 'yes' || a.status === 'no').map((a) => key(a.event_id, a.user_id)));
  const sent = new Set((alreadySent || []).map((s) => key(s.event_id, s.user_id)));

  const devicesByUser = new Map();
  for (const s of subscriptions || []) {
    if (!s.fcm_token) continue;
    if (!devicesByUser.has(s.profile_id)) devicesByUser.set(s.profile_id, []);
    devicesByUser.get(s.profile_id).push({ token: s.fcm_token, platform: s.platform || 'web' });
  }

  const recipients = [];
  for (const event of events) {
    for (const { id: userId } of players || []) {
      const devices = devicesByUser.get(userId);
      if (!devices || answered.has(key(event.id, userId)) || sent.has(key(event.id, userId))) continue;
      recipients.push({ event, userId, devices });
    }
  }
  return recipients;
}

const WEEKDAYS_CA = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];

// "avui" / "demà" / "dilluns"... según el día del evento visto desde ahora (en Madrid).
function dayWord(startsAt, nowMs) {
  const eventDay = madridDate(startsAt);
  if (eventDay === madridDate(nowMs)) return 'avui';
  if (eventDay === madridDate(nowMs + REMIND_WITHIN_MS)) return 'demà';
  const [y, m, d] = eventDay.split('-').map(Number);
  return WEEKDAYS_CA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// Texto del aviso, en catalán. El nombre del partido se guarda tal como lo escribió
// quien lo creó ("Partido vs Santboi", "Partit vs Santboi"...): se quita la palabra
// "Partido/Partit" del principio para no repetirla.
export function reminderText(event, nowMs) {
  const when = `${dayWord(event.startsAt, nowMs)} a les ${event.time}`;
  let title;
  if (event.type === 'match') {
    const rival = event.label.replace(/^\s*(partido|partit)\b\s*/i, '').trim();
    title = rival ? `Partit ${rival} ${when}` : `Partit ${when}`;
  } else {
    title = `Entreno ${when}`;
  }
  return { title, body: 'Encara no has dit si hi vens. Toca per respondre.' };
}

// Mensaje para la API HTTP v1 de Firebase Cloud Messaging.
//  - web: solo "data"; lo enseña sw.js (lee data.title/body/url/tag).
//  - android (app de Capacitor): "notification", que lo enseña el propio sistema.
// Caduca cuando empieza el evento: si el móvil está apagado hasta entonces, ya no llega.
export function fcmMessage({ token, platform }, event, text, nowMs) {
  const ttlSeconds = Math.max(60, Math.round((event.startsAt - nowMs) / 1000));
  const data = { title: text.title, body: text.body, url: './#asistencia', tag: `att-${event.id}` };
  if (platform === 'web') {
    return { message: { token, data, webpush: { headers: { TTL: String(ttlSeconds), Urgency: 'high' } } } };
  }
  return {
    message: {
      token, data,
      notification: { title: text.title, body: text.body },
      android: { priority: 'high', ttl: `${ttlSeconds}s`, notification: { tag: data.tag } },
    },
  };
}
