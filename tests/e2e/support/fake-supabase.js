// In-memory stand-in for the Supabase project used by the app (PostgREST, Auth,
// Storage, Edge Functions and Realtime), so the e2e tests never touch real data.
//
// It implements the subset of PostgREST that the app uses: filters (eq, neq, gt,
// gte, lt, lte, like, ilike, is, in, not.*, or=(...)), order, limit/offset, single
// object responses, counts, insert/upsert/update/delete with return=representation.
// Every write is recorded in `mutations` so two builds can be compared.

export const PROJECT_REF = 'tpbuxspqibwitqzstdcz';
export const SUPABASE_ORIGIN = `https://${PROJECT_REF}.supabase.co`;

const clone = (v) => JSON.parse(JSON.stringify(v));

function parseValue(raw) {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

function splitTopLevel(str) {
  const parts = [];
  let depth = 0, cur = '', quoted = false;
  for (const ch of str) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

function stripQuotes(s) {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const na = Number(a), nb = Number(b);
  if (typeof a !== 'boolean' && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a) < String(b) ? -1 : 1;
}

function likeToRegex(pattern, flags) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*');
  return new RegExp(`^${escaped}$`, flags);
}

// Returns a predicate for "op.value" (optionally prefixed with "not.")
function predicate(column, expr) {
  let negate = false;
  if (expr.startsWith('not.')) { negate = true; expr = expr.slice(4); }
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const raw = expr.slice(dot + 1);
  let test;
  switch (op) {
    case 'eq': test = (v) => compare(v, parseValue(raw)) === 0 || String(v) === raw; break;
    case 'neq': test = (v) => !(compare(v, parseValue(raw)) === 0 || String(v) === raw); break;
    case 'gt': test = (v) => v !== null && v !== undefined && compare(v, raw) > 0; break;
    case 'gte': test = (v) => v !== null && v !== undefined && compare(v, raw) >= 0; break;
    case 'lt': test = (v) => v !== null && v !== undefined && compare(v, raw) < 0; break;
    case 'lte': test = (v) => v !== null && v !== undefined && compare(v, raw) <= 0; break;
    case 'like': test = (v) => likeToRegex(raw).test(String(v ?? '')); break;
    case 'ilike': test = (v) => likeToRegex(raw, 'i').test(String(v ?? '')); break;
    case 'is': test = (v) => (raw === 'null' ? v === null || v === undefined : v === parseValue(raw)); break;
    case 'in': {
      const list = splitTopLevel(raw.replace(/^\(|\)$/g, '')).map(stripQuotes);
      test = (v) => list.some((x) => String(v) === x);
      break;
    }
    case 'cs': {
      const want = raw.startsWith('{') ? raw.slice(1, -1).split(',').map(stripQuotes) : JSON.parse(raw);
      test = (v) => Array.isArray(v) && want.every((w) => v.map(String).includes(String(w)));
      break;
    }
    default: throw new Error(`fake-supabase: unsupported operator "${op}" on ${column}`);
  }
  return (row) => (negate ? !test(row[column]) : test(row[column]));
}

// or=(a.eq.1,and(b.gt.2,c.is.null))
function orPredicate(expr, isAnd = false) {
  const inner = expr.replace(/^\(|\)$/g, '');
  const preds = splitTopLevel(inner).map((part) => {
    if (part.startsWith('and(')) return orPredicate(part.slice(3), true);
    if (part.startsWith('or(')) return orPredicate(part.slice(2), false);
    const dot = part.indexOf('.');
    return predicate(part.slice(0, dot), part.slice(dot + 1));
  });
  return isAnd ? (row) => preds.every((p) => p(row)) : (row) => preds.some((p) => p(row));
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function filtersFrom(url) {
  const preds = [];
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === 'or') preds.push(orPredicate(value));
    else if (key === 'and') preds.push(orPredicate(value, true));
    else preds.push(predicate(key, value));
  }
  return (row) => preds.every((p) => p(row));
}

