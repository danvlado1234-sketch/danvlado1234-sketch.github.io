import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto, timingSafeEqual, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = process.env.ANALYTICS_ROOT || path.resolve(import.meta.dirname, '..');
const source = readFileSync(path.join(root, 'src/index.js'), 'utf8');
const schema = readFileSync(path.join(root, 'schema.sql'), 'utf8');
const tracker = readFileSync(path.join(root, '../analytics.js'), 'utf8');
const dashboard = readFileSync(path.join(root, 'src/dashboard.html'), 'utf8');
const origin = 'https://danvlado1234-sketch.github.io';
const stamp = Date.parse('2026-11-12T12:00:00Z');
const tick = () => new Promise(resolve => setImmediate(resolve));

function database() {
  const raw = new DatabaseSync(':memory:'); raw.exec(schema);
  return { raw, fail: false, prepare(sql) {
    return { sql, values: [], bind(...values) { this.values = values; return this; },
      async all() { return { results: raw.prepare(sql).all(...this.values) }; } };
  }, async batch(statements) {
    if (this.fail) throw new Error('database unavailable');
    raw.exec('BEGIN');
    try { const out = statements.map(s => ({ results: raw.prepare(s.sql).all(...s.values) })); raw.exec('COMMIT'); return out; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
  }};
}
function limiter(max = Infinity) {
  const calls = new Map();
  return { async limit({ key }) { const n = (calls.get(key) || 0) + 1; calls.set(key, n); return { success: n <= max }; }, calls };
}
function server() {
  let now = stamp + 3600000;
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Request, Response, URL, TextEncoder, TextDecoder, Intl, Date: Clock,
    crypto: { randomUUID, subtle: { digest: webcrypto.subtle.digest.bind(webcrypto.subtle),
      timingSafeEqual: (a, b) => timingSafeEqual(new Uint8Array(a), new Uint8Array(b)) } } });
  vm.runInContext(source.replace("import DASHBOARD from './dashboard.html';", "const DASHBOARD = 'dashboard';")
    .replace('export default {', 'globalThis.worker = {') + '\nglobalThis.queries = STAT_QUERIES;', context);
  const DB = database();
  const env = { DB, ALLOWED_ORIGINS: origin, DASHBOARD_PASSWORD: 'fixture-password-only', RATE_LIMIT_SALT: 'fixture-salt-only',
    INGEST_LIMITER: limiter(), VISITOR_LIMITER: limiter(), AUTH_LIMITER: limiter(10) };
  return { DB, env, queries: context.queries, setClock: n => { now = n; },
    async post(body, headers = {}) { return context.worker.fetch(new Request('https://test.invalid/e', {
      method: 'POST', headers: { Origin: origin, 'User-Agent': 'Mozilla/5.0', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(body) }), env, {}); },
    async get(p, authenticated = true) { return context.worker.fetch(new Request('https://test.invalid' + p, {
      headers: authenticated ? { Authorization: 'Bearer fixture-password-only' } : {} }), env, {}); },
  };
}
function packet(extra = {}) {
  return { ver: 2, b: randomUUID(), created: stamp, v: 'visitor_fixture_01', s: 'session_fixture_01', sst: stamp,
    ctx: { entry: '#/' }, act: 10, hb: stamp + 10000, ev: [{ t: 'pageview', ts: stamp, r: '#/' }],
    ls: [{ id: 'listen_fixture_01', i: 'lesson_fixture', st: stamp, t: stamp + 10000, n: true, mp: 10, du: 100, spd: 1,
      sg: [{ ts: stamp, d: 10, w: 10, spd: 1 }] }], ...extra };
}
test('valid ingestion and all statistics queries run on real SQLite', async () => {
  const s = server(); assert.equal((await s.post(packet())).status, 204);
  assert.equal(s.DB.raw.prepare('SELECT plays FROM sessions').get().plays, 1);
  for (const sql of Object.values(s.queries)) s.DB.raw.prepare(sql).all('2026-11-12', '2026-11-12');
  for (const route of ['/api/stats', '/api/sessions', '/api/session?id=session_fixture_01', '/api/visitor?id=visitor_fixture_01', '/api/live', '/api/export?table=events', '/api/ping', '/health'])
    assert.equal((await s.get(route)).status, 200, route);
});
test('duplicate and concurrent retries do not change any counter', async () => {
  const s = server(), p = packet();
  assert.deepEqual((await Promise.all([s.post(p), s.post(p), s.post(p)])).map(r => r.status), [204, 204, 204]);
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM events').get().n, 1);
  assert.equal(s.DB.raw.prepare('SELECT listen_s FROM visitors').get().listen_s, 10);
  assert.equal(s.DB.raw.prepare('SELECT wall_s FROM listens').get().wall_s, 10);
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM listen_segments').get().n, 1);
});
test('failed persistence is retriable and never acknowledges success', async () => {
  const s = server(), p = packet(); s.DB.fail = true;
  assert.equal((await s.post(p)).status, 503);
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM ingest_batches').get().n, 0);
  s.DB.fail = false; assert.equal((await s.post(p)).status, 204);
  assert.equal(s.DB.raw.prepare('SELECT plays FROM sessions').get().plays, 1);
});
test('packet ID collision and session/listen ownership cannot mutate another record', async () => {
  const s = server(), p = packet(); await s.post(p);
  assert.equal((await s.post({ ...p, act: 100 })).status, 409);
  assert.equal((await s.post(packet({ v: 'another_visitor_01' }))).status, 503);
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM visitors').get().n, 1);
  assert.equal(s.DB.raw.prepare('SELECT active_s FROM sessions').get().active_s, 10);
});
test('bad origins, malformed packets, missing limiter and excess requests fail closed', async () => {
  const s = server();
  assert.equal((await s.post(packet(), { Origin: 'https://untrusted.invalid' })).status, 403);
  assert.equal((await s.post(null)).status, 400);
  assert.equal((await s.post(packet({ ver: 1 }))).status, 400);
  assert.equal((await s.post(packet({ ls: [{ id: 'listen_fixture_01', i: 'x', sg: [null] }] }))).status, 400);
  s.env.INGEST_LIMITER = limiter(0); assert.equal((await s.post(packet())).status, 429);
  delete s.env.INGEST_LIMITER; assert.equal((await s.post(packet())).status, 503);
});
test('dashboard is private and failed password attempts are rate limited', async () => {
  const s = server();
  for (let i = 0; i < 10; i++) assert.equal((await s.get('/api/stats', false)).status, 401);
  assert.equal((await s.get('/api/stats', false)).status, 429);
  assert.equal((await s.get('/api/stats')).status, 200);
  const r = await s.get('/'); assert.match(r.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});
test('SQL stays bound and spreadsheet formulas are forced to text', async () => {
  const s = server(); await s.post(packet({ ev: [{ t: 'search', l: '=1+1' }, { t: 'search', l: "x'); DROP TABLE visitors;--" }] }));
  const csv = await (await s.get('/api/export?table=events')).text();
  assert.match(csv, /"\t=1\+1"/);
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM visitors').get().n, 1);
});
test('clock time is summed per segment across speeds and hours', async () => {
  const s = server(); const st = stamp - 60000;
  await s.post(packet({ sst: st, ls: [{ id: 'listen_fixture_01', i: 'x', st, t: stamp + 30000, n: true, spd: 2,
    sg: [{ ts: stamp - 3600000, d: 30, w: 30, spd: 1 }, { ts: stamp, d: 30, w: 15, spd: 2 }] }] }));
  const l = s.DB.raw.prepare('SELECT listened_s,wall_s FROM listens').get(); assert.equal(l.listened_s, 60); assert.equal(l.wall_s, 45);
  const heat = s.DB.raw.prepare(s.queries.heatL).all('2026-11-12', '2026-11-12');
  assert.equal(heat.length, 2); assert.equal(heat.reduce((a, x) => a + x.s, 0), 45);
});
test('server counts a listen once even when a fresh packet claims it is new again', async () => {
  const s = server(); await s.post(packet()); await s.post(packet());
  assert.equal(s.DB.raw.prepare('SELECT plays FROM sessions').get().plays, 1);
  assert.equal(s.DB.raw.prepare('SELECT plays FROM visitors').get().plays, 1);
});
test('listening after midnight belongs to the new day without inventing another play', async () => {
  const s = server(), midnight = Date.parse('2026-11-11T22:00:00Z');
  assert.equal((await s.post(packet({ sst: midnight - 30000, ls: [{ id: 'listen_fixture_01', i: 'x', st: midnight - 30000,
    t: midnight + 15000, n: true, spd: 1, sg: [{ ts: midnight - 3600000, d: 30, w: 30, spd: 1 }, { ts: midnight, d: 15, w: 15, spd: 1 }] }] }))).status, 204);
  const today = s.DB.raw.prepare(s.queries.kpiL).get('2026-11-12', '2026-11-12');
  assert.equal(today.plays, 0); assert.equal(today.wall_s, 15); assert.equal(today.listen_s, 15);
  assert.equal(s.DB.raw.prepare(s.queries.dailyL).get('2026-11-12', '2026-11-12').listen_s, 15);
});

class Events { constructor() { this.listeners = {}; } addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  dispatch(t, data = {}) { for (const f of this.listeners[t] || []) f({ type: t, ...data }); } }
function browser(storage = new Map(), search = '') {
  let now = stamp, mode = 204;
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
  const win = new Events(), document = new Events(), audio = new Events(), requests = [], intervals = [];
  Object.assign(document, { referrer: '', visibilityState: 'visible', querySelectorAll: () => [] });
  Object.assign(audio, { paused: true, ended: false, currentTime: 0, duration: 1000, playbackRate: 1, seeking: false });
  const localStorage = { get length() { return storage.size; }, key: i => [...storage.keys()][i], getItem: k => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const app = { audio, id: 'lesson_fixture', getNowId: () => app.id, getNowFrom: () => 'direct',
    byId: { lesson_fixture: { kind: 'm' } }, fullName: () => 'Fixture lesson', seriesName: () => 'Fixture series' };
  const c = { window: null, Date: Clock, URLSearchParams, URL, Blob, Math, JSON, Intl, crypto: { randomUUID },
    location: { hostname: 'public.test', host: 'public.test', pathname: '/', search, hash: '#/' },
    history: { state: null, replaceState() {} }, navigator: { language: 'he', userAgent: 'Mozilla/5.0', sendBeacon: () => true },
    screen: { width: 360, height: 800 }, matchMedia: () => ({ matches: false }), localStorage, document,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {},
    setTimeout() { return 1; }, clearTimeout() {}, addEventListener: win.addEventListener.bind(win),
    SHIURIM_ANALYTICS_BASE: 'https://test.invalid', SHIURIM_APP: app,
    fetch: async (url, opts) => { requests.push(JSON.parse(opts.body)); if (mode === 'network') throw new Error('offline'); return new Response(null, { status: mode }); } };
  c.window = c; vm.createContext(c); vm.runInContext(tracker, c);
  intervals.filter(x => x.ms === 200).forEach(x => x.fn());
  return { c, storage, requests, audio, app, win, document, intervals, mode: m => { mode = m; }, advance: ms => { now += ms; },
    flush: () => c.SHIURIM_ANALYTICS.flush(), play(n) {
      audio.paused = false; audio.ended = false; audio.dispatch('playing');
      for (let i = 0; i < n; i++) { now += 1000; audio.currentTime += audio.playbackRate; audio.dispatch('timeupdate'); }
    }, finish() { audio.paused = true; audio.ended = true; audio.dispatch('ended'); } };
}
const saved = b => [...b.storage.entries()].filter(([k]) => k.startsWith('sa_packet_v2_')).map(([, v]) => JSON.parse(v));
test('HTTP errors retain an immutable packet for acknowledged retry', async () => {
  const b = browser(); b.mode(500); b.play(5); b.flush(); await tick();
  const first = b.requests[0]; assert.ok(saved(b).length);
  b.advance(31000); b.mode(204); b.flush(); await tick();
  assert.equal(b.requests[1].b, first.b); assert.deepEqual(b.requests[1], first); assert.equal(saved(b).length, 0);
});
test('finished listens survive network loss and reload', async () => {
  const b = browser(); b.mode('network'); b.play(5); b.finish(); await tick();
  assert.equal(saved(b)[0].ls[0].sg.reduce((a, x) => a + x.w, 0), 5);
  const recovered = browser(b.storage); recovered.flush(); await tick();
  assert.ok(recovered.requests.some(p => p.ls.length && p.ls[0].n)); assert.equal(saved(recovered).length, 0);
});
test('a queued beacon remains unacknowledged until a later POST succeeds', async () => {
  const b = browser(); b.play(5); b.win.dispatch('pagehide');
  assert.ok(saved(b).length); assert.equal(b.requests.length, 0);
  const recovered = browser(b.storage); recovered.flush(); await tick(); assert.equal(saved(recovered).length, 0);
});
test('resume after 31 minutes creates a fresh listen and excludes the idle gap', async () => {
  const b = browser(); b.play(5); b.flush(); await tick(); b.audio.paused = true; b.audio.dispatch('pause'); await tick();
  b.advance(31 * 60000); b.play(5); b.flush(); await tick();
  const s = server(); s.setClock(stamp + 3600000); for (const p of b.requests) assert.equal((await s.post(p)).status, 204);
  const sessions = s.DB.raw.prepare('SELECT duration_s,plays FROM sessions ORDER BY started_at').all();
  assert.equal(sessions.length, 2); assert.ok(sessions.every(x => x.duration_s <= 6 && x.plays === 1));
  assert.equal(s.DB.raw.prepare('SELECT count(*) n FROM listens').get().n, 2);
});
test('browser reports real time after changing speed and accepts delayed background updates', async () => {
  const b = browser(); b.play(30); b.flush(); await tick(); b.audio.playbackRate = 2; b.audio.dispatch('ratechange'); await tick();
  b.play(15); b.flush(); await tick();
  const gs = b.requests.flatMap(p => p.ls.flatMap(l => l.sg));
  assert.equal(gs.reduce((a, x) => a + x.w, 0), 45); assert.equal(gs.reduce((a, x) => a + x.d, 0), 60);
  const bg = browser(); bg.play(0); bg.advance(30000); bg.audio.currentTime = 30; bg.audio.dispatch('timeupdate'); bg.flush(); await tick();
  assert.equal(bg.requests[0].ls[0].sg.reduce((a, x) => a + x.w, 0), 30);
});
test('seeking does not inflate listening and opt-out does not send anything', async () => {
  const b = browser(); b.play(5); b.audio.currentTime = 900; b.audio.dispatch('seeking'); b.audio.dispatch('seeked'); b.flush(); await tick();
  assert.equal(b.requests[0].ls[0].sg.reduce((a, x) => a + x.w, 0), 5);
  const off = browser(new Map(), '?no_track=1'); assert.equal(off.c.SHIURIM_ANALYTICS.optedOut, true); assert.equal(off.requests.length, 0);
});
test('browser and dashboard scripts parse; dashboards escape untrusted HTML', () => {
  new vm.Script(tracker); const js = dashboard.match(/<script>([\s\S]*?)<\/script>/)[1]; new vm.Script(js);
  const c = vm.createContext({}); vm.runInContext(js.slice(js.indexOf('  const esc = '), js.indexOf('  const KEY = ')).replace('  const esc =', 'globalThis.esc ='), c);
  assert.equal(c.esc('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
});

test('logout clears the password, cached views and polling timers', async () => {
  const elements = new Map(), values = new Map(), stopped = [];
  const el = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, value: '', open: false, textContent: '', listeners: {},
      classList: { add() {}, remove() {} }, addEventListener(t, fn) { this.listeners[t] = fn; }, focus() {},
      replaceChildren() { this.cleared = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const store = { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  const c = vm.createContext({ document: { querySelector: q => el(q), querySelectorAll: () => [] }, sessionStorage: store, localStorage: store,
    location: { hash: '' }, history: { replaceState() {} }, setInterval: () => 1, clearInterval: id => stopped.push(id),
    fetch: async p => p === '/api/ping' ? new Response('{}') : new Promise(() => {}), Intl, Date });
  vm.runInContext(dashboard.match(/<script>([\s\S]*?)<\/script>/)[1], c);
  el('#pw').value = 'fixture-password-only';
  await el('#loginForm').listeners.submit({ preventDefault() {} });
  assert.equal(el('#app').hidden, false); assert.equal(el('#pw').value, '');
  el('#dlg').open = true; el('#logout').listeners.click();
  assert.equal(values.get('sa_dash_pw'), undefined); assert.equal(el('#app').hidden, true); assert.equal(el('#login').hidden, false);
  assert.equal(el('#dlg').open, false); assert.ok(el('#main').cleared); assert.ok(stopped.length >= 2);
});
