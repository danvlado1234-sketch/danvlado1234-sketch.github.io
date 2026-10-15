/* שיעורי הרב — האתר. העיצוב: הסטודיו (design-studio/projects/shiurim/mocks/stream). הנתונים: live.js (list.json החי),
   הקול: R2, טקסט המשנה: ספריא. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = 'i') => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;

  // ---------- כריכות (Unsplash — רק גיבוי אם gen.js לא נטען) ----------
  // gen:<id> = כריכה שנוצרה (סגנון ב) · אחרת — צילום Unsplash
  const IMG = (id, w = 800, h) => id.startsWith('gen:') ? `covers/img/series/${id.slice(4)}.jpg` : `https://images.unsplash.com/photo-${id}?w=${w}${h ? `&h=${h}` : ''}&q=72&auto=format&fit=crop`;
  const ART = {
    // מסכתות
    'ברכות': '1609970774353-3e2ee33d8cb3', 'פאה': '1594842059196-5b6b8fa73187', 'דמאי': '1488459716781-31db52582fe9',
    'כלאים': '1637181156153-bedd1098f8c1', 'שביעית': '1698036867785-a8aeb0f59c48', 'זבחים': '1625119161833-57f8a7009f7b',
    'בכורות': '1554755209-85e44182e019', 'ערכין': '1606385838720-5ff10ab1d32b',
    // פרשות
    'בראשית': '1531874993088-51b60dda4452', 'נח': '1584820537082-8e19daff36bd', 'דברים': '1547235001-d703406d3f17',
    'ואתחנן': '1538426923164-6869f58ccae5', 'עקב': '1646684662890-a5076aef9010', 'ראה': '1563514227147-6d2ff665a6a0',
    'שופטים': '1522442676585-c751dab71864', 'כי תצא': '1470093014438-2ede8d7a4818', 'כי תבוא': '1609780447631-05b93e5a88ea',
    'נצבים וילך': '1470240731273-7821a6eeb6bd', 'האזינו': '1488866022504-f2584929ca5f', 'וזאת הברכה': '1588406320565-9fa6d9901d1d',
    // מועדים
    'חנוכה': '1701187260247-fef58f0ba2a7', 'יום כיפור': '1601922046210-41e129a3e64a', 'לג בעומר': '1569430251091-da3b108cff29',
    'סוכות': '1701190092059-7424fcf38a8e', 'פורים': '1536675572774-1b66ac2e26e9', 'פסח': '1547234935-80c7145ec969',
    'ראש השנה': '1574709755254-fcd942d09d5a', 'שבועות': '1618468355232-88a329df0182', 'שמחת תורה': '1595123550441-d377e017de6a',
    'תשעה באב': '1760183439136-d2949909c1ff',
  };
  const SEDER_ART = { 'זרעים': '1529511582893-2d7e684dd128', 'מועד': '1561212856-44e9bae482aa', 'נשים': '1592290435338-682c400cb6f8',
    'נזיקין': '1544475925-9199e8ed85ab', 'קדשים': '1539978411915-9f883018db6e', 'טהרות': '1501691223387-dd0500403074' };
  const SEDER_TINT = { 'זרעים': 'oklch(0.55 0.12 95)', 'מועד': 'oklch(0.45 0.12 260)', 'נשים': 'oklch(0.48 0.14 350)',
    'נזיקין': 'oklch(0.45 0.05 230)', 'קדשים': 'oklch(0.47 0.15 25)', 'טהרות': 'oklch(0.5 0.08 195)' };
  const FALLBACK = 'gen:daybg-sky';
  // שלט/כותרת רחבה: גרסה רחבה שנוצרה, אם יש; אחרת הכריכה
  const HERO = (a, w = 1800) => a.startsWith('gen:') && (window.GENW || []).includes(a.slice(4)) ? `covers/img/series/wide-${a.slice(4)}.jpg` : IMG(a, w);
  const MART = {}; // כריכות מסכתות (נפרד: "שבועות" ו"ראש השנה" הם גם מסכת וגם מועד)
  for (const [k, id] of Object.entries(window.GEN || {})) {
    if (k.startsWith('סדר:')) SEDER_ART[k.slice(4)] = 'gen:' + id; else if (k.startsWith('מסכת:')) MART[k.slice(5)] = 'gen:' + id; else ART[k] = 'gen:' + id;
  }
  const mArt = n => MART[n] || ART[n];
  const artOf = it => ((window.GENL || {})[it.id] ? 'gen:' + window.GENL[it.id] : null) || (it.kind === 'm' ? mArt(it.masechet) : ART[it.title]) || SEDER_ART[it.seder] || FALLBACK;

  // ---------- המשנה ----------
  const SEDARIM = [
    ['זרעים', ['ברכות','פאה','דמאי','כלאים','שביעית','תרומות','מעשרות','מעשר שני','חלה','ערלה','ביכורים']],
    ['מועד', ['שבת','עירובין','פסחים','שקלים','יומא','סוכה','ביצה','ראש השנה','תענית','מגילה','מועד קטן','חגיגה']],
    ['נשים', ['יבמות','כתובות','נדרים','נזיר','סוטה','גיטין','קידושין']],
    ['נזיקין', ['בבא קמא','בבא מציעא','בבא בתרא','סנהדרין','מכות','שבועות','עדיות','עבודה זרה','אבות','הוריות']],
    ['קדשים', ['זבחים','מנחות','חולין','בכורות','ערכין','תמורה','כריתות','מעילה','תמיד','מידות','קינים']],
    ['טהרות', ['כלים','אהלות','נגעים','פרה','טהרות','מקוואות','נדה','מכשירין','זבים','טבול יום','ידים','עוקצין']],
  ];
  const PEREK_COUNTS = { 'ברכות':9,'פאה':8,'דמאי':7,'כלאים':9,'שביעית':10,'תרומות':11,'מעשרות':5,'מעשר שני':5,'חלה':4,'ערלה':3,'ביכורים':4,
    'שבת':24,'עירובין':10,'פסחים':10,'שקלים':8,'יומא':8,'סוכה':5,'ביצה':5,'ראש השנה':4,'תענית':4,'מגילה':4,'מועד קטן':3,'חגיגה':3,
    'יבמות':16,'כתובות':13,'נדרים':11,'נזיר':9,'סוטה':9,'גיטין':9,'קידושין':4,'בבא קמא':10,'בבא מציעא':10,'בבא בתרא':10,'סנהדרין':11,
    'מכות':3,'שבועות':8,'עדיות':8,'עבודה זרה':5,'אבות':6,'הוריות':3,'זבחים':14,'מנחות':13,'חולין':12,'בכורות':9,'ערכין':9,'תמורה':7,
    'כריתות':6,'מעילה':6,'תמיד':7,'מידות':5,'קינים':3,'כלים':30,'אהלות':18,'נגעים':14,'פרה':12,'טהרות':10,'מקוואות':10,'נדה':10,
    'מכשירין':6,'זבים':5,'טבול יום':4,'ידים':4,'עוקצין':3 };
  // השם בספריא (Mishnah_<מסכת>; אבות — Pirkei_Avot)
  const SEFARIA = { 'ברכות':'Mishnah_Berakhot','פאה':'Mishnah_Peah','דמאי':'Mishnah_Demai','כלאים':'Mishnah_Kilayim','שביעית':'Mishnah_Sheviit','תרומות':'Mishnah_Terumot','מעשרות':'Mishnah_Maasrot','מעשר שני':'Mishnah_Maaser_Sheni','חלה':'Mishnah_Challah','ערלה':'Mishnah_Orlah','ביכורים':'Mishnah_Bikkurim','שבת':'Mishnah_Shabbat','עירובין':'Mishnah_Eruvin','פסחים':'Mishnah_Pesachim','שקלים':'Mishnah_Shekalim','יומא':'Mishnah_Yoma','סוכה':'Mishnah_Sukkah','ביצה':'Mishnah_Beitzah','ראש השנה':'Mishnah_Rosh_Hashanah','תענית':'Mishnah_Taanit','מגילה':'Mishnah_Megillah','מועד קטן':'Mishnah_Moed_Katan','חגיגה':'Mishnah_Chagigah','יבמות':'Mishnah_Yevamot','כתובות':'Mishnah_Ketubot','נדרים':'Mishnah_Nedarim','נזיר':'Mishnah_Nazir','סוטה':'Mishnah_Sotah','גיטין':'Mishnah_Gittin','קידושין':'Mishnah_Kiddushin','בבא קמא':'Mishnah_Bava_Kamma','בבא מציעא':'Mishnah_Bava_Metzia','בבא בתרא':'Mishnah_Bava_Batra','סנהדרין':'Mishnah_Sanhedrin','מכות':'Mishnah_Makkot','שבועות':'Mishnah_Shevuot','עדיות':'Mishnah_Eduyot','עבודה זרה':'Mishnah_Avodah_Zarah','אבות':'Pirkei_Avot','הוריות':'Mishnah_Horayot','זבחים':'Mishnah_Zevachim','מנחות':'Mishnah_Menachot','חולין':'Mishnah_Chullin','בכורות':'Mishnah_Bekhorot','ערכין':'Mishnah_Arakhin','תמורה':'Mishnah_Temurah','כריתות':'Mishnah_Keritot','מעילה':'Mishnah_Meilah','תמיד':'Mishnah_Tamid','מידות':'Mishnah_Middot','קינים':'Mishnah_Kinnim','כלים':'Mishnah_Kelim','אהלות':'Mishnah_Oholot','נגעים':'Mishnah_Negaim','פרה':'Mishnah_Parah','טהרות':'Mishnah_Tahorot','מקוואות':'Mishnah_Mikvaot','נדה':'Mishnah_Niddah','מכשירין':'Mishnah_Makhshirin','זבים':'Mishnah_Zavim','טבול יום':'Mishnah_Tevul_Yom','ידים':'Mishnah_Yadayim','עוקצין':'Mishnah_Oktzin' };
  const ABOUT = {
    'ברכות': 'קריאת שמע, תפילה וברכות — מה אומרים, מתי, ועל מה.',
    'פאה': 'מתנות עניים: פאה, לקט, שכחה ופרט — החלק של העני בשדה.',
    'דמאי': 'פירות שקונים מעם הארץ, ואין ידוע אם הופרשו מהם תרומות ומעשרות.',
    'כלאים': 'איסור הרכבת מינים — בזרעים, בכרם, בבהמה ובבגד.',
    'שביעית': 'שנת השמיטה: עבודת הארץ, קדושת הפירות ושמיטת כספים.',
    'זבחים': 'סדר עבודת הקרבנות — שחיטה, קבלה, הולכה וזריקה, ומה פוסל אותן.',
    'בכורות': 'בכור אדם ובכור בהמה — קדושתם, פדיונם ומומיהם.',
    'ערכין': 'הנודר "ערכי עליי" — כמה נותן להקדש, לפי גיל ומין, ולא לפי שווי.',
  };
  const sederOf = {};
  for (const [s, ms] of SEDARIM) for (const m of ms) sederOf[m] = s;

  const HEB = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'];
  const heb = n => HEB[n] || String(n);

  // ---------- מועדים — לפי הקרוב (תשפ"ז) ----------
  const MOED_NAME = { 'לג בעומר': 'ל״ג בעומר', 'טו בשבט': 'ט״ו בשבט' };
  // כל מועד — לפי הקרוב (מועד שהתחיל לפני עד שבוע עדיין בראש). תאריכי ההתחלה: Hebcal, ארץ ישראל, עד 2032 (scratchpad: moadim.json)
  const MOED_DATES = '2026-09-12|ראש השנה;2026-09-21|יום כיפור;2026-09-26|סוכות;2026-10-03|שמחת תורה;2026-12-04|חנוכה;2026-12-20|עשרה בטבת;2027-01-23|טו בשבט;2027-03-22|תענית אסתר;2027-03-23|פורים;2027-04-22|פסח;2027-05-25|לג בעומר;2027-06-11|שבועות;2027-07-22|שבעה עשר בתמוז;2027-08-12|תשעה באב;2027-10-02|ראש השנה;2027-10-11|יום כיפור;2027-10-16|סוכות;2027-10-23|שמחת תורה;2027-12-24|חנוכה;2028-01-09|עשרה בטבת;2028-02-12|טו בשבט;2028-03-09|תענית אסתר;2028-03-12|פורים;2028-04-11|פסח;2028-05-14|לג בעומר;2028-05-31|שבועות;2028-07-11|שבעה עשר בתמוז;2028-08-01|תשעה באב;2028-09-21|ראש השנה;2028-09-30|יום כיפור;2028-10-05|סוכות;2028-10-12|שמחת תורה;2028-12-12|חנוכה;2028-12-28|עשרה בטבת;2029-01-31|טו בשבט;2029-02-28|תענית אסתר;2029-03-01|פורים;2029-03-31|פסח;2029-05-03|לג בעומר;2029-05-20|שבועות;2029-07-01|שבעה עשר בתמוז;2029-09-10|ראש השנה;2029-09-19|יום כיפור;2029-09-24|סוכות;2029-10-01|שמחת תורה;2029-12-01|חנוכה;2029-12-16|עשרה בטבת;2030-01-19|טו בשבט;2030-03-18|תענית אסתר;2030-03-19|פורים;2030-04-18|פסח;2030-05-21|לג בעומר;2030-06-07|שבועות;2030-07-18|שבעה עשר בתמוז;2030-08-08|תשעה באב;2030-09-28|ראש השנה;2030-10-07|יום כיפור;2030-10-12|סוכות;2030-10-19|שמחת תורה;2030-12-20|חנוכה;2031-01-05|עשרה בטבת;2031-02-08|טו בשבט;2031-03-06|תענית אסתר;2031-03-09|פורים;2031-04-08|פסח;2031-05-11|לג בעומר;2031-05-28|שבועות;2031-07-08|שבעה עשר בתמוז;2031-07-29|תשעה באב;2031-09-18|ראש השנה;2031-09-27|יום כיפור;2031-10-02|סוכות;2031-10-09|שמחת תורה;2031-12-09|חנוכה;2031-12-25|עשרה בטבת;2032-01-28|טו בשבט;2032-02-25|תענית אסתר;2032-02-26|פורים;2032-03-27|פסח;2032-04-29|לג בעומר;2032-05-16|שבועות;2032-06-27|שבעה עשר בתמוז;2032-09-06|ראש השנה;2032-09-15|יום כיפור;2032-09-20|סוכות;2032-09-27|שמחת תורה;2032-11-27|חנוכה;2032-12-12|עשרה בטבת'.split(';').map(x => x.split('|'));
  const MOED_NEXT = (() => { const n = new Date(), t = new Date(n - 7 * 864e5 - n.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), first = {};
    for (const [d, m] of MOED_DATES) if (d >= t && !first[m]) first[m] = d;
    return Object.keys(first).sort((x, y) => first[x].localeCompare(first[y])); })();
  const MOED_MONTH = { 'חנוכה':'כסלו','פורים':'אדר','פסח':'ניסן','לג בעומר':'אייר','שבועות':'סיון','תשעה באב':'אב','ראש השנה':'תשרי','יום כיפור':'תשרי','סוכות':'תשרי','שמחת תורה':'תשרי', 'עשרה בטבת':'טבת', 'טו בשבט':'שבט', 'תענית אסתר':'אדר', 'שבעה עשר בתמוז':'תמוז' };
  const BOOK_ORDER = ['בראשית','שמות','ויקרא','במדבר','דברים'];

  // ---------- מודל ----------
  const MBASE = 'https://pub-ebfc0fe34f6e49f5a45ba2d358d2ae0d.r2.dev';
  const PBASE = 'https://pub-c502103793ec448b9964b8779d053cd4.r2.dev';
  const enc = p => p.split('/').map(encodeURIComponent).join('/');
  const SNAP = window.SNAP;
  const items = [];
  for (const x of SNAP.mishna) items.push({ kind: 'm', id: x.f, masechet: x.m, seder: sederOf[x.m], perek: x.p, nums: x.n, date: x.d, url: `${MBASE}/${enc(x.f)}` });
  for (const x of SNAP.parasha) items.push({ kind: 'p', id: x.f, title: x.t, moed: x.moed, book: x.book, year: x.y, tag: x.tag, iyun: x.iyun, date: x.d, pdf: x.pdf ? `${PBASE}/${enc(x.f.replace(/\.m4a$/, '.pdf'))}` : null, url: `${PBASE}/${enc(x.f)}` });
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const mItems = items.filter(i => i.kind === 'm').sort((a, b) => a.masechet === b.masechet ? (a.perek - b.perek || a.nums[0] - b.nums[0]) : 0);
  const masechet = {};
  for (const it of mItems) {
    const s = masechet[it.masechet] ||= { name: it.masechet, seder: it.seder, items: [], perakim: {} };
    s.items.push(it);
    (s.perakim[it.perek] ||= []).push(it);
  }
  for (const s of Object.values(masechet)) s.last = s.items.reduce((m, i) => (i.date || '') > m ? i.date : m, '');
  const pItems = items.filter(i => i.kind === 'p');
  const groups = {};
  for (const it of pItems) (groups[it.title] ||= { title: it.title, moed: it.moed, book: it.book, items: [] }).items.push(it);
  for (const g of Object.values(groups)) g.items.sort((a, b) => b.year.localeCompare(a.year) || (a.iyun ? 1 : 0) - (b.iyun ? 1 : 0) || a.tag.localeCompare(b.tag));

  const seriesName = it => it.kind === 'm' ? it.masechet : it.moed ? (MOED_NAME[it.title] || it.title) : `פרשת ${it.title}`;
  const epName = it => {
    if (it.kind === 'm') return `פרק ${heb(it.perek)} · משנה ${it.nums.map(heb).join('–')}`;
    if (it.iyun) return it.iyun;
    return [it.year, it.tag].filter(Boolean).join(' · ');
  };
  const fullName = it => it.kind === 'm' ? `${it.masechet} ${heb(it.perek)}, ${it.nums.map(heb).join('–')}` : (it.iyun ? `${seriesName(it)}: ${it.iyun}` : `${seriesName(it)} ${epName(it)}`);
  const seriesHref = it => it.kind === 'm' ? `#/m/${encodeURIComponent(it.masechet)}/${it.perek}` : `#/p/${encodeURIComponent(it.title)}`;

  // ---------- תאריכים ----------
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = d => d ? Math.round((today - new Date(d + 'T00:00:00')) / 864e5) : 9999;
  const MONTHS = ['בינואר','בפברואר','במרץ','באפריל','במאי','ביוני','ביולי','באוגוסט','בספטמבר','באוקטובר','בנובמבר','בדצמבר'];
  const rel = d => { const n = days(d); if (!d) return ''; if (n <= 0) return 'עלה היום'; if (n === 1) return 'עלה אתמול'; if (n < 7) return `עלה לפני ${n} ימים`; const x = new Date(d); return `עלה ב-${x.getDate()} ${MONTHS[x.getMonth()]}`; };
  const maxDate = items.reduce((m, i) => (i.date || '') > m ? i.date : m, '');
  const isNew = it => it.date && days(it.date) <= 7;

  // ---------- זיכרון מקומי ----------
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('stream.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('stream.' + k, JSON.stringify(v)); } catch {} } };
  const params = new URLSearchParams(location.search);
  let building = null; // {name, ids} — רשימה בבנייה
  // המשך האזנה מהאתרים הקודמים (אותו דומיין): mishna:progress / parasha:progress → prog, פעם אחת
  if (!store.get('migrated')) {
    const old = {};
    for (const k of ['mishna:progress', 'parasha:progress']) { try { Object.assign(old, JSON.parse(localStorage.getItem(k)) || {}); } catch {} }
    const p0 = store.get('prog', {});
    for (const [id, v] of Object.entries(old)) if (v && v.d && !p0[id]) p0[id] = [v.done ? v.d : (v.t || 0), v.d, v.at || 0];
    store.set('prog', p0); store.set('migrated', true);
  }
  let prog = store.get('prog', {});
  const fracOf = id => { const p = prog[id]; return p && p[1] ? p[0] / p[1] : 0; };
  const inProgress = () => Object.keys(prog).filter(id => byId[id] && fracOf(id) > 0.02 && fracOf(id) < 0.95).sort((a, b) => (prog[b][2] || 0) - (prog[a][2] || 0)).map(id => byId[id]);

  // ---------- כרטיסים ----------
  const wideCard = (it, { showProg, fresh } = {}) => `
    <a class="wide" href="${seriesHref(it)}" data-play="${esc(it.id)}" aria-label="${esc(fullName(it))}">
      <div class="pic"><img loading="lazy" src="${IMG(artOf(it), 640, 360)}" alt="">
        ${isNew(it) && !showProg ? '<span class="badge">חדש</span>' : ''}
        <span class="pic-title">${esc(seriesName(it))}<small>${esc(epName(it))}</small></span>
        <span class="over"><span>${icon('play')}</span></span>
        ${showProg ? `<span class="prog"><i style="width:${Math.round(fracOf(it.id) * 100)}%"></i></span>` : ''}
      </div>
      <div class="cap"><span>${showProg ? `נשארו ${remain(it.id)}` : fresh > 1 ? `${fresh} משניות חדשות השבוע · האחרונה ${rel(it.date).replace('עלה ', '')}` : rel(it.date)}</span></div>
    </a>`;
  const remain = id => { const p = prog[id]; const s = Math.max(0, (p[1] - p[0]) | 0); return s >= 60 ? `${Math.round(s / 60)} דק׳` : `${s} שנ׳`; };
  const posterCard = name => {
    const s = masechet[name];
    const art = mArt(name) || SEDER_ART[sederOf[name]];
    const sub = s ? `${s.items.length} משניות` : 'טרם הוקלט';
    return `<a class="poster${s ? '' : ' is-empty'}" href="#/m/${encodeURIComponent(name)}" aria-label="מסכת ${esc(name)}">
      <div class="pic"><img loading="lazy" src="${IMG(art, 420, 630)}" alt="">
        ${s && days(s.last) <= 7 ? '<span class="badge">משנה חדשה</span>' : `<span class="seder">${esc(sederOf[name])}</span>`}
        <span class="pic-title">${esc(name)}<small>${sub}</small></span></div></a>`;
  };
  const squareCard = g => {
    const it = g.items[0];
    const name = g.moed ? (MOED_NAME[g.title] || g.title) : `פרשת ${g.title}`;
    const sub = g.moed ? `${MOED_MONTH[g.title] || ''} · ${g.items.length === 1 ? 'שיעור אחד' : `${g.items.length} שיעורים`}` : `${it.year}${g.items.length > 1 ? ` · ${g.items.length} שיעורים` : ''}`;
    return `<div class="sq-wrap"><a class="sq" href="#/p/${encodeURIComponent(g.title)}" aria-label="${esc(name)}">
      <div class="pic"><img loading="lazy" src="${IMG(ART[g.title] || FALLBACK, 400, 400)}" alt="">
        ${!g.moed && g.title === weekParasha.name ? '<span class="badge">השבוע</span>' : g.items.some(isNew) ? '<span class="badge">חדש</span>' : ''}
        <span class="pic-title">${esc(g.moed ? name : g.title)}</span>
        <button class="fabmini" data-play="${esc(it.id)}" aria-label="נגן ${esc(name)}">${icon('play')}</button></div>
      <div class="cap"><b>${esc(name)}</b><span>${esc(sub)}</span></div></a></div>`;
  };
  // עיון: שני פרמטרים — המועד (הקשר, צבע) והנושא (הכותרת, התמונה)
  const MOED_TINT = { 'סוכות': 'oklch(0.62 0.13 120)', 'שמחת תורה': 'oklch(0.6 0.12 250)', 'תשעה באב': 'oklch(0.55 0.05 300)', 'חנוכה': 'oklch(0.7 0.13 80)', 'פסח': 'oklch(0.6 0.12 40)' };
  const iyunCard = it => `<a class="iyun" href="#/p/${encodeURIComponent(it.title)}" data-play="${esc(it.id)}" style="--mt:${MOED_TINT[it.title] || 'var(--accent)'}">
      <img loading="lazy" src="${IMG(artOf(it), 700, 700)}" alt="">
      <span class="iy-tag">${esc(seriesName(it))} · עיון</span>
      <q>${esc(it.iyun)}</q>
      <span class="meta"><span>${esc(it.year)}${it.pdf ? ' · עם סיכום כתוב' : ''}</span><span class="playbtn" aria-hidden="true">${icon('play')}</span></span></a>`;
  const row = (title, cards, more) => cards.length ? `
    <section class="row"><div class="row-head"><h2>${title}</h2>${more ? `<a href="${more[1]}">${more[0]}</a>` : ''}</div>
      <button class="row-nav prev" data-dir="1" aria-label="הקודמים">${icon('prev')}</button>
      <div class="track">${cards.join('')}</div>
      <button class="row-nav next" data-dir="-1" aria-label="הבאים">${icon('next')}</button></section>` : '';
  const tile = (href, title, sub, tint, art) => `<a class="tile" href="${href}" style="--c:${tint}">${esc(title)}<small>${esc(sub)}</small><img loading="lazy" src="${IMG(art, 240, 240)}" alt=""></a>`;
  const tiles = () => `<div class="tiles">${SEDARIM.map(([s, ms]) => {
    const n = ms.reduce((a, m) => a + (masechet[m]?.items.length || 0), 0);
    return tile(`#/seder/${encodeURIComponent(s)}`, `סדר ${s}`, n ? `${n} שיעורים` : 'טרם הוקלט', SEDER_TINT[s], SEDER_ART[s]);
  }).join('')}</div>`;
  // חומשים, מועדים, עיון — לגלישה
  const CHUMASH = {
    'בראשית': ['בראשית','נח','לך לך','וירא','חיי שרה','תולדות','ויצא','וישלח','וישב','מקץ','ויגש','ויחי'],
    'שמות': ['שמות','וארא','בא','בשלח','יתרו','משפטים','תרומה','תצוה','כי תשא','ויקהל פקודי'],
    'ויקרא': ['ויקרא','צו','שמיני','תזריע מצורע','אחרי מות קדושים','אמור','בהר בחוקותי'],
    'במדבר': ['במדבר','נשא','בהעלותך','שלח','קרח','חוקת','בלק','פינחס','מטות מסעי'],
    'דברים': ['דברים','ואתחנן','עקב','ראה','שופטים','כי תצא','כי תבוא','נצבים וילך','האזינו','וזאת הברכה'],
  };
  const PARASHA_ORDER = Object.values(CHUMASH).flat();
  const BOOK_TINT = { 'בראשית': 'oklch(0.44 0.1 240)', 'שמות': 'oklch(0.5 0.12 50)', 'ויקרא': 'oklch(0.42 0.11 300)', 'במדבר': 'oklch(0.5 0.08 100)', 'דברים': 'oklch(0.45 0.12 25)' };
  // זהה ל-$MOADIM ב-upload.ps1 (שיעורי פרשה). מועד שלא כאן — לא יופיע ברשימת המועדים.
  const ALL_MOADIM = ['ראש השנה','יום כיפור','סוכות','שמחת תורה','חנוכה','עשרה בטבת','טו בשבט','תענית אסתר','פורים','פסח','לג בעומר','שבועות','שבעה עשר בתמוז','תשעה באב'];
  const bookTiles = () => `<div class="tiles">${Object.entries(CHUMASH).map(([b, ps]) => {
    const n = pItems.filter(i => !i.moed && i.book === b).length;
    return tile(`#/book/${encodeURIComponent(b)}`, `חומש ${b}`, n ? `${n} שיעורים` : 'טרם הוקלט', BOOK_TINT[b], ART[ps.find(p => ART[p] && ART[p].startsWith('gen:')) || ps[0]] || FALLBACK);
  }).join('')}${tile('#/moadim', 'מועדים', `${pItems.filter(i => i.moed).length} שיעורים`, 'oklch(0.48 0.1 75)', ART['חנוכה'] || FALLBACK)}${tile('#/iyun', 'עיון · סוגיות', `${pItems.filter(i => i.iyun).length} שיעורים`, 'oklch(0.42 0.07 170)', ART['סוכות'] || FALLBACK)}</div>`;
  const ghostSq = (name, title) => `<div class="sq-wrap"><div class="sq is-empty"><div class="pic"><img loading="lazy" src="${IMG(ART[name] || FALLBACK, 400, 400)}" alt=""><span class="pic-title">${esc(name)}</span></div><div class="cap"><b>${esc(title)}</b><span>טרם הוקלט</span></div></div></div>`;

  // ---------- תצוגות ----------
  const view = $('#view');
  let filter = 'all';

  function billboard(it, tag, desc) {
    const hasText = it.kind === 'm' || it.pdf;
    return `<section class="billboard">
      <img src="${HERO(artOf(it))}" alt="" fetchpriority="high">
      <div class="bb-in">
        <span class="bb-tag"><span class="dot"></span>${tag}</span>
        <h1 class="bb-title">${esc(seriesName(it))}</h1>
        <div class="bb-meta"><span class="new">${rel(it.date)}</span><span>${esc(epName(it))}</span>${hasText ? `<span>${it.kind === 'm' ? 'עם טקסט המשנה' : 'עם סיכום כתוב'}</span>` : ''}</div>
        <p class="bb-desc">${esc(desc)}</p>
        <div class="bb-actions">
          <button class="btn btn-play" data-play="${esc(it.id)}">${icon('play')}האזנה</button>
          <a class="btn btn-ghost" href="${seriesHref(it)}">${icon('info')}לכל השיעורים</a>
        </div>
      </div></section>`;
  }

  // רקע דף הבית: בינתיים הצילום של הרב בשיעור (דניאל, 14.10). null = קיר הכריכות
  const HERO_PHOTO = 'img/rabbi.jpg';
  // דף הבית מציג את המערכת (דניאל): קיר כל הכריכות + מה יש כאן + ארבע דלתות + שני קיצורי "נגן עכשיו"
  function systemHero(latestP, latestM) {
    const covers = [...new Set(Object.values(ART).filter(v => v.startsWith('gen:')))];
    const wall = [];
    while (covers.length && wall.length < 48) wall.push(...covers);
    const nM = mItems.length, nP = pItems.filter(i => !i.moed).length, nH = pItems.filter(i => i.moed).length, nI = pItems.filter(i => i.iyun).length;
    const door = (attrs, title, sub, tint) => `<a class="door" ${attrs} style="--t:${tint}"><b>${title}</b><span>${sub}</span>${icon('next')}</a>`;
    return `<section class="sys${HERO_PHOTO ? ' has-photo' : ''}">
      ${HERO_PHOTO ? `<img class="sys-photo" src="${HERO_PHOTO}" alt="">` : `<div class="wall" aria-hidden="true"><div class="wall-in">${wall.slice(0, 48).map(v => `<img src="${IMG(v, 300, 300)}" alt="" loading="lazy">`).join('')}</div></div>`}
      <div class="sys-in">
        <h1 class="sys-title">שיעורי הרב <span>ולדומירסקי</span></h1>
        <p class="sys-sub">שיעורי הרה״ג רבי יצחק ולדומירסקי שליט״א — משנה, פרשת השבוע, מועדים ועיון. <b class="num">${items.length}</b> שיעורים בקול, עם הטקסט, פתוחים לכולם.</p>
        <div class="latest">
          <span class="cover sm">${coverHTML(latestM)}</span>
          <div><small>המשנה האחרונה בספרייה</small><b>${esc(`${latestM.masechet} ${heb(latestM.perek)}, ${latestM.nums.map(heb).join('–')}`)}</b><span>${rel(latestM.date)} · האזנה עם טקסט המשנה</span></div>
          <button class="btn btn-play" data-play="${esc(latestM.id)}">${icon('play')}להאזנה</button>
        </div>
        <div class="doors">
          ${door('href="#/" data-f="m"', 'משנה', `${Object.keys(masechet).length} מסכתות · ${nM} שיעורים`, 'var(--mishna)')}
          ${door('href="#/" data-f="p"', 'פרשת השבוע', `${nP} שיעורים · 5 חומשים`, 'var(--parasha)')}
          ${door('href="#/" data-f="h"', 'מועדים', `${nH} שיעורים · מהקרוב`, 'oklch(0.6 0.12 75)')}
          ${door('href="#/" data-f="i"', 'עיון', `${nI} סוגיות בהלכה`, 'oklch(0.55 0.08 170)')}
        </div>
        <div class="quick">
          ${(() => { const g = groups[weekParasha.name]; const it = g ? g.items[0] : latestP; return `<button class="qk" data-play="${esc(it.id)}"><span class="cover sm">${coverHTML(it)}</span><span><small>פרשת השבוע · שבת ${esc(hebDate(weekParasha.date))}</small><b>פרשת ${esc(weekParasha.label)}</b></span>${icon('play')}</button>`; })()}
        </div>
      </div></section>`;
  }
  const coverHTML = it => `<img src="${IMG(artOf(it), 120, 120)}" alt="">`;

  // לשוניות למעלה (דניאל, 15.10): לא שיעור אחרון בגדול — אלא המבנה של כל חלק
  const chumashTiles = () => `<div class="tiles">${Object.entries(CHUMASH).map(([b, ps]) => {
    const n = pItems.filter(i => !i.moed && i.book === b).length;
    return tile(`#/book/${encodeURIComponent(b)}`, `חומש ${b}`, n ? `${n} שיעורים` : 'טרם הוקלט', BOOK_TINT[b], ART[ps.find(p => ART[p] && ART[p].startsWith('gen:')) || ps[0]] || FALLBACK);
  }).join('')}</div>`;
  // פרשת השבוע לפי הלוח, ארץ ישראל: תאריך|מפתח באתר[|השם באותה שבת, כשפרשה מחוברת נקראת לבד]. נוצר מ-Hebcal (15.10.2026),
  // מכסה עד סוף 2031 — לפני כן להשלים שנים (scratchpad: mkshab.js). שבת שהיא חג — מדלגים לפרשה הבאה.
  const SHABBATOT = '2026-09-05|נצבים וילך;2026-09-19|האזינו;2026-10-10|בראשית;2026-10-17|נח;2026-10-24|לך לך;2026-10-31|וירא;2026-11-07|חיי שרה;2026-11-14|תולדות;2026-11-21|ויצא;2026-11-28|וישלח;2026-12-05|וישב;2026-12-12|מקץ;2026-12-19|ויגש;2026-12-26|ויחי;2027-01-02|שמות;2027-01-09|וארא;2027-01-16|בא;2027-01-23|בשלח;2027-01-30|יתרו;2027-02-06|משפטים;2027-02-13|תרומה;2027-02-20|תצוה;2027-02-27|כי תשא;2027-03-06|ויקהל פקודי|ויקהל;2027-03-13|ויקהל פקודי|פקודי;2027-03-20|ויקרא;2027-03-27|צו;2027-04-03|שמיני;2027-04-10|תזריע מצורע|תזריע;2027-04-17|תזריע מצורע|מצורע;2027-05-01|אחרי מות קדושים|אחרי מות;2027-05-08|אחרי מות קדושים|קדושים;2027-05-15|אמור;2027-05-22|בהר בחוקותי|בהר;2027-05-29|בהר בחוקותי|בחוקותי;2027-06-05|במדבר;2027-06-12|נשא;2027-06-19|בהעלותך;2027-06-26|שלח;2027-07-03|קרח;2027-07-10|חוקת;2027-07-17|בלק;2027-07-24|פינחס;2027-07-31|מטות מסעי;2027-08-07|דברים;2027-08-14|ואתחנן;2027-08-21|עקב;2027-08-28|ראה;2027-09-04|שופטים;2027-09-11|כי תצא;2027-09-18|כי תבוא;2027-09-25|נצבים וילך;2027-10-09|האזינו;2027-10-30|בראשית;2027-11-06|נח;2027-11-13|לך לך;2027-11-20|וירא;2027-11-27|חיי שרה;2027-12-04|תולדות;2027-12-11|ויצא;2027-12-18|וישלח;2027-12-25|וישב;2028-01-01|מקץ;2028-01-08|ויגש;2028-01-15|ויחי;2028-01-22|שמות;2028-01-29|וארא;2028-02-05|בא;2028-02-12|בשלח;2028-02-19|יתרו;2028-02-26|משפטים;2028-03-04|תרומה;2028-03-11|תצוה;2028-03-18|כי תשא;2028-03-25|ויקהל פקודי;2028-04-01|ויקרא;2028-04-08|צו;2028-04-22|שמיני;2028-04-29|תזריע מצורע;2028-05-06|אחרי מות קדושים;2028-05-13|אמור;2028-05-20|בהר בחוקותי;2028-05-27|במדבר;2028-06-03|נשא;2028-06-10|בהעלותך;2028-06-17|שלח;2028-06-24|קרח;2028-07-01|חוקת;2028-07-08|בלק;2028-07-15|פינחס;2028-07-22|מטות מסעי;2028-07-29|דברים;2028-08-05|ואתחנן;2028-08-12|עקב;2028-08-19|ראה;2028-08-26|שופטים;2028-09-02|כי תצא;2028-09-09|כי תבוא;2028-09-16|נצבים וילך;2028-09-23|האזינו;2028-10-14|בראשית;2028-10-21|נח;2028-10-28|לך לך;2028-11-04|וירא;2028-11-11|חיי שרה;2028-11-18|תולדות;2028-11-25|ויצא;2028-12-02|וישלח;2028-12-09|וישב;2028-12-16|מקץ;2028-12-23|ויגש;2028-12-30|ויחי;2029-01-06|שמות;2029-01-13|וארא;2029-01-20|בא;2029-01-27|בשלח;2029-02-03|יתרו;2029-02-10|משפטים;2029-02-17|תרומה;2029-02-24|תצוה;2029-03-03|כי תשא;2029-03-10|ויקהל פקודי;2029-03-17|ויקרא;2029-03-24|צו;2029-04-07|שמיני;2029-04-14|תזריע מצורע;2029-04-21|אחרי מות קדושים;2029-04-28|אמור;2029-05-05|בהר בחוקותי|בהר;2029-05-12|בהר בחוקותי|בחוקותי;2029-05-19|במדבר;2029-05-26|נשא;2029-06-02|בהעלותך;2029-06-09|שלח;2029-06-16|קרח;2029-06-23|חוקת;2029-06-30|בלק;2029-07-07|פינחס;2029-07-14|מטות מסעי;2029-07-21|דברים;2029-07-28|ואתחנן;2029-08-04|עקב;2029-08-11|ראה;2029-08-18|שופטים;2029-08-25|כי תצא;2029-09-01|כי תבוא;2029-09-08|נצבים וילך|נצבים;2029-09-15|נצבים וילך|וילך;2029-09-22|האזינו;2029-10-06|בראשית;2029-10-13|נח;2029-10-20|לך לך;2029-10-27|וירא;2029-11-03|חיי שרה;2029-11-10|תולדות;2029-11-17|ויצא;2029-11-24|וישלח;2029-12-01|וישב;2029-12-08|מקץ;2029-12-15|ויגש;2029-12-22|ויחי;2029-12-29|שמות;2030-01-05|וארא;2030-01-12|בא;2030-01-19|בשלח;2030-01-26|יתרו;2030-02-02|משפטים;2030-02-09|תרומה;2030-02-16|תצוה;2030-02-23|כי תשא;2030-03-02|ויקהל פקודי|ויקהל;2030-03-09|ויקהל פקודי|פקודי;2030-03-16|ויקרא;2030-03-23|צו;2030-03-30|שמיני;2030-04-06|תזריע מצורע|תזריע;2030-04-13|תזריע מצורע|מצורע;2030-04-27|אחרי מות קדושים|אחרי מות;2030-05-04|אחרי מות קדושים|קדושים;2030-05-11|אמור;2030-05-18|בהר בחוקותי|בהר;2030-05-25|בהר בחוקותי|בחוקותי;2030-06-01|במדבר;2030-06-08|נשא;2030-06-15|בהעלותך;2030-06-22|שלח;2030-06-29|קרח;2030-07-06|חוקת;2030-07-13|בלק;2030-07-20|פינחס;2030-07-27|מטות מסעי;2030-08-03|דברים;2030-08-10|ואתחנן;2030-08-17|עקב;2030-08-24|ראה;2030-08-31|שופטים;2030-09-07|כי תצא;2030-09-14|כי תבוא;2030-09-21|נצבים וילך;2030-10-05|האזינו;2030-10-26|בראשית;2030-11-02|נח;2030-11-09|לך לך;2030-11-16|וירא;2030-11-23|חיי שרה;2030-11-30|תולדות;2030-12-07|ויצא;2030-12-14|וישלח;2030-12-21|וישב;2030-12-28|מקץ;2031-01-04|ויגש;2031-01-11|ויחי;2031-01-18|שמות;2031-01-25|וארא;2031-02-01|בא;2031-02-08|בשלח;2031-02-15|יתרו;2031-02-22|משפטים;2031-03-01|תרומה;2031-03-08|תצוה;2031-03-15|כי תשא;2031-03-22|ויקהל פקודי;2031-03-29|ויקרא;2031-04-05|צו;2031-04-19|שמיני;2031-04-26|תזריע מצורע;2031-05-03|אחרי מות קדושים;2031-05-10|אמור;2031-05-17|בהר בחוקותי;2031-05-24|במדבר;2031-05-31|נשא;2031-06-07|בהעלותך;2031-06-14|שלח;2031-06-21|קרח;2031-06-28|חוקת;2031-07-05|בלק;2031-07-12|פינחס;2031-07-19|מטות מסעי;2031-07-26|דברים;2031-08-02|ואתחנן;2031-08-09|עקב;2031-08-16|ראה;2031-08-23|שופטים;2031-08-30|כי תצא;2031-09-06|כי תבוא;2031-09-13|נצבים וילך;2031-09-20|האזינו;2031-10-11|בראשית;2031-10-18|נח;2031-10-25|לך לך;2031-11-01|וירא;2031-11-08|חיי שרה;2031-11-15|תולדות;2031-11-22|ויצא;2031-11-29|וישלח;2031-12-06|וישב;2031-12-13|מקץ;2031-12-20|ויגש;2031-12-27|ויחי'.split(';').map(x => x.split('|'));
  const weekParasha = (() => { const t = new Date(today - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const e = SHABBATOT.find(([d]) => d >= t) || SHABBATOT[SHABBATOT.length - 1];
    return { name: e[1], label: e[2] || e[1], date: new Date(e[0] + 'T12:00:00') }; })();
  const hebDate = d => { try { const p = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' }).formatToParts(d);
    const n = +p.find(x => x.type === 'day').value, m = p.find(x => x.type === 'month').value.replace(/^ב/, '');
    const g = heb(n); return `${g.length > 1 ? g.slice(0, -1) + '״' + g.slice(-1) : g + '׳'} ב${m}`; } catch { return ''; } };
  function weekCard() {
    const w = weekParasha, g = groups[w.name], art = ART[w.name] || FALLBACK;
    const last = g && g.items[0];
    return `<section class="week">
      <img src="${HERO(art)}" alt="">
      <div class="week-in">
        <span class="week-k"><i></i>פרשת השבוע · שבת ${esc(hebDate(w.date))}</span>
        <h2>פרשת ${esc(w.label)}</h2>
        <p>${g ? `${g.items.length === 1 ? 'שיעור אחד' : `${g.items.length} שיעורים`} על הפרשה · האחרון: ${esc(last.year)}${last.pdf ? ' · עם סיכום כתוב' : ''}` : 'השיעור על הפרשה יעלה לקראת שבת'}</p>
        <div class="week-acts">${g ? `<button class="btn btn-play" data-play="${esc(last.id)}">${icon('play')}להאזנה</button><a class="btn btn-ghost" href="#/p/${encodeURIComponent(w.name)}">לכל השיעורים</a>` : `<a class="btn btn-ghost" href="#/book/${encodeURIComponent(Object.keys(CHUMASH).find(b => CHUMASH[b].includes(w.name)) || 'בראשית')}">לחומש</a>`}</div>
      </div></section>`;
  }
  function sectionPage(f, { iyuns, books, moadim }) {
    const head = (t, sub) => `<header class="sec-head"><h1 class="page-title">${t}</h1><p class="note">${sub}</p></header>`;
    const cont = (pred) => row('המשך האזנה', inProgress().filter(pred).map(i => wideCard(i, { showProg: true })));
    if (f === 'm') {
      let h = head('משנה', `ששת סדרי משנה · ${Object.keys(masechet).length} מסכתות הוקלטו · ${mItems.length} שיעורים`);
      h += `<section class="row" style="margin-top:8px">${tiles()}</section>`;
      h += cont(i => i.kind === 'm');
      for (const [sd, ms] of SEDARIM) if (ms.some(m => masechet[m])) h += row(`סדר ${sd}`, ms.map(posterCard), [`כל מסכתות סדר ${sd}`, `#/seder/${encodeURIComponent(sd)}`]);
      return h;
    }
    if (f === 'p') {
      let h = head('פרשת השבוע', `חמשת חומשי תורה · ${pItems.filter(i => !i.moed).length} שיעורים`);
      h += weekCard();
      h += `<section class="row"><div class="row-head"><h2>חמשת חומשי תורה</h2></div>${chumashTiles()}</section>`;
      h += cont(i => i.kind === 'p' && !i.moed);
      // החומש של השבוע ראשון; כל הפרשות בשורה (גם שלא הוקלטו), כדי שהשורה לא תהיה חצי ריקה
      const wb = Object.keys(CHUMASH).find(b => CHUMASH[b].includes(weekParasha.name));
      for (const b of [wb, ...BOOK_ORDER.filter(x => x !== wb)]) { if (!b || !CHUMASH[b].some(t => groups[t])) continue;
        h += row(`חומש ${b}`, CHUMASH[b].map(t => groups[t] ? squareCard(groups[t]) : ghostSq(t, `פרשת ${t}`)), ['לכל הפרשות', `#/book/${encodeURIComponent(b)}`]); }
      return h;
    }
    if (f === 'h') {
      let h = head('מועדים', 'מועדי השנה לפי הסדר — הקרוב ראשון');
      h += cont(i => i.moed);
      h += `<div class="grid sq-grid" style="margin-top:8px">${[...MOED_NEXT, ...ALL_MOADIM.filter(m => !MOED_NEXT.includes(m))].map(t => groups[t] ? squareCard(groups[t]) : ghostSq(t, MOED_NAME[t] || t)).join('')}</div>`;
      return h;
    }
    // עיון — הגדרה נפרדת תבוא; בינתיים: כל הסוגיות
    let h = head('עיון', `סוגיות בהלכה, לעומק · ${iyuns.length} שיעורים`);
    h += cont(i => i.iyun);
    h += `<div class="grid iy-grid" style="margin-top:8px">${iyuns.map(iyunCard).join('')}</div>`;
    return h;
  }

  function home() {
    const latestP = pItems.filter(i => !i.moed).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    const latestM = [...mItems].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.perek - a.perek || b.nums[0] - a.nums[0])[0];
    const iyuns = pItems.filter(i => i.iyun).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const fresh = items.filter(isNew).sort((a, b) => b.date.localeCompare(a.date) || (b.perek || 0) - (a.perek || 0) || (b.nums?.[0] || 0) - (a.nums?.[0] || 0));
    const cont = inProgress();
    const recorded = Object.values(masechet).sort((a, b) => b.last.localeCompare(a.last)).map(s => s.name);
    const books = BOOK_ORDER.filter(b => pItems.some(i => !i.moed && i.book === b));
    const moadim = MOED_NEXT.filter(t => groups[t]).map(t => groups[t]);
    const want = k => filter === 'all' || filter === k;
    if (filter !== 'all') return sectionPage(filter, { latestP, latestM, iyuns, books, moadim });
    let html = '';
    html += systemHero(latestP, latestM);
    html += row('המשך האזנה', cont.filter(i => filter === 'all' || (filter === 'm' ? i.kind === 'm' : filter === 'i' ? i.iyun : i.kind === 'p')).map(i => wideCard(i, { showProg: true })));
    // סדרה אחת = כרטיס אחד (כמו "פרקים חדשים" בנטפליקס), עם מספר החדשים
    const seen = {}, freshCards = [];
    for (const i of fresh.filter(i => filter === 'all' || (filter === 'm' ? i.kind === 'm' : filter === 'i' ? i.iyun : i.kind === 'p'))) {
      const k = i.kind === 'm' ? i.masechet : i.id;
      if (seen[k]) { seen[k].n++; continue; }
      freshCards.push(seen[k] = { it: i, n: 1 });
    }
    html += row('חדש השבוע', freshCards.map(({ it, n }) => wideCard(it, { fresh: n })));
    if (want('m')) html += row('סדרות המשנה', recorded.map(posterCard), ['כל ששת הסדרים', '#/search']);
    if (want('p')) for (const b of [...books].sort((x, y) => { const last = k => pItems.filter(i => !i.moed && i.book === k).reduce((m, i) => (i.date || '') > m ? i.date : m, ''); return last(y).localeCompare(last(x)); })) {
      const gs = PARASHA_ORDER.filter(t => groups[t] && groups[t].book === b).map(t => groups[t]);
      html += row(`חומש ${b}`, gs.map(squareCard));
    }
    if (want('p')) html += row('מועדי השנה — הקרוב ראשון', moadim.map(squareCard));
    if (want('p') || want('i')) html += row('עיון · סוגיות בהלכה', iyuns.map(iyunCard));
    if (filter === 'm') for (const [s, ms] of SEDARIM) { const r = ms.filter(m => masechet[m]); if (r.length) html += row(`סדר ${s}`, ms.map(posterCard)); }
    if (want('m')) html += `<section class="row"><div class="row-head"><h2>ששת סדרי משנה</h2></div>${tiles()}</section>`;
    return html;
  }

  const txtCache = {};
  function sefariaPerek(name, perek) {
    const en = SEFARIA[name]; if (!en) return Promise.resolve(null);
    const ref = `${en}.${perek}`;
    if (txtCache[ref]) return txtCache[ref];
    const key = 'txt.' + ref; const c = store.get(key, null); if (c) return (txtCache[ref] = Promise.resolve(c));
    return (txtCache[ref] = fetch(`https://www.sefaria.org/api/v3/texts/${ref}?version=hebrew&return_format=text_only`)
      .then(r => r.json()).then(d => { const t = d.versions[0].text.map(s => String(s).replace(/<[^>]+>/g, '').trim()); store.set(key, t); return t; })
      .catch(() => { delete txtCache[ref]; return null; }));
  }

  function masechetPage(name, perekArg) {
    const s = masechet[name];
    const seder = sederOf[name];
    if (!seder) return notFound();
    const total = PEREK_COUNTS[name] || 0;
    const art = mArt(name) || SEDER_ART[seder];
    if (!s) return `<section class="hero"><img src="${IMG(art, 1800)}" alt="" style="filter:grayscale(1) brightness(.5)">
      <div><span class="kick">סדר ${seder} · ${total} פרקים</span><h1>מסכת ${esc(name)}</h1><p>עוד לא הוקלטו שיעורים במסכת הזו. כשתעלה המשנה הראשונה — היא תופיע כאן, ובשורת "חדש השבוע".</p>
      <div class="acts"><a class="btn btn-ghost" href="#/seder/${encodeURIComponent(seder)}">לכל מסכתות סדר ${seder}</a></div></div></section>`;
    const lastP = Object.keys(prog).map(id => byId[id]).filter(i => i && i.kind === 'm' && i.masechet === name).sort((a, b) => (prog[b.id][2] || 0) - (prog[a.id][2] || 0))[0];
    const perek = +perekArg || lastP?.perek || +Object.keys(s.perakim).sort((a, b) => b - a)[0];
    const resume = lastP && fracOf(lastP.id) < 0.95 ? lastP : s.perakim[perek]?.[0];
    const eps = s.perakim[perek] || [];
    const html = `<section class="hero"><img src="${HERO(art)}" alt="">
      <div><span class="kick">סדר ${seder} · מסכת</span><h1>${esc(name)}</h1>
        <div class="bb-meta"><span>${total} פרקים</span><span>${s.items.length} משניות הוקלטו</span><span class="new">${rel(s.last)}</span></div>
        <p>${esc(ABOUT[name] || '')}</p>
        <div class="acts"><button class="fab" data-play="${esc(resume.id)}" aria-label="נגן">${icon('play')}</button>
          <span class="kick">${lastP ? 'המשך: ' : 'התחלה: '}${esc(epName(resume))}</span></div></div></section>
      <div class="series">
        <div class="seasons" role="tablist" aria-label="פרקים">${Array.from({ length: total }, (_, i) => i + 1).map(p =>
          `<a class="season${p === perek ? ' is-on' : ''}" role="tab" aria-selected="${p === perek}" ${s.perakim[p] ? `href="#/m/${encodeURIComponent(name)}/${p}"` : 'aria-disabled="true" tabindex="-1" title="טרם הוקלט"'}>פרק ${heb(p)}</a>`).join('')}</div>
        <div class="ep-head"><h2>פרק ${heb(perek)}</h2><span>${eps.length} משניות הוקלטו</span></div>
        <div id="eps">${eps.map((it, k) => `
          <div class="ep${nowId === it.id ? ' is-now' : ''}" data-play="${esc(it.id)}" data-queue="${esc(name)}" role="button" tabindex="0" aria-label="נגן ${esc(fullName(it))}">
            <span class="ep-n">${it.nums.map(heb).join('–')}</span>
            <div class="pic"><img loading="lazy" src="${IMG(art, 400, 225)}" alt="" style="object-position:${(k * 37) % 100}% ${(k * 23 + 30) % 100}%">
              <span class="over"><span>${icon('play')}</span></span>${fracOf(it.id) > 0.02 ? `<span class="prog"><i style="width:${Math.round(fracOf(it.id) * 100)}%"></i></span>` : ''}</div>
            <div class="ep-body"><b>משנה ${it.nums.map(heb).join('–')}<span>${rel(it.date)}</span></b><p class="wait" data-n="${it.nums.join(',')}">טוען את לשון המשנה…</p></div>
            ${moreBtn(it)}
          </div>`).join('')}</div>
      </div>`;
    queueMicrotask(() => sefariaPerek(name, perek).then(t => {
      $$('#eps p[data-n]').forEach(p => {
        const ns = p.dataset.n.split(',').map(Number);
        const line = t && ns.map(n => t[n - 1]).filter(Boolean).join(' ');
        p.textContent = line || 'הטקסט לא נטען — אפשר לפתוח בספריא';
        if (line) p.classList.remove('wait');
      });
    }));
    return html;
  }

  // כפתור "עוד" לכל שיעור — נגן הבא / הוסף לתור / שמירה לרשימה (כמו ביוטיוב מיוזיק)
  // במצב "בניית רשימה" — במקום ⋮ מופיע ＋ (✓ כשכבר ברשימה)
  const addBtn = it => { const on = !!building && building.ids.includes(it.id); return `<button class="addb${on ? ' is-on' : ''}" data-addl="${esc(it.id)}" aria-pressed="${on}" aria-label="${on ? 'הסרה מהרשימה' : 'הוספה לרשימה'}: ${esc(fullName(it))}">${icon(on ? 'check' : 'plus')}</button>`; };
  const lessonRow = it => `<div class="res res-l"><img src="${IMG(artOf(it), 120, 120)}" alt=""><div><b>${esc(it.kind === 'm' ? fullName(it) : (it.iyun || seriesName(it)))}</b><span>${esc(it.kind === 'm' ? `מסכת ${it.masechet} · ${rel(it.date)}` : `${seriesName(it)} · ${it.year}${it.tag ? ' · ' + it.tag : ''}`)}</span></div>${addBtn(it)}</div>`;
  const moreBtn = it => building ? addBtn(it) : `<button class="more" data-more="${esc(it.id)}" aria-label="אפשרויות ל${esc(fullName(it))}" title="נגן הבא · הוסף לתור · שמירה לרשימה">${icon('more')}</button>`;

  function groupPage(title) {
    const g = groups[title];
    if (!g) return notFound();
    const name = g.moed ? (MOED_NAME[title] || title) : `פרשת ${title}`;
    const art = ART[title] || FALLBACK;
    return `<section class="hero"><img src="${HERO(art)}" alt="">
      <div><span class="kick">${g.moed ? `מועדים · ${MOED_MONTH[title] || ''}` : `חומש ${g.book}`}</span><h1>${esc(name)}</h1>
        <div class="bb-meta"><span>${g.items.length === 1 ? 'שיעור אחד' : `${g.items.length} שיעורים`}</span>${g.items.some(i => i.pdf) ? '<span>עם סיכום כתוב</span>' : ''}</div>
        <p>${g.moed ? `שיעורי הרב ל${esc(name)} — הוורט, ושיעורי עיון בסוגיות ההלכה של החג.` : `השיעורים על ${esc(name)} מכל השנים, מהחדש לישן.`}</p>
        <div class="acts"><button class="fab" data-play="${esc(g.items[0].id)}" aria-label="נגן">${icon('play')}</button><span class="kick">${esc(epName(g.items[0]) || g.items[0].year)}</span></div></div></section>
      <div class="series"><div class="ep-head"><h2>השיעורים</h2><span>${g.items.length}</span></div>
      ${g.items.map((it, k) => `<div class="ep${nowId === it.id ? ' is-now' : ''}" data-play="${esc(it.id)}" role="button" tabindex="0" aria-label="נגן ${esc(fullName(it))}">
          <span class="ep-n" style="font-size:1.6rem">${heb(k + 1)}</span>
          <div class="pic"><img loading="lazy" src="${IMG(art, 400, 225)}" alt="" style="object-position:${(k * 41) % 100}% 50%"><span class="over"><span>${icon('play')}</span></span>${fracOf(it.id) > 0.02 ? `<span class="prog"><i style="width:${Math.round(fracOf(it.id) * 100)}%"></i></span>` : ''}</div>
          <div class="ep-body"><b>${esc(it.iyun ? 'עיון · ' + it.iyun : [it.year, it.tag].filter(Boolean).join(' · '))}<span>${it.date ? rel(it.date) : esc(it.year)}</span></b>
            <p class="wait">${it.iyun ? `${esc(it.year)} · שיעור עיון` : g.moed ? 'ווארט לחג' : 'ווארט על הפרשה'}${it.pdf ? ' · יש סיכום כתוב' : ''}</p></div>${moreBtn(it)}</div>`).join('')}</div>`;
  }

  function sederPage(s) {
    const e = SEDARIM.find(x => x[0] === s); if (!e) return notFound();
    const n = e[1].reduce((a, m) => a + (masechet[m]?.items.length || 0), 0);
    return `<h1 class="page-title">סדר ${s}</h1><p class="note">${e[1].length} מסכתות · ${n ? `${n} שיעורים` : 'טרם הוקלט'}. כל המסכתות מופיעות — גם מה שעוד לא הוקלט.</p><br><div class="grid">${e[1].map(posterCard).join('')}</div>`;
  }

  function searchPage(q = '') {
    const toQ = building && building.target === 'queue';
    return `<h1 class="page-title">${building ? (toQ ? 'הוספה לתור' : 'הוספת שיעורים לרשימה') : 'חיפוש'}</h1>
      ${building ? `<p class="note" style="margin-top:-8px">חפשו מסכת, פרק, פרשה או מועד — ולחצו ＋ ליד כל שיעור. ${toQ ? 'הוא ייכנס לתור מיד אחרי מה שמתנגן.' : 'הרשימה נבנית בצד.'}</p><br>` : ''}
      <div class="searchbox">${icon('search')}<input id="q" type="search" dir="auto" placeholder="מסכת, פרשה, מועד או נושא — למשל: ערכין ד ג" value="${esc(q)}" autocomplete="off"></div>
      <div id="res"></div>`;
  }
  // חיפוש במצב בניית רשימה: מחזיר שיעורים בודדים עם ＋
  function buildResults(q) {
    if (!q) {
      const fresh = items.filter(i => i.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      return `<section class="row" style="margin-top:0"><div class="row-head"><h2>עלו לאחרונה</h2></div><div class="results">${fresh.map(lessonRow).join('')}</div></section>
        <section class="row"><div class="row-head"><h2>או לפי סדרה — בכל עמוד יש ＋ ליד כל שיעור</h2></div>
        <div class="results">${Object.values(masechet).map(s => `<a class="res" href="#/m/${encodeURIComponent(s.name)}"><img src="${IMG(mArt(s.name), 120, 120)}" alt=""><div><b>מסכת ${esc(s.name)}</b><span>${s.items.length} משניות</span></div></a>`).join('')}
        ${Object.values(groups).map(g => `<a class="res" href="#/p/${encodeURIComponent(g.title)}"><img src="${IMG(ART[g.title] || FALLBACK, 120, 120)}" alt=""><div><b>${esc(g.moed ? (MOED_NAME[g.title] || g.title) : 'פרשת ' + g.title)}</b><span>${g.items.length} שיעורים</span></div></a>`).join('')}</div></section>`;
    }
    const out = [];
    const m = q.match(/^(.+?)(?:\s+(?:פרק\s+)?([א-ת]{1,2}))?(?:\s+(?:משנה\s+)?([א-ת]{1,2}))?$/);
    if (m && masechet[m[1]]) {
      const p = m[2] ? HEB.indexOf(m[2]) : 0, n = m[3] ? HEB.indexOf(m[3]) : 0;
      out.push(...masechet[m[1]].items.filter(i => (!p || i.perek === p) && (!n || i.nums.includes(n))).slice(0, 40));
    }
    for (const g of Object.values(groups)) if (g.title.includes(q) || (MOED_NAME[g.title] || '').includes(q)) out.push(...g.items);
    for (const it of pItems) if (it.iyun && it.iyun.replace(/["'״׳]/g, '').includes(q) && !out.includes(it)) out.push(it);
    return `<div class="results">${out.map(lessonRow).join('') || `<p class="note">לא נמצא "${esc(q)}". נסו: ערכין ד · ברכות · נח · סוכות</p>`}</div>`;
  }
  function searchResults(q) {
    q = q.trim().replace(/["'״׳]/g, '');
    if (building) return buildResults(q);
    // דף החיפוש — אריחי צבע בלי תמונות (החלטה 15.10): כלי ניווט מהיר, לא עוד קיר כריכות
    if (!q) return `<div class="plain-tiles"><section class="row" style="margin-top:0"><div class="row-head"><h2>משנה · ששת הסדרים</h2></div>${tiles()}</section>
      <section class="row"><div class="row-head"><h2>פרשת השבוע, מועדים ועיון</h2></div>${bookTiles()}</section></div>`;
    const out = [];
    const m = q.match(/^(.+?)\s+(?:פרק\s+)?([א-ת]{1,2})(?:\s+(?:משנה\s+)?([א-ת]{1,2}))?$/);
    if (m && masechet[m[1]]) {
      const p = HEB.indexOf(m[2]), n = m[3] ? HEB.indexOf(m[3]) : 0;
      const hit = masechet[m[1]].perakim[p]?.find(i => !n || i.nums.includes(n));
      if (hit) out.push(`<a class="res" href="${seriesHref(hit)}" data-play="${esc(hit.id)}"><img src="${IMG(artOf(hit), 120, 120)}" alt=""><div><b>${esc(fullName(hit))}</b><span>משנה · נגן עכשיו</span></div></a>`);
    }
    for (const [s, ms] of SEDARIM) for (const name of ms) if (name.includes(q) || q.includes(name)) out.push(`<a class="res" href="#/m/${encodeURIComponent(name)}"><img src="${IMG(mArt(name) || SEDER_ART[s], 120, 120)}" alt=""><div><b>מסכת ${esc(name)}</b><span>סדר ${s} · ${masechet[name] ? `${masechet[name].items.length} משניות` : 'טרם הוקלט'}</span></div></a>`);
    for (const g of Object.values(groups)) if (g.title.includes(q) || (MOED_NAME[g.title] || '').includes(q)) out.push(`<a class="res" href="#/p/${encodeURIComponent(g.title)}"><img src="${IMG(ART[g.title] || FALLBACK, 120, 120)}" alt=""><div><b>${esc(g.moed ? (MOED_NAME[g.title] || g.title) : 'פרשת ' + g.title)}</b><span>${g.moed ? 'מועד' : 'חומש ' + g.book} · ${g.items.length} שיעורים</span></div></a>`);
    for (const it of pItems) if (it.iyun && it.iyun.replace(/["'״׳]/g, '').includes(q)) out.push(`<a class="res" href="#/p/${encodeURIComponent(it.title)}" data-play="${esc(it.id)}"><img src="${IMG(artOf(it), 120, 120)}" alt=""><div><b>${esc(it.iyun)}</b><span>עיון · ${esc(seriesName(it))}</span></div></a>`);
    return `<div class="results">${out.join('') || `<p class="note">לא נמצא "${esc(q)}". נסו שם מסכת (ברכות), פרשה (נח) או מועד (סוכות).</p>`}</div>`;
  }

  function libraryPage() {
    const cont = inProgress();
    const lc = (l, i) => { const f = byId[l.ids[0]]; return `<div class="sq-wrap"><a class="sq" href="#/library" data-list="${i}" aria-label="נגן את ${esc(l.name)}">
      <div class="pic">${f ? `<img loading="lazy" src="${IMG(artOf(f), 400, 400)}" alt="">` : ''}<span class="pic-title">${esc(l.name)}</span>
        <span class="fabmini">${icon('play')}</span></div>
      <div class="cap"><b>${esc(l.name)}</b><span>${l.ids.length} שיעורים</span></div></a></div>`; };
    return `<h1 class="page-title">הספרייה שלי</h1>
      <div style="padding:0 var(--gutter)"><button class="btn-new" data-newlist style="width:auto;padding:0 22px">${icon('plus')}רשימה חדשה</button></div>
      ${lists.length ? row('הרשימות שלי', lists.map(lc)) : '<p class="note" style="margin-top:14px">כאן יופיעו הרשימות שלך — "רשימה חדשה", מחפשים שיעורים ולוחצים ＋.</p>'}
      ${cont.length ? row('המשך האזנה', cont.map(i => wideCard(i, { showProg: true }))) : '<p class="note">כאן יופיעו השיעורים שהתחלתם לשמוע — ממשיכים בדיוק מאיפה שעצרתם, גם אחרי סגירת הדפדפן.</p>'}
      ${row('המסכתות שלי', [...new Set(cont.filter(i => i.kind === 'm').map(i => i.masechet))].map(posterCard))}`;
  }
  const notFound = () => `<h1 class="page-title">לא נמצא</h1><p class="note"><a href="#/" style="text-decoration:underline">חזרה לדף הבית</a></p>`;

  // ---------- ניתוב ----------
  const top = $('#top');
  function route() {
    const [, a, b, c] = location.hash.split('/').map(decodeURIComponent);
    let html, flat = true, nav = '';
    if (!a) { html = home(); flat = false; nav = 'home'; }
    else if (a === 'm') html = masechetPage(b, c);
    else if (a === 'p') html = groupPage(b);
    else if (a === 'seder') html = sederPage(b);
    else if (a === 'book' && CHUMASH[b]) html = `<h1 class="page-title">חומש ${esc(b)}</h1><p class="note">${CHUMASH[b].length} פרשות · כל הפרשות מופיעות — גם מה שעוד לא הוקלט.</p><br>
      <div class="grid sq-grid">${CHUMASH[b].map(t => groups[t] ? squareCard(groups[t]) : ghostSq(t, `פרשת ${t}`)).join('')}</div>`;
    else if (a === 'moadim') html = `<h1 class="page-title">מועדים</h1><p class="note">לפי סדר השנה, מהקרוב.</p><br>
      <div class="grid sq-grid">${[...MOED_NEXT, ...ALL_MOADIM.filter(m => !MOED_NEXT.includes(m))].map(t => groups[t] ? squareCard(groups[t]) : ghostSq(t, MOED_NAME[t] || t)).join('')}</div>`;
    else if (a === 'iyun') html = `<h1 class="page-title">עיון · סוגיות בהלכה</h1><p class="note">שיעורי עיון בסוגיות של החגים, לעומק, עם סיכום כתוב.</p><br>
      <div class="grid iy-grid">${pItems.filter(i => i.iyun).map(iyunCard).join('')}</div>`;
    else if (a === 'search') { html = searchPage(); nav = 'search'; }
    else if (a === 'library') { html = libraryPage(); nav = 'library'; }
    else html = notFound();
    view.innerHTML = `${building ? buildBar() : ''}<div class="view-in">${html}</div>`;
    setPageBg(a, b);
    top.classList.toggle('is-flat', flat);
    $$('[data-nav]').forEach(x => x.classList.toggle('is-on', x.dataset.nav === nav));
    if (a === 'search') { const q = $('#q'); $('#res').innerHTML = searchResults(''); q.addEventListener('input', () => { $('#res').innerHTML = searchResults(q.value); }); if (matchMedia('(hover:hover)').matches) q.focus(); }
    (matchMedia('(min-width:1024px)').matches ? $('#main') : document.scrollingElement).scrollTop = 0;
    onScroll();
    if (typeof syncPlayBtns === 'function' && nowId) syncPlayBtns();
  }
  // רקע לפי הדף (מצב יום): הבית — נוף/שמיים; כל סדרה — מהכריכה שלה, מטושטש (כמו ספוטיפיי/אפל מיוזיק)
  const pageBg = document.createElement('div'); pageBg.className = 'pagebg'; pageBg.setAttribute('aria-hidden', 'true'); document.body.prepend(pageBg);
  let bgNow = '';
  function bgFor(a, b) {
    const firstGen = list => list.map(t => ART[t]).find(v => v && v.startsWith('gen:'));
    if (a === 'm') return mArt(b) || SEDER_ART[sederOf[b]];
    if (a === 'p') return ART[b];
    if (a === 'seder') return SEDER_ART[b];
    if (a === 'book') return firstGen(CHUMASH[b] || []);
    if (a === 'moadim') return firstGen(MOED_NEXT);
    if (a === 'iyun') return ART['סוכות'];
    return null; // בית, חיפוש, ספרייה — רקע הבית
  }
  function setPageBg(a, b) {
    const art = bgFor(a, b);
    const url = art ? IMG(art, 900, 900) : DAY_BG[bgKey];
    if (!url || url === bgNow) return; bgNow = url;
    const layer = document.createElement('i');
    layer.style.backgroundImage = `url("${url}")`;
    if (art) layer.className = 'blur';
    pageBg.append(layer);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
    setTimeout(() => { while (pageBg.children.length > 1) pageBg.firstChild.remove(); }, 800);
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => {
    const d = e.target.closest('.door[data-f]'); if (!d) return;
    e.preventDefault(); filter = d.dataset.f; $$('#topChips .chip').forEach(x => x.classList.toggle('is-on', x.dataset.f === filter)); route();
  });
  // "בית" = דף הבית (שלט + שורות). כבר בבית? חוזר להתחלה ומאפס את הסינון.
  $$('[data-nav=home]').forEach(a => a.addEventListener('click', () => {
    filter = 'all'; $$('#topChips .chip').forEach(x => x.classList.toggle('is-on', x.dataset.f === 'all'));
    if (!location.hash || location.hash === '#/') route();
  }));
  $('#topChips').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f; $$('#topChips .chip').forEach(x => x.classList.toggle('is-on', x === b));
    if (location.hash && location.hash !== '#/') location.hash = '#/'; else route();
  });
  function onScroll() {
    const y = matchMedia('(min-width:1024px)').matches ? $('#main').scrollTop : window.scrollY;
    top.classList.toggle('is-solid', y > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  $('#main').addEventListener('scroll', onScroll, { passive: true });

  // ספרייה בסרגל הצד
  let libF = 'all';
  function sideList() {
    const ms = Object.values(masechet).sort((a, b) => b.last.localeCompare(a.last)).map(s => ({ href: `#/m/${encodeURIComponent(s.name)}`, art: mArt(s.name), t: `מסכת ${s.name}`, sub: `סדר ${s.seder} · ${s.items.length} משניות`, k: 'm' }));
    const ps = [...BOOK_ORDER.flatMap(b => PARASHA_ORDER.filter(t => groups[t]?.book === b)), ...MOED_NEXT.filter(t => groups[t])].map(t => groups[t]).map(g => ({ href: `#/p/${encodeURIComponent(g.title)}`, art: ART[g.title] || FALLBACK, t: g.moed ? (MOED_NAME[g.title] || g.title) : `פרשת ${g.title}`, sub: `${g.moed ? 'מועד' : 'חומש ' + g.book} · ${g.items.length} שיעורים`, k: 'p' }));
    const ls = lists.map((l, i) => ({ list: i, art: artOf(byId[l.ids[0]] || items[0]), t: l.name, sub: `רשימה שלך · ${l.ids.length} שיעורים`, k: 'l' }));
    $('#sideList').innerHTML = [...ls, ...ms, ...ps].filter(x => libF === 'all' || x.k === libF || x.k === 'l').map(x => `<li><a ${x.list != null ? `href="#/library" data-list="${x.list}"` : `href="${x.href}"`}><img loading="lazy" src="${IMG(x.art, 96, 96)}" alt=""><div><b>${esc(x.t)}</b><span>${esc(x.sub)}</span></div></a></li>`).join('');
  }
  $('.side-chips').addEventListener('click', e => { const b = e.target.closest('[data-lib]'); if (!b) return; libF = b.dataset.lib; $$('.side-chips .chip').forEach(x => x.classList.toggle('is-on', x === b)); sideList(); });

  // חיצי שורות
  document.addEventListener('click', e => {
    const n = e.target.closest('.row-nav'); if (!n) return;
    const t = n.parentElement.querySelector('.track');
    t.scrollBy({ left: +n.dataset.dir * t.clientWidth * 0.85, behavior: 'smooth' });
  });

  // ---------- נגן ----------
  const audio = new Audio(); audio.preload = 'metadata';
  let nowId = null, speed = 1;
  // שני דברים נפרדים (דניאל, 14.10):
  //   userQ  — "התור שלך": מה שהמאזין הוסיף, מכל סוג, בסדר שלו. נשמר גם כשמנגנים משהו אחר (כמו ספוטיפיי).
  //   contQ  — "ניגון רציף": המשך המסכת לפי הסדר, רק למשניות, עם מתג. נעצר בסוף המסכת עם הודעה.
  // קודם התור שלך, אחריו הניגון הרציף. בשניהם אפשר למחוק ולגרור (רק מהידית ≡).
  let userQ = [], contQ = [], contOn = store.get('contOn', true), nowFrom = 'direct';
  const hist = [];
  const contFor = it => it.kind === 'm' ? masechet[it.masechet].items.slice(masechet[it.masechet].items.indexOf(it) + 1).map(x => x.id) : [];
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75];
  const fmt = s => { s = Math.max(0, s | 0); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };
  const bar = $('#bar'), np = $('#np');

  function queueFor(it) {
    if (it.kind === 'm') return masechet[it.masechet].items;
    return groups[it.title].items;
  }
  // כריכה מעוצבת: צילום + שם הסדרה בגדול + שורת משנה (כמו כריכת אלבום / כרטיס נטפליקס)
  function cover(it, w = 600) {
    const big = it.kind === 'm' ? it.masechet : it.moed ? (MOED_NAME[it.title] || it.title) : it.title;
    const small = it.kind === 'm' ? `פרק ${heb(it.perek)}` : it.iyun ? `עיון · ${it.year}` : it.year;
    return `<img src="${IMG(artOf(it), w, w)}" alt=""><span class="cv-mark">שיעורי הרב</span><span class="cv-t">${esc(big)}</span><span class="cv-s">${esc(small)}</span>`;
  }
  const npTitle = it => it.kind === 'm' ? `משנה ${it.nums.map(heb).join('–')}` : (it.iyun || seriesName(it));
  const npSub = it => it.kind === 'm' ? `${it.masechet} · פרק ${heb(it.perek)}` : it.iyun ? `עיון · ${seriesName(it)} · ${it.year}` : `${it.moed ? 'ווארט לחג' : 'ווארט על הפרשה'} · ${it.year}${it.tag ? ' · ' + it.tag : ''}`;
  function play(id) {
    const it = byId[id]; if (!it) return;
    if (nowId === id) { toggle(); return; }
    if (nowId) hist.push(nowId);
    nowFrom = 'direct'; contQ = contFor(it); load(it, true);
    // רק הסרגל הקטן — הנגן המלא (נייד) או הלוח בצד (מחשב) נפתחים רק מנגיעה (דניאל, 15.10)
  }
  function load(it, autoplay) {
    nowId = it.id;
    audio.src = it.url; audio.playbackRate = speed;
    const p = prog[it.id]; if (p && p[0] / p[1] < 0.95) audio.currentTime = p[0];
    if (autoplay) audio.play().catch(() => {});
    const art = IMG(artOf(it), 600, 600);
    $('#barArt').innerHTML = `<span class="cover sm">${cover(it, 160)}</span>`;
    $('#barTitle').textContent = npTitle(it); $('#barSub').textContent = npSub(it);
    $('#npCover').innerHTML = cover(it, 900);
    $('#npMiniCover').innerHTML = cover(it, 160);
    $('#npTitle').textContent = $('#npMiniTitle').textContent = npTitle(it);
    $('#npSub').textContent = $('#npMiniSub').textContent = npSub(it);
    $('#npFrom').textContent = it.kind === 'm' ? `מסכת ${it.masechet} · סדר ${it.seder}` : seriesName(it);
    $('#npTabText').textContent = it.kind === 'm' ? 'טקסט המשנה' : 'סיכום'; $('#npTextLbl').textContent = it.kind === 'm' ? 'טקסט' : 'סיכום';
    // ספריא (משנה) או הסיכום הכתוב (פרשה/מועד)
    const sf = $('#npSefaria');
    if (it.kind === 'm') { sf.href = `https://www.sefaria.org.il/${SEFARIA[it.masechet] || ''}.${it.perek}.${it.nums[0]}`; $('#npSefariaLbl').textContent = 'ספריא'; sf.hidden = !SEFARIA[it.masechet]; }
    else { sf.href = it.pdf || '#'; $('#npSefariaLbl').textContent = 'סיכום'; sf.hidden = !it.pdf; }
    // הנגן הבינוני
    $('#dockCover').innerHTML = cover(it, 700);
    $('#dockTitle').textContent = npTitle(it); $('#dockSub').textContent = npSub(it); 
    $('#dockTextTitle').textContent = it.kind === 'm' ? 'טקסט המשנה' : 'על השיעור';
    const da = $('.dock-acts [data-act=sefaria]'); da.href = sf.href; da.hidden = sf.hidden; $('.act-sf').textContent = $('#npSefariaLbl').textContent;
    bar.hidden = false; document.body.classList.add('has-bar');
    tint(IMG(artOf(it), 48, 48));
    renderText(it); renderQueue();
    $$('.ep').forEach(e => e.classList.toggle('is-now', e.dataset.play === it.id));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: $('#npTitle').textContent, artist: 'הרה״ג רבי יצחק ולדומירסקי', album: $('#npSub').textContent, artwork: [{ src: art, sizes: '600x600', type: 'image/jpeg' }] });
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(15));
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    }
  }
  function next(auto) {
    let id = null, from = null;
    if (userQ.length) { id = userQ.shift(); from = 'user'; }
    else if (contOn && contQ.length) { id = contQ.shift(); from = 'cont'; }
    if (!id) {
      if (auto) { const it = byId[nowId]; toast(contOn && it && it.kind === 'm' ? `סיימת את מסכת ${it.masechet}` : 'התור נגמר'); }
      renderQueue(); return;
    }
    hist.push(nowId); nowFrom = from; load(byId[id], true);
  }
  function prev() {
    if (audio.currentTime > 5 || !hist.length) { audio.currentTime = 0; return; }
    const back = hist.pop();
    if (nowFrom === 'user') userQ.unshift(nowId); else if (nowFrom === 'cont') contQ.unshift(nowId);
    nowFrom = 'back'; load(byId[back], true);
  }
  // ---------- לוח התור: מתנגן עכשיו · התור שלך · ניגון רציף ----------
  const qRow = (x, src) => `<li class="qrow" data-id="${esc(x.id)}"><button class="qi${src === 'now' ? ' is-now' : ''}" ${src === 'now' ? '' : `data-q="${esc(x.id)}" data-src="${src}"`}><span class="cover sm">${cover(x, 120)}</span><span><b>${esc(npTitle(x))}</b><span>${esc(npSub(x))}${src !== 'now' && x.date ? ' · ' + rel(x.date) : ''}</span></span></button>${src === 'now' || src === 'peek' ? '' :
    `<button class="ib qrm" data-rm="${esc(x.id)}" data-src="${src}" aria-label="הסרה: ${esc(fullName(x))}">${icon('x')}</button><button class="qh" data-src="${src}" aria-label="גרירה לשינוי מיקום (או חצים למעלה/למטה)">${icon('grip')}</button>`}</li>`;
  const CONT_SHOW = 40;
  function queueHTML() {
    const it = byId[nowId];
    const ctxM = it.kind === 'm' ? it.masechet : (contQ[0] && byId[contQ[0]].masechet);
    const sw = `<button class="switch-w" data-cont role="switch" aria-checked="${contOn}" aria-label="ניגון רציף"><span>${contOn ? 'פועל' : 'כבוי'}</span><span class="switch"><i></i></span></button>`;
    return `<li class="qsec"><h3>מתנגן עכשיו</h3><ol class="qlist">${qRow(it, 'now')}</ol></li>
      <li class="qsec"><div class="qsec-h"><h3>התור שלך${userQ.length ? ` · ${userQ.length}` : ''}</h3>${userQ.length ? '<button class="lnk" data-clear>ניקוי</button>' : ''}</div>
        ${userQ.length ? `<ol class="qlist" data-ql="user">${userQ.map(id => qRow(byId[id], 'user')).join('')}</ol>` : '<p class="qempty">התור ריק. מה שתוסיפו יתנגן לפני הניגון הרציף.</p>'}
        <button class="btn-new" data-addq>${icon('plus')}הוספה לתור</button></li>
      <li class="qsec"><div class="qsec-h"><h3>ניגון רציף</h3>${sw}</div>
        <p class="qempty">${!contOn ? 'כבוי — אחרי התור שלך הנגינה תיעצר.' : ctxM ? `ממשיך במסכת ${esc(ctxM)} לפי הסדר, ועוצר בסוף המסכת.` : 'פועל במשניות: אחרי כל משנה — הבאה בתור לפי הסדר.'}</p>
        ${contOn && contQ.length ? `<ol class="qlist" data-ql="cont">${contQ.slice(0, CONT_SHOW).map(id => qRow(byId[id], 'cont')).join('')}</ol>${contQ.length > CONT_SHOW ? `<p class="qempty">ועוד ${contQ.length - CONT_SHOW} משניות עד סוף המסכת</p>` : ''}` : ''}</li>`;
  }
  function upNext(n) { return [...userQ, ...(contOn ? contQ : [])].slice(0, n); }
  function renderQueue() {
    if (!nowId) return;
    $('#npQueue').innerHTML = queueHTML();
    $('#dockQ').innerHTML = queueHTML();
    const nx = upNext(3);
    $('#dockQueue').innerHTML = nx.length ? `<ol class="qlist">${nx.map(id => qRow(byId[id], 'peek')).join('')}</ol>` : `<p class="src" style="margin:0;color:oklch(1 0 0 / .7)">אין עוד בתור</p>`;
    const none = !upNext(1).length;
    $('#npNext').disabled = $('#barNext').disabled = $('#dockNext').disabled = none;
    $('#npCont').setAttribute('aria-pressed', contOn);
  }
  // לחיצה על שיעור בתור: מנגן אותו, ומדלג על מה שלפניו באותו חלק (כמו ספוטיפיי)
  function jump(id, src) {
    const list = src === 'cont' ? contQ : userQ; const k = list.indexOf(id); if (k < 0) return;
    list.splice(0, k + 1); hist.push(nowId); nowFrom = src; load(byId[id], true);
  }
  function unqueue(id, src) {
    if (src !== 'cont') userQ = userQ.filter(x => x !== id);
    if (src === 'cont') contQ = contQ.filter(x => x !== id);
  }
  function playNext(id) {
    if (!nowId) return play(id);
    if (id === nowId) return; unqueue(id); userQ.unshift(id); renderQueue();
    toast(`יתנגן הבא: ${fullName(byId[id])}`);
  }
  function addToQueue(id) {
    if (!nowId) return play(id);
    if (id === nowId) return; unqueue(id); userQ.push(id); renderQueue();
    if (!building) toast(`נוסף לתור: ${fullName(byId[id])}`);
  }
  function setCont(on) {
    contOn = on; store.set('contOn', on);
    const it = byId[nowId];
    if (on && it && it.kind === 'm' && !contQ.length) contQ = contFor(it);
    renderQueue(); toast(on ? 'ניגון רציף פועל' : 'ניגון רציף כבוי');
  }
  // רשימות השמעה — נשמרות במכשיר (בלי הרשמה)
  let lists = store.get('lists', []);
  function saveList(name, ids) {
    name = (name || '').trim() || `הרשימה שלי ${lists.length + 1}`;
    lists.unshift({ name, ids, at: Date.now() }); store.set('lists', lists); sideList();
    toast(`נשמרה הרשימה "${name}" · בספרייה`);
  }
  function saveToFav(id) {
    let fav = lists.find(l => l.fav);
    if (!fav) { fav = { name: 'השמורים שלי', ids: [], at: Date.now(), fav: true }; lists.unshift(fav); }
    if (!fav.ids.includes(id)) fav.ids.push(id);
    store.set('lists', lists); sideList(); toast(`נשמר ב"השמורים שלי"`);
  }
  function playList(i) {
    const ids = lists[i].ids.filter(id => byId[id]); if (!ids.length) return;
    play(ids[0]); userQ = ids.slice(1); renderQueue();
  }
  for (const box of [$('#npQueue'), $('#dockQ'), $('#dockQueue')]) box.addEventListener('click', e => {
    if (e.target.closest('.qh')) return;
    const rm = e.target.closest('[data-rm]');
    if (rm) { if (building && building.target === 'queue' && building.ids.includes(rm.dataset.rm)) toggleAdd(rm.dataset.rm); else { unqueue(rm.dataset.rm, rm.dataset.src); renderQueue(); } return; }
    if (e.target.closest('[data-cont]')) { setCont(!contOn); return; }
    if (e.target.closest('[data-clear]')) { userQ = []; renderQueue(); toast('התור נוקה'); return; }
    const b = e.target.closest('[data-q]'); if (b) jump(b.dataset.q, b.dataset.src);
  });
  // גרירה — רק מהידית ≡ (עכבר ומגע), ובמקלדת: חצים על הידית
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.qh'); if (!h) return;
    e.preventDefault();
    const row = h.closest('.qrow'), list = row.parentElement;
    drag = { row, list, src: h.dataset.src }; row.classList.add('dragging'); list.classList.add('is-sorting');
    try { h.setPointerCapture(e.pointerId); } catch {}
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const y = e.clientY;
    for (const r of drag.list.children) {
      if (r === drag.row) continue;
      const b = r.getBoundingClientRect();
      if (y < b.top + b.height / 2) { if (drag.row.nextElementSibling !== r) drag.list.insertBefore(drag.row, r); return; }
    }
    if (drag.list.lastElementChild !== drag.row) drag.list.appendChild(drag.row);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const ids = [...drag.list.children].map(r => r.dataset.id);
    if (drag.src === 'user') userQ = ids; else contQ = [...ids, ...contQ.slice(ids.length)];
    drag.row.classList.remove('dragging'); drag = null; renderQueue();
  });
  document.addEventListener('keydown', e => {
    const h = e.target.closest && e.target.closest('.qh'); if (!h || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const id = h.closest('.qrow').dataset.id, list = h.dataset.src === 'cont' ? contQ : userQ, k = list.indexOf(id), to = k + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= list.length) return;
    list.splice(k, 1); list.splice(to, 0, id); renderQueue();
    const again = $(`${h.closest('ol').closest('#npQueue') ? '#npQueue' : '#dockQ'} .qrow[data-id="${CSS.escape(id)}"] .qh`); if (again) again.focus();
  });

  document.addEventListener('click', e => { const a = e.target.closest('[data-list]'); if (!a) return; e.preventDefault(); playList(+a.dataset.list); });

  // ---------- בניית רשימה: "הוספת שיעורים" → האתר עם ＋ ליד כל שיעור, והרשימה נבנית בלוח בצד ----------
  function buildBar() {
    const n = building.ids.length;
    if (building.target === 'queue') return `<div class="buildbar"><span><b>מוסיפים לתור</b> · ${n === 1 ? 'נוסף שיעור אחד' : n ? `נוספו ${n} שיעורים` : 'לחצו ＋ ליד שיעור'}</span>
      <button class="lnk show-mob" data-bopen>לתור</button><button class="btn-save" data-bsave>סיום</button></div>`;
    return `<div class="buildbar"><span><b>${esc(building.name || 'רשימה חדשה')}</b> · ${n ? `${n} שיעורים` : 'עוד ריקה'}</span>
      <button class="lnk show-mob" data-bopen>לרשימה</button><button class="btn-save" data-bsave ${n ? '' : 'disabled'}>סיום ושמירה</button></div>`;
  }
  function buildPanel() {
    const its = building.ids.map(id => byId[id]);
    $('#dockB').innerHTML = `<input class="bname" id="bName" dir="auto" value="${esc(building.name)}" placeholder="שם הרשימה, למשל: לנסיעה" aria-label="שם הרשימה">
      <p class="bhint">${its.length ? `${its.length} שיעורים` : 'חפשו שיעורים מימין ולחצו ＋ — הם יופיעו כאן.'}</p>
      <div class="blist">${its.map(x => qRow(x, { mine: true })).join('')}</div>
      <div class="bact"><button class="btn-save" data-bsave ${its.length ? '' : 'disabled'}>שמירת הרשימה</button><button class="lnk" data-bcancel>ביטול</button></div>`;
    const bar = $('.buildbar'); if (bar) bar.outerHTML = buildBar();
  }
  function startBuild(target = 'list') {
    if (np.classList.contains('is-open')) closeNP(); // מהנגן המלא — סוגרים אותו כדי שהחיפוש ייראה
    building = { name: '', ids: [], target }; document.body.classList.add('building');
    if (!isMob()) openDock(target === 'queue' && nowId ? 'queue' : 'build');
    else minDock();
    buildPanel();
    if (location.hash === '#/search') route(); else location.hash = '#/search';
  }
  function endBuild(save) {
    const b = building; building = null; document.body.classList.remove('building');
    if (b.target === 'queue') { if (nowId) openDock('queue'); if (b.ids.length) toast(`נוספו ${b.ids.length} שיעורים לתור`); route(); return; }
    if (save && b.ids.length) saveList(b.name, b.ids);
    minDock(); // הלוח נפתח רק מלחיצה
    if (save && b.ids.length) location.hash = '#/library'; else route();
  }
  function toggleAdd(id) {
    if (!building) return;
    const k = building.ids.indexOf(id);
    if (k >= 0) building.ids.splice(k, 1); else building.ids.push(id);
    if (building.target === 'queue') { // ישר לתור, בסדר ההוספה
      if (k >= 0) { unqueue(id); renderQueue(); }
      else if (!nowId) { play(id); building.ids = [id]; }
      else addToQueue(id);
      if (nowId && !isMob()) openDock('queue');
    }
    const on = k < 0;
    $$(`[data-addl="${CSS.escape(id)}"]`).forEach(b => { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); b.innerHTML = icon(on ? 'check' : 'plus'); });
    buildPanel();
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-newlist]')) { e.preventDefault(); startBuild(); return; }
    if (e.target.closest('[data-addq]')) { e.preventDefault(); startBuild('queue'); return; }
    const ad = e.target.closest('[data-addl]'); if (ad) { e.preventDefault(); e.stopPropagation(); toggleAdd(ad.dataset.addl); return; }
    const rm = e.target.closest('#dockB [data-rm]'); if (rm) { toggleAdd(rm.dataset.rm); return; }
    if (e.target.closest('[data-bsave]')) { endBuild(true); return; }
    if (e.target.closest('[data-bcancel]')) { endBuild(false); return; }
    if (e.target.closest('[data-bopen]')) { openDock('build'); return; }
  }, true);
  document.addEventListener('input', e => { if (e.target.id === 'bName' && building) { building.name = e.target.value; const b = $('.buildbar b'); if (b) b.textContent = building.name || 'רשימה חדשה'; } });

  // תפריט "עוד" (⋮) לכל שיעור
  const menu = $('#menu'); let menuFor = null;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-more]');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      menuFor = b.dataset.more; menu.hidden = false;
      const r = b.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
      menu.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px';
      menu.style.top = (r.bottom + mh + 8 > innerHeight ? r.top - mh - 6 : r.bottom + 6) + 'px';
      menu.querySelector('button').focus();
      return;
    }
    const a = e.target.closest('#menu [data-m]');
    if (a) { const id = menuFor; menu.hidden = true; e.stopPropagation(); ({ next: playNext, queue: addToQueue, fav: saveToFav })[a.dataset.m](id); return; }
    if (!menu.hidden && !e.target.closest('#menu')) menu.hidden = true;
  }, true);
  function toggle() { if (!nowId) return; audio.paused ? audio.play().catch(() => {}) : audio.pause(); }
  function skip(s) { audio.currentTime = Math.max(0, Math.min((audio.duration || 0), audio.currentTime + s)); }
  function setPlayIcons() {
    const on = !audio.paused;
    for (const b of [$('#barPlay'), $('#npPlay'), $('#dockPlay')]) { b.innerHTML = icon(on ? 'pause' : 'play'); b.setAttribute('aria-label', on ? 'השהה' : 'נגן'); }
    np.classList.toggle('is-paused', !on);
    syncPlayBtns();
  }
  // כפתורי נגן בדפים (השלט של מסכת/פרשה, להאזנה, קיצורים): של השיעור שמתנגן עכשיו — השהיה; כל השאר — נגן
  function syncPlayBtns() {
    const on = !audio.paused;
    for (const b of $$('[data-play]')) {
      const u = b.querySelector(':scope > svg > use'); if (!u || !/^#i-(play|pause)$/.test(u.getAttribute('href'))) continue;
      const me = on && b.dataset.play === nowId;
      u.setAttribute('href', me ? '#i-pause' : '#i-play');
      if (b.hasAttribute('aria-label') && !b.classList.contains('ep')) b.setAttribute('aria-label', me ? 'השהה' : 'נגן');
    }
  }
  audio.addEventListener('play', setPlayIcons); audio.addEventListener('pause', setPlayIcons);
  audio.addEventListener('ended', () => { if (loopOn) { audio.currentTime = 0; audio.play().catch(() => {}); return; } prog[nowId] = [audio.duration, audio.duration, Date.now()]; store.set('prog', prog); next(true); });
  let lastSave = 0;
  function updTime() {
    const d = audio.duration || 0, t = audio.currentTime, pct = d ? t / d * 100 : 0;
    $('#barProg').style.width = pct + '%';
    for (const [s, c, du] of [[$('#barSeek'), $('#barCur'), $('#barDur')], [$('#npSeek'), $('#npCur'), $('#npDur')], [$('#dockSeek'), $('#dockCur'), $('#dockDur')]]) {
      if (!s.matches(':active')) { s.value = pct * 10; s.style.setProperty('--p', pct + '%'); }
      c.textContent = d ? fmt(t) : '–:––'; du.textContent = d ? '-' + fmt(d - t) : '–:––';
    }
    if (Date.now() - lastSave > 4000 && d && !audio.paused) { lastSave = Date.now(); prog[nowId] = [t, d, Date.now()]; store.set('prog', prog); }
  }
  for (const ev of ['timeupdate', 'loadedmetadata', 'seeked', 'emptied']) audio.addEventListener(ev, updTime);
  for (const s of [$('#barSeek'), $('#npSeek'), $('#dockSeek')]) s.addEventListener('input', () => { s.style.setProperty('--p', s.value / 10 + '%'); if (audio.duration) audio.currentTime = s.value / 1000 * audio.duration; });
  for (const k of ['bar', 'np', 'dock']) {
    $(`#${k}Play`).addEventListener('click', toggle);
    $(`#${k}Back`).addEventListener('click', () => skip(-15)); $(`#${k}Fwd`).addEventListener('click', () => skip(15));
    $(`#${k}Prev`).addEventListener('click', prev); $(`#${k}Next`).addEventListener('click', () => next());
  }

  // ---------- נייד: שני מצבים — סרגל ⇄ נגן מלא. מחשב: סרגל + לוח בצד מלחיצה + מסך מלא ----------
  const dock = $('#dock');
  const isMob = () => !matchMedia('(min-width:1024px)').matches;
  // mode: 'now' = מתנגן עכשיו · 'queue' = התור ורשימות
  function openDock(mode = 'now') {
    if (isMob() && mode !== 'build') { openNP(mode === 'queue' ? 'queue' : null); return; } // בנייד אין לוח ביניים
    if (building && mode === 'now') mode = building.target === 'queue' && nowId ? 'queue' : 'build';
    if (building && building.target === 'queue' && mode === 'build') mode = 'queue';
    if (!nowId && mode !== 'build') return;
    dock.classList.toggle('mode-queue', mode === 'queue');
    dock.classList.toggle('mode-build', mode === 'build');
    $('#dockFrom').textContent = mode === 'build' ? 'רשימה חדשה' : mode === 'queue' ? 'התור' : 'מתנגן עכשיו';
    syncBarBtns(mode);
    if (!dock.hidden && !dock.classList.contains('is-enter')) return;
    dock.hidden = false; document.body.classList.add('dock-open');
    if (isMob()) { dock.classList.add('is-enter'); requestAnimationFrame(() => requestAnimationFrame(() => dock.classList.remove('is-enter'))); }
  }
  function minDock() {
    document.body.classList.remove('dock-open'); syncBarBtns(null);
    if (isMob()) { dock.classList.add('is-enter'); setTimeout(() => { if (!document.body.classList.contains('dock-open')) { dock.hidden = true; dock.classList.remove('is-enter'); } }, 450); }
    else dock.hidden = true;
  }
  const dockMode = () => dock.hidden ? null : dock.classList.contains('mode-build') ? 'build' : dock.classList.contains('mode-queue') ? 'queue' : 'now';
  function syncBarBtns(mode) { $('#barPanel').setAttribute('aria-pressed', mode === 'now'); $('#barQueue').setAttribute('aria-pressed', mode === 'queue'); }
  // שלושה כפתורים, שלוש פעולות שונות: לוח "מתנגן עכשיו" · לוח "התור" · מסך מלא
  $('#barPanel').addEventListener('click', () => dockMode() === 'now' ? minDock() : openDock('now'));
  $('#barQueue').addEventListener('click', () => dockMode() === 'queue' ? minDock() : openDock('queue'));
  $('#dockMin').addEventListener('click', minDock);
  $('#dockExpand').addEventListener('click', () => openNP(dockMode() === 'queue' ? 'queue' : null));
  $('#dockCover').addEventListener('click', () => openNP());
  $('#dockCover').addEventListener('keydown', e => { if (e.key === 'Enter') openNP(); });
  $$('#dock [data-full]').forEach(b => b.addEventListener('click', () => b.dataset.full === 'queue' && !isMob() ? openDock('queue') : openNP(b.dataset.full)));
  // נייד: גרירה — למעלה למסך מלא, למטה לסרגל
  let dragY = null;
  for (const h of [$('#dockGrab'), $('.dock-head')]) h.addEventListener('pointerdown', e => { if (!isMob() || e.target.closest('button')) return; dragY = e.clientY; dock.classList.add('is-drag'); h.setPointerCapture(e.pointerId); });
  document.addEventListener('pointermove', e => { if (dragY == null) return; dock.style.setProperty('--drag', Math.max(-120, e.clientY - dragY) + 'px'); });
  document.addEventListener('pointerup', e => {
    if (dragY == null) return; const dy = e.clientY - dragY; dragY = null;
    dock.classList.remove('is-drag'); dock.style.removeProperty('--drag');
    if (dy < -50) openNP(); else if (dy > 90) minDock();
  });
  for (const b of [$('#barSpeed'), $('#npSpeed')]) b.addEventListener('click', () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; audio.playbackRate = speed;
    $('#barSpeed span').textContent = $('#npSpeed .spd').textContent = speed + '×';
  });
  function openNP(pane) {
    np.hidden = false; requestAnimationFrame(() => np.classList.add('is-open'));
    setPane(pane || null);
    document.body.style.overflow = 'hidden';
  }
  function closeNP() { np.classList.remove('is-open'); document.body.style.overflow = ''; setTimeout(() => { if (!np.classList.contains('is-open')) np.hidden = true; }, 520); }
  // pane: 'text' / 'queue' / null (נייד: null = כריכה; מחשב: הלוח תמיד פתוח, ברירת מחדל טקסט)
  let pane = null;
  function setPane(p) {
    pane = p;
    const shown = p || 'text';
    np.classList.toggle('panel-open', !!p);
    $$('.np-tabs [role=tab]').forEach(t => t.setAttribute('aria-selected', t.dataset.pane === shown));
    $$('.np-pane').forEach(x => { x.hidden = x.dataset.pane !== shown; });
    $('#npTextBtn').setAttribute('aria-pressed', p === 'text'); $('#npQueueBtn').setAttribute('aria-pressed', p === 'queue');
  }
  $('#barOpen').addEventListener('click', () => (isMob() ? openNP() : dockMode() === 'now' ? minDock() : openDock('now'))); // נייד: ישר לנגן המלא · מחשב: הכריכה פותחת/סוגרת את הלוח
  $('#barExpand').addEventListener('click', () => openNP());
  // הורדה: שמירה כקובץ עם שם קריא; אם הדפדפן חוסם (הרשאות הדלי) — פותח את הקובץ בלשונית חדשה
  async function download(btn) {
    const it = byId[nowId]; if (!it) return;
    const lbl = btn.querySelector('span'); if (btn.classList.contains('is-busy')) return;
    btn.classList.add('is-busy'); lbl.textContent = 'מוריד…';
    try {
      const r = await fetch(it.url); if (!r.ok) throw new Error(r.status);
      const blob = await r.blob(), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${fullName(it).replace(/[\\/:*?"<>|]/g, '')}.m4a`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('השיעור נשמר בהורדות');
    } catch { window.open(it.url, '_blank', 'noopener'); toast('הקובץ נפתח בלשונית חדשה — שם אפשר לשמור'); }
    btn.classList.remove('is-busy'); lbl.textContent = 'הורדה';
  }
  $('#npDownload').addEventListener('click', e => download(e.currentTarget));
  $('#dock [data-act=download]').addEventListener('click', e => download(e.currentTarget));
  $('#dock [data-act=share]').addEventListener('click', () => $('#npShare').click());
  // חזרה על השיעור (לופ) — מתג בסרגל ובלוח
  let loopOn = false;
  function setLoop(on) {
    loopOn = on;
    for (const b of $$('[data-loop]')) { b.setAttribute('aria-pressed', on); const l = b.querySelector('span'); if (l) l.textContent = on ? 'חזרה: פועל' : 'חזרה'; }
    toast(on ? 'השיעור יתנגן שוב בסיום' : 'חזרה על השיעור כבויה');
  }
  $$('[data-loop]').forEach(b => b.addEventListener('click', () => setLoop(!loopOn)));
  // לימוד עם טקסט — נגן מלא, לשונית הטקסט
  $('#dock [data-act=study]').addEventListener('click', () => openNP('text'));
  $('#npCont').addEventListener('click', () => setCont(!contOn));
  $('#npClose').addEventListener('click', closeNP);
  $('#npMini').addEventListener('click', () => setPane(null));
  for (const b of [$('#npTextBtn'), $('#npQueueBtn'), ...$$('.np-tabs [role=tab]')]) b.addEventListener('click', () => setPane(pane === b.dataset.pane && !b.matches('[role=tab]') ? null : b.dataset.pane));
  $('#npShare').addEventListener('click', () => {
    const it = byId[nowId]; const url = location.origin + location.pathname + seriesHref(it);
    (navigator.share ? navigator.share({ title: fullName(it), url }) : navigator.clipboard.writeText(url).then(() => toast('הקישור הועתק'))).catch(() => {});
  });

  // ---------- נייד: מגע כמו ספוטיפיי / אפל מיוזיק (דניאל, 15.10) ----------
  // שני מצבים בלבד: סרגל קטן ⇄ נגן מלא. הנגן עוקב אחרי האצבע; ההחלטה בשחרור לפי מרחק *או* מהירות.
  // עקומה ומשך כמו גיליון של iOS (Vaul): cubic-bezier(0.32, 0.72, 0, 1), 500ms.
  const SHEET = 'transform .5s cubic-bezier(0.32, 0.72, 0, 1)';
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch {} };
  // מחווה אחת: נועלת כיוון אחרי 8px, מודדת מהירות מ-5 הנקודות האחרונות, ומבטלת את הקליק שאחרי גרירה
  function gesture(el, { ok = () => true, start, move, end }) {
    let s = null;
    el.addEventListener('pointerdown', e => {
      if (!isMob() || (e.pointerType === 'mouse' && e.button !== 0) || !ok(e)) return;
      s = { x: e.clientX, y: e.clientY, id: e.pointerId, lock: null, pts: [[performance.now(), 0, 0]] };
    });
    el.addEventListener('pointermove', e => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.lock) {
        if (Math.hypot(dx, dy) < 8) return;
        s.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (start(s.lock, dx, dy) === false) { s = null; return; }
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
      s.pts.push([performance.now(), dx, dy]); if (s.pts.length > 5) s.pts.shift();
      move(s.lock, dx, dy);
    });
    const fin = e => {
      if (!s || e.pointerId !== s.id) return;
      const g = s; s = null; if (!g.lock) return;
      const a = g.pts[0], b = g.pts[g.pts.length - 1], dt = Math.max(16, b[0] - a[0]);
      el._dragged = true; setTimeout(() => { el._dragged = false; }, 0);
      end(g.lock, b[1], b[2], (b[1] - a[1]) / dt, (b[2] - a[2]) / dt, e.type === 'pointercancel');
    };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
    el.addEventListener('click', e => { if (el._dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  // מעבר עם העקומה של הגיליון, ואז ניקוי
  function settle(el, prop, value, after) {
    el.style.transition = prop === 'transform' ? SHEET : `${prop} .5s cubic-bezier(0.32, 0.72, 0, 1)`;
    requestAnimationFrame(() => { if (prop === 'transform') el.style.transform = value; else el.style.setProperty(prop, value); });
    let done = false;
    const fin = () => { if (done) return; done = true; el.style.transition = ''; after && after(); };
    el.addEventListener('transitionend', fin, { once: true }); setTimeout(fin, 600);
  }
  const noDrag = t => t.closest('button, a, input, .np-panel, .np-tools, .np-ctl');
  const forward = dx => dx < 0; // בעברית "קדימה" זה שמאלה — החלקה שמאלה = השיעור הבא

  // 1) הסרגל: החלקה למעלה פותחת את הנגן צמוד לאצבע · החלקה הצידה מחליפה שיעור · נגיעה פותחת
  const barNow = $('#barOpen');
  gesture(bar, {
    ok: e => !e.target.closest('.bar-ctl, .bar-end'),
    start(lock, dx, dy) {
      if (lock === 'y') { if (dy > 0) return false; np.hidden = false; np.classList.add('is-drag'); np.style.transform = `translateY(${innerHeight}px)`; setPane(null); return; }
      barNow.classList.add('is-drag');
    },
    move(lock, dx, dy) {
      if (lock === 'y') np.style.transform = `translateY(${Math.max(0, innerHeight + dy)}px)`;
      else barNow.style.setProperty('--sx', dx + 'px');
    },
    end(lock, dx, dy, vx, vy) {
      if (lock === 'y') {
        const open = -dy > innerHeight * 0.2 || vy < -0.45;
        np.classList.remove('is-drag');
        if (open) { buzz(); settle(np, 'transform', 'translateY(0px)', () => { np.classList.add('is-open'); np.style.transform = ''; document.body.style.overflow = 'hidden'; }); }
        else settle(np, 'transform', `translateY(${innerHeight}px)`, () => { np.style.transform = ''; np.hidden = true; });
        return;
      }
      barNow.classList.remove('is-drag');
      const go = Math.abs(dx) > 70 || Math.abs(vx) > 0.45;
      if (!go) { settle(barNow, '--sx', '0px'); return; }
      const fwd = forward(dx); buzz();
      settle(barNow, '--sx', (fwd ? -1 : 1) * innerWidth * 0.6 + 'px', () => {
        fwd ? next() : prev();
        barNow.style.setProperty('--sx', (fwd ? 1 : -1) * innerWidth * 0.6 + 'px');
        settle(barNow, '--sx', '0px');
      });
    },
  });

  // 2) הנגן המלא: גרירה למטה סוגרת (עוקב אחרי האצבע, מעלה — התנגדות) · הכריכה: הצידה מחליפה שיעור
  gesture(np, {
    ok: e => !noDrag(e.target) && np.classList.contains('is-open'),
    start(lock) { if (lock !== 'y') return false; np.classList.add('is-drag'); },
    move(lock, dx, dy) { np.style.transform = `translateY(${dy > 0 ? dy : dy * 0.12}px)`; },
    end(lock, dx, dy, vx, vy) {
      np.classList.remove('is-drag');
      if (dy > innerHeight * 0.22 || vy > 0.45) {
        buzz(); document.body.style.overflow = '';
        settle(np, 'transform', `translateY(${innerHeight}px)`, () => { np.classList.remove('is-open'); np.style.transform = ''; np.hidden = true; });
      } else settle(np, 'transform', 'translateY(0px)', () => { np.style.transform = ''; });
    },
  });
  const npCov = $('#npCover');
  gesture(npCov, {
    ok: () => np.classList.contains('is-open'),
    start(lock) { if (lock !== 'x') return false; npCov.classList.add('is-drag'); },
    move(lock, dx) { npCov.style.setProperty('--sx', dx + 'px'); npCov.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / innerWidth)); },
    end(lock, dx, dy, vx) {
      npCov.classList.remove('is-drag');
      const go = Math.abs(dx) > innerWidth * 0.25 || Math.abs(vx) > 0.45;
      if (!go) { npCov.style.opacity = ''; settle(npCov, '--sx', '0px'); return; }
      const fwd = forward(dx); buzz();
      settle(npCov, '--sx', (fwd ? -1 : 1) * innerWidth + 'px', () => {
        fwd ? next() : prev();
        npCov.style.setProperty('--sx', (fwd ? 1 : -1) * innerWidth + 'px'); npCov.style.opacity = '';
        settle(npCov, '--sx', '0px');
      });
    },
  });

  // 3) פס ההתקדמות מתעבה בזמן גרירה (כמו אפל מיוזיק)
  for (const s of [$('#npSeek'), $('#dockSeek')]) {
    const wrap = s.closest('.np-scrub');
    s.addEventListener('pointerdown', () => wrap.classList.add('is-scrub'));
    for (const ev of ['pointerup', 'pointercancel', 'blur']) s.addEventListener(ev, () => wrap.classList.remove('is-scrub'));
  }

  function renderText(it) {
    const box = $('#npText'), dbox = $('#dockText');
    if (it.kind === 'p') {
      box.innerHTML = `<span class="ln-n">${esc(npSub(it))}</span><p class="ln">${esc(it.iyun ? it.iyun : seriesName(it))}</p>
        ${it.pdf ? `<p class="src">לשיעור יש סיכום כתוב — עיקרי הדברים, לקריאה ולהדפסה.</p><a class="pdf" href="${it.pdf}" target="_blank" rel="noopener">${icon('file')}פתיחת הסיכום</a>` : '<p class="src">לשיעור הזה אין סיכום כתוב.</p>'}`;
      dbox.innerHTML = `${esc(it.iyun ? it.iyun : seriesName(it))}<br><span class="src">${it.pdf ? 'יש סיכום כתוב לשיעור — בכפתור "סיכום" למעלה' : 'לשיעור הזה אין סיכום כתוב'}</span>`;
      return;
    }
    box.innerHTML = dbox.innerHTML = '<p class="src">טוען את לשון המשנה…</p>';
    sefariaPerek(it.masechet, it.perek).then(t => {
      if (nowId !== it.id) return;
      if (!t) { box.innerHTML = dbox.innerHTML = '<p class="src">הטקסט לא נטען כרגע.</p>'; return; }
      dbox.textContent = it.nums.map(n => t[n - 1] || '').join(' ');
      box.innerHTML = it.nums.map(n => {
        const lines = (t[n - 1] || '').split(/(?<=[.:])\s+/).filter(Boolean);
        return `<span class="ln-n">משנה ${heb(n)}</span>${lines.map(l => `<p class="ln">${esc(l)}</p>`).join('')}`;
      }).join('') + `<p class="src">הטקסט מספריא · <a href="https://www.sefaria.org.il/${SEFARIA[it.masechet]}.${it.perek}.${it.nums[0]}" target="_blank" rel="noopener" style="text-decoration:underline">לפתוח בספריא</a></p>`;
    });
  }

  // צבע מהתמונה — כמו בספוטיפיי ובאפל מיוזיק
  function tint(src) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 12; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data;
        // שלושה אזורים (עליון, תחתון, אמצע) → צבע רווי וכהה מכל אחד, כמו הרקע החי באפל מיוזיק
        const avg = (y0, y1) => { let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let xx = 0; xx < 12; xx++) { const i = (y * 12 + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n]; };
        const vivid = ([r, g, b], L) => { // HSL: רוויה למעלה, בהירות קבועה
          r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
          if (mx !== mn) { const dd = mx - mn; s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
          return `hsl(${h | 0} ${Math.min(70, s * 100 * 1.5 + 12) | 0}% ${L}%)`;
        };
        const root = document.documentElement.style;
        root.setProperty('--np-a', vivid(avg(0, 5), 38)); root.setProperty('--np-b', vivid(avg(7, 12), 24));
        root.setProperty('--np-d', vivid(avg(4, 8), 30)); root.setProperty('--np-c', vivid(avg(0, 12), 14));
      } catch {}
    };
    img.src = src;
  }

  // לחיצה על כל דבר עם data-play
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-play]'); if (!p) return;
    const onCard = p.matches('.wide, .iyun, .res');
    if (onCard && !e.target.closest('.over, .playbtn') && !e.metaKey) return; // לחיצה על הכרטיס — פותחת את הסדרה
    e.preventDefault(); play(p.dataset.play);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.ep')) play(e.target.dataset.play);
    if (e.key === ' ' && !e.target.matches('input, textarea, button, a, [role=button]')) { e.preventDefault(); toggle(); }
    if (e.key === 'Escape' && np.classList.contains('is-open')) closeNP();
  });

  let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('is-on'), 2200); }

  // מצב יום/לילה: ברירת מחדל לפי המכשיר, מתג ידני נשמר
  const mqDay = matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const t = store.get('theme', null) || (mqDay.matches ? 'day' : 'night');
    document.documentElement.dataset.theme = t;
    const b = $('#themeBtn'); b.setAttribute('aria-pressed', t === 'day'); b.querySelector('span').textContent = t === 'day' ? 'יום' : 'לילה';
    b.querySelector('use').setAttribute('href', t === 'day' ? '#i-sun' : '#i-moon');
    document.querySelector('meta[name=theme-color]').content = t === 'day' ? '#f4f1ea' : '#121110';
  }
  // רקע מצב יום — צילום מאחורי לוחות נייר שקופים-למחצה. ?bg=<מפתח> להשוואה; הבחירה הסופית — DAY_BG_DEFAULT
  const DAY_BG = {
    books: IMG('1535905496755-26ae35d0ae54', 2000),
    wheat: IMG('1529511582893-2d7e684dd128', 2000), olive: IMG('1544475925-9199e8ed85ab', 2000),
    land: 'covers/img/series/p-vezot-haberakhah.jpg', valley: 'covers/img/series/p-eikev.jpg',
    sky: 'covers/img/series/daybg-sky.jpg', 'gen-stone': 'covers/img/series/daybg-stone.jpg', 'gen-library': 'covers/img/series/daybg-library.jpg', 'gen-hills': 'covers/img/series/daybg-hills.jpg',
  };
  const DAY_BG_DEFAULT = 'sky'; // דניאל (15.10): בית = שמיים; שאר הדפים — מהכריכה שלהם
  const bgKey = params.get('bg') || DAY_BG_DEFAULT;
  if (bgKey !== 'none' && DAY_BG[bgKey]) document.documentElement.style.setProperty('--day-bg', `url("${DAY_BG[bgKey]}")`);
  else document.documentElement.classList.add('no-day-bg');
  $('#themeBtn').addEventListener('click', () => { store.set('theme', document.documentElement.dataset.theme === 'day' ? 'night' : 'day'); applyTheme(); });
  mqDay.addEventListener('change', applyTheme);
  if (params.get('theme')) store.set('theme', params.get('theme'));
  if (params.has('blend')) document.documentElement.classList.add('blend');
  applyTheme();

  if (params.get('f')) { filter = params.get('f'); $$('#topChips .chip').forEach(x => x.classList.toggle('is-on', x.dataset.f === filter)); }
  sideList();
  route();
})();
