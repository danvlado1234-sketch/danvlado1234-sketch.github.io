/* ============================================================================
 *  analytics.js — איסוף נתוני שימוש לאתר "שיעורי הרב" (נשלח לשרת shiurim-analytics)
 *
 *  מה נאסף: כניסות וביקורים (זמן התחלה, משך, זמן פעיל על המסך), דפים שנצפו, האזנות לשיעורים
 *  (כמה נשמע בפועל, עד איפה, מהירות, האם הושלם), הורדות, פתיחת סיכומים, שיתופים, חיפושים,
 *  התקנת האפליקציה, תגובות, מכשיר/דפדפן/מסך, ומאיפה הגיעו (גוגל, ווטסאפ, מייל...).
 *  מה לא נאסף: שם, טלפון, מייל, כתובת IP. המבקר מזוהה במזהה אקראי שנשמר רק בדפדפן שלו.
 *
 *  כדי שהביקורים שלך לא ייספרו: לפתוח פעם אחת בכל מכשיר  https://danvlado1234-sketch.github.io/?no_track=1
 *  (ולהחזיר: ?no_track=0). בקונסול: SHIURIM_ANALYTICS.visitorId — המזהה של הדפדפן הזה.
 * ========================================================================== */
(() => {
  'use strict';
  const BASE = String(window.SHIURIM_ANALYTICS_BASE || '').replace(/\/+$/, '');
  if (!BASE) return;
  const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (LOCAL && !window.SHIURIM_ANALYTICS_LOCAL) return;
  if (location.pathname.startsWith('/manage')) return;

  // ---------- אחסון ----------
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

  // ---------- ביטול מעקב (למנהל האתר) ----------
  const q = new URLSearchParams(location.search);
  let notice = null;
  if (q.has('no_track')) {
    const off = q.get('no_track') !== '0';
    set('sa_optout', off ? '1' : null);
    notice = off ? 'הביקורים מהמכשיר הזה לא ייספרו בסטטיסטיקות' : 'הספירה בסטטיסטיקות הופעלה מחדש במכשיר הזה';
    q.delete('no_track');
    try { history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch {}
  }
  const whenApp = fn => { let n = 0; const t = setInterval(() => { if (window.SHIURIM_APP) { clearInterval(t); fn(window.SHIURIM_APP); } else if (++n > 150) clearInterval(t); }, 200); };
  if (notice) whenApp(A => setTimeout(() => A.toast && A.toast(notice), 600));
  if (get('sa_optout') === '1') { window.SHIURIM_ANALYTICS = { optedOut: true }; return; }
  if (navigator.webdriver || /bot|crawl|spider|headless|lighthouse|preview/i.test(navigator.userAgent)) return;

  // ---------- מזהים ----------
  const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
  const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)).replace(/[^A-Za-z0-9_-]/g, '');
  let vid = get('sa_vid');
  if (!vid || !ID_RE.test(vid)) { vid = rid(); set('sa_vid', vid); }

  const IDLE = 30 * 60e3;           // הפסקה של 30 דקות = ביקור חדש
  const ACTIVE_GRACE = 2 * 60e3;    // בלי מגע/גלילה 2 דקות (ובלי שמע) = לא פעיל
  let S = null;
  try { S = JSON.parse(get('sa_ses') || 'null'); } catch {}
  const saveS = () => set('sa_ses', JSON.stringify(S));

  // ---------- הקשר ----------
  const route = () => { let h = location.hash || '#/'; try { h = decodeURIComponent(h); } catch {} return h.slice(0, 200); };
  const standalone = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } })();
  const extRef = (() => {
    const r = document.referrer; if (!r) return null;
    try { const u = new URL(r); return u.host === location.host ? null : (u.protocol === 'android-app:' ? u.host : u.host); } catch { return null; }
  })();
  const ctx = {
    ref: extRef,
    src: q.get('utm_source') || q.get('ref') || q.get('src') || null,
    cmp: q.get('utm_campaign') || null,
    lang: navigator.language || null,
    scr: `${screen.width}x${screen.height}`,
    sa: standalone,
    conn: (navigator.connection && navigator.connection.effectiveType) || null,
    entry: route(),
  };

  // ---------- תור ושליחה ----------
  let evq = [];
  const doneListens = [];            // האזנות שהסתיימו וממתינות לשליחה
  let cur = null;                    // ההאזנה הנוכחית
  let activeAcc = 0, visibleSince = document.visibilityState === 'visible' ? Date.now() : null, lastInput = Date.now();
  let lastRoute = null;

  function ensureSession() {
    const now = Date.now();
    if (!S || !ID_RE.test(S.id || '') || !Number.isFinite(S.last) || !Number.isFinite(S.start) || now - S.last > IDLE) {
      if (S && S.id) {
        // Closing an idle visit must not extend its heartbeat to the next visit.
        finishListen();
        flush(true, false);
      }
      S = { id: rid(), start: now, last: now };
      ctx.entry = route();
      lastRoute = null;
      visibleSince = document.visibilityState === 'visible' ? now : null;
      lastInput = now;
      saveS();
      return true;
    }
    S.last = now; saveS();
    return false;
  }

  function track(t, data) {
    const rotated = ensureSession();
    if (rotated && t !== 'pageview') pageview(true);
    evq.push(Object.assign({ t, ts: Date.now(), r: route() }, data || {}));
    if (evq.length >= 25) flush();
  }

  function accrueActive() {
    const now = Date.now();
    if (visibleSince != null) {
      const end = isPlaying() ? now : Math.min(now, lastInput + ACTIVE_GRACE);
      if (end > visibleSince) activeAcc += (end - visibleSince) / 1000;
      visibleSince = now;
    }
  }

  function listenSnap(l, final) {
    if (!l.sent && l.d < 3 && !l.c) return null;
    if (l.sent && l.d < 0.001 && !final && l.c === l.cSent) return null;
    const snap = { id: l.lid, i: l.id, k: l.k, ti: l.ti, se: l.se, st: l.st, t: l.t,
      sp: Math.round(l.sp), mp: Math.round(l.mp), du: Math.round(l.du || 0), spd: l.spd,
      c: l.c, r: l.r, src: l.src, n: !l.sent, sg: [...l.buckets.values()] };
    l.d = 0; l.buckets.clear(); l.sent = true; l.cSent = l.c;
    return snap;
  }

  // Immutable packets survive refresh/navigation. An acknowledgement removes a packet;
  // a beacon never acknowledges it. Duplicate delivery is handled atomically by the server.
  const OUTBOX = 'sa_packet_v2_';
  const pending = new Map();
  let sending = false, retryAt = 0;
  function recoverPackets() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(OUTBOX) || pending.has(key)) continue;
        const text = get(key);
        try {
          const p = JSON.parse(text);
          if (p.ver === 2 && ID_RE.test(p.b) && p.created >= Date.now() - 3 * 864e5) pending.set(key, text);
          else set(key, null);
        } catch { set(key, null); }
      }
    } catch {}
  }
  function remember(payload) {
    const key = OUTBOX + payload.b, text = JSON.stringify(payload);
    pending.set(key, text);
    set(key, text);
  }
  async function deliver() {
    if (sending || Date.now() < retryAt) return;
    sending = true;
    recoverPackets();
    try {
      let budget = 5;
      for (const [key, body] of pending) {
        if (JSON.parse(body).created < Date.now() - 3 * 864e5) { pending.delete(key); set(key, null); continue; }
        if (budget-- <= 0) break;
        const r = await fetch(BASE + '/e', { method: 'POST', body, keepalive: body.length < 60000,
          mode: 'cors', credentials: 'omit', headers: { 'content-type': 'text/plain' } });
        if (!r.ok) {
          retryAt = Date.now() + Math.max(30, Math.min(300, Number(r.headers.get('Retry-After')) || 30)) * 1000;
          break;
        }
        pending.delete(key); set(key, null);
      }
    } catch { retryAt = Date.now() + 30000; }
    finally { sending = false; }
  }
  function flush(beacon, heartbeat = true) {
    if (!S) return;
    accrueActive();
    const ls = [];
    while (doneListens.length && ls.length < 5) { const snap = listenSnap(doneListens.shift(), true); if (snap) ls.push(snap); }
    if (cur && ls.length < 5) { const snap = listenSnap(cur, false); if (snap) ls.push(snap); }
    const act = Math.floor(activeAcc);
    const engaged = isPlaying() || (visibleSince != null && Date.now() - lastInput < ACTIVE_GRACE);
    if (evq.length || ls.length || act >= 5 || (heartbeat && engaged)) {
      activeAcc -= act;
      const payload = { ver: 2, b: rid(), created: Date.now(), v: vid, s: S.id, sst: S.start,
        ctx: { ...ctx }, ev: evq.splice(0, 25), ls, act };
      if (heartbeat && (engaged || payload.ev.length || ls.length)) payload.hb = Date.now();
      remember(payload);
    }
    if (beacon && navigator.sendBeacon) {
      const body = pending.values().next().value;
      if (body) { try { navigator.sendBeacon(BASE + '/e', new Blob([body], { type: 'text/plain' })); } catch {} }
    } else void deliver();
  }

  function pageview(force) {
    const r = route();
    if (!force && r === lastRoute) return;
    lastRoute = r;
    track('pageview', { r });
  }

  // ---------- שיעורים ----------
  let A = null;
  const isPlaying = () => !!(A && A.audio && !A.audio.paused && !A.audio.ended);
  function info(id) {
    const it = A && A.byId && A.byId[id];
    if (!it) return { i: id || null };
    const k = it.kind === 'm' ? 'mishna' : it.iyun ? 'iyun' : it.moed ? 'moed' : 'parasha';
    let ti = null, se = null;
    try { ti = A.fullName(it); se = A.seriesName(it); } catch {}
    return { i: id, k, ti, se };
  }
  const nowInfo = () => info(A && A.getNowId && A.getNowId());

  function finishListen() {
    if (cur) { doneListens.push(cur); cur = null; }
  }
  function startListen(id) {
    finishListen();
    const a = A.audio, ct = a.currentTime || 0;
    const from = A.getNowFrom ? A.getNowFrom() : 'direct';
    cur = Object.assign({ id, lid: rid(), st: Date.now(), t: Date.now(), d: 0, sp: ct, mp: ct, du: a.duration || 0,
      spd: a.playbackRate || 1, c: false, cSent: false, r: ct > 5, src: from, sent: false, lastCT: ct, lastTS: Date.now(), lastRate: a.playbackRate || 1, buckets: new Map() }, info(id));
    delete cur.i;
  }

  function sampleAudio() {
    if (!cur || !A || A.getNowId() !== cur.id) return;
    const a = A.audio, now = Date.now(), ct = a.currentTime || 0;
    const diff = ct - cur.lastCT, rate = cur.lastRate || 1;
    const elapsed = Math.max(0, (now - cur.lastTS) / 1000);
    // A seek is not listening. Accept delayed background events when actual elapsed time permits them.
    if (diff > 0 && diff <= elapsed * rate + 1 && !a.seeking) {
      const wall = diff / rate;
      let from = now - wall * 1000;
      while (from < now) {
        const end = Math.min(now, (Math.floor(from / 3600000) + 1) * 3600000);
        const w = (end - from) / 1000, key = Math.floor(from / 3600000) + ':' + rate;
        const g = cur.buckets.get(key) || { ts: Math.floor(from / 3600000) * 3600000, d: 0, w: 0, spd: rate };
        g.d += w * rate; g.w += w; cur.buckets.set(key, g);
        cur.d += w * rate; from = end;
      }
    }
    cur.lastCT = ct; cur.lastTS = now; cur.lastRate = a.playbackRate || 1;
    cur.mp = Math.max(cur.mp, ct);
    if (a.duration && isFinite(a.duration)) cur.du = a.duration;
    cur.spd = a.playbackRate || 1; cur.t = now;
    if (cur.du && ct / cur.du >= 0.9) cur.c = true;
  }
  function hookAudio() {
    const a = A.audio;
    a.addEventListener('playing', () => {
      const rotated = ensureSession(), id = A.getNowId();
      if (!id) return;
      if (rotated) pageview(true);
      if (!cur || cur.id !== id || (cur.c && (a.currentTime || 0) < 5)) startListen(id);
      else { cur.lastCT = a.currentTime; cur.lastTS = Date.now(); cur.lastRate = a.playbackRate || 1; }
      if (visibleSince == null && document.visibilityState === 'visible') visibleSince = Date.now();
    });
    a.addEventListener('timeupdate', sampleAudio);
    for (const ev of ['seeking', 'seeked']) a.addEventListener(ev, () => {
      if (cur) { cur.lastCT = a.currentTime; cur.lastTS = Date.now(); }
    });
    a.addEventListener('pause', () => { sampleAudio(); flush(); });
    a.addEventListener('ended', () => { sampleAudio(); if (cur) { cur.c = true; cur.mp = cur.du || cur.mp; } finishListen(); flush(); });
    a.addEventListener('emptied', () => { if (cur && A.getNowId() !== cur.id) finishListen(); });
    a.addEventListener('error', () => { const e = a.error; track('error', Object.assign(nowInfo(), { l: 'audio' + (e ? ':' + e.code : '') })); });
    a.addEventListener('ratechange', () => { sampleAudio(); flush(); });
    if (isPlaying()) startListen(A.getNowId());
  }

  // ---------- לחיצות ----------
  let moreFor = null;
  window.addEventListener('click', e => {
    lastInput = Date.now();
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const c = s => t.closest(s);
    const m = c('[data-more]'); if (m) { moreFor = m.dataset.more; return; }
    const mi = c('#menu [data-m]');
    if (mi) {
      const map = { next: 'queue_add', queue: 'queue_add', fav: 'favorite', feedback: 'comments_open' };
      if (map[mi.dataset.m]) track(map[mi.dataset.m], Object.assign(info(moreFor), { l: mi.dataset.m }));
      return;
    }
    const cm = c('[data-comments]'); if (cm) { track('comments_open', info(cm.dataset.comments || (A && A.getNowId()))); return; }
    if (c('[data-feedback]')) { track('comments_open', nowInfo()); return; }
    if (c('#npDownload') || c('#dock [data-act=download]')) { track('download', nowInfo()); return; }
    if (c('#npShare')) { track('share', nowInfo()); return; }
    if (c('#npTextBtn') || c('#dock [data-act=study]') || c('.np-tabs [data-pane=text]')) { track('text_open', nowInfo()); return; }
    const sf = c('#npSefaria') || c('[data-act=sefaria]');
    if (sf) { track(/\.pdf/i.test(sf.getAttribute('href') || '') ? 'pdf_open' : 'sefaria_open', nowInfo()); return; }
    const pdf = c('a.pdf') || c('a[href*=".pdf"]'); if (pdf) { track('pdf_open', nowInfo()); return; }
    if (c('#installBtn')) { track('install_click'); return; }
    if (c('#contactOpen')) { track('contact_open'); return; }
    if (c('#barSpeed') || c('#npSpeed')) { setTimeout(() => track('speed_change', Object.assign(nowInfo(), { n: A && A.audio ? A.audio.playbackRate : null })), 50); return; }
    if (c('#npCont')) { track('cont_on'); return; }
    const out = c('a[href^="http"]');
    if (out) { try { const u = new URL(out.href); if (u.host !== location.host) track('outbound', { l: u.host }); } catch {} }
  }, true);

  // ---------- חיפוש ----------
  let searchT = null, lastSearch = '';
  document.addEventListener('input', e => {
    if (!e.target || e.target.id !== 'q') return;
    clearTimeout(searchT);
    const v = String(e.target.value || '').trim();
    searchT = setTimeout(() => {
      if (v.length < 2 || v === lastSearch) return;
      lastSearch = v;
      const results = document.querySelectorAll('#res > *').length;
      track('search', { l: v.slice(0, 120), n: results });
    }, 1500);
  }, true);

  // ---------- פעילות, מעבר בין דפים, יציאה ----------
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel']) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  addEventListener('hashchange', () => pageview());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { accrueActive(); visibleSince = null; flush(true); }
    else {
      const rotated = ensureSession();
      visibleSince = Date.now(); lastInput = Date.now();
      if (rotated) pageview(true);
    }
  });
  addEventListener('pagehide', () => { sampleAudio(); finishListen(); flush(true); });
  addEventListener('pageshow', e => { if (e.persisted && A && isPlaying()) { ensureSession(); startListen(A.getNowId()); } void deliver(); });
  addEventListener('online', () => { retryAt = 0; void deliver(); });
  addEventListener('appinstalled', () => track('app_installed'));
  setInterval(() => {
    const engaged = isPlaying() || (visibleSince != null && Date.now() - lastInput < ACTIVE_GRACE);
    if (engaged) ensureSession();
    if (engaged || evq.length || doneListens.length) flush();
    else void deliver();
  }, 30e3);

  // התחלה
  recoverPackets();
  ensureSession();
  pageview(true);
  setTimeout(() => flush(), 4000);
  whenApp(app => { A = app; if (A.audio) hookAudio(); });

  window.SHIURIM_ANALYTICS = { visitorId: vid, track, flush: () => flush(), get sessionId() { return S && S.id; } };
})();