function applyOrder(rows, order) {
  if (!order) return rows;
  const specs = order.split(',').map((s) => {
    const [col, dir, nulls] = s.split('.');
    return { col, desc: dir === 'desc', nullsFirst: nulls === 'nullsfirst' };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc, nullsFirst } of specs) {
      const av = a[col], bv = b[col];
      const an = av === null || av === undefined, bn = bv === null || bv === undefined;
      if (an || bn) {
        if (an && bn) continue;
        return (an ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const c = compare(av, bv);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

export class FakeSupabase {
  constructor({ seed = {}, users = {}, now }) {
    this.db = clone(seed);
    this.users = users;
    this.currentUser = null;
    this.now = now;
    this.mutations = [];
    this.idCounter = 1;
  }

  table(name) {
    if (!this.db[name]) this.db[name] = [];
    return this.db[name];
  }

  nextId() {
    const n = String(this.idCounter++).padStart(12, '0');
    return `00000000-0000-4000-8000-${n}`;
  }

  withDefaults(row) {
    const out = { ...row };
    if (out.id === undefined) out.id = this.nextId();
    if (out.created_at === undefined) out.created_at = this.now.toISOString();
    return out;
  }

  async handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    try {
      if (path.startsWith('/rest/v1/rpc/')) return this.json(route, null);
      if (path.startsWith('/rest/v1/')) return await this.rest(route, req, url);
      if (path.startsWith('/auth/v1/')) return this.auth(route, req, url);
      if (path.startsWith('/storage/v1/')) return this.storage(route, req, url);
      if (path.startsWith('/functions/v1/')) {
        this.mutations.push({ kind: 'function', name: path.split('/')[3] });
        return this.json(route, {});
      }
      return this.json(route, {});
    } catch (e) {
      return this.json(route, { message: e.message }, 500);
    }
  }

  json(route, body, status = 200, headers = {}) {
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*', ...headers },
      body: body === undefined ? '' : JSON.stringify(body),
    });
  }

  auth(route, req, url) {
    const path = url.pathname;
    if (path.startsWith('/auth/v1/user')) {
      if (req.method() === 'PUT') return this.json(route, this.currentUser);
      return this.currentUser ? this.json(route, this.currentUser) : this.json(route, { message: 'no session' }, 401);
    }
    if (path.startsWith('/auth/v1/logout')) {
      this.mutations.push({ kind: 'auth', action: 'logout' });
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.startsWith('/auth/v1/token')) {
      const body = req.postDataJSON() || {};
      const user = Object.values(this.users).find((u) => u.email === body.email) || this.currentUser;
      if (!user) return this.json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      this.currentUser = user;
      return this.json(route, sessionFor(user, this.now));
    }
    if (path.startsWith('/auth/v1/signup')) {
      const body = req.postDataJSON() || {};
      this.mutations.push({ kind: 'auth', action: 'signup', email: body.email, data: body.data });
      const user = { id: this.nextId(), email: body.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: body.data || {} };
      return this.json(route, { ...sessionFor(user, this.now), user });
    }
    return this.json(route, {});
  }

  storage(route, req, url) {
    if (req.method() === 'GET') {
      // 1x1 transparent PNG for any public object
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    }
    this.mutations.push({ kind: 'storage', method: req.method(), path: url.pathname });
    return this.json(route, { Key: url.pathname.replace('/storage/v1/object/', '') });
  }

  // select=*,child_table(*) → each row gets child_table: rows of child_table whose
  // "<this table in singular>_id" points at it (one-to-many, the only kind the app uses).
  embed(tableName, rows, select) {
    if (!select) return rows;
    const fk = tableName.replace(/s$/, '') + '_id';
    for (const part of splitTopLevel(select.replace(/\s+/g, ''))) {
      const m = /^(\w+)\((.*)\)$/.exec(part);
      if (!m) continue;
      const child = this.table(m[1]);
      for (const row of rows) row[m[1]] = clone(child.filter((c) => String(c[fk]) === String(row.id)));
    }
    return rows;
  }

  async rest(route, req, url) {
    const tableName = decodeURIComponent(url.pathname.split('/')[3]);
    const method = req.method();
    const headers = req.headers();
    const prefer = headers['prefer'] || '';
    const wantsObject = (headers['accept'] || '').includes('vnd.pgrst.object');
    const returnRep = prefer.includes('return=representation');
    const rows = this.table(tableName);
    const match = filtersFrom(url);

    const respond = (result, extraHeaders = {}) => {
      if (wantsObject) {
        if (result.length !== 1) {
          return this.json(route, { code: 'PGRST116', details: `The result contains ${result.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
        }
        return this.json(route, result[0], 200, extraHeaders);
      }
      return this.json(route, result, 200, extraHeaders);
    };

    if (method === 'GET' || method === 'HEAD') {
      let result = applyOrder(rows.filter(match), url.searchParams.get('order'));
      const total = result.length;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = url.searchParams.get('limit');
      result = result.slice(offset, limit ? offset + Number(limit) : undefined);
      result = this.embed(tableName, clone(result), url.searchParams.get('select'));
      const extra = prefer.includes('count=') ? { 'Content-Range': `${offset}-${offset + result.length - 1}/${total}` } : {};
      if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', ...extra }, body: '' });
      return respond(result, extra);
    }

    const body = req.postDataJSON();

    if (method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body];
      const upsert = prefer.includes('resolution=merge-duplicates') || prefer.includes('resolution=ignore-duplicates');
      const conflictCols = (url.searchParams.get('on_conflict') || 'id').split(',');
      this.mutations.push({ kind: 'rest', method: upsert ? 'UPSERT' : 'INSERT', table: tableName, body: incoming, onConflict: upsert ? conflictCols : undefined });
      const written = [];
      for (const item of incoming) {
        const existing = upsert && rows.find((r) => conflictCols.every((c) => item[c] !== undefined && String(r[c]) === String(item[c])));
        if (existing) {
          if (!prefer.includes('ignore-duplicates')) Object.assign(existing, item);
          written.push(existing);
        } else {
          const row = this.withDefaults(item);
          rows.push(row);
          written.push(row);
        }
      }
      if (!returnRep) return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
      return respond(clone(written));
    }

    if (method === 'PATCH') {
      const filters = [...url.searchParams].filter(([k]) => !RESERVED.has(k));
      this.mutations.push({ kind: 'rest', method: 'UPDATE', table: tableName, filters, body });
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, body));
      if (!returnRep) return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
      return respond(clone(hit));
    }

    if (method === 'DELETE') {
      const filters = [...url.searchParams].filter(([k]) => !RESERVED.has(k));
      this.mutations.push({ kind: 'rest', method: 'DELETE', table: tableName, filters });
      const hit = rows.filter(match);
      this.db[tableName] = rows.filter((r) => !hit.includes(r));
      if (!returnRep) return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
      return respond(clone(hit));
    }

    return this.json(route, { message: `unsupported ${method}` }, 405);
  }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function sessionFor(user, now) {
  const exp = Math.floor(now.getTime() / 1000) + 10 * 365 * 24 * 3600;
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.signature`;
  return { access_token: accessToken, token_type: 'bearer', expires_in: exp - Math.floor(now.getTime() / 1000), expires_at: exp, refresh_token: 'fake-refresh-token', user };
}

// Realtime: accept the websocket and acknowledge every channel join so the
// client does not keep retrying; never pushes changes.
export async function mockRealtime(page) {
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const reply = (payload) => ({ status: 'ok', response: { postgres_changes: ((payload && payload.config && payload.config.postgres_changes) || []).map((c, i) => ({ ...c, id: i + 1 })) } });
    ws.onMessage((raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (Array.isArray(msg)) {
        const [joinRef, ref, topic, event, payload] = msg;
        if (['phx_join', 'heartbeat', 'access_token', 'phx_leave'].includes(event)) {
          ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', event === 'phx_join' ? reply(payload) : { status: 'ok', response: {} }]));
        }
      } else if (msg && msg.event) {
        ws.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', ref: msg.ref, join_ref: msg.join_ref, payload: msg.event === 'phx_join' ? reply(msg.payload) : { status: 'ok', response: {} } }));
      }
    });
  });
}
