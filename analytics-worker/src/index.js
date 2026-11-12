/* ============================================================================
 *  shiurim-analytics — שרת הסטטיסטיקות של "שיעורי הרב" (Cloudflare Worker + D1)
 *
 *  POST /e            קליטת אירועים מהאתר (analytics.js) — ציבורי, מוגבל למקורות מורשים
 *  GET  /             לוח הבקרה (dashboard.html) — הנתונים עצמם דורשים סיסמה
 *  GET  /api/stats    כל הסיכומים לטווח תאריכים            ┐
 *  GET  /api/sessions רשימת ביקורים                          │
 *  GET  /api/session  מסלול ביקור אחד (אירועים + האזנות)     │  דורשים
 *  GET  /api/visitor  היסטוריה של מבקר אחד                   │  Authorization: Bearer <סיסמה>
 *  GET  /api/live     מי באתר עכשיו                          │
 *  GET  /api/export   ייצוא CSV (events/sessions/listens/visitors)
 *  POST /api/delete-visitor  מחיקת כל הנתונים של מבקר אחד  ┘
 *
 *  פרטיות: לא נשמרת כתובת IP; מיקום ברמת עיר בלבד (מ-Cloudflare); המבקר מזוהה במזהה אקראי.
 * ========================================================================== */
import DASHBOARD from './dashboard.html';

