// ---- Recordatorios de asistencia (la ejecuta pg_cron cada 15 minutos) ----
// Avisa por notificación push a cada jugadora que aún no ha respondido (ni sí ni no) a
// un entreno o partido que empieza en las próximas 24 h. Cada jugadora recibe un solo
// aviso por evento: se apunta en att_reminders_sent. Qué se avisa y a quién está en
// ../_shared/reminders.js; aquí solo se lee Supabase y se manda a Firebase.
//
// Secretos (supabase secrets set ...):
//   REMINDERS_CRON_SECRET     el mismo valor que guarda pg_cron en Vault (reminders_secret):
//                             sin él en la cabecera x-cron-secret, la función no hace nada.
//   FIREBASE_SERVICE_ACCOUNT  el JSON de la cuenta de servicio de Firebase.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PLAYER_ROLES, fcmMessage, pickRecipients, reminderText, remindableEvents } from '../_shared/reminders.js';
import { fcmAccessToken, sendFcm, type ServiceAccount } from './fcm.ts';

type Env = { get(name: string): string | undefined };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function must<T>({ data, error }: { data: T | null; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`No se ha podido leer ${what}: ${error.message}`);
  return data as T;
}

export async function handle(req: Request, env: Env = Deno.env, nowMs = Date.now()): Promise<Response> {
  const secret = env.get('REMINDERS_CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  try {
    const db = createClient(env.get('SUPABASE_URL')!, env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    const stored = must(await db.from('att_events').select('id, type, label, iso, start_time, meet_time'), 'att_events');
    const events = remindableEvents(stored, nowMs);
    if (!events.length) return json({ events: 0, reminded: 0 });

    const ids = events.map((e) => e.id);
    const [players, answers, alreadySent, subscriptions] = await Promise.all([
      db.from('profiles').select('id').in('rol', PLAYER_ROLES).then((r) => must(r, 'profiles')),
      db.from('att_attendance').select('event_id, user_id, status').in('event_id', ids).then((r) => must(r, 'att_attendance')),
      db.from('att_reminders_sent').select('event_id, user_id').in('event_id', ids).then((r) => must(r, 'att_reminders_sent')),
      db.from('push_subscriptions').select('profile_id, fcm_token, platform').then((r) => must(r, 'push_subscriptions')),
    ]);
    const recipients = pickRecipients({ events, players, answers, alreadySent, subscriptions });
    if (!recipients.length) return json({ events: events.length, reminded: 0 });

    const account: ServiceAccount = JSON.parse(env.get('FIREBASE_SERVICE_ACCOUNT') || 'null');
    if (!account?.private_key) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT');
    const accessToken = await fcmAccessToken(account);

    const reminded: { event_id: string; user_id: string }[] = [];
    const deadTokens: string[] = [];
    const failures: string[] = [];
    for (const { event, userId, devices } of recipients) {
      const text = reminderText(event, nowMs);
      let delivered = false;
      for (const device of devices) {
        const result = await sendFcm(accessToken, account.project_id, fcmMessage(device, event, text, nowMs));
        if (result.ok) delivered = true;
        else if (result.unregistered) deadTokens.push(device.token);
        else failures.push(`${event.id} → ${userId}: ${result.error}`);
      }
      // Si no ha llegado a ningún dispositivo se vuelve a intentar en la próxima ejecución.
      if (delivered) reminded.push({ event_id: event.id, user_id: userId });
    }

    if (reminded.length) {
      const { error } = await db.from('att_reminders_sent').upsert(reminded, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
      if (error) throw new Error(`No se ha podido apuntar a quién se ha avisado: ${error.message}`);
    }
    if (deadTokens.length) {
      const { error } = await db.from('push_subscriptions').delete().in('fcm_token', deadTokens);
      if (error) console.error('No se han podido borrar los tokens caducados', error);
    }
    if (failures.length) console.error('Avisos que no se han podido mandar', failures);

    return json({ events: events.length, reminded: reminded.length, removedTokens: deadTokens.length, failed: failures.length });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
