/* הנתונים החיים: list.json + uploads.json של שני הריפואים (אותו דומיין) → window.SNAP, ואז טוען את app.js.
   זה הפענוח של שמות הקבצים באתר (מה שהיה parseFilename ב-index.html של האתרים הקודמים) — חייב להתאים
   ל-upload.ps1 בשני הריפואים. רשימת המועדים — ALL_MOADIM ב-app.js, זהה ל-$MOADIM ב-upload.ps1. */
(async () => {
  // מקור חלופי הוא כלי לפיתוח מקומי בלבד, ותמיד מאותו שרת.
  const ROOT = (() => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return '/';
    const root = new URLSearchParams(location.search).get('root');
    if (!root) return '/';
    try {
      const url = new URL(root, location.href);
      return url.origin === location.origin ? url.pathname.replace(/\/?$/, '/') : '/';
    } catch { return '/'; }
  })();
  // כל רשימה נטענת בנפרד: כשל באחת (רשת חלשה) לא עוצר את כל האתר — ממשיכים עם מה שיש
  const failed = [];
  const get = p => fetch(ROOT + p, { cache: 'no-cache' }).then(r => { if (!r.ok) throw r.status; return r.json(); })
    .catch(() => { failed.push(p); return p.endsWith('list.json') ? [] : {}; });
  const [mList, mUp, pList, pUp, pVer] = await Promise.all([
    get('Shiurim-mishnhyot/list.json'), get('Shiurim-mishnhyot/uploads.json'),
    get('shiurim-parasha/list.json'), get('shiurim-parasha/uploads.json'), get('shiurim-parasha/pdf-versions.json'),
  ]);
  if (failed.includes('Shiurim-mishnhyot/list.json') && failed.includes('shiurim-parasha/list.json')) {
    document.getElementById('view').innerHTML = `<div class="view-in"><h1 class="page-title">השיעורים לא נטענו</h1>
      <p class="note">כנראה אין כרגע חיבור לאינטרנט, או שהוא חלש. <a href="" style="text-decoration:underline">לנסות שוב</a></p></div>`;
    return;
  }
  const GEM = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ל': 30 };
  const hebNum = s => [...s.replace(/['"]/g, '')].reduce((a, c) => a + (GEM[c] || 0), 0);

  const mishna = [];
  for (const path of mList) {
    if (!/\.(m4a|mp3)$/.test(path)) continue;
    const name = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/^_+|_+$/g, '');
    const m = name.match(/^(.+?)_פרק_([א-ת]+)_משנה_(.+)$/);
    const legacy = !m && name.match(/^(.+?)_(\d+)_(\d+)(?:_.*)?$/);
    if (!m && !legacy) continue;
    const nums = (m ? m[3].split(/[,_-]+/).filter(Boolean).map(hebNum) : [+legacy[3]]).filter(n => n > 0);
    const perek = m ? hebNum(m[2]) : +legacy[2];
    if (!perek || !nums.length) continue;
    mishna.push({ m: (m || legacy)[1].replace(/_/g, ' '), p: perek, n: nums, f: path, d: mUp[path] || null });
  }

  // פרשה שנקראת לבד בשנה פשוטה (ויקהל) — באותו דף כמו המחוברת (ויקהל פקודי). זהה ל-$PAIRS ב-upload.ps1.
  const PAIRS = [['ויקהל', 'פקודי'], ['תזריע', 'מצורע'], ['אחרי מות', 'קדושים'], ['בהר', 'בחוקותי'], ['מטות', 'מסעי'], ['נצבים', 'וילך']];
  const pageKey = t => { const p = PAIRS.find(p => t === p[0] || t === p[1]); return p ? p.join(' ') : t; };
  // איות חלופי בשם הקובץ → השם שברשימת הפרשות (CHUMASH ב-app.js)
  const SPELL = { 'חקת': 'חוקת', 'פנחס': 'פינחס' };
  const pdfs = new Set(pList.filter(x => x.endsWith('.pdf')));
  const parasha = [];
  for (const path of pList) {
    if (!/\.(m4a|mp3)$/.test(path)) continue;
    const parts = path.split('/'), moed = parts[0] === 'מועדים';
    let toks = parts[parts.length - 1].replace(/\.[^.]+$/, '').split('_');
    if (toks[0] === 'פרשת' || toks[0] === 'מועד') toks = toks.slice(1);
    // השנה באה אחרי שם השיעור; "תשעה" ב"תשעה באב" אינה שנה.
    const yi = toks.findIndex((t, i) => i > 0 && /^תש[א-ת]{0,3}$/.test(t));
    if (yi < 0) continue;
    let rest = toks.slice(yi + 1), iyun = null;
    const k = rest.indexOf('עיון');
    if (k >= 0) { iyun = rest.slice(k + 1).join(' ').replace(/''/g, '"') || 'שיעור עיון'; rest = rest.slice(0, k); }
    const y = toks[yi], t0 = toks.slice(0, yi).join(' '), t = SPELL[t0] || t0, key = moed ? t : pageKey(t);
    // pv = גרסת ה-PDF (pdf-versions.json, מ-upload.ps1) — נכנסת לקישור, כדי שסיכום שהוחלף לא ייפתח מהמטמון
    const pdf = path.replace(/\.[^.]+$/, '.pdf');
    parasha.push({ t: key, moed, book: moed ? parts[1] : parts[0], y: y.slice(0, -1) + '"' + y.slice(-1),
      tag: [key !== t ? t : '', ...rest].filter(Boolean).join(' '), iyun, f: path, d: pUp[path] || null, pdf: pdfs.has(pdf) ? pdf : null, pv: pVer[pdf] || null });
  }
  window.SNAP = { mishna, parasha, failed };
  const s = document.createElement('script'); s.src = 'app.js?v=' + (window.APP_V || ''); document.body.append(s);
})();
