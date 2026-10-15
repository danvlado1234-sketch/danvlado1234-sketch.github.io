/* הנתונים החיים: list.json + uploads.json של שני הריפואים (אותו דומיין) → window.SNAP, ואז טוען את app.js.
   זה הפענוח של שמות הקבצים באתר (מה שהיה parseFilename ב-index.html של האתרים הקודמים) — חייב להתאים
   ל-upload.ps1 בשני הריפואים. רשימת המועדים — ALL_MOADIM ב-app.js, זהה ל-$MOADIM ב-upload.ps1. */
(async () => {
  const ROOT = new URLSearchParams(location.search).get('root') || '/'; // ?root= לבדיקה מקומית
  const get = p => fetch(ROOT + p, { cache: 'no-cache' }).then(r => r.ok ? r.json() : (p.endsWith('uploads.json') ? {} : []));
  const [mList, mUp, pList, pUp] = await Promise.all([
    get('Shiurim-mishnhyot/list.json'), get('Shiurim-mishnhyot/uploads.json'),
    get('shiurim-parasha/list.json'), get('shiurim-parasha/uploads.json'),
  ]);
  const GEM = { 'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10, 'כ': 20, 'ל': 30 };
  const hebNum = s => [...s.replace(/['"]/g, '')].reduce((a, c) => a + (GEM[c] || 0), 0);

  const mishna = [];
  for (const path of mList) {
    if (!/\.(m4a|mp3)$/.test(path)) continue;
    const name = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/^_+|_+$/g, '');
    const m = name.match(/^(.+?)_פרק_([א-ת]+)_משנה_(.+)$/);
    if (!m) continue;
    const nums = m[3].split(/[,_]+/).filter(Boolean).map(hebNum).filter(Boolean);
    mishna.push({ m: m[1].replace(/_/g, ' '), p: hebNum(m[2]), n: nums, f: path, d: mUp[path] || null });
  }

  // פרשה שנקראת לבד בשנה פשוטה (ויקהל) — באותו דף כמו המחוברת (ויקהל פקודי). זהה ל-$PAIRS ב-upload.ps1.
  const PAIRS = [['ויקהל', 'פקודי'], ['תזריע', 'מצורע'], ['אחרי מות', 'קדושים'], ['בהר', 'בחוקותי'], ['מטות', 'מסעי'], ['נצבים', 'וילך']];
  const pageKey = t => { const p = PAIRS.find(p => t === p[0] || t === p[1]); return p ? p.join(' ') : t; };
  const pdfs = new Set(pList.filter(x => x.endsWith('.pdf')));
  const parasha = [];
  for (const path of pList) {
    if (!/\.(m4a|mp3)$/.test(path)) continue;
    const parts = path.split('/'), moed = parts[0] === 'מועדים';
    let toks = parts.at(-1).replace(/\.[^.]+$/, '').split('_');
    if (!moed) toks = toks.slice(1);
    const yi = toks.findIndex(t => /^תש[פ-ת][א-ט]?$/.test(t));
    if (yi < 0) continue;
    let rest = toks.slice(yi + 1), iyun = null;
    const k = rest.indexOf('עיון');
    if (k >= 0) { iyun = rest.slice(k + 1).join(' ').replace(/''/g, '"'); rest = rest.slice(0, k); }
    const y = toks[yi], t = toks.slice(0, yi).join(' '), key = moed ? t : pageKey(t);
    parasha.push({ t: key, moed, book: moed ? parts[1] : parts[0], y: y.slice(0, -1) + '"' + y.slice(-1),
      tag: [key !== t ? t : '', ...rest].filter(Boolean).join(' '), iyun, f: path, d: pUp[path] || null, pdf: pdfs.has(path.replace(/\.[^.]+$/, '.pdf')) });
  }
  window.SNAP = { mishna, parasha };
  const s = document.createElement('script'); s.src = 'app.js?v=' + (window.APP_V || ''); document.body.append(s);
})();
