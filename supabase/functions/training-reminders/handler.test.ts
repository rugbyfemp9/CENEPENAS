// The whole function against fake Supabase (PostgREST), Google OAuth and FCM servers:
// globalThis.fetch is replaced for the duration of each run.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';
import { madridInstant } from '../_shared/reminders.js';

const SUPABASE_URL = 'https://project.supabase.test';
const SECRET = 'cron-secret';
const MONDAY = 'auto-2026-10-05';
const NOW = madridInstant('2026-10-04', '21:00'); // Sunday night: Monday's training is 23.5 h away

type Row = Record<string, unknown>;

async function serviceAccount() {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8)).replace(/.{64}/g, '$&\n')}\n-----END PRIVATE KEY-----\n`;
  return { account: { client_email: 'fcm@cnpn-app.iam.test', private_key: pem, project_id: 'cnpn-app' }, publicKey: keys.publicKey };
}

// PostgREST filters used by the function: col=in.(a,b)
function applyFilters(rows: Row[], params: URLSearchParams) {
  return rows.filter((row) => [...params].every(([col, value]) => {
    if (['select', 'on_conflict'].includes(col)) return true;
    const m = /^in\.\((.*)\)$/.exec(value);
    return !m || m[1].split(',').map((v) => v.replace(/^"|"$/g, '')).includes(String(row[col]));
  }));
}

function fakeBackends(db: Record<string, Row[]>, publicKey: CryptoKey, { deadTokens = [] as string[] } = {}) {
  const sent: { token: string; body: Row }[] = [];
  let tokenRequests = 0;

  const fetchStub = async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);

    if (url.origin === SUPABASE_URL) {
      assertEquals(req.headers.get('apikey'), 'service-role-key');
      const table = url.pathname.replace('/rest/v1/', '');
      if (req.method === 'GET') return Response.json(applyFilters(db[table] || [], url.searchParams));
      if (req.method === 'POST') {
        const body = await req.json();
        for (const row of body) {
          if (!db[table].some((r) => r.event_id === row.event_id && r.user_id === row.user_id)) db[table].push(row);
        }
        return new Response(null, { status: 201 });
      }
      if (req.method === 'DELETE') {
        const doomed = applyFilters(db[table], url.searchParams);
        db[table] = db[table].filter((r) => !doomed.includes(r));
        return new Response(null, { status: 204 });
      }
    }

    if (req.url === 'https://oauth2.googleapis.com/token') {
      tokenRequests += 1;
      const assertion = new URLSearchParams(await req.text()).get('assertion')!;
      const [header, claims, signature] = assertion.split('.');
      const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, b64(signature), new TextEncoder().encode(`${header}.${claims}`));
      assert(valid, 'the JWT is signed with the service account key');
      const payload = JSON.parse(new TextDecoder().decode(b64(claims)));
      assertEquals(payload.iss, 'fcm@cnpn-app.iam.test');
      assertEquals(payload.scope, 'https://www.googleapis.com/auth/firebase.messaging');
      return Response.json({ access_token: 'google-access-token' });
    }

    if (req.url === 'https://fcm.googleapis.com/v1/projects/cnpn-app/messages:send') {
      assertEquals(req.headers.get('authorization'), 'Bearer google-access-token');
      const body = await req.json();
      const token = body.message.token;
      if (deadTokens.includes(token)) {
        return Response.json({ error: { code: 404, status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } }, { status: 404 });
      }
      sent.push({ token, body });
      return Response.json({ name: `projects/cnpn-app/messages/${sent.length}` });
    }

    throw new Error(`unexpected request ${req.method} ${req.url}`);
  };

  return { fetchStub, sent, tokenRequests: () => tokenRequests };
}

function seed(): Record<string, Row[]> {
  return {
    att_events: [
      { id: 'ce-meeting', type: 'meeting', label: 'Reunió', iso: '2026-10-05', start_time: '19:00h', meet_time: '' },
    ],
    profiles: [
      { id: 'marta', rol: 'jugadora' }, { id: 'aina', rol: 'Capitana' }, { id: 'paula', rol: 'jugadora' },
      { id: 'laia', rol: 'jugadora' }, { id: 'coach', rol: 'entrenador/a' },
    ],
    att_attendance: [{ event_id: MONDAY, user_id: 'paula', status: 'yes' }],
    att_reminders_sent: [],
    push_subscriptions: [
      { profile_id: 'marta', fcm_token: 'marta-phone', platform: 'web' },
      { profile_id: 'aina', fcm_token: 'aina-app', platform: 'android' },
      { profile_id: 'paula', fcm_token: 'paula-phone', platform: 'web' },
      { profile_id: 'laia', fcm_token: 'laia-old-phone', platform: 'web' },
      { profile_id: 'coach', fcm_token: 'coach-phone', platform: 'web' },
    ],
  };
}

async function run(db: Record<string, Row[]>, options: { deadTokens?: string[]; secret?: string } = {}) {
  const { account, publicKey } = await serviceAccount();
  const env = new Map(Object.entries({
    REMINDERS_CRON_SECRET: SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account),
  }));
  const backends = fakeBackends(db, publicKey, options);
  const realFetch = globalThis.fetch;
  globalThis.fetch = backends.fetchStub as typeof fetch;
  try {
    const req = new Request('https://fn.test/training-reminders', { method: 'POST', headers: { 'x-cron-secret': options.secret ?? SECRET } });
    const res = await handle(req, env, NOW);
    return { status: res.status, body: await res.json(), ...backends };
  } finally {
    globalThis.fetch = realFetch;
  }
}

Deno.test('without the cron secret it does nothing', async () => {
  const { status, sent } = await run(seed(), { secret: 'wrong' });
  assertEquals(status, 401);
  assertEquals(sent.length, 0);
});

Deno.test('reminds the players who have not answered, once', async () => {
  const db = seed();
  const first = await run(db, { deadTokens: ['laia-old-phone'] });

  assertEquals(first.status, 200);
  assertEquals(first.body, { events: 1, reminded: 2, removedTokens: 1, failed: 0 });
  // Marta (web) and Aina (Capitana, Android app). Not Paula (answered), not the coach,
  // and Laia's only phone no longer exists.
  assertEquals(first.sent.map((s) => s.token), ['marta-phone', 'aina-app']);
  assertEquals(first.sent[0].body.message, {
    token: 'marta-phone',
    data: { title: 'Entreno demà a les 20:30', body: 'Encara no has dit si hi vens. Toca per respondre.', url: './#asistencia', tag: `att-${MONDAY}` },
    webpush: { headers: { TTL: String(23.5 * 3600), Urgency: 'high' } },
  });
  assertEquals((first.sent[1].body.message as Row).notification, { title: 'Entreno demà a les 20:30', body: 'Encara no has dit si hi vens. Toca per respondre.' });

  assertEquals(db.att_reminders_sent.map((r) => r.user_id), ['marta', 'aina']);
  assert(!db.push_subscriptions.some((s) => s.fcm_token === 'laia-old-phone'));

  // Fifteen minutes later (next cron run): nobody is reminded again, and Google isn't even asked.
  const second = await run(db);
  assertEquals(second.body, { events: 1, reminded: 0 });
  assertEquals(second.sent.length, 0);
  assertEquals(second.tokenRequests(), 0);
});

Deno.test('no events in the next 24 h: nothing else is read', async () => {
  const db = seed();
  db.att_events = [];
  // Saturday morning: the next training is Monday
  const { account, publicKey } = await serviceAccount();
  const backends = fakeBackends(db, publicKey);
  const reads: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    reads.push(new URL(new Request(input, init).url).pathname);
    return backends.fetchStub(input, init);
  }) as typeof fetch;
  try {
    const env = new Map(Object.entries({ REMINDERS_CRON_SECRET: SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role-key', FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account) }));
    const res = await handle(new Request('https://fn.test', { method: 'POST', headers: { 'x-cron-secret': SECRET } }), env, madridInstant('2026-10-03', '10:00'));
    assertEquals(await res.json(), { events: 0, reminded: 0 });
    assertEquals(reads, ['/rest/v1/att_events']);
  } finally {
    globalThis.fetch = realFetch;
  }
});
