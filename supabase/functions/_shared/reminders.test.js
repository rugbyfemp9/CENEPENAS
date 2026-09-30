// deno test supabase/functions   (npm run test:functions)
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { fcmMessage, madridInstant, parseTime, pickRecipients, reminderText, remindableEvents } from './reminders.js';

const at = (isoUtc) => Date.parse(isoUtc);
const ids = (events) => events.map((e) => e.id);

Deno.test('parseTime reads the times the app stores', () => {
  assertEquals(parseTime('20:30h'), '20:30');
  assertEquals(parseTime('9:05h'), '09:05');
  assertEquals(parseTime('17.30'), '17:30');
  assertEquals(parseTime(''), null);
  assertEquals(parseTime(null), null);
  assertEquals(parseTime('25:00h'), null);
});

Deno.test('madridInstant follows summer and winter time', () => {
  assertEquals(madridInstant('2026-10-05', '20:30'), at('2026-10-05T18:30:00Z')); // CEST, UTC+2
  assertEquals(madridInstant('2026-11-02', '20:30'), at('2026-11-02T19:30:00Z')); // CET, UTC+1
  // 25 Oct 2026: clocks go back at 03:00; that evening is already winter time
  assertEquals(madridInstant('2026-10-25', '20:30'), at('2026-10-25T19:30:00Z'));
  assertEquals(madridInstant('2027-03-28', '20:30'), at('2027-03-28T18:30:00Z')); // back to summer
});

Deno.test('an automatic training enters the window exactly 24 h before it starts', () => {
  const start = madridInstant('2026-10-05', '20:30'); // Monday
  assertEquals(ids(remindableEvents([], start - 24 * 3600e3 - 60e3)), []);
  assertEquals(ids(remindableEvents([], start - 24 * 3600e3)), ['auto-2026-10-05']);
  assertEquals(ids(remindableEvents([], start - 60e3)), ['auto-2026-10-05']);
  assertEquals(ids(remindableEvents([], start)), []); // already started
});

Deno.test('the window works across the change to winter time', () => {
  // Monday 26 Oct 20:30 CET, the day after the clocks go back (Sunday 25 Oct lasts 25 h)
  const start = madridInstant('2026-10-26', '20:30');
  assertEquals(ids(remindableEvents([], start - 23.9 * 3600e3)), ['auto-2026-10-26']);
  assertEquals(ids(remindableEvents([], start - 24.1 * 3600e3)), []);
});

Deno.test('holidays have no training, so nothing to remind', () => {
  // Monday 12 Oct 2026 is a holiday
  const sundayNight = madridInstant('2026-10-11', '21:00');
  assertEquals(ids(remindableEvents([], sundayNight)), []);
});

Deno.test('stored events: edited trainings, matches, meetings', () => {
  const now = madridInstant('2026-10-09', '12:00'); // Friday noon
  const rows = [
    // The Friday training moved to 19:00 by the coach
    { id: 'auto-2026-10-09', type: 'training', label: 'Entreno', iso: '2026-10-09', start_time: '19:00h', meet_time: '' },
    { id: 'ce-match', type: 'match', label: 'Partido vs Santboi', iso: '2026-10-10', start_time: '11:30h', meet_time: '10:45h' },
    { id: 'ce-meet-only', type: 'match', label: 'Partit vs Gòtics', iso: '2026-10-10', start_time: '', meet_time: '09:00h' },
    { id: 'ce-no-time', type: 'match', label: 'Partit vs ?', iso: '2026-10-10', start_time: '', meet_time: '' },
    { id: 'ce-meeting', type: 'meeting', label: 'Reunió', iso: '2026-10-09', start_time: '21:00h', meet_time: '' },
    { id: 'ce-far', type: 'match', label: 'Partit lluny', iso: '2026-10-17', start_time: '11:30h', meet_time: '' },
  ];
  const events = remindableEvents(rows, now);
  assertEquals(ids(events), ['auto-2026-10-09', 'ce-meet-only', 'ce-match']);
  assertEquals(events[0].startsAt, madridInstant('2026-10-09', '19:00'));
  assertEquals(events[1].time, '09:00');
});

