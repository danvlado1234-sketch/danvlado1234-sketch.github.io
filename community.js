/* ============================================================================
 * מערכת תגובות ציבוריות לשיעורים ופניות פרטיות ("יצירת קשר") + מסך ניהול
 * משולב באתר "שיעורי הרב" (דף השער)
 * ============================================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const CONTACT_PHONE = '972552562033';
  const LOCAL_MODE = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && Boolean(window.__LOCAL_ADMIN_TOKENS);
  const API_BASE = LOCAL_MODE || location.pathname.startsWith('/manage') ? '' : (window.SHIURIM_API_BASE || '');
  let productionIdentity = { role: 'guest', actor_id: null };
  let productionConfig = null;
  let productionReady = Promise.resolve();
  let turnstileScript = null;

  let app = null;
  const lessonIdCache = new Map(); // mediaPath -> lesson_id
  const commentDrafts = new Map(); // mediaPath -> { body, replyToId, replyToName }

  // מצב חלונית תגובות לשיעור
  let currentMediaPath = null;
  let currentLessonId = null;
  let currentReplyTo = null; // { id, name }
  let activeRequestSeq = 0;
  let commentsReturnFocus = null;
  let commentIdempotencyKey = null;

  // מצב חלונית יצירת קשר (פניות פרטיות)
  let contactKind = null; // 'bug' | 'improvement' | 'whatsapp'
  let contactReturnFocus = null;
  let ticketIdempotencyKey = null;

  // מצב מסך ניהול
  let adminReturnFocus = null;
  let adminTab = 'comments'; // 'comments' | 'tickets'
  let adminCommentFilter = 'pending';
  let adminTicketFilter = 'new';

  function newUuid() {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  async function makeChallengeToken(action, container) {
    if (LOCAL_MODE) return `pass:${action}:${newUuid()}`;
    await productionReady;
    if (action === 'comment_create' && productionIdentity.role !== 'guest') return '';
    if (!productionConfig?.turnstile_sitekey) throw new Error('אימות הטופס אינו זמין כרגע. הטקסט נשמר.');
    if (!window.turnstile) {
      if (!turnstileScript) turnstileScript = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => { turnstileScript = null; reject(new Error('טעינת האימות נכשלה. בדקו חיבור ונסו שוב.')); };
        document.head.appendChild(script);
      });
      await turnstileScript;
    }
    const holder = document.createElement('div');
    holder.className = 'community-challenge';
    (container || (action === 'ticket_create' ? $('#feedbackForm') : $('#commentsForm'))).appendChild(holder);
    return new Promise((resolve, reject) => {
      let widget, finished = false;
      const finish = (error, token) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (widget !== undefined) window.turnstile.remove(widget);
        holder.remove();
        error ? reject(new Error(error)) : resolve(token);
      };
      const timer = setTimeout(() => finish('אימות הטופס הסתיים ללא תשובה. הטקסט נשמר; נסו שוב.'), 120000);
      try {
        widget = window.turnstile.render(holder, {
          sitekey: productionConfig.turnstile_sitekey, action, language: 'he', appearance: 'interaction-only',
          callback: token => finish(null, token),
          'error-callback': () => finish('אימות הטופס נכשל. הטקסט נשמר; נסו שוב.'),
          'expired-callback': () => finish('פג תוקף האימות. נסו שוב.'),
        });
      } catch { finish('לא ניתן להפעיל אימות כרגע. הטקסט נשמר.'); }
    });
  }

  function getCurrentRole() {
    if (!LOCAL_MODE) return productionIdentity.role;
    const sel = $('#adminRoleSelect')?.value;
    if (sel === 'rabbi' || sel === 'admin' || sel === 'guest') return sel;
    if (window.__LOCAL_ADMIN_TOKENS?.admin) return 'admin';
    if (window.__LOCAL_ADMIN_TOKENS?.rabbi) return 'rabbi';
    return 'guest';
  }

  function getAdminHeaders(roleOverride) {
    if (!LOCAL_MODE) return {};
    const role = roleOverride || getCurrentRole();
    if (role === 'guest') return {};
    const tokens = window.__LOCAL_ADMIN_TOKENS || {};
    const token =
      (role === 'rabbi'
        ? tokens.rabbi
        : tokens.admin) || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function isLocalOrAdmin() {
    return LOCAL_MODE || (productionIdentity.authenticated === true && ['admin', 'rabbi'].includes(productionIdentity.role));
  }

  async function refreshIdentity() {
    try {
      const identity = await apiFetch('/v1/auth/me');
      productionIdentity = identity.authenticated === true && ['admin', 'rabbi'].includes(identity.role)
        ? identity : { role: 'guest', actor_id: null };
    } catch {
      productionIdentity = { role: 'guest', actor_id: null };
    }
    adminOpenBtn.hidden = !isLocalOrAdmin();
    if (isLocalOrAdmin()) await refreshAdminBadge();
    else if (!adminLayer.hidden) closeAdmin();
  }

  // Drag only the handle/title. Content retains native touch scrolling and zoom.
  const sheetControllers = new WeakMap();
  function resetSheet(layer) { sheetControllers.get(layer)?.reset(); }
  function installSheetGesture(layer, close) {
    const panel = layer?.querySelector('.feedback-panel');
    if (!panel) return;
    let drag = null, animation = null;
    const mobile = () => matchMedia('(max-width: 680px)').matches;
    const reset = () => {
      const previous = drag;
      drag = null;
      animation?.cancel();
      animation = null;
      if (previous && panel.hasPointerCapture(previous.id)) panel.releasePointerCapture(previous.id);
      panel.style.removeProperty('transform');
      panel.classList.remove('sheet-moving', 'sheet-ready');
    };
    sheetControllers.set(layer, { reset });
    const settle = (offset, dismiss) => {
      const end = dismiss ? panel.getBoundingClientRect().height + 40 : 0;
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
      animation = panel.animate([
        { transform: `translate3d(0, ${offset}px, 0)` },
        { transform: `translate3d(0, ${end}px, 0)` },
      ], { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      const current = animation;
      current.finished.then(() => {
        if (animation !== current) return;
        animation = null;
        panel.style.removeProperty('transform');
        panel.classList.remove('sheet-moving');
        if (dismiss) close();
      }).catch(() => {});
    };
    panel.addEventListener('pointerdown', e => {
      if (!mobile() || layer.hidden || drag || animation || !e.isPrimary || e.button !== 0) return;
      if (!e.target.closest('.sheet-grab, .feedback-head') || e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
      panel.classList.add('sheet-ready');
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, offset: 0, moved: false,
        samples: [[e.timeStamp, e.clientY]] };
      panel.setPointerCapture(e.pointerId);
    });
    panel.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < 7) return;
      if (!drag.moved && Math.abs(dx) > Math.abs(dy)) { reset(); return; }
      drag.moved = true;
      drag.offset = Math.max(-24, dy < 0 ? dy * .12 : dy);
      drag.samples.push([e.timeStamp, e.clientY]);
      while (drag.samples.length > 2 && e.timeStamp - drag.samples[0][0] > 100) drag.samples.shift();
      panel.classList.add('sheet-moving');
      panel.style.transform = `translate3d(0, ${drag.offset}px, 0)`;
      e.preventDefault();
    });
    const finish = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const done = drag;
      drag = null;
      if (panel.hasPointerCapture(done.id)) panel.releasePointerCapture(done.id);
      if (!done.moved) return;
      const first = done.samples[0];
      const speed = (e.clientY - first[1]) / Math.max(16, e.timeStamp - first[0]);
      const dismiss = e.type === 'pointerup' && (done.offset > Math.min(140, panel.offsetHeight * .28) || (done.offset > 45 && speed > .65));
      settle(done.offset, dismiss);
    };
    panel.addEventListener('pointerup', finish);
    panel.addEventListener('pointercancel', finish);
    panel.addEventListener('lostpointercapture', () => {
      if (!drag) return;
      const offset = drag.offset;
      drag = null;
      settle(offset, false);
    });
    window.addEventListener('resize', () => { if (!mobile() || drag) reset(); });
  }

  async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
    const opts = {
      method,
      headers: {
        ...headers,
      },
      cache: 'no-store',
      credentials: 'include',
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, opts);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = (data && data.error) || `שגיאת תקשורת (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatDateHe(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  // ---------- 1. סנכרון מוני תגובות בדפי הסדרות ובנגן ----------

  async function syncVisibleCommentBadges() {
    if (!app) return;
    const badgeEls = $$('[data-cmt-badge]');
    const mediaPaths = new Set();
    for (const el of badgeEls) {
      if (el.dataset.cmtBadge) mediaPaths.add(el.dataset.cmtBadge);
    }
    const nowId = app.getNowId?.();
    if (nowId) mediaPaths.add(nowId);
    if (!mediaPaths.size) return;

    const itemsPayload = [];
    for (const mp of mediaPaths) {
      const it = app.byId[mp];
      if (!it) continue;
      itemsPayload.push({ source_kind: it.kind === 'p' ? 'p' : 'm', media_path: mp });
    }
    if (!itemsPayload.length) return;

    try {
      const res = await apiFetch('/v1/comment-counts/by-media', {
        method: 'POST',
        body: { items: itemsPayload.slice(0, 60) },
      });
      const counts = (res && res.counts) || {};
      for (const el of badgeEls) {
        const cnt = Number(counts[el.dataset.cmtBadge] || 0);
        el.textContent = String(cnt);
        el.hidden = cnt <= 0;
        const btn = el.closest('.ep-cmt');
        if (btn) btn.classList.toggle('has-comments', cnt > 0);
      }
      if (nowId) {
        const nowCnt = Number(counts[nowId] || 0);
        for (const el of $$('[data-now-cmt-badge]')) {
          el.textContent = String(nowCnt);
          el.hidden = nowCnt <= 0;
        }
      }
    } catch {
      // כשל ברשת לא מפריע להאזנה
    }
  }

  async function resolveLessonId(mediaPath) {
    if (lessonIdCache.has(mediaPath)) return lessonIdCache.get(mediaPath);
    const it = app?.byId?.[mediaPath];
    const sourceKind = it?.kind === 'p' ? 'p' : 'm';
    const displayTitle = it ? app.fullName(it) : mediaPath;
    const res = await apiFetch('/v1/lessons/resolve', {
      method: 'POST',
      body: {
        source_kind: sourceKind,
        media_path: mediaPath,
        display_title: displayTitle,
      },
    });
    if (res?.lesson?.id) {
      lessonIdCache.set(mediaPath, res.lesson.id);
      return res.lesson.id;
    }
    throw new Error('לא ניתן לזהות את השיעור');
  }

  // ---------- 2. חלונית תגובות ציבוריות לשיעור (W5) ----------

  const commentsLayer = $('#commentsLayer');
  const commentsTitle = $('#commentsTitle');
  const commentsKicker = $('#commentsKicker');
  const commentsCountLabel = $('#commentsCountLabel');
  const commentsWriteToggle = $('#commentsWriteToggle');
  const commentsForm = $('#commentsForm');
  const commentsReplyBanner = $('#commentsReplyBanner');
  const commentsReplyTarget = $('#commentsReplyTarget');
  const commentAuthor = $('#commentAuthor');
  const commentContact = $('#commentContact');
  const commentBody = $('#commentBody');
  const commentError = $('#commentError');
  const commentSubmitBtn = $('#commentSubmitBtn');
  const commentsNotice = $('#commentsNotice');
  const commentsList = $('#commentsList');

  function saveCurrentCommentDraft() {
    if (!currentMediaPath) return;
    const text = commentBody.value;
    if (text.trim()) {
      commentDrafts.set(currentMediaPath, {
        body: text,
        replyTo: currentReplyTo,
      });
    } else {
      commentDrafts.delete(currentMediaPath);
    }
  }

  function attachAutoGrow(textarea, minPx = 92, maxPx = 260) {
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = 'auto';
      const next = Math.min(Math.max(textarea.scrollHeight, minPx), maxPx);
      textarea.style.height = `${next}px`;
    };
    textarea.addEventListener('input', resize);
  }

  attachAutoGrow(commentBody, 96, 260);

  function setReplyTarget(replyObj) {
    currentReplyTo = replyObj || null;
    commentIdempotencyKey = newUuid();
    if (currentReplyTo) {
      commentsReplyBanner.hidden = false;
      commentsReplyTarget.textContent = `מענה לתגובה של ${currentReplyTo.name}`;
      commentsForm.hidden = false;
      if (getCurrentRole() === 'rabbi' && (!commentAuthor.value.trim() || commentAuthor.value === 'דניאל (צוות האתר)')) {
        commentAuthor.value = 'הרב ולדומירסקי';
      }
      setTimeout(() => {
        commentsForm.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        commentBody.focus();
      }, 40);
    } else {
      commentsReplyBanner.hidden = true;
      commentsReplyTarget.textContent = '';
    }
  }

  function makeSvgIcon(id) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'i');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${id}`);
    svg.appendChild(use);
    return svg;
  }

  function getInitialMonogram(name, role) {
    if (role === 'rabbi') return 'הרב';
    if (role === 'admin') return 'צ';
    const clean = String(name || '').trim();
    return clean ? clean[0] : 'מ';
  }

  function createCommentCardDom(item, isReply = false) {
    const isOfficial = item.author_role === 'rabbi' || item.author_role === 'admin';
    const card = document.createElement('article');
    card.className = [
      'cmt-card',
      isReply ? 'cmt-reply' : '',
      isOfficial ? `is-official-card is-role-${item.author_role}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    card.dataset.commentId = item.id;

    const head = document.createElement('header');
    head.className = 'cmt-card-head';

    const authorWrap = document.createElement('div');
    authorWrap.className = 'cmt-author-wrap';

    const avatar = document.createElement('span');
    avatar.className = `cmt-avatar${isOfficial ? ' is-official' : ''}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = getInitialMonogram(item.display_name, item.author_role);
    authorWrap.appendChild(avatar);

    const authorMeta = document.createElement('div');
    authorMeta.className = 'cmt-author-meta';

    const nameRow = document.createElement('div');
    nameRow.className = 'cmt-name-row';

    const nameEl = document.createElement('strong');
    nameEl.className = 'cmt-author';
    nameEl.dir = 'auto';
    nameEl.textContent = item.display_name;
    nameRow.appendChild(nameEl);

    if (isOfficial) {
      const badge = document.createElement('span');
      badge.className = `cmt-role-badge role-${item.author_role}`;
      badge.textContent = item.author_role === 'rabbi' ? 'תשובת הרב' : 'צוות האתר';
      nameRow.appendChild(badge);
    }

    const timeEl = document.createElement('time');
    timeEl.className = 'cmt-time';
    timeEl.dateTime = item.created_at || '';
    timeEl.textContent = formatDateHe(item.created_at);

    authorMeta.appendChild(nameRow);
    authorMeta.appendChild(timeEl);
    authorWrap.appendChild(authorMeta);
    head.appendChild(authorWrap);
    card.appendChild(head);

    const bodyEl = document.createElement('p');
    bodyEl.className = 'cmt-body';
    bodyEl.dir = 'auto';
    bodyEl.textContent = item.body;
    card.appendChild(bodyEl);

    const foot = document.createElement('footer');
    foot.className = 'cmt-foot';

    if (!isReply) {
      const replyBtn = document.createElement('button');
      replyBtn.type = 'button';
      replyBtn.className = 'cmt-act-btn';
      replyBtn.appendChild(makeSvgIcon('reply'));
      const replySpan = document.createElement('span');
      replySpan.textContent = 'מענה';
      replyBtn.appendChild(replySpan);
      replyBtn.addEventListener('click', () => {
        setReplyTarget({ id: item.id, name: item.display_name });
      });
      foot.appendChild(replyBtn);
    }

    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'cmt-act-btn cmt-report-btn';
    reportBtn.appendChild(makeSvgIcon('flag'));
    const reportSpan = document.createElement('span');
    reportSpan.textContent = 'דיווח';
    reportBtn.appendChild(reportSpan);
    foot.appendChild(reportBtn);

    const reportBox = document.createElement('div');
    reportBox.className = 'cmt-report-box';
    reportBox.hidden = true;

    const reportTitle = document.createElement('div');
    reportTitle.className = 'cmt-report-title';
    reportTitle.textContent = 'סיבת הדיווח למנהל האתר:';
    reportBox.appendChild(reportTitle);

    const reasonsRow = document.createElement('div');
    reasonsRow.className = 'cmt-report-reasons';
    const reportInput = document.createElement('input');
    reportInput.type = 'text';
    reportInput.maxLength = 300;
    reportInput.dir = 'auto';
    reportInput.className = 'cmt-report-input';
    reportInput.placeholder = 'בחרו סיבה למעלה או פרטו בקצרה…';

    for (const preset of ['תוכן לא מתאים', 'טעות בתוכן', 'ספאם / פרסומת']) {
      const rChip = document.createElement('button');
      rChip.type = 'button';
      rChip.className = 'cmt-reason-chip';
      rChip.textContent = preset;
      rChip.addEventListener('click', () => {
        $$('.cmt-reason-chip', reasonsRow).forEach((c) => c.classList.toggle('is-on', c === rChip));
        reportInput.value = preset;
      });
      reasonsRow.appendChild(rChip);
    }
    reportBox.appendChild(reasonsRow);
    reportBox.appendChild(reportInput);

    const reportActs = document.createElement('div');
    reportActs.className = 'cmt-inline-edit-acts';

    const reportCancelBtn = document.createElement('button');
    reportCancelBtn.type = 'button';
    reportCancelBtn.className = 'btn btn-ghost btn-sm';
    reportCancelBtn.textContent = 'ביטול';
    reportCancelBtn.addEventListener('click', () => {
      reportBox.hidden = true;
    });

    const reportSendBtn = document.createElement('button');
    reportSendBtn.type = 'button';
    reportSendBtn.className = 'btn btn-sm feedback-submit-btn';
    reportSendBtn.textContent = 'שליחת דיווח';
    reportSendBtn.addEventListener('click', async () => {
      const reasonText = reportInput.value.trim() || 'תוכן לא מתאים';
      reportSendBtn.disabled = true;
      try {
        await apiFetch(`/v1/comments/${encodeURIComponent(item.id)}/reports`, {
          method: 'POST',
          body: { reason: reasonText, challenge_token: await makeChallengeToken('comment_report', reportBox) },
        });
        reportBox.replaceChildren();
        const doneMsg = document.createElement('div');
        doneMsg.className = 'cmt-report-done';
        doneMsg.textContent = '✓ הדיווח נשלח ומופיע כעת בממשק הניהול לבדיקה.';
        reportBox.appendChild(doneMsg);
        reportBtn.disabled = true;
        reportSpan.textContent = 'דווח ✓';
        app?.toast?.('הדיווח נשלח לבדיקת מנהל האתר');
        refreshAdminBadge();
      } catch (err) {
        app?.toast?.(err.message || 'שגיאה בשליחת הדיווח');
        reportSendBtn.disabled = false;
      }
    });

    reportActs.appendChild(reportCancelBtn);
    reportActs.appendChild(reportSendBtn);
    reportBox.appendChild(reportActs);

    reportBtn.addEventListener('click', () => {
      if (reportBtn.disabled) return;
      reportBox.hidden = !reportBox.hidden;
      if (!reportBox.hidden) {
        setTimeout(() => {
          reportBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
          reportInput.focus();
        }, 40);
      }
    });

    // עריכת תשובה עצמית בלבד (הרב על תשובותיו או דניאל על תגובותיו)
    const activeRole = getCurrentRole();
    const canEditSelf =
      isLocalOrAdmin() &&
      (activeRole === 'rabbi' || activeRole === 'admin') &&
      item.author_role === activeRole && (LOCAL_MODE || item.can_edit === true);

    let editBox = null;
    if (canEditSelf) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cmt-act-btn cmt-edit-btn';
      editBtn.textContent = '✎ עריכה';
      foot.appendChild(editBtn);

      editBox = document.createElement('div');
      editBox.className = 'cmt-inline-edit';
      editBox.hidden = true;

      const editInput = document.createElement('textarea');
      editInput.rows = 3;
      editInput.dir = 'auto';
      editInput.value = item.body;
      attachAutoGrow(editInput, 84, 240);
      editBox.appendChild(editInput);

      const editActs = document.createElement('div');
      editActs.className = 'cmt-inline-edit-acts';

      const cancelEditBtn = document.createElement('button');
      cancelEditBtn.type = 'button';
      cancelEditBtn.className = 'btn btn-ghost btn-sm';
      cancelEditBtn.textContent = 'ביטול';
      cancelEditBtn.addEventListener('click', () => {
        editInput.value = item.body;
        editBox.hidden = true;
      });

      const saveEditBtn = document.createElement('button');
      saveEditBtn.type = 'button';
      saveEditBtn.className = 'btn btn-sm feedback-submit-btn';
      saveEditBtn.textContent = 'שמירת שינויים';
      saveEditBtn.addEventListener('click', async () => {
        const nextText = editInput.value.trim();
        if (!nextText) return;
        saveEditBtn.disabled = true;
        try {
          const res = await apiFetch(`/v1/comments/${encodeURIComponent(item.id)}`, {
            method: 'PATCH',
            headers: getAdminHeaders(activeRole),
            body: { body: nextText, expected_version: item.version },
          });
          item.body = res?.comment?.body || nextText;
          item.version = res?.comment?.version || item.version;
          bodyEl.textContent = item.body;
          editBox.hidden = true;
          app?.toast?.('השינויים בתשובה נשמרו');
        } catch (err) {
          app?.toast?.(err.message || 'שגיאה בשמירת העריכה');
        } finally {
          saveEditBtn.disabled = false;
        }
      });

      editActs.appendChild(cancelEditBtn);
      editActs.appendChild(saveEditBtn);
      editBox.appendChild(editActs);

      editBtn.addEventListener('click', () => {
        editBox.hidden = !editBox.hidden;
        if (!editBox.hidden) {
          editInput.value = item.body;
          setTimeout(() => {
            editBox.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
            editInput.focus();
          }, 40);
        }
      });
    }

    card.appendChild(foot);
    card.appendChild(reportBox);
    if (editBox) card.appendChild(editBox);

    if (!isReply && Array.isArray(item.replies) && item.replies.length > 0) {
      const repliesBox = document.createElement('div');
      repliesBox.className = 'cmt-replies';
      for (const rep of item.replies) {
        repliesBox.appendChild(createCommentCardDom(rep, true));
      }
      card.appendChild(repliesBox);
    }

    return card;
  }

  function renderCommentsList(items) {
    commentsList.replaceChildren();
    let totalVisible = 0;
    for (const root of items) {
      totalVisible += 1 + (Array.isArray(root.replies) ? root.replies.length : 0);
    }
    commentsCountLabel.textContent =
      totalVisible === 0
        ? 'עדיין אין תגובות מפורסמות לשיעור זה'
        : totalVisible === 1
        ? 'תגובה אחת'
        : `${totalVisible} תגובות`;

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cmt-empty';
      empty.textContent = 'היו הראשונים להוסיף הארה, שאלה או נקודה למחשבה על השיעור.';
      commentsList.appendChild(empty);
      return;
    }

    for (const root of items) {
      commentsList.appendChild(createCommentCardDom(root, false));
    }
  }

  async function openComments(mediaPath, triggerEl) {
    const targetPath = mediaPath || app?.getNowId?.();
    if (!targetPath) {
      app?.toast?.('בחרו שיעור כדי לצפות או להוסיף תגובות');
      return;
    }

    if (currentMediaPath && currentMediaPath !== targetPath) {
      saveCurrentCommentDraft();
    }

    currentMediaPath = targetPath;
    currentLessonId = null;
    commentsReturnFocus = triggerEl || document.activeElement;
    commentIdempotencyKey = newUuid();

    const it = app?.byId?.[targetPath];
    const artEl = $('#commentsArt');
    if (it && app?.artOf && app?.IMG && artEl) {
      artEl.src = app.IMG(app.artOf(it), 160, 160);
      artEl.hidden = false;
    } else if (artEl) {
      artEl.hidden = true;
    }
    if (it) {
      const sName = it.kind === 'm' ? `מסכת ${it.masechet} · סדר ${it.seder}` : app.seriesName(it);
      commentsKicker.textContent = sName;
      commentsTitle.textContent = app.epName(it) || app.fullName(it);
    } else {
      commentsKicker.textContent = 'תגובות על השיעור';
      commentsTitle.textContent = targetPath;
    }
    commentsCountLabel.textContent = 'טוען תגובות…';
    commentsNotice.hidden = true;
    commentError.hidden = true;

    // שחזור טיוטה אם נשמרה לשיעור זה
    const saved = commentDrafts.get(targetPath);
    if (saved) {
      commentBody.value = saved.body;
      setReplyTarget(saved.replyTo || null);
      commentsForm.hidden = false;
    } else {
      commentBody.value = '';
      setReplyTarget(null);
      commentsForm.hidden = true;
    }

    // שמירת שם המגיב במכשיר לנוחות (או מילוי אוטומטי כשמחוברים כרב)
    const activeRole = getCurrentRole();
    if (activeRole === 'rabbi' && (!commentAuthor.value || commentAuthor.value === 'דניאל (צוות האתר)')) {
      commentAuthor.value = 'הרב ולדומירסקי';
    } else {
      const savedName = localStorage.getItem('shiurim.commentAuthor') || '';
      if (savedName && !commentAuthor.value) commentAuthor.value = savedName;
    }

    commentsList.replaceChildren();
    const loadingEl = document.createElement('p');
    loadingEl.className = 'cmt-loading';
    loadingEl.textContent = 'טוען תגובות לשיעור…';
    commentsList.appendChild(loadingEl);

    resetSheet(commentsLayer);
    commentsLayer.hidden = false;
    document.body.classList.add('feedback-open');
    commentsWriteToggle.focus();

    const reqSeq = ++activeRequestSeq;
    try {
      const lessonId = await resolveLessonId(targetPath);
      if (reqSeq !== activeRequestSeq) return;
      currentLessonId = lessonId;

      const data = await apiFetch(`/v1/lessons/${encodeURIComponent(lessonId)}/comments`);
      if (reqSeq !== activeRequestSeq) return;
      renderCommentsList(data.items || []);
    } catch (err) {
      if (reqSeq !== activeRequestSeq) return;
      commentsCountLabel.textContent = 'לא ניתן לטעון תגובות כרגע';
      commentsList.replaceChildren();
      const errBox = document.createElement('p');
      errBox.className = 'cmt-empty';
      errBox.textContent = err.message || 'שגיאה בטעינת התגובות.';
      commentsList.appendChild(errBox);
    }
  }

  function closeComments() {
    saveCurrentCommentDraft();
    resetSheet(commentsLayer);
    commentsLayer.hidden = true;
    if ($('#feedback').hidden && $('#adminLayer').hidden) {
      document.body.classList.remove('feedback-open');
    }
    if (commentsReturnFocus && commentsReturnFocus.isConnected) {
      commentsReturnFocus.focus();
    }
  }

  commentsWriteToggle?.addEventListener('click', () => {
    commentsForm.hidden = !commentsForm.hidden;
    commentError.hidden = true;
    if (!commentsForm.hidden) {
      commentIdempotencyKey = newUuid();
      if (getCurrentRole() === 'rabbi' && !commentAuthor.value.trim()) {
        commentAuthor.value = 'הרב ולדומירסקי';
      }
      (commentAuthor.value.trim() ? commentBody : commentAuthor).focus();
    }
  });

  $('#commentFormCancel')?.addEventListener('click', () => {
    commentsForm.hidden = true;
    setReplyTarget(null);
    commentError.hidden = true;
  });

  $('#commentsCancelReply')?.addEventListener('click', () => {
    setReplyTarget(null);
  });

  $('#commentsClose')?.addEventListener('click', closeComments);
  commentsLayer?.addEventListener('click', (e) => {
    if (e.target === commentsLayer) closeComments();
  });

  commentsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    commentError.hidden = true;

    const displayName = commentAuthor.value.trim();
    const bodyText = commentBody.value.trim();
    const contactText = commentContact.value.trim();
    const submittedPath = currentMediaPath;
    const submittedParent = currentReplyTo ? currentReplyTo.id : null;
    const submittedKey = commentIdempotencyKey || (commentIdempotencyKey = newUuid());

    if (!displayName) {
      commentError.textContent = 'נא להזין שם להצגה.';
      commentError.hidden = false;
      commentAuthor.focus();
      return;
    }
    if (!bodyText) {
      commentError.textContent = 'נא לכתוב את תוכן התגובה.';
      commentError.hidden = false;
      commentBody.focus();
      return;
    }

    commentSubmitBtn.disabled = true;
    try {
      const activeRole = getCurrentRole();
      const isOfficial = activeRole === 'rabbi' || activeRole === 'admin';
      if (!isOfficial) {
        localStorage.setItem('shiurim.commentAuthor', displayName);
      }
      const lessonId = currentLessonId || (await resolveLessonId(submittedPath));
      if (currentMediaPath === submittedPath) currentLessonId = lessonId;

      const res = await apiFetch('/v1/comments', {
        method: 'POST',
        headers: {
          ...(isOfficial ? getAdminHeaders(activeRole) : {}),
          'Idempotency-Key': submittedKey,
        },
        body: {
          lesson_id: lessonId,
          parent_id: submittedParent,
          display_name: displayName,
          body: bodyText,
          contact_if_provided: contactText || null,
          publish_immediately: isOfficial,
          challenge_token: await makeChallengeToken('comment_create'),
        },
      });

      // תשובה מאוחרת אינה מנקה טיוטה של שיעור אחר או טקסט שנערך בזמן ההמתנה.
      if (currentMediaPath !== submittedPath || commentBody.value.trim() !== bodyText ||
          commentAuthor.value.trim() !== displayName || commentContact.value.trim() !== contactText ||
          (currentReplyTo ? currentReplyTo.id : null) !== submittedParent) {
        app?.toast?.(res?.message || 'התגובה הקודמת נקלטה במערכת.');
        syncVisibleCommentBadges();
        return;
      }
      // ניקוי הטופס והטיוטה רק לאחר הצלחה
      commentBody.value = '';
      commentDrafts.delete(currentMediaPath);
      setReplyTarget(null);
      commentsForm.hidden = true;
      commentIdempotencyKey = newUuid();

      if (res?.status === 'published') {
        commentsNotice.textContent =
          activeRole === 'rabbi'
            ? 'תשובת הרב פורסמה מיד באתר.'
            : 'התגובה הרשמית פורסמה מיד באתר.';
        commentsNotice.hidden = false;
        const fresh = await apiFetch(`/v1/lessons/${encodeURIComponent(lessonId)}/comments`);
        renderCommentsList(fresh.items || []);
        await syncVisibleCommentBadges();
      } else {
        commentsNotice.textContent =
          res?.message || 'התגובה נשלחה ונקלטה במערכת. היא תופיע באתר לאחר אישור קצר.';
        commentsNotice.hidden = false;
      }
      refreshAdminBadge();
    } catch (err) {
      if (currentMediaPath === submittedPath) {
        commentError.textContent = err.message || 'שגיאה בשליחת התגובה. הטקסט שכתבתם נשמר.';
        commentError.hidden = false;
      } else app?.toast?.('שליחת התגובה הקודמת לא אושרה. הטיוטה נשמרה.');
      // מפתח השליחה נשמר אחרי אובדן תשובת רשת; טוקן האימות יוחלף בניסיון הבא.
    } finally {
      commentSubmitBtn.disabled = false;
    }
  });

  // ---------- 3. חלונית יצירת קשר — פניות פרטיות ווואטסאפ (W6) ----------

  const feedback = $('#feedback');
  const feedbackTitle = $('#feedbackTitle');
  const feedbackContext = $('#feedbackContext');
  const contactChoices = $('#contactChoices');
  const feedbackForm = $('#feedbackForm');
  const feedbackWhatsappView = $('#feedbackWhatsappView');
  const feedbackSuccess = $('#feedbackSuccess');
  const feedbackSender = $('#feedbackSender');
  const feedbackContact = $('#feedbackContact');
  const feedbackText = $('#feedbackText');
  const feedbackError = $('#feedbackError');
  const feedbackSubmitBtn = $('#feedbackSubmitBtn');
  const feedbackRefCode = $('#feedbackRefCode');
  const feedbackWhatsappText = $('#feedbackWhatsappText');
  const feedbackSend = $('#feedbackSend');

  for (const field of [commentAuthor, commentContact, commentBody]) {
    field?.addEventListener('input', () => { commentIdempotencyKey = newUuid(); });
  }
  for (const field of [feedbackSender, feedbackContact, feedbackText]) {
    field?.addEventListener('input', () => { ticketIdempotencyKey = newUuid(); });
  }

  const CONTACT_META = {
    bug: {
      title: 'דיווח על תקלה',
      ctx: 'דיווח פרטי לצוות האתר — אינו מתפרסם באתר.',
      ph: 'מה לא עבד כשורה? (למשל: הקלטה שלא מתנגנת, טעות בסיכום, או כפתור שלא מגיב)',
    },
    improvement: {
      title: 'הצעה לשיפור',
      ctx: 'הצעה פרטית לצוות האתר — נשמרת במערכת הפניות.',
      ph: 'איזה שיפור או תוספת יקלו עליכם בלימוד או בהאזנה?',
    },
    whatsapp: {
      title: 'פנייה בווטסאפ',
      ctx: 'מעבר לוואטסאפ לשליחת הודעה ישירה לדניאל.',
    },
  };

  function showContactChoicesView() {
    contactKind = null;
    feedbackTitle.textContent = 'יצירת קשר';
    feedbackContext.textContent = 'פנייה פרטית לצוות האתר — אינה מתפרסמת באתר.';
    contactChoices.hidden = false;
    feedbackForm.hidden = true;
    feedbackWhatsappView.hidden = true;
    feedbackSuccess.hidden = true;
    feedbackError.hidden = true;
    $('[data-contact-type]')?.focus();
  }

  function openContactChoice(kind) {
    const meta = CONTACT_META[kind];
    if (!meta) return;
    if (contactKind && contactKind !== kind && !feedbackText.value.trim()) {
      feedbackError.hidden = true;
    }
    contactKind = kind;
    ticketIdempotencyKey = newUuid();
    feedbackTitle.textContent = meta.title;
    feedbackContext.textContent = meta.ctx;
    contactChoices.hidden = true;
    feedbackSuccess.hidden = true;
    feedbackError.hidden = true;

    if (kind === 'whatsapp') {
      feedbackForm.hidden = true;
      feedbackWhatsappView.hidden = false;
      updateWhatsappHref();
      feedbackWhatsappText.focus();
    } else {
      feedbackWhatsappView.hidden = true;
      feedbackForm.hidden = false;
      feedbackText.placeholder = meta.ph;
      feedbackText.focus();
    }
  }

  function updateWhatsappHref() {
    const msg = feedbackWhatsappText?.value?.trim() || '';
    const textParam = msg ? `שלום דניאל,\n${msg}` : 'שלום דניאל, פנייה מאתר שיעורי הרב:';
    if (feedbackSend) {
      feedbackSend.href = `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(textParam)}`;
    }
  }

  feedbackWhatsappText?.addEventListener('input', updateWhatsappHref);

  function openContact(triggerEl) {
    contactReturnFocus = triggerEl || document.activeElement;
    resetSheet(feedback);
    feedback.hidden = false;
    document.body.classList.add('feedback-open');
    showContactChoicesView();
  }

  function closeContact() {
    resetSheet(feedback);
    feedback.hidden = true;
    if (commentsLayer.hidden && $('#adminLayer').hidden) {
      document.body.classList.remove('feedback-open');
    }
    if (contactReturnFocus && contactReturnFocus.isConnected) {
      contactReturnFocus.focus();
    }
  }

  $$('[data-contact-type]').forEach((btn) => {
    btn.addEventListener('click', () => openContactChoice(btn.dataset.contactType));
  });

  $('#feedbackBack')?.addEventListener('click', showContactChoicesView);
  $('#feedbackWhatsappBack')?.addEventListener('click', showContactChoicesView);
  $('#feedbackNewBtn')?.addEventListener('click', () => {
    feedbackText.value = '';
    showContactChoicesView();
  });
  $('#feedbackDoneBtn')?.addEventListener('click', closeContact);
  $('#feedbackClose')?.addEventListener('click', closeContact);
  feedback?.addEventListener('click', (e) => {
    if (e.target === feedback) closeContact();
  });

  feedbackForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedbackError.hidden = true;

    const bodyText = feedbackText.value.trim();
    const submittedKind = contactKind;
    const submittedSender = feedbackSender.value.trim();
    const submittedContact = feedbackContact.value.trim();
    const submittedKey = ticketIdempotencyKey || (ticketIdempotencyKey = newUuid());
    if (!bodyText) {
      feedbackError.textContent = 'נא לכתוב את תוכן הפנייה.';
      feedbackError.hidden = false;
      feedbackText.focus();
      return;
    }

    feedbackSubmitBtn.disabled = true;
    try {
      const res = await apiFetch('/v1/tickets', {
        method: 'POST',
        headers: {
          'Idempotency-Key': submittedKey,
        },
        body: {
          category: submittedKind === 'improvement' ? 'improvement' : 'bug',
          body: bodyText,
          sender_name: submittedSender || null,
          contact: submittedContact || null,
          challenge_token: await makeChallengeToken('ticket_create'),
        },
      });

      if (contactKind !== submittedKind || feedbackText.value.trim() !== bodyText ||
          feedbackSender.value.trim() !== submittedSender || feedbackContact.value.trim() !== submittedContact) {
        app?.toast?.(`הפנייה הקודמת נקלטה: ${res?.reference || ''}`);
        return;
      }
      feedbackText.value = '';
      feedbackForm.hidden = true;
      feedbackRefCode.textContent = res?.reference || 'REF-OK';
      feedbackSuccess.hidden = false;
      ticketIdempotencyKey = newUuid();
      refreshAdminBadge();
    } catch (err) {
      feedbackError.textContent = err.message || 'שגיאה בשליחת הפנייה. הטקסט שכתבתם נשמר.';
      feedbackError.hidden = false;
    } finally {
      feedbackSubmitBtn.disabled = false;
    }
  });

  // ---------- 4. מסך ניהול תגובות ופניות (W7) ----------

  const adminLayer = $('#adminLayer');
  const adminOpenBtn = $('#adminOpen');
  const adminPendingBadge = $('#adminPendingBadge');
  const adminCommentsCount = $('#adminCommentsCount');
  const adminTicketsCount = $('#adminTicketsCount');
  const adminCommentFilters = $('#adminCommentFilters');
  const adminTicketFilters = $('#adminTicketFilters');
  const adminBody = $('#adminBody');
  const adminRoleSelect = $('#adminRoleSelect');

  function syncRoleUi() {
    const role = getCurrentRole();
    const isRabbi = role === 'rabbi';
    const kickerEl = adminLayer?.querySelector('.comments-kicker');
    const titleEl = $('#adminTitle');
    const ticketsTabBtn = $('[data-admin-tab="tickets"]');
    const exportBtn = $('#adminExportBtn');
    const hiddenFilterBtn = $('[data-cmt-filter="hidden"]');
    const reportedFilterBtn = $('[data-cmt-filter="reported"]');
    const topBtnLabel = adminOpenBtn?.querySelector('.contact-label');

    if (kickerEl) kickerEl.textContent = isRabbi ? 'אזור הרב ולדומירסקי' : 'ממשק ניהול (חשבון דניאל)';
    if (titleEl) titleEl.textContent = isRabbi ? 'שאלות ותגובות לשיעורים' : 'ניהול תגובות ופניות';
    if (ticketsTabBtn) ticketsTabBtn.hidden = isRabbi;
    if (exportBtn) exportBtn.hidden = isRabbi;
    if (hiddenFilterBtn) hiddenFilterBtn.hidden = isRabbi;
    if (reportedFilterBtn) reportedFilterBtn.hidden = isRabbi;
    if (topBtnLabel) topBtnLabel.textContent = isRabbi ? 'שאלות לרב' : 'ניהול';

    if (isRabbi && adminTab === 'tickets') {
      adminTab = 'comments';
      $$('[data-admin-tab]').forEach((b) => {
        const on = b.dataset.adminTab === 'comments';
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on);
      });
      adminCommentFilters.hidden = false;
      adminTicketFilters.hidden = true;
    }
  }

  async function refreshAdminBadge() {
    if (!isLocalOrAdmin()) { adminOpenBtn.hidden = true; return; }
    const role = getCurrentRole();
    if (role === 'guest') {
      adminOpenBtn.hidden = true;
      return;
    }
    adminOpenBtn.hidden = false;
    syncRoleUi();
    try {
      const cmtsPromise = apiFetch('/v1/admin/comments?status=pending', { headers: getAdminHeaders(role) });
      const repPromise =
        role === 'admin'
          ? apiFetch('/v1/admin/comments?status=reported', { headers: getAdminHeaders('admin') })
          : Promise.resolve({ items: [] });
      const tktsPromise =
        role === 'admin'
          ? apiFetch('/v1/admin/tickets?state=new', { headers: getAdminHeaders('admin') })
          : Promise.resolve({ items: [] });
      const [cmts, reps, tkts] = await Promise.all([cmtsPromise, repPromise, tktsPromise]);
      const pCount = (cmts?.items || []).length;
      const rCount = (reps?.items || []).length;
      const tCount = (tkts?.items || []).length;
      const total = role === 'admin' ? pCount + rCount + tCount : pCount;
      adminCommentsCount.textContent = String(role === 'admin' ? pCount + rCount : pCount);
      const repCountEl = $('#adminReportedCount');
      if (repCountEl) {
        repCountEl.textContent = String(rCount);
        repCountEl.hidden = rCount <= 0;
      }
      adminTicketsCount.textContent = String(tCount);
      adminPendingBadge.textContent = String(total);
      adminPendingBadge.hidden = total <= 0;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        productionIdentity = { role: 'guest', actor_id: null };
        adminOpenBtn.hidden = true;
        if (!adminLayer.hidden) closeAdmin();
      }
    }
  }

  async function renderAdminContent() {
    syncRoleUi();
    const role = getCurrentRole();
    adminBody.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'cmt-loading';
    loading.textContent = role === 'rabbi' ? 'טוען שאלות ותגובות…' : 'טוען נתוני ניהול…';
    adminBody.appendChild(loading);

    try {
      if (adminTab === 'comments' || role === 'rabbi') {
        const q = adminCommentFilter ? `?status=${encodeURIComponent(adminCommentFilter)}` : '';
        const data = await apiFetch(`/v1/admin/comments${q}`, { headers: getAdminHeaders(role) });
        renderAdminComments(data.items || []);
      } else {
        const q = adminTicketFilter ? `?state=${encodeURIComponent(adminTicketFilter)}` : '';
        const data = await apiFetch(`/v1/admin/tickets${q}`, { headers: getAdminHeaders('admin') });
        renderAdminTickets(data.items || []);
      }
      refreshAdminBadge();
    } catch (err) {
      adminBody.replaceChildren();
      const p = document.createElement('p');
      p.className = 'cmt-empty';
      p.textContent = err.message || 'שגיאה בטעינת נתוני הניהול';
      adminBody.appendChild(p);
    }
  }

  function renderAdminComments(items) {
    const role = getCurrentRole();
    const isRabbi = role === 'rabbi';
    adminBody.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'cmt-empty';
      empty.textContent = 'אין תגובות בסינון הנוכחי.';
      adminBody.appendChild(empty);
      return;
    }

    for (const item of items) {
      const card = document.createElement('article');
      card.className = `admin-card status-${item.status}`;
      card.dataset.adminCommentId = item.id;

      const topRow = document.createElement('div');
      topRow.className = 'admin-card-top';

      const meta = document.createElement('div');
      const lessonRow = document.createElement('div');
      lessonRow.className = 'admin-lesson-row';
      const lessonStrong = document.createElement('strong');
      lessonStrong.className = 'admin-lesson-title';
      lessonStrong.textContent = item.lesson_title || item.lesson_id;
      lessonRow.appendChild(lessonStrong);

      if (item.media_path) {
        const jumpBtn = document.createElement('button');
        jumpBtn.type = 'button';
        jumpBtn.className = 'admin-lesson-jump';
        jumpBtn.textContent = 'לשיעור ↗';
        jumpBtn.addEventListener('click', () => {
          closeAdmin();
          openComments(item.media_path);
        });
        lessonRow.appendChild(jumpBtn);
      }
      meta.appendChild(lessonRow);

      const sub = document.createElement('div');
      sub.className = 'admin-sub';
      sub.textContent = `מאת: ${item.display_name}${isRabbi ? '' : ` (${item.author_role})`} · ${formatDateHe(item.created_at)}${
        !isRabbi && item.contact_if_provided ? ` · קשר: ${item.contact_if_provided}` : ''
      }`;
      meta.appendChild(sub);

      const statusBadge = document.createElement('span');
      statusBadge.className = `admin-status-pill is-${item.status}`;
      statusBadge.textContent =
        item.status === 'pending'
          ? 'ממתינה לאישור'
          : item.status === 'published'
          ? 'מפורסמת'
          : item.status === 'hidden'
          ? 'מוסתרת'
          : item.status;

      topRow.appendChild(meta);
      topRow.appendChild(statusBadge);
      card.appendChild(topRow);

      if (!isRabbi && Number(item.open_reports_count) > 0) {
        const repAlert = document.createElement('div');
        repAlert.className = 'admin-report-alert';
        repAlert.textContent = `⚑ דווח ע"י משתמש (${item.open_reports_count}): ${item.report_reasons || 'דיווח ממשתמש'}`;
        card.appendChild(repAlert);
      }

      const bodyP = document.createElement('p');
      bodyP.className = 'cmt-body';
      bodyP.dir = 'auto';
      bodyP.textContent = item.body;
      card.appendChild(bodyP);

      const acts = document.createElement('div');
      acts.className = 'admin-card-acts';

      if (!isRabbi && Number(item.open_reports_count) > 0) {
        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.className = 'btn btn-ghost btn-sm';
        dismissBtn.dataset.adminAction = 'dismiss-reports';
        dismissBtn.textContent = 'סימון הדיווח כתקין ✓';
        dismissBtn.addEventListener('click', async () => {
          dismissBtn.disabled = true;
          try {
            await apiFetch(`/v1/admin/comments/${encodeURIComponent(item.id)}/dismiss-reports`, {
              method: 'POST',
              headers: getAdminHeaders('admin'),
            });
            app?.toast?.('הדיווח נסגר והתגובה נשארה באתר');
            await renderAdminContent();
          } catch (e) {
            app?.toast?.(e.message);
            dismissBtn.disabled = false;
          }
        });
        acts.appendChild(dismissBtn);
      }

      if (!isRabbi && item.status !== 'published') {
        const approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.className = 'btn btn-sm feedback-submit-btn';
        approveBtn.dataset.adminAction = 'approve';
        approveBtn.textContent = item.status === 'hidden' ? 'שחזור ופרסום' : 'אישור ופרסום';
        approveBtn.addEventListener('click', async () => {
          approveBtn.disabled = true;
          try {
            await apiFetch(`/v1/admin/comments/${encodeURIComponent(item.id)}/moderation`, {
              method: 'POST',
              headers: getAdminHeaders(),
              body: { status: 'published', expected_version: item.version },
            });
            app?.toast?.('התגובה אושרה ופורסמה');
            await renderAdminContent();
            await syncVisibleCommentBadges();
          } catch (e) {
            app?.toast?.(e.message);
            approveBtn.disabled = false;
          }
        });
        acts.appendChild(approveBtn);
      }

      if (!isRabbi && item.status !== 'hidden') {
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'btn btn-ghost btn-sm';
        hideBtn.dataset.adminAction = 'hide';
        hideBtn.textContent = 'הסתרה';
        hideBtn.addEventListener('click', async () => {
          hideBtn.disabled = true;
          try {
            await apiFetch(`/v1/admin/comments/${encodeURIComponent(item.id)}/moderation`, {
              method: 'POST',
              headers: getAdminHeaders(),
              body: { status: 'hidden', expected_version: item.version },
            });
            app?.toast?.('התגובה הוסתרה (ניתן למחוק אותה לצמיתות בלשונית "מוסתרות")');
            await renderAdminContent();
            await syncVisibleCommentBadges();
          } catch (e) {
            app?.toast?.(e.message);
            hideBtn.disabled = false;
          }
        });
        acts.appendChild(hideBtn);
      }

      // מחיקה לצמיתות — זמינה למנהל בלבד ורק לאחר שהתגובה כבר במצב "מוסתרת" (hidden)
      if (!isRabbi && item.status === 'hidden') {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-sm admin-delete-btn';
        delBtn.dataset.adminAction = 'delete';
        delBtn.textContent = 'מחיקה לצמיתות';
        let armed = false;
        delBtn.addEventListener('click', async () => {
          if (!armed) {
            armed = true;
            delBtn.classList.add('is-confirming');
            delBtn.textContent = 'אישור מחיקה סופית?';
            setTimeout(() => {
              if (armed && delBtn.isConnected) {
                armed = false;
                delBtn.classList.remove('is-confirming');
                delBtn.textContent = 'מחיקה לצמיתות';
              }
            }, 4000);
            return;
          }
          delBtn.disabled = true;
          try {
            await apiFetch(
              `/v1/admin/comments/${encodeURIComponent(item.id)}?expected_version=${encodeURIComponent(item.version)}`,
              {
                method: 'DELETE',
                headers: getAdminHeaders('admin'),
              }
            );
            app?.toast?.('התגובה נמחקה לצמיתות');
            await renderAdminContent();
            await syncVisibleCommentBadges();
          } catch (e) {
            app?.toast?.(e.message);
            delBtn.disabled = false;
          }
        });
        acts.appendChild(delBtn);
      }

      // עריכת תשובה עצמית בלבד (הרב על תשובותיו / דניאל על תגובותיו)
      let selfEditBox = null;
      if (item.author_role === role && (LOCAL_MODE || item.author_id === productionIdentity.actor_id)) {
        const editOwnBtn = document.createElement('button');
        editOwnBtn.type = 'button';
        editOwnBtn.className = 'btn btn-ghost btn-sm';
        editOwnBtn.dataset.adminAction = 'edit-own';
        editOwnBtn.textContent = '✎ עריכת התשובה';
        acts.appendChild(editOwnBtn);

        selfEditBox = document.createElement('div');
        selfEditBox.className = 'admin-reply-box';
        selfEditBox.hidden = true;

        const editInput = document.createElement('textarea');
        editInput.rows = 3;
        editInput.dir = 'auto';
        editInput.value = item.body;
        attachAutoGrow(editInput, 88, 240);
        selfEditBox.appendChild(editInput);

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-sm feedback-submit-btn';
        saveBtn.textContent = 'שמירת שינויים בתשובה';
        saveBtn.addEventListener('click', async () => {
          const nextTxt = editInput.value.trim();
          if (!nextTxt) return;
          saveBtn.disabled = true;
          try {
            await apiFetch(`/v1/comments/${encodeURIComponent(item.id)}`, {
              method: 'PATCH',
              headers: getAdminHeaders(role),
              body: { body: nextTxt, expected_version: item.version },
            });
            app?.toast?.('השינויים בתשובה נשמרו');
            await renderAdminContent();
          } catch (e) {
            app?.toast?.(e.message);
            saveBtn.disabled = false;
          }
        });
        selfEditBox.appendChild(saveBtn);

        editOwnBtn.addEventListener('click', () => {
          selfEditBox.hidden = !selfEditBox.hidden;
          if (!selfEditBox.hidden) {
            editInput.value = item.body;
            setTimeout(() => {
              card.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
              editInput.focus();
            }, 40);
          }
        });
      }

      // כפתור מענה רשמי (כמנהל או כרב)
      if (!item.parent_id) {
        const replyToggleBtn = document.createElement('button');
        replyToggleBtn.type = 'button';
        replyToggleBtn.className = isRabbi ? 'btn btn-sm feedback-submit-btn' : 'btn btn-ghost btn-sm';
        replyToggleBtn.dataset.adminAction = 'reply-open';
        replyToggleBtn.textContent = isRabbi ? 'כתיבת תשובת הרב' : 'מענה רשמי';
        acts.appendChild(replyToggleBtn);

        const replyBox = document.createElement('div');
        replyBox.className = 'admin-reply-box';
        replyBox.hidden = true;

        const replyInput = document.createElement('textarea');
        replyInput.rows = 3;
        replyInput.dir = 'auto';
        replyInput.placeholder = isRabbi
          ? 'כתבו את תשובת הרב — תתפרסם מיד באתר תחת שאלת המאזין…'
          : 'כתבו תשובה רשמית שתתפרסם מיד תחת התגובה…';
        attachAutoGrow(replyInput, 88, 240);
        replyBox.appendChild(replyInput);

        const replySend = document.createElement('button');
        let replySubmissionKey = newUuid();
        replyInput.addEventListener('input', () => { replySubmissionKey = newUuid(); });
        replySend.type = 'button';
        replySend.className = 'btn btn-sm feedback-submit-btn';
        replySend.textContent = isRabbi ? 'פרסום תשובת הרב' : 'פרסום תשובה רשמית';
        replySend.addEventListener('click', async () => {
          const txt = replyInput.value.trim();
          if (!txt) return;
          replySend.disabled = true;
          try {
            const currentRole = getCurrentRole();
            // אם תגובת ההורה עדיין pending — נאשר אותה קודם כדי שהתשובה תופיע תחתיה
            if (item.status === 'pending') {
              await apiFetch(`/v1/admin/comments/${encodeURIComponent(item.id)}/moderation`, {
                method: 'POST',
                headers: getAdminHeaders(currentRole),
                body: { status: 'published', expected_version: item.version },
              });
            }
            await apiFetch('/v1/comments', {
              method: 'POST',
              headers: {
                ...getAdminHeaders(currentRole),
                'Idempotency-Key': replySubmissionKey,
              },
              body: {
                lesson_id: item.lesson_id,
                parent_id: item.id,
                display_name: currentRole === 'rabbi' ? 'הרב ולדומירסקי' : 'דניאל (צוות האתר)',
                body: txt,
                publish_immediately: true,
                turnstile_token: await makeChallengeToken('comment_create'),
              },
            });
            app?.toast?.(currentRole === 'rabbi' ? 'תשובת הרב פורסמה באתר' : 'התשובה הרשמית פורסמה');
            await renderAdminContent();
            await syncVisibleCommentBadges();
          } catch (e) {
            app?.toast?.(e.message);
            replySend.disabled = false;
          }
        });
        replyBox.appendChild(replySend);

        replyToggleBtn.addEventListener('click', () => {
          replyBox.hidden = !replyBox.hidden;
          if (!replyBox.hidden) {
            setTimeout(() => {
              card.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
              replyInput.focus();
            }, 40);
          }
        });

        card.appendChild(acts);
        if (selfEditBox) card.appendChild(selfEditBox);
        card.appendChild(replyBox);
      } else {
        card.appendChild(acts);
        if (selfEditBox) card.appendChild(selfEditBox);
      }

      adminBody.appendChild(card);
    }
  }

  function renderAdminTickets(items) {
    adminBody.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'cmt-empty';
      empty.textContent = 'אין פניות פרטיות בסינון הנוכחי.';
      adminBody.appendChild(empty);
      return;
    }

    for (const tkt of items) {
      const card = document.createElement('article');
      card.className = `admin-card state-${tkt.state}`;
      card.dataset.adminTicketId = tkt.id;

      const topRow = document.createElement('div');
      topRow.className = 'admin-card-top';

      const meta = document.createElement('div');
      const titleEl = document.createElement('strong');
      titleEl.className = 'admin-lesson-title';
      titleEl.textContent = `${tkt.category === 'improvement' ? 'הצעה לשיפור' : 'דיווח על תקלה'} · ${tkt.reference}`;
      meta.appendChild(titleEl);

      const sub = document.createElement('div');
      sub.className = 'admin-sub';
      sub.textContent = `${ formatDateHe(tkt.created_at) }${tkt.sender_name ? ` · פונה: ${tkt.sender_name}` : ''}${
        tkt.contact ? ` · חזרה: ${tkt.contact}` : ''
      }`;
      meta.appendChild(sub);

      const badge = document.createElement('span');
      badge.className = `admin-status-pill is-${tkt.state}`;
      badge.textContent =
        tkt.state === 'new'
          ? 'חדשה'
          : tkt.state === 'in_progress'
          ? 'בטיפול'
          : tkt.state === 'resolved'
          ? 'טופלה'
          : tkt.state;

      topRow.appendChild(meta);
      topRow.appendChild(badge);
      card.appendChild(topRow);

      const bodyP = document.createElement('p');
      bodyP.className = 'cmt-body';
      bodyP.dir = 'auto';
      bodyP.textContent = tkt.body;
      card.appendChild(bodyP);

      const acts = document.createElement('div');
      acts.className = 'admin-card-acts';

      for (const [nextState, label] of [
        ['in_progress', 'העברה לטיפול'],
        ['resolved', 'סיום טיפול ✓'],
        ['spam', 'ספאם'],
      ]) {
        if (tkt.state === nextState) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = nextState === 'resolved' ? 'btn btn-sm feedback-submit-btn' : 'btn btn-ghost btn-sm';
        btn.dataset.ticketState = nextState;
        btn.textContent = label;
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await apiFetch(`/v1/admin/tickets/${encodeURIComponent(tkt.id)}`, {
              method: 'PATCH',
              headers: getAdminHeaders(),
              body: { state: nextState, expected_version: tkt.version },
            });
            app?.toast?.('מצב הפנייה עודכן');
            await renderAdminContent();
          } catch (e) {
            app?.toast?.(e.message);
            btn.disabled = false;
          }
        });
        acts.appendChild(btn);
      }

      card.appendChild(acts);
      adminBody.appendChild(card);
    }
  }

  async function openAdmin(triggerEl) {
    if (!LOCAL_MODE) {
      await productionReady;
      if (!isLocalOrAdmin() || API_BASE) {
        if (productionConfig?.admin_url) location.assign(productionConfig.admin_url);
        else app?.toast?.('הכניסה לניהול עדיין אינה זמינה.');
        return;
      }
    }
    adminReturnFocus = triggerEl || document.activeElement;
    resetSheet(adminLayer);
    adminLayer.hidden = false;
    document.body.classList.add('feedback-open');
    renderAdminContent();
  }

  function closeAdmin() {
    resetSheet(adminLayer);
    adminLayer.hidden = true;
    if (commentsLayer.hidden && feedback.hidden) {
      document.body.classList.remove('feedback-open');
    }
    if (location.hash === '#/admin') {
      history.replaceState(null, '', '#/');
    }
    if (adminReturnFocus && adminReturnFocus.isConnected) {
      adminReturnFocus.focus();
    }
  }

  adminOpenBtn?.addEventListener('click', (e) => openAdmin(e.currentTarget));
  $('#adminClose')?.addEventListener('click', closeAdmin);
  adminLayer?.addEventListener('click', (e) => {
    if (e.target === adminLayer) closeAdmin();
  });
  adminRoleSelect?.addEventListener('change', () => {
    syncRoleUi();
    renderAdminContent();
  });

  $$('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminTab = btn.dataset.adminTab;
      $$('[data-admin-tab]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on);
      });
      adminCommentFilters.hidden = adminTab !== 'comments';
      adminTicketFilters.hidden = adminTab !== 'tickets';
      renderAdminContent();
    });
  });

  $$('[data-cmt-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminCommentFilter = btn.dataset.cmtFilter;
      $$('[data-cmt-filter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      renderAdminContent();
    });
  });

  $$('[data-tkt-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminTicketFilter = btn.dataset.tktFilter;
      $$('[data-tkt-filter]').forEach((b) => b.classList.toggle('is-on', b === btn));
      renderAdminContent();
    });
  });

  $('#adminExportBtn')?.addEventListener('click', async () => {
    try {
      const snap = await apiFetch('/v1/admin/exports', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shiurim-community-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      app?.toast?.('קובץ הגיבוי הורד בהצלחה');
    } catch (e) {
      app?.toast?.(e.message || 'שגיאה בייצוא הגיבוי');
    }
  });

  // סגירה ב-Escape של כל שכבה פתוחה
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!adminLayer.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeAdmin();
    } else if (!commentsLayer.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeComments();
    } else if (!feedback.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeContact();
    }
  });

  installSheetGesture(feedback, closeContact);
  installSheetGesture(commentsLayer, closeComments);
  installSheetGesture(adminLayer, closeAdmin);

  // ---------- 5. אתחול וחיבור ל-app.js ----------

  function init(shiurimApp) {
    app = shiurimApp;
    if (!LOCAL_MODE) {
      if (adminRoleSelect) adminRoleSelect.hidden = true;
      productionReady = Promise.all([
        apiFetch('/v1/config').then(config => { productionConfig = config; }),
        refreshIdentity(),
      ]).catch(() => { adminOpenBtn.hidden = true; });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshIdentity();
      });
      window.addEventListener('pageshow', e => { if (e.persisted) refreshIdentity(); });
    }
    if (isLocalOrAdmin()) {
      adminOpenBtn.hidden = false;
      refreshAdminBadge();
    }
    syncVisibleCommentBadges();
    const q = new URLSearchParams(location.search);
    if (q.get('open_comments')) {
      setTimeout(() => openComments(q.get('open_comments')), 80);
    } else if (q.has('open_contact')) {
      setTimeout(() => openContact(), 80);
    } else if (q.has('open_admin')) {
      setTimeout(() => openAdmin(), 80);
    }
  }

  window.ShiurimCommunity = {
    init,
    openComments,
    closeComments,
    openContact,
    closeContact,
    openAdmin,
    closeAdmin,
    onRoute() {
      syncVisibleCommentBadges();
    },
    onNowChange() {
      syncVisibleCommentBadges();
    },
  };
})();