const TZ = 'Asia/Jerusalem';
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const ilFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
});
function il(ts) {
  const p = {};
  for (const x of ilFmt.formatToParts(new Date(ts))) p[x.type] = x.value;
  return {
    day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, dow: DOW[p.weekday] ?? 0,
    text: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`,
  };
}

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|telegrambot|preview|headless|lighthouse|pingdom|uptime|curl|wget|python|go-http|axios|node-fetch/i;
const EVENT_TYPES = new Set([
  'pageview', 'download', 'pdf_open', 'share', 'search', 'install_prompt', 'install_click', 'app_installed',
  'comments_open', 'contact_open', 'text_open', 'queue_add', 'favorite', 'speed_change', 'loop_on', 'cont_on',
  'session_start', 'complete', 'play_start', 'sefaria_open', 'error', 'theme_change', 'outbound',
]);

// ---------- כלים ----------
const str = (v, n = 300) => (v == null || v === '' ? null : String(v).slice(0, n));
const num = (v, min = 0, max = 1e9) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : 0; };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*') || list.includes(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) && env.ALLOW_LOCALHOST === 'true') return origin;
  return null;
}

function parseUA(ua) {
  ua = ua || '';
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'tablet'
    : /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua) ? 'mobile' : 'desktop';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : 'אחר';
  const browser = /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook (בתוך האפליקציה)'
    : /Instagram/.test(ua) ? 'Instagram (בתוך האפליקציה)'
    : /Line\//.test(ua) ? 'Line'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /EdgA?\/|Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /YaBrowser/.test(ua) ? 'Yandex'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS/.test(ua) ? 'Chrome'
    : /; wv\)/.test(ua) ? 'WebView (בתוך אפליקציה)'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'אחר';
  return { device, os, browser };
}

function classifySource(ref, utm, ua) {
  if (utm) return utm.slice(0, 80);
  const r = (ref || '').toLowerCase();
  if (r) {
    if (r.includes('whatsapp')) return 'WhatsApp';
    if (r.includes('mail.google') || r.includes('gmail')) return 'Gmail';
    if (/(^|\.)google\.|com\.google\.android/.test(r)) return 'Google';
    if (r.includes('bing.')) return 'Bing';
    if (r.includes('facebook') || r.includes('fb.') || r === 'm.facebook.com') return 'Facebook';
    if (r.includes('instagram')) return 'Instagram';
    if (r.includes('t.me') || r.includes('telegram')) return 'Telegram';
    if (r.includes('youtube')) return 'YouTube';
    if (r.includes('outlook') || r.includes('live.com')) return 'Outlook';
    if (r.includes('yahoo')) return 'Yahoo';
    if (r.includes('duckduckgo')) return 'DuckDuckGo';
    return r.replace(/^www\./, '').slice(0, 80);
  }
  if (/FBAN|FBAV/.test(ua || '')) return 'Facebook';
  if (/Instagram/.test(ua || '')) return 'Instagram';
  return null;
}

async function sha(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
}
async function checkAuth(request, env) {
  const pw = env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  const h = request.headers.get('Authorization') || '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!given) return false;
  const [a, b] = await Promise.all([sha(given), sha(pw)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

// ---------- קליטת אירועים ----------
async function ingest(request, env, ctx) {
  const origin = allowedOrigin(request, env);
  const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
  if (!origin) return new Response('forbidden origin', { status: 403 });
  const ua = request.headers.get('User-Agent') || '';
  if (BOT_RE.test(ua)) return new Response(null, { status: 204, headers: cors });
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > 65536) return new Response('too large', { status: 413, headers: cors });

  let body;
  try {
    const text = await request.text();
    if (text.length > 65536) return new Response('too large', { status: 413, headers: cors });
    body = JSON.parse(text);
  } catch { return new Response('bad json', { status: 400, headers: cors }); }

  const vid = String(body.v || ''), sid = String(body.s || '');
  if (!ID_RE.test(vid) || !ID_RE.test(sid)) return new Response('bad id', { status: 400, headers: cors });

  const now = Date.now();
  const clampTs = t => { t = Number(t); return Number.isFinite(t) && t > now - 3 * 864e5 && t < now + 60e3 ? Math.round(t) : now; };
  const c = body.ctx || {};
  const cf = request.cf || {};
  const { device, os, browser } = parseUA(ua);
  const country = str(cf.country, 8), region = str(cf.region, 80), city = str(cf.city, 80), timezone = str(cf.timezone, 60);
  const referrer = str(c.ref, 120);
  const source = classifySource(referrer, str(c.src, 80), ua);
  const campaign = str(c.cmp, 120);

  const evs = Array.isArray(body.ev) ? body.ev.slice(0, 200) : [];
  const lss = Array.isArray(body.ls) ? body.ls.slice(0, 50) : [];
  const active = num(body.act, 0, 3600);

  let firstTs = Infinity, lastTs = 0, pageviews = 0, plays = 0, listenSum = 0, exitRoute = null, entryRoute = str(c.entry, 200);
  const stmts = [];
  const evRows = [];
  for (const e of evs) {
    if (!e || !EVENT_TYPES.has(e.t)) continue;
    const ts = clampTs(e.ts); const t = il(ts);
    firstTs = Math.min(firstTs, ts); lastTs = Math.max(lastTs, ts);
    if (e.t === 'pageview') { pageviews++; exitRoute = str(e.r, 200); if (!entryRoute) entryRoute = exitRoute; }
    evRows.push([ts, t.day, t.hour, vid, sid, e.t, str(e.r, 200), str(e.i, 300), str(e.k, 20), str(e.ti, 200), str(e.se, 120), str(e.l, 200), e.n == null ? null : num(e.n, -1e9, 1e9)]);
  }
  const lsRows = [];
  for (const l of lss) {
    if (!l || !ID_RE.test(String(l.id || '')) || !l.i) continue;
    const st = clampTs(l.st), lt = clampTs(l.t || l.st); const t = il(st);
    firstTs = Math.min(firstTs, st); lastTs = Math.max(lastTs, lt);
    const d = num(l.d, 0, 4 * 3600);
    listenSum += d; if (l.n) plays++;
    lsRows.push([String(l.id), sid, vid, str(l.i, 300), str(l.k, 20), str(l.ti, 200), str(l.se, 120), st, lt, t.day, t.hour, t.dow,
      d, num(l.sp, 0, 1e6), num(l.mp, 0, 1e6), num(l.du, 0, 1e6), num(l.spd, 0.25, 4) || 1, l.c ? 1 : 0, l.r ? 1 : 0, str(l.src, 20)]);
  }
  if (body.hb) { const ts = clampTs(body.hb); firstTs = Math.min(firstTs, ts); lastTs = Math.max(lastTs, ts); }
  if (firstTs === Infinity) { firstTs = now; lastTs = now; }
  const st = il(firstTs);

  // מבקר: סופרים ביקור חדש רק כשהביקור עוד לא קיים
  stmts.push(env.DB.prepare(
    `INSERT INTO visitors (visitor_id, first_seen, first_day, last_seen, sessions, listen_s, plays, country, city, device, os, browser, first_referrer, first_source)
     VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
     ON CONFLICT(visitor_id) DO UPDATE SET last_seen = MAX(last_seen, excluded.last_seen), listen_s = listen_s + excluded.listen_s,
       plays = plays + excluded.plays, country = COALESCE(excluded.country, country), city = COALESCE(excluded.city, city),
       device = excluded.device, os = excluded.os, browser = excluded.browser`
  ).bind(vid, firstTs, st.day, lastTs, listenSum, plays, country, city, device, os, browser, referrer, source));
  stmts.push(env.DB.prepare(
    `UPDATE visitors SET sessions = sessions + 1 WHERE visitor_id = ?1 AND NOT EXISTS (SELECT 1 FROM sessions WHERE session_id = ?2)`
  ).bind(vid, sid));
  stmts.push(env.DB.prepare(
    `INSERT INTO sessions (session_id, visitor_id, started_at, last_seen, start_day, start_hour, start_dow, duration_s, active_s, pageviews, plays, listen_s, events,
       is_new, entry_route, exit_route, referrer, source, campaign, country, region, city, timezone, device, os, browser, standalone, lang, screen, connection)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CAST((?4 - ?3) / 1000 AS INTEGER), ?8, ?9, ?10, ?11, ?12,
       CASE WHEN EXISTS (SELECT 1 FROM sessions WHERE visitor_id = ?2) THEN 0 ELSE 1 END,
       ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28)
     ON CONFLICT(session_id) DO UPDATE SET
       last_seen = MAX(last_seen, excluded.last_seen),
       duration_s = CAST((MAX(last_seen, excluded.last_seen) - started_at) / 1000 AS INTEGER),
       active_s = active_s + excluded.active_s, pageviews = pageviews + excluded.pageviews, plays = plays + excluded.plays,
       listen_s = listen_s + excluded.listen_s, events = events + excluded.events,
       exit_route = COALESCE(excluded.exit_route, exit_route), entry_route = COALESCE(entry_route, excluded.entry_route),
       standalone = MAX(standalone, excluded.standalone)`
  ).bind(sid, vid, firstTs, lastTs, st.day, st.hour, st.dow, Math.round(active), pageviews, plays, listenSum, evRows.length,
    entryRoute, exitRoute, referrer, source, campaign, country, region, city, timezone, device, os, browser,
    c.sa ? 1 : 0, str(c.lang, 20), str(c.scr, 20), str(c.conn, 20)));
  for (const r of evRows) {
    stmts.push(env.DB.prepare(
      `INSERT INTO events (ts, day, hour, visitor_id, session_id, type, route, item_id, kind, title, series, label, value) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`
    ).bind(...r));
  }
  for (const r of lsRows) {
    stmts.push(env.DB.prepare(
      `INSERT INTO listens (listen_id, session_id, visitor_id, item_id, kind, title, series, started_at, last_at, day, hour, dow, listened_s, start_pos_s, max_pos_s, duration_s, speed, completed, resumed, source)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)
       ON CONFLICT(listen_id) DO UPDATE SET last_at = MAX(last_at, excluded.last_at), listened_s = listened_s + excluded.listened_s,
         max_pos_s = MAX(max_pos_s, excluded.max_pos_s), duration_s = MAX(duration_s, excluded.duration_s),
         speed = excluded.speed, completed = MAX(completed, excluded.completed)`
    ).bind(...r));
  }
  ctx.waitUntil(env.DB.batch(stmts).catch(err => console.error('ingest failed', err && err.message)));
  return new Response(null, { status: 204, headers: cors });
}

// ---------- סיכומים ללוח הבקרה ----------
function rangeOf(url) {
  const today = il(Date.now()).day;
  let from = url.searchParams.get('from') || today, to = url.searchParams.get('to') || today;
  if (!DAY_RE.test(from)) from = today;
  if (!DAY_RE.test(to)) to = today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}
function prevRange(from, to) {
  const d0 = Date.parse(from + 'T00:00:00Z'), d1 = Date.parse(to + 'T00:00:00Z');
  const span = Math.round((d1 - d0) / 864e5) + 1;
  const iso = ms => new Date(ms).toISOString().slice(0, 10);
  return { pfrom: iso(d0 - span * 864e5), pto: iso(d0 - 864e5) };
}

const STAT_QUERIES = {
  kpiS: `SELECT COUNT(*) sessions, COUNT(DISTINCT visitor_id) visitors, COALESCE(SUM(is_new),0) new_visitors, COALESCE(SUM(pageviews),0) pageviews,
           AVG(duration_s) avg_duration, AVG(active_s) avg_active, COALESCE(SUM(active_s),0) total_active,
           COALESCE(SUM(CASE WHEN pageviews <= 1 AND plays = 0 AND duration_s < 30 THEN 1 ELSE 0 END),0) bounces,
           COALESCE(SUM(standalone),0) app_sessions, COALESCE(SUM(CASE WHEN plays > 0 THEN 1 ELSE 0 END),0) listening_sessions
         FROM sessions WHERE start_day BETWEEN ?1 AND ?2`,
  kpiL: `SELECT COUNT(*) plays, COUNT(DISTINCT visitor_id) listeners, COUNT(DISTINCT item_id) items, COALESCE(SUM(listened_s),0) listen_s,
           COALESCE(SUM(completed),0) completed, AVG(listened_s) avg_listen, COALESCE(SUM(listened_s / speed),0) wall_s
         FROM listens WHERE day BETWEEN ?1 AND ?2`,
  returning: `SELECT COUNT(DISTINCT s.visitor_id) n FROM sessions s JOIN visitors v ON v.visitor_id = s.visitor_id
              WHERE s.start_day BETWEEN ?1 AND ?2 AND v.first_day < ?1`,
  evTypes: `SELECT type, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM events WHERE day BETWEEN ?1 AND ?2 GROUP BY type`,
  dailyS: `SELECT start_day day, COUNT(*) sessions, COUNT(DISTINCT visitor_id) visitors, SUM(is_new) new_visitors, SUM(pageviews) pageviews,
             AVG(duration_s) avg_duration, SUM(active_s) active_s FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY start_day`,
  dailyL: `SELECT day, COUNT(*) plays, COUNT(DISTINCT visitor_id) listeners, SUM(listened_s) listen_s, SUM(completed) completed
           FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY day`,
  heatS: `SELECT start_dow dow, start_hour hour, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY 1, 2`,
  heatL: `SELECT dow, hour, COUNT(*) n, SUM(listened_s) s FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY 1, 2`,
  topItems: `SELECT item_id, MAX(title) title, MAX(series) series, MAX(kind) kind, COUNT(*) plays, COUNT(DISTINCT visitor_id) listeners,
               SUM(listened_s) listen_s, SUM(completed) completed, MAX(duration_s) duration_s,
               AVG(CASE WHEN duration_s > 0 THEN MIN(1.0, max_pos_s / duration_s) END) avg_reach
             FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY item_id ORDER BY plays DESC, listen_s DESC LIMIT 150`,
  series: `SELECT series, MAX(kind) kind, COUNT(*) plays, COUNT(DISTINCT visitor_id) listeners, SUM(listened_s) listen_s, COUNT(DISTINCT item_id) items,
             SUM(completed) completed FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY series ORDER BY listen_s DESC LIMIT 80`,
  kinds: `SELECT kind k, COUNT(*) n, COUNT(DISTINCT visitor_id) u, SUM(listened_s) s FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY kind`,
  devices: `SELECT device k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY device ORDER BY n DESC`,
  os: `SELECT os k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY os ORDER BY n DESC`,
  browsers: `SELECT browser k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY browser ORDER BY n DESC`,
  appMode: `SELECT standalone k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY standalone`,
  countries: `SELECT country k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY country ORDER BY n DESC LIMIT 40`,
  cities: `SELECT city k, country c, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 AND city IS NOT NULL
           GROUP BY city, country ORDER BY n DESC LIMIT 60`,
  sources: `SELECT COALESCE(source, '') k, COUNT(*) n, COUNT(DISTINCT visitor_id) u, SUM(plays) plays FROM sessions WHERE start_day BETWEEN ?1 AND ?2
            GROUP BY COALESCE(source, '') ORDER BY n DESC LIMIT 40`,
  campaigns: `SELECT campaign k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM sessions WHERE start_day BETWEEN ?1 AND ?2 AND campaign IS NOT NULL
              GROUP BY campaign ORDER BY n DESC LIMIT 30`,
  entries: `SELECT COALESCE(entry_route, '#/') k, COUNT(*) n FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY 1 ORDER BY n DESC LIMIT 30`,
  pages: `SELECT COALESCE(route, '#/') k, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM events WHERE day BETWEEN ?1 AND ?2 AND type = 'pageview'
          GROUP BY 1 ORDER BY n DESC LIMIT 50`,
  searches: `SELECT lower(trim(label)) k, COUNT(*) n, COUNT(DISTINCT visitor_id) u, AVG(value) results FROM events
             WHERE day BETWEEN ?1 AND ?2 AND type = 'search' AND label IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 60`,
  actions: `SELECT type, item_id, MAX(title) title, COUNT(*) n, COUNT(DISTINCT visitor_id) u FROM events
            WHERE day BETWEEN ?1 AND ?2 AND type IN ('download', 'pdf_open', 'share', 'comments_open', 'text_open', 'sefaria_open', 'queue_add', 'favorite')
            GROUP BY type, item_id ORDER BY n DESC LIMIT 200`,
  durBuckets: `SELECT CASE WHEN duration_s < 10 THEN 0 WHEN duration_s < 60 THEN 1 WHEN duration_s < 180 THEN 2 WHEN duration_s < 600 THEN 3
                 WHEN duration_s < 1800 THEN 4 WHEN duration_s < 3600 THEN 5 ELSE 6 END b, COUNT(*) n
               FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY b`,
  freq: `SELECT c, COUNT(*) n FROM (SELECT visitor_id, MIN(COUNT(*), 10) c FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY visitor_id) GROUP BY c`,
  activeDays: `SELECT c, COUNT(*) n FROM (SELECT visitor_id, MIN(COUNT(DISTINCT start_day), 15) c FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY visitor_id) GROUP BY c`,
  speeds: `SELECT speed k, COUNT(*) n FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY speed ORDER BY speed`,
  listenSrc: `SELECT COALESCE(source, 'click') k, COUNT(*) n FROM listens WHERE day BETWEEN ?1 AND ?2 GROUP BY 1`,
  reach: `SELECT MIN(CAST(max_pos_s * 10 / duration_s AS INTEGER), 10) b, COUNT(*) n FROM listens WHERE day BETWEEN ?1 AND ?2 AND duration_s > 0 GROUP BY b`,
  langs: `SELECT lang k, COUNT(*) n FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY lang ORDER BY n DESC LIMIT 15`,
  topVisitors: `SELECT visitor_id, COUNT(*) sessions, SUM(listen_s) listen_s, SUM(plays) plays, MAX(last_seen) last_seen, MAX(city) city, MAX(device) device, MAX(os) os
                FROM sessions WHERE start_day BETWEEN ?1 AND ?2 GROUP BY visitor_id ORDER BY listen_s DESC, sessions DESC LIMIT 50`,
};

async function stats(env, url) {
  const { from, to } = rangeOf(url);
  const { pfrom, pto } = prevRange(from, to);
  const keys = Object.keys(STAT_QUERIES);
  const stmts = keys.map(k => env.DB.prepare(STAT_QUERIES[k]).bind(from, to));
  stmts.push(env.DB.prepare(STAT_QUERIES.kpiS).bind(pfrom, pto), env.DB.prepare(STAT_QUERIES.kpiL).bind(pfrom, pto), env.DB.prepare(STAT_QUERIES.returning).bind(pfrom, pto));
  stmts.push(env.DB.prepare(`SELECT COUNT(*) visitors, MIN(first_day) since FROM visitors`));
  const res = await env.DB.batch(stmts);
  const out = { from, to, pfrom, pto };
  keys.forEach((k, i) => { out[k] = res[i].results; });
  const n = keys.length;
  out.prev = { kpiS: res[n].results[0], kpiL: res[n + 1].results[0], returning: res[n + 2].results[0] };
  out.allTime = res[n + 3].results[0];
  out.generated = Date.now();
  return json(out);
}

async function sessionsList(env, url) {
  const { from, to } = rangeOf(url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const r = await env.DB.prepare(
    `SELECT * FROM sessions WHERE start_day BETWEEN ?1 AND ?2 ORDER BY started_at DESC LIMIT ?3 OFFSET ?4`
  ).bind(from, to, limit, offset).all();
  return json({ rows: r.results });
}

async function sessionDetail(env, url) {
  const id = url.searchParams.get('id') || '';
  if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
  const [s, e, l] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM sessions WHERE session_id = ?1`).bind(id),
    env.DB.prepare(`SELECT ts, type, route, item_id, title, series, label, value FROM events WHERE session_id = ?1 ORDER BY ts LIMIT 1000`).bind(id),
    env.DB.prepare(`SELECT * FROM listens WHERE session_id = ?1 ORDER BY started_at LIMIT 500`).bind(id),
  ]);
  return json({ session: s.results[0] || null, events: e.results, listens: l.results });
}

