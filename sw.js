// ============================================================
//  Service Worker של האפליקציה המאוחדת ("שיעורי הרב")
//  חל על כל האתר (scope "/"): דף השער ושיעורי המשנה. לאתר הפרשות יש
//  service worker משלו (/shiurim-parasha/sw.js), והוא גובר בתיקייה שלו -
//  לכן כאן לא נוגעים בדפי הפרשות.
//  - הדפים ורשימות ה-JSON: קודם מהרשת (תמיד הגרסה העדכנית), ורק אם אין
//    רשת - מהעותק השמור. לכן כל עדכון מופיע מיד.
//  - תמונות, אייקונים וגופנים: מהעותק השמור, ומתעדכנים ברקע.
//  - קובצי השמע (R2) וטקסט המשנה (ספריא) לא עוברים כאן בכלל - ישר לרשת.
// ============================================================
const CACHE = 'shiurim-v1';
const CORE = ['/', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // מוחקים רק גרסאות ישנות של המטמון הזה - לא את של הפרשות
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('shiurim-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// מפתח קבוע בלי פרמטרים (?m=ברכות, ?t=123): כל כתובות האתר הן אותו דף
function cacheKey(req){
  const url = new URL(req.url);
  if (url.origin === self.location.origin) url.search = '';
  return url.href;
}

async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(cacheKey(req), res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey(req)) || (req.mode === 'navigate' && await cache.match('/'));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
  if (hit){ refresh.catch(() => {}); return hit; }
  return refresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (/\.(m4a|mp3|mp4|pdf)$/i.test(url.pathname)) return;
  if (sameOrigin && req.mode === 'navigate' && url.pathname.toLowerCase().startsWith('/shiurim-parasha/')) return;
  if (req.mode === 'navigate' || (sameOrigin && /\.(json|html|webmanifest)$|\/$/.test(url.pathname))){
    e.respondWith(networkFirst(req));
  } else if (sameOrigin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(cacheFirst(req));
  }
  // כל השאר (קובצי השמע בענן, ספריא) - בלי התערבות
});