Deno.test('pickRecipients: only players with a device who have not answered and were not reminded', () => {
  const event = { id: 'auto-2026-10-05' };
  const other = { id: 'auto-2026-10-07' };
  const recipients = pickRecipients({
    events: [event, other],
    players: [{ id: 'yes' }, { id: 'no' }, { id: 'silent' }, { id: 'reminded' }, { id: 'no-device' }, { id: 'undone' }],
    answers: [
      { event_id: event.id, user_id: 'yes', status: 'yes' },
      { event_id: event.id, user_id: 'no', status: 'no' },
      { event_id: event.id, user_id: 'undone', status: 'pending' },
      { event_id: other.id, user_id: 'silent', status: 'yes' },
    ],
    alreadySent: [{ event_id: event.id, user_id: 'reminded' }],
    subscriptions: [
      { profile_id: 'yes', fcm_token: 't-yes', platform: 'web' },
      { profile_id: 'no', fcm_token: 't-no', platform: 'web' },
      { profile_id: 'silent', fcm_token: 't-silent-phone', platform: 'web' },
      { profile_id: 'silent', fcm_token: 't-silent-app', platform: 'android' },
      { profile_id: 'reminded', fcm_token: 't-reminded', platform: 'web' },
      { profile_id: 'undone', fcm_token: 't-undone', platform: null },
      { profile_id: 'staff', fcm_token: 't-staff', platform: 'web' },
    ],
  });
  assertEquals(recipients.map((r) => [r.event.id, r.userId, r.devices.map((d) => `${d.token}/${d.platform}`)]), [
    [event.id, 'silent', ['t-silent-phone/web', 't-silent-app/android']],
    [event.id, 'undone', ['t-undone/web']],
    // The answers and the reminder were for the first event only
    [other.id, 'yes', ['t-yes/web']],
    [other.id, 'no', ['t-no/web']],
    [other.id, 'reminded', ['t-reminded/web']],
    [other.id, 'undone', ['t-undone/web']],
  ]);
});

Deno.test('reminderText is in Catalan and says when', () => {
  const now = madridInstant('2026-10-04', '21:00'); // Sunday
  const training = { id: 'auto-2026-10-05', type: 'training', label: 'Entreno', time: '20:30', startsAt: madridInstant('2026-10-05', '20:30') };
  assertEquals(reminderText(training, now), { title: 'Entreno demà a les 20:30', body: 'Encara no has dit si hi vens. Toca per respondre.' });

  const sameDay = { ...training, startsAt: madridInstant('2026-10-04', '23:00'), time: '23:00' };
  assertEquals(reminderText(sameDay, now).title, 'Entreno avui a les 23:00');

  const match = { id: 'ce1', type: 'match', label: 'Partido vs Santboi', time: '17:30', startsAt: madridInstant('2026-10-05', '17:30') };
  assertEquals(reminderText(match, now).title, 'Partit vs Santboi demà a les 17:30');
  assertEquals(reminderText({ ...match, label: 'Partit' }, now).title, 'Partit demà a les 17:30');
});

Deno.test('fcmMessage: data only for the web, a system notification for the Android app', () => {
  const now = at('2026-10-04T19:00:00Z');
  const event = { id: 'auto-2026-10-05', startsAt: at('2026-10-05T18:30:00Z') };
  const text = { title: 'T', body: 'B' };
  const data = { title: 'T', body: 'B', url: './#asistencia', tag: 'att-auto-2026-10-05' };

  assertEquals(fcmMessage({ token: 'w', platform: 'web' }, event, text, now), {
    message: { token: 'w', data, webpush: { headers: { TTL: String(23.5 * 3600), Urgency: 'high' } } },
  });
  assertEquals(fcmMessage({ token: 'a', platform: 'android' }, event, text, now), {
    message: {
      token: 'a', data, notification: { title: 'T', body: 'B' },
      android: { priority: 'high', ttl: `${23.5 * 3600}s`, notification: { tag: 'att-auto-2026-10-05' } },
    },
  });
});