async function visitorDetail(env, url) {
  const id = url.searchParams.get('id') || '';
  if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
  const [v, s, l] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM visitors WHERE visitor_id = ?1`).bind(id),
    env.DB.prepare(`SELECT * FROM sessions WHERE visitor_id = ?1 ORDER BY started_at DESC LIMIT 300`).bind(id),
    env.DB.prepare(`SELECT * FROM listens WHERE visitor_id = ?1 ORDER BY started_at DESC LIMIT 1000`).bind(id),
  ]);
  return json({ visitor: v.results[0] || null, sessions: s.results, listens: l.results });
}

async function live(env) {
  const now = Date.now();
  const [s, l, t] = await env.DB.batch([
    env.DB.prepare(`SELECT session_id, visitor_id, started_at, last_seen, exit_route, city, country, device, os, browser, standalone, pageviews, plays, listen_s
                    FROM sessions WHERE last_seen > ?1 ORDER BY last_seen DESC LIMIT 200`).bind(now - 5 * 60e3),
    env.DB.prepare(`SELECT session_id, item_id, title, series, max_pos_s, duration_s, last_at FROM listens WHERE last_at > ?1 ORDER BY last_at DESC LIMIT 200`).bind(now - 2 * 60e3),
    env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) n FROM sessions WHERE last_seen > ?1`).bind(now - 30 * 60e3),
  ]);
  return json({ now, sessions: s.results, listening: l.results, last30min: t.results[0]?.n || 0 });
}

