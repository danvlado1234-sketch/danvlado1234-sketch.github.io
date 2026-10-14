/* גרסת בטא: הנתונים חיים מ-list.json של שני האתרים (אותו דומיין), במקום תמונת המצב של ההדמיה.
   אותו פענוח כמו tools/snapshot.py. בסוף — טוען את app.js. */
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
    const y = toks[yi];
    parasha.push({ t: toks.slice(0, yi).join(' '), moed, book: moed ? parts[1] : parts[0], y: y.slice(0, -1) + '"' + y.slice(-1),
      tag: rest.join(' '), iyun, f: path, d: pUp[path] || null, pdf: pdfs.has(path.replace(/\.[^.]+$/, '.pdf')) });
  }
  window.SNAP = { mishna, parasha };
  const s = document.createElement('script'); s.src = 'app.js?v=' + (window.BETA_V || ''); document.body.append(s);
})();