const TS_COLS = new Set(['ts', 'started_at', 'last_seen', 'last_at', 'first_seen']);
async function exportCsv(env, url) {
  const table = url.searchParams.get('table');
  const { from, to } = rangeOf(url);
  const sql = {
    events: `SELECT * FROM events WHERE day BETWEEN ?1 AND ?2 ORDER BY ts LIMIT 200000`,
    sessions: `SELECT * FROM sessions WHERE start_day BETWEEN ?1 AND ?2 ORDER BY started_at LIMIT 200000`,
    listens: `SELECT * FROM listens WHERE day BETWEEN ?1 AND ?2 ORDER BY started_at LIMIT 200000`,
    visitors: `SELECT * FROM visitors WHERE visitor_id IN (SELECT DISTINCT visitor_id FROM sessions WHERE start_day BETWEEN ?1 AND ?2) ORDER BY first_seen LIMIT 200000`,
  }[table];
  if (!sql) return json({ error: 'unknown table' }, 400);
  const r = await env.DB.prepare(sql).bind(from, to).all();
  const rows = r.results || [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(',')];
  for (const row of rows) lines.push(cols.map(c => esc(TS_COLS.has(c) && row[c] ? il(row[c]).text : row[c])).join(','));
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
      'content-disposition': `attachment; filename="shiurim-${table}-${from}_${to}.csv"`,
    },
  });
}

async function deleteVisitor(request, env) {
  let body = {};
  try { body = await request.json(); } catch {}
  const id = String(body.visitor_id || '');
  if (!ID_RE.test(id)) return json({ error: 'bad id' }, 400);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM events WHERE visitor_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM listens WHERE visitor_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM sessions WHERE visitor_id = ?1`).bind(id),
    env.DB.prepare(`DELETE FROM visitors WHERE visitor_id = ?1`).bind(id),
  ]);
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/e') {
      if (request.method === 'OPTIONS') {
        const origin = allowedOrigin(request, env);
        return new Response(null, {
          status: origin ? 204 : 403,
          headers: origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' } : {},
        });
      }
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
      return ingest(request, env, ctx);
    }

    if (path === '/' || path === '/dashboard') {
      return new Response(DASHBOARD, {
        headers: {
          'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
          'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow',
        },
      });
    }
    if (path === '/health') return json({ ok: true, time: il(Date.now()).text });
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');

    if (path.startsWith('/api/')) {
      if (!env.DASHBOARD_PASSWORD) return json({ error: 'DASHBOARD_PASSWORD לא הוגדרה בשרת' }, 500);
      if (!(await checkAuth(request, env))) {
        await new Promise(r => setTimeout(r, 400));
        return json({ error: 'unauthorized' }, 401);
      }
      try {
        if (path === '/api/stats') return await stats(env, url);
        if (path === '/api/sessions') return await sessionsList(env, url);
        if (path === '/api/session') return await sessionDetail(env, url);
        if (path === '/api/visitor') return await visitorDetail(env, url);
        if (path === '/api/live') return await live(env);
        if (path === '/api/export') return await exportCsv(env, url);
        if (path === '/api/delete-visitor' && request.method === 'POST') return await deleteVisitor(request, env);
        if (path === '/api/ping') return json({ ok: true });
      } catch (err) {
        return json({ error: String(err && err.message || err) }, 500);
      }
      return json({ error: 'not found' }, 404);
    }
    return new Response('not found', { status: 404 });
  },
};
