/*!
 * QuadroBoards Automatizations - BODY BUNDLE
 * @version 1.0.0
 */

/* UI Components */
(() => {
  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  (async () => {
    try {
      await ready;

      // === Переменные для настроек и проверок ===
      const bodyGroup  = Number(document.body?.dataset?.groupId || NaN);
      const groupId    = window.GroupID ? Number(window.GroupID) : null;

      // объединяем списки для удобства
      const allowedGroups = [
        ...(window.PROFILE_CHECK?.GroupID || []),
        ...(window.CHRONO_CHECK?.GroupID || [])
      ];
      const allowedForums = [
        ...(window.PROFILE_CHECK?.ForumID || []),
        ...(window.CHRONO_CHECK?.ForumID || []),
        ...(window.CHRONO_CHECK?.AmsForumID || []),
      ];

      const isAllowedGroup = allowedGroups.includes(groupId);

      const crumbs = document.querySelector('.container.crumbs');

      const isAllowedForum = crumbs && Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          const id = u.searchParams.get('id');
          const check = id ? allowedForums.includes(Number(id)) : false;
          return u.pathname.endsWith('/viewforum.php') && check;
        } catch { return false; }
      });

      // === Используем переменные ===
      if (!isAllowedGroup || !isAllowedForum) return;

      // === Вставляем div ===
      let bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
      if (!bodies.length) {
        try {
          await FMV.waitForSelector('.topicpost .post-body .post-box .post-content', 5000);
          bodies = document.querySelectorAll('.topicpost .post-body .post-box .post-content');
        } catch { return; }
      }

      const target = bodies[bodies.length - 1];
      if (!target || target.querySelector('.ams_info')) return;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'ams_info';
      infoDiv.textContent = '';

      target.appendChild(document.createElement('br'));
      target.appendChild(infoDiv);

      window.__ams_ready = true;
      window.dispatchEvent(new CustomEvent('ams:ready', { detail: { node: infoDiv } }));
      if (typeof window.__amsReadyResolve === 'function') window.__amsReadyResolve(infoDiv);
    } catch (e) {
      console.log('[AMS injector] error:', e);
    }
  })();
})();
// button.js
(() => {
  'use strict';

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  async function waitAmsReady() {
    await ready;
    if (window.__ams_ready) return;
    await new Promise(r => window.addEventListener('ams:ready', r, { once: true }));
  }

  // проверка форума по ссылкам на viewforum.php
  function isAllowedForum(forumIds) {
    const allow = (forumIds || []).map(String);
    const crumbs = document.querySelector('.container.crumbs');

    const matchIn = (root) => Array.from(root.querySelectorAll('a[href]')).some(a => {
      try {
        const u = new URL(a.getAttribute('href'), location.href);
        if (!u.pathname.includes('viewforum.php')) return false;
        const id = (u.searchParams.get('id') || '').trim();
        return id && allow.includes(id);
      } catch { return false; }
    });

    if (crumbs && matchIn(crumbs)) return true;
    if (matchIn(document)) return true;

    const bodyForumId = document.body?.dataset?.forumId;
    if (bodyForumId && allow.includes(String(bodyForumId))) return true;

    return false;
  }

  // НОВОЕ: проверка, что мы на нужной теме /viewtopic.php?id=N (p/K/#pM игнорируем)
  function isOnTopicId(topicId) {
    if (topicId == null) return true; // проверка не запрошена
    const want = String(topicId).trim();
    if (!want) return false;

    try {
      const u = new URL(location.href);
      if (!u.pathname.includes('viewtopic.php')) return false;
      const got = (u.searchParams.get('id') || '').trim();
      return got === want;
    } catch {
      return false;
    }
  }

  /**
   * Универсальный конструктор кнопки.
   *
   * @param {Object}   opts
   * @param {string[]} [opts.allowedGroups=[]]
   * @param {string[]} [opts.allowedForums=[]]
   * @param {string}   [opts.label='Действие']
   * @param {Function} opts.onClick  async ({statusEl, linkEl, detailsEl, setStatus, setDetails, setLink, wrap}) => void
   * @param {string}   [opts.containerSelector='.ams_info']
   * @param {number}   [opts.order=0]
   * @param {boolean}  [opts.showStatus=true]
   * @param {boolean}  [opts.showDetails=true]
   * @param {boolean}  [opts.showLink=true]
   * @param {string|number|null} [opts.topicId=null]  // НОВОЕ: если задано — рендерить только на /viewtopic.php?id=topicId
   */
  window.createForumButton = async function createForumButton(opts) {
    const {
      allowedGroups = [],
      allowedForums = [],
      label = 'Действие',
      onClick,
      containerSelector = '.ams_info',
      order = 0,
      showStatus = true,
      showDetails = true,
      showLink = true,
      topicId = null,               // НОВОЕ
    } = opts || {};

    if (typeof onClick !== 'function') return;

    await waitAmsReady();

    const gid = typeof window.getCurrentGroupId === 'function'
      ? window.getCurrentGroupId()
      : NaN;

    // строгая проверка группы
    if (!Array.isArray(allowedGroups) || allowedGroups.length === 0) return;
    if (!allowedGroups.map(Number).includes(Number(gid))) return;

    // строгая проверка форума
    if (!Array.isArray(allowedForums) || allowedForums.length === 0) return;
    if (!isAllowedForum(allowedForums)) return;

    // НОВОЕ: строгая проверка нужной темы
    if (!isOnTopicId(topicId)) return;

    const container = await FMV.waitForSelector(containerSelector, 5000).catch(() => null);
    if (!container) return;

    // ---------- UI ----------
    const br = document.createElement('br');
    const wrap = document.createElement('div');
    wrap.dataset.order = order;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'button';
    btn.textContent = label;

    // статус (опционально)
    const status = showStatus ? document.createElement('span') : null;
    if (status) {
      status.style.marginLeft = '10px';
      status.style.fontSize = '14px';
      status.style.color = '#555';
    }

    // встроенная ссылка рядом со статусом (опционально)
    const link = showLink ? document.createElement('a') : null;
    if (link) {
      link.className = 'fmv-action-link';
      link.target = '_blank';
      link.rel = 'noopener';
      link.style.marginLeft = '10px';
      link.style.fontSize = '14px';
      link.style.display = 'none';
    }

    // блок деталей (опционально)
    const details = showDetails ? document.createElement('details') : null;
    let pre = null;
    if (details) {
      details.style.marginTop = '6px';
      const summary = document.createElement('summary');
      summary.textContent = 'Показать детали';
      summary.style.cursor = 'pointer';
      pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.margin = '6px 0 0';
      pre.style.fontSize = '12px';
      details.appendChild(summary);
      details.appendChild(pre);
    }

    // собираем wrap
    wrap.appendChild(btn);
    if (status) wrap.appendChild(status);
    if (link) wrap.appendChild(link);
    if (details) wrap.appendChild(details);

    container.appendChild(br);

    // вставка по order
    const siblings = Array.from(container.querySelectorAll('div[data-order]'));
    const next = siblings.find(el => Number(el.dataset.order) > Number(order));
    if (next) container.insertBefore(wrap, next);
    else container.appendChild(wrap);

    // helpers
    const setStatus = (text, color = '#555') => {
      if (!status) return;
      status.textContent = text;
      status.style.color = color;
    };
    const setDetails = (text = '') => {
      if (!pre) return;
      pre.textContent = String(text || '');
    };
    const setLink = (url, text = 'Открыть') => {
      if (!link) return;
      if (url) {
        link.href = url;
        link.textContent = text;
        link.style.display = 'inline';
      } else {
        link.style.display = 'none';
        link.textContent = '';
        link.removeAttribute('href');
      }
    };

    btn.addEventListener('click', async () => {
      if (showStatus) setStatus('Выполняю…', '#555');
      if (showDetails) setDetails('');
      if (showLink) setLink(null);

      try {
        await onClick({
          statusEl: status || null,
          linkEl: link || null,
          detailsEl: pre || null,
          setStatus,
          setDetails,
          setLink,
          wrap
        });
      } catch (err) {
        if (showStatus) setStatus('✖ Ошибка', 'red');
        if (showDetails) setDetails((err && err.message) ? err.message : String(err));
        console.error('[createForumButton]', err);
      }
    });
  };
})();
(function () {
  // -------- утилиты --------
  function $(sel, root) { return (root||document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function selectNodeContents(el){
    try{
      var r=document.createRange();
      r.selectNodeContents(el);
      var s=window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }catch(e){}
  }

  function getText(pre){
    return (pre && (pre.innerText || pre.textContent) || '').replace(/\s+$/,'');
  }

  function copyFromSelection(){
    try{ return document.execCommand && document.execCommand('copy'); }
    catch(e){ return false; }
  }

  async function copyTextPreferClipboard(text){
    if(navigator.clipboard && window.isSecureContext){
      try{ await navigator.clipboard.writeText(text); return true; }catch(e){}
    }
    return copyFromSelection();
  }

  // -------- управление выделением после копирования --------
  let activePre = null;

  function setActivePre(pre){
    activePre = pre || null;
  }

  function hardClearSelection() {
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
      if (document.selection && document.selection.empty) document.selection.empty(); // старый IE
    } catch(e) {}

    try {
      if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
    } catch(e) {}

    const b = document.body;
    const prevUS = b.style.userSelect;
    const prevWk = b.style.webkitUserSelect;
    b.style.userSelect = 'none';
    b.style.webkitUserSelect = 'none';
    void b.offsetHeight; // форсим рефлоу
    b.style.userSelect = prevUS;
    b.style.webkitUserSelect = prevWk;
  }

  function needClearByTarget(t) {
    if (!activePre) return false;
    return !activePre.contains(t);
  }

  function globalDown(e) {
    const t = e.target || e.srcElement;
    if (needClearByTarget(t)) {
      activePre = null;
      hardClearSelection();
    }
  }

  function onSelectionChange() {
    if (!activePre) return;
    const sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      activePre = null;
      return;
    }
    const n = sel.anchorNode;
    if (n && !activePre.contains(n)) {
      activePre = null;
      hardClearSelection();
    }
  }

  // -------- инициализация коробок --------
  function ensureButton(box){
    // ищем/создаём .legend
    let lg = box.querySelector('.legend');
    if (!lg) {
      lg = document.createElement('strong');
      lg.className = 'legend';
      box.insertBefore(lg, box.firstChild);
    }
    if (lg.dataset.copyReady) return;

    // если внутри нет кнопки — вставляем
    if (!lg.querySelector('.code-copy')) {
      let label = (lg.textContent || '').trim();
      if (!label || /^код:?\s*$/i.test(label)) label = 'Скопировать код';
      lg.textContent = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = label;
      lg.appendChild(btn);
    }
    lg.dataset.copyReady = '1';
  }

  function armBox(box){
    ensureButton(box);
    if (box.__armed) return;
    box.__armed = true;

    // обработчик клика по кнопке (и по самой legend)
    box.addEventListener('click', async function(e){
      const target = (e.target.closest && e.target.closest('.code-copy, .legend')) || null;
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const pre = box.querySelector('pre');
      if (!pre) return;

      // выделяем и копируем
      selectNodeContents(pre);
      setActivePre(pre);
      await copyTextPreferClipboard(getText(pre));
    }, true);
  }

  function init(ctx){
    $all('.code-box', ctx).forEach(armBox);
  }

  // первичная инициализация
  init();

  // если движок форума шлёт это событие — доинициализируем
  document.addEventListener('pun_main_ready', function(){ init(); });

  // MutationObserver — подхватываем динамически появляющиеся блоки
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      (m.addedNodes||[]).forEach(function(n){
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.code-box')) armBox(n);
        n.querySelectorAll && n.querySelectorAll('.code-box').forEach(armBox);
      });
    });
  }).observe(document.body, {childList:true, subtree:true});

  // глобальные «крючки» для гарантированного снятия выделения
  window.addEventListener('pointerdown', globalDown, true);
  document.addEventListener('mousedown', globalDown, true);
  document.addEventListener('click', globalDown, true);
  document.addEventListener('touchstart', globalDown, true);
  document.addEventListener('focusin', globalDown, true);
  document.addEventListener('scroll', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
  document.addEventListener('selectionchange', onSelectionChange, true);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { activePre = null; hardClearSelection(); }
  }, true);
  window.addEventListener('blur', function () {
    if (activePre) { activePre = null; hardClearSelection(); }
  }, true);
})();

/* Private Pages */
// admin_bridge.js — загрузка/сохранение страницы с проверкой main-маркера (только textarea)
// Экспорт: window.skinAdmin.load(userId) -> { status, initialHtml, save(newHtml), targetUserId }

(function () {
  'use strict';
  if (window.skinAdmin && typeof window.skinAdmin.load === 'function') return;

  const getHtml = (typeof window.fetchHtml === 'function')
    ? window.fetchHtml
    : async (url) => (await fetch(url, { credentials: 'include' })).text();

  const toDoc = (html) => new DOMParser().parseFromString(html, 'text/html');

  const normalizeHtml = (s) =>
    String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/&quot;/g, '"').replace(/>\s+</g, '><')
      .replace(/[ \t\n]+/g, ' ').replace(/\s*=\s*/g, '=').trim();

  async function loadSkinAdmin(userId) {
    const mkUrl = (uid) => new URL(`/admin_pages.php?edit_page=usr${uid}_skin`, location.origin).toString();
    const RX_RAW  = /<!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*-->/i;
    const RX_HTML = /&lt;!--\s*main\s*:\s*usr\s*(\d+)\s*_skin\s*--&gt;/i;
    const htmlDecode = (s) => { const t=document.createElement('textarea'); t.innerHTML=String(s||''); return t.value; };

    const getMainId = (doc) => {
      const ta = doc.querySelector('#page-content,[name="content"]');
      if (!ta) return { id: null, value: '' };
      const v = String(ta.value || '');
      let m = v.match(RX_RAW);  if (m) return { id: m[1], value: v };
      m = htmlDecode(v).match(RX_RAW); if (m) return { id: m[1], value: v };
      m = v.match(RX_HTML); if (m) return { id: m[1], value: v };
      return { id: null, value: v };
    };

    let id = String(userId);
    let url = mkUrl(id);

    // исходная страница
    let html = await getHtml(url);
    let doc  = toDoc(html);
    if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(doc.body?.textContent || ''))
      return { status: 'ошибка доступа к персональной странице' };

    // проверка маркера
    let { id: main1, value: val1 } = getMainId(doc);
    if (main1) {
      if (main1 === id) return { status: 'ошибка: найден цикл main-страниц' };
      // редирект на основную
      id  = main1;
      url = mkUrl(id);
      html = await getHtml(url);
      doc  = toDoc(html);
      if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(doc.body?.textContent || ''))
        return { status: 'ошибка доступа к персональной странице' };
      const { id: main2, value: val2 } = getMainId(doc);
      if (main2) return { status: 'ошибка: найден цикл main-страниц' };
      val1 = val2;
    }

    const form = doc.querySelector('form[action*="admin_pages.php"]') || doc.querySelector('form');
    const ta   = doc.querySelector('#page-content,[name="content"]');
    if (!form || !ta) return { status: 'ошибка: не найдены форма или textarea' };

    const initialHtml = String(val1 ?? ta.value ?? '');

    async function verifySaved(expected) {
      try {
        const chk = await getHtml(url);
        const chkTa = toDoc(chk).querySelector('#page-content,[name="content"]');
        return chkTa && normalizeHtml(chkTa.value) === normalizeHtml(expected);
      } catch { return false; }
    }

    async function save(newHtml) {
      const fresh = await getHtml(url);
      const freshDoc = toDoc(fresh);
      const fForm = freshDoc.querySelector('form[action*="admin_pages.php"]') || freshDoc.querySelector('form');
      const fTa   = freshDoc.querySelector('#page-content,[name="content"]');
      if (!fForm || !fTa) return { ok: false, status: 'ошибка: не найдены форма/textarea при сохранении' };

      fTa.value = newHtml;
      const postUrl = new URL(fForm.getAttribute('action') || url, location.origin).toString();
      const submitBtn = [...fForm.elements].find(el =>
        el.type === 'submit' && (el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')));
      const submitName  = submitBtn?.name  || 'save';
      const submitValue = submitBtn?.value || '1';

      if (typeof window.serializeFormCP1251_SelectSubmit === 'function' &&
          typeof window.fetchCP1251Text === 'function') {
        const body = window.serializeFormCP1251_SelectSubmit(fForm, submitName);
        const { res, text } = await window.fetchCP1251Text(postUrl, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
          referrer: url, referrerPolicy: 'strict-origin-when-cross-origin', body
        });
        const ok = res.ok || res.redirected || /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text)
                   || await verifySaved(newHtml);
        return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
      }

      const fd = new FormData(fForm);
      fd.set(fTa.getAttribute('name') || 'content', fTa.value);
      fd.append(submitName, submitValue);

      const res  = await fetch(postUrl, {
        method: 'POST', credentials: 'include', body: fd,
        referrer: url, referrerPolicy: 'strict-origin-when-cross-origin'
      });
      const text = await res.text();
      const ok = res.ok || res.redirected || /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text)
                 || await verifySaved(newHtml);
      return { ok, status: ok ? 'успешно' : 'ошибка сохранения' };
    }

    return { status: 'ok', initialHtml, save, targetUserId: id };
  }

  window.skinAdmin = { load: loadSkinAdmin };
})();
// chrono_filter.js — модульная, корне-изолированная версия
(() => {
  function makeFilterAPI(root) {
    const $  = (sel, r = root) => r.querySelector(sel);
    const $$ = (sel, r = root) => Array.from(r.querySelectorAll(sel));
    const parseDate = v => (v ? new Date(v) : null);
    const getChecked = (box, name) =>
      Array.from(box?.querySelectorAll(`input[name="${name}"]:checked`) || []).map(i => i.value);

    const filters = $('#filters');
    const list    = $('#list');
    if (!filters || !list) {
      return { apply: () => [], reset: () => [], getVisible: () => [], destroy: () => {} };
    }

    const elDateStart = $('#dateStart');
    const elDateEnd   = $('#dateEnd');
    const elReset     = $('#resetBtn');

    const typeBox     = $('#typeList');
    const statusBox   = $('#statusList');
    const maskBox     = $('#maskList');
    const playerBox   = $('#playerList');
    const locationBox = $('#locationList');

    // дропдауны
    function wireToggle(btnSel, listEl) {
      const btn  = $(btnSel);
      if (!btn || !listEl) return () => {};
      const onBtn = (e) => { e.stopPropagation(); listEl.style.display = listEl.style.display === 'block' ? 'none' : 'block'; };
      const onDoc = (e) => { if (!listEl.contains(e.target) && !btn.contains(e.target)) listEl.style.display = 'none'; };
      btn.addEventListener('click', onBtn);
      document.addEventListener('click', onDoc);
      return () => { btn.removeEventListener('click', onBtn); document.removeEventListener('click', onDoc); };
    }

    const unTypeTgl     = wireToggle('#typeToggle',     typeBox);
    const unStatusTgl   = wireToggle('#statusToggle',   statusBox);
    const unMaskTgl     = wireToggle('#maskToggle',     maskBox);
    const unPlayerTgl   = wireToggle('#playerToggle',   playerBox);
    const unLocationTgl = wireToggle('#locationToggle', locationBox);

    const episodes = $$('#list .episode').map(el => {
      const masks   = (el.dataset.mask    || '').split(';').map(s => s.trim()).filter(Boolean);
      const players = (el.dataset.players || '').split(';').map(s => s.trim()).filter(Boolean);
      return {
        el,
        type:    (el.dataset.type    || '').trim(),
        status:  (el.dataset.status  || '').trim(),
        startL:  parseDate(el.dataset.startL),
        startR:  parseDate(el.dataset.startR),
        endL:    parseDate(el.dataset.endL),
        endR:    parseDate(el.dataset.endR),
        masks, players,
        location: (el.dataset.location || '').trim()
      };
    });

    function apply() {
      const ds = elDateStart?.value ? new Date(elDateStart.value) : null;
      const de = elDateEnd?.value   ? new Date(elDateEnd.value)   : null;

      const selType     = getChecked(typeBox,     'type');
      const selStatus   = getChecked(statusBox,   'status');
      const selMask     = getChecked(maskBox,     'mask');
      const selPlayer   = getChecked(playerBox,   'player');
      const selLocation = getChecked(locationBox, 'location');

      const visible = [], hidden = [];

      episodes.forEach(ep => {
        let ok = true;
        if (ok && ds && ep.endL   && ep.endL   < ds) ok = false;
        if (ok && de && ep.startR && ep.startR > de) ok = false;
        if (ok && selType.length     && !selType.includes(ep.type))           ok = false;
        if (ok && selStatus.length   && !selStatus.includes(ep.status))       ok = false;
        if (ok && selMask.length     && !ep.masks.some(m => selMask.includes(m)))   ok = false;
        if (ok && selPlayer.length   && !ep.players.some(p => selPlayer.includes(p))) ok = false;
        if (ok && selLocation.length && !selLocation.includes(ep.location))   ok = false;

        ep.el.style.display = ok ? '' : 'none';
        (ok ? visible : hidden).push(ep.el);
      });

      // событие — от корня модалки
      root.dispatchEvent(new CustomEvent('chrono:filtered', { detail: { visible, hidden } }));
      return visible;
    }

    function reset() {
      if (elDateStart) elDateStart.value = '';
      if (elDateEnd)   elDateEnd.value   = '';
      $$('#filters .dropdown-list input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      return apply();
    }

    function onChange(e) {
      if (e.target.closest('#filters .dropdown-list') && e.target.matches('input[type="checkbox"]')) apply();
    }
    root.addEventListener('change', onChange);
    elDateStart?.addEventListener('change', apply);
    elDateEnd?.addEventListener('change', apply);
    elReset?.addEventListener('click', (e) => { e.preventDefault(); reset(); });

    apply();

    return {
      apply, reset,
      getVisible: () => episodes.filter(ep => ep.el.style.display !== 'none').map(ep => ep.el),
      destroy: () => {
        root.removeEventListener('change', onChange);
        elDateStart?.removeEventListener('change', apply);
        elDateEnd?.removeEventListener('change', apply);
        elReset?.removeEventListener('click', reset);
        unTypeTgl(); unStatusTgl(); unMaskTgl(); unPlayerTgl(); unLocationTgl();
      }
    };
  }

  // Публичный API — то, что ждёт modal_loader
  window.ChronoFilter = {
    init({ root } = {}) { return makeFilterAPI(root || document); },
    apply: () => [],
    reset: () => [],
    getVisible: () => [],
    destroy: () => {}
  };
})();
// chrono_info_parser.js
// Глобальный namespace
(function () {
  if (!window.FMV) window.FMV = {};

  /** ============================
   *  Утилиты
   *  ============================ */
  const esc = s => String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
  const escAttr = s => esc(s).replace(/"/g, "&quot;");
  const unique = arr => Array.from(new Set((arr || []).filter(Boolean)));
  const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  // Экспорт утилит (если где-то используются)
  FMV.utils = { esc, escAttr, unique, capitalize };

  // Отображаемые метки для типа/статуса (оставляю как у тебя)
  const TYPE_RU = {
    personal: { label: "личный",  emoji: "<иконка>" },
    plot:     { label: "сюжетный", emoji: "<иконка>" },
    au:       { label: "au",       emoji: "<иконка>" },
  };
  const STATUS_RU = {
    on:   { label: "активен",     emoji: "<иконка>" },
    archived: { label: "неактуален",  emoji: "<иконка>" },
    off:   { label: "закрыт",      emoji: "<иконка>" },
  };

  /** ============================
   *  Работа с датами (ТОЛЬКО эта часть изменялась)
   *  ============================ */
  const pad = n => String(n).padStart(2, "0");
  const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate();
  const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  // Поддерживаем: dd.mm.yyyy | yyyy-mm-dd | mm.yyyy | yyyy
  function parseDateSmart(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return { y:+m[3], m:+m[2], d:+m[1], g:"day" };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { y:+m[1], m:+m[2], d:+m[3], g:"day" };
    m = s.match(/^(\d{1,2})\.(\d{4})$/);
    if (m) return { y:+m[2], m:+m[1], d:1, g:"month" };
    m = s.match(/^(\d{4})$/);
    if (m) return { y:+m[1], m:1, d:1, g:"year" };
    return null;
  }

  // Рамки для data-* по твоим правилам (месяц/год → растягиваем до начала/конца)
  function calcBounds(startRaw, endRaw) {
    const ps = parseDateSmart(startRaw);
    const pe = endRaw ? parseDateSmart(endRaw) : null;

    if (!ps && !pe) return { startL:"", startR:"", endL:"", endR:"" };

    // --- START ---
    let startL = "", startR = "";
    if (ps) {
      if (ps.g === "day") {
        startL = toISO(ps.y, ps.m, 1);
        startR = toISO(ps.y, ps.m, ps.d);
      } else if (ps.g === "month") {
        startL = toISO(ps.y, ps.m, 1);
        startR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else { // year
        startL = toISO(ps.y, 1, 1);
        startR = toISO(ps.y, 12, 31);
      }
    } else if (pe) {
      if (pe.g === "day") {
        startL = toISO(pe.y, pe.m, 1);
        startR = toISO(pe.y, pe.m, pe.d);
      } else if (pe.g === "month") {
        startL = toISO(pe.y, pe.m, 1);
        startR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else {
        startL = toISO(pe.y, 1, 1);
        startR = toISO(pe.y, 12, 31);
      }
    }

    // --- END ---
    let endL = "", endR = "";
    if (pe) {
      if (pe.g === "day") {
        endL = toISO(pe.y, pe.m, pe.d);
        endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else if (pe.g === "month") {
        endL = toISO(pe.y, pe.m, 1);
        endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
      } else { // year
        endL = toISO(pe.y, 1, 1);
        endR = toISO(pe.y, 12, 31);
      }
    } else if (ps) {
      if (ps.g === "day") {
        endL = toISO(ps.y, ps.m, ps.d);
        endR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else if (ps.g === "month") {
        endL = toISO(ps.y, ps.m, 1);
        endR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      } else {
        endL = toISO(ps.y, 1, 1);
        endR = toISO(ps.y, 12, 31);
      }
    }

    return { startL, startR, endL, endR };
  }

  // Человеческое отображение в <span class="muted">…</span> по твоим правилам
  function formatHumanRange(startRaw, endRaw) {
    const s = parseDateSmart(startRaw);
    const e = parseDateSmart(endRaw);

    const fmtDay  = (o) => `${pad(o.d)}.${pad(o.m)}.${o.y}`;
    const fmtMon  = (o) => `${pad(o.m)}.${o.y}`;
    const fmtYear = (o) => `${o.y}`;

    if (!s && !e) return ""; // 0: нет даже года — не выводим

    // Совпадают?
    const equal = (() => {
      if (!s || !e) return false;
      if (s.g === 'day'   && e.g === 'day'   && s.y===e.y && s.m===e.m && s.d===e.d) return true;
      if (s.g === 'month' && e.g === 'month' && s.y===e.y && s.m===e.m)               return true;
      if (s.g === 'year'  && e.g === 'year'  && s.y===e.y)                            return true;
      return false;
    })();

    if (equal) {
      if (s.g === 'day')   return fmtDay(s);   // dd.mm.yyyy
      if (s.g === 'month') return fmtMon(s);   // mm.yyyy
      if (s.g === 'year')  return fmtYear(s);  // yyyy
    }

    // Разные, но одна пустая → ничего
    if (!s || !e) return "";

    // Нормализация a/b/c:
    const S = {...s};
    const E = {...e};
    const ensureDay = (obj, month, day=1) => {
      obj.m = (typeof month === 'number') ? month : (obj.m ?? 1);
      obj.d = day;
      obj.g = 'day';
    };
    const ensureMonth = (obj, month) => {
      obj.m = (typeof month === 'number') ? month : (obj.m ?? 1);
      obj.d = 1;
      obj.g = 'month';
    };
    // a) день vs месяц
    if (S.g === 'day' && E.g === 'month') ensureDay(E, E.m, 1);
    if (E.g === 'day' && S.g === 'month') ensureDay(S, S.m, 1);
    // b) день vs год
    if (S.g === 'day' && E.g === 'year') ensureDay(E, 1, 1);
    if (E.g === 'day' && S.g === 'year') ensureDay(S, 1, 1);
    // c) месяц vs год
    if (S.g === 'month' && E.g === 'year') ensureMonth(E, S.m);
    if (E.g === 'month' && S.g === 'year') ensureMonth(S, E.m);

    // Классы вывода
    if (S.g === 'day' && E.g === 'day') {
      if (S.y === E.y && S.m === E.m && S.d === E.d) return fmtDay(S);
      if (S.y === E.y && S.m === E.m) return `${pad(S.d)}-${pad(E.d)}.${pad(S.m)}.${S.y}`;
      if (S.y === E.y && S.m !== E.m) return `${pad(S.d)}.${pad(S.m)}-${pad(E.d)}.${pad(E.m)}.${S.y}`;
      return `${fmtDay(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'month' && E.g === 'month') {
      if (S.y === E.y && S.m === E.m) return fmtMon(S);
      if (S.y === E.y && S.m !== E.m) return `${pad(S.m)}-${pad(E.m)}.${S.y}`;
      return `${fmtMon(S)}-${fmtMon(E)}`;
    }
    if (S.g === 'year' && E.g === 'year') {
      if (S.y === E.y) return fmtYear(S);
      return `${fmtYear(S)}-${fmtYear(E)}`;
    }
    // Смешанные случаи
    if (S.g === 'day' && E.g === 'month') {
      if (S.y === E.y && S.m === E.m) return fmtDay(S);
      if (S.y === E.y) return `${pad(S.d)}.${pad(S.m)}-${pad(E.m)}.${S.y}`;
      return `${fmtDay(S)}-${fmtMon(E)}`;
    }
    if (S.g === 'month' && E.g === 'day') {
      if (S.y === E.y && S.m === E.m) return fmtDay(E);
      if (S.y === E.y) return `${pad(S.m)}.${S.y}-${pad(E.d)}.${pad(E.m)}.${E.y}`;
      return `${fmtMon(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'day' && E.g === 'year') {
      if (S.y === E.y) return fmtDay(S);
      return `${fmtDay(S)}-${fmtYear(E)}`;
    }
    if (S.g === 'year' && E.g === 'day') {
      if (S.y === E.y) return fmtDay(E);
      return `${fmtYear(S)}-${fmtDay(E)}`;
    }
    if (S.g === 'month' && E.g === 'year') {
      if (S.y === E.y) return fmtMon(S);
      return `${fmtMon(S)}-${fmtYear(E)}`;
    }
    if (S.g === 'year' && E.g === 'month') {
      if (S.y === E.y) return fmtMon(E);
      return `${fmtYear(S)}-${fmtMon(E)}`;
    }
    return "";
  }

  /** ============================
   *  Общий билдер HTML (остальное не трогаю)
   *  ============================ */
  FMV.buildChronoHtml = function buildChronoHtml(userData, opts = {}) {
    const titlePrefix = opts.titlePrefix || "Хронология";
    const userName = esc(userData?.name || "");
    const episodes = Array.isArray(userData?.episodes) ? userData.episodes : [];

    // Справочники
    const masksAll = unique(episodes.flatMap(e => Array.isArray(e?.masks) ? e.masks : []));
    const playersAll = unique(
      episodes.flatMap(e =>
        (Array.isArray(e?.participants) ? e.participants : [])
          .map(p => {
            const masksArr = Array.isArray(p?.masks)
              ? p.masks.filter(Boolean).map(x => String(x).trim()).filter(Boolean)
              : (typeof p?.mask === 'string' && p.mask.trim() ? [p.mask.trim()] : []);
            return masksArr.length ? masksArr.join(", ") : String(p?.name || "").trim();
          })
          .map(t => t.replace(/;/g, " ")) // чтобы не ломать разделитель ;
          .filter(Boolean)
      )
    );
    const locationsAll = unique(episodes.map(e => e?.location).filter(Boolean));

    // Посчитаем рамки и min/max для дефолтов дат
    let globalMin = null, globalMax = null;
    const boundsArr = episodes.map(e => {
      const b = calcBounds(e?.dateStart, e?.dateEnd);
      if (b.startL && (!globalMin || b.startL < globalMin)) globalMin = b.startL;
      if (b.endR   && (!globalMax || b.endR   > globalMax)) globalMax = b.endR;
      return b;
    });

    // Фильтры
    const typeOptions = Object.entries(TYPE_RU)
      .map(([key, t]) => `<label><input type="checkbox" name="type" value="${escAttr(key)}"> ${esc(t.label)}</label>`)
      .join("");
    const statusOptions = Object.entries(STATUS_RU)
      .map(([key, s]) => `<label><input type="checkbox" name="status" value="${escAttr(key)}"> ${esc(s.label)}</label>`)
      .join("");
    const maskOptions = unique(masksAll)
      .map(m => `<label><input type="checkbox" name="mask" value="${escAttr(m)}"> ${esc(m)}</label>`)
      .join("");
    const playerOptions = playersAll
      .map(p => `<label><input type="checkbox" name="player" value="${escAttr(p)}"> ${esc(p)}</label>`)
      .join("");
    const locationOptions = locationsAll
      .map(l => `<label><input type="checkbox" name="location" value="${escAttr(l)}"> ${esc(l)}</label>`)
      .join("");
  
    // Шапка + фильтры
    let html = `<div class="filters" id="filters">
    <div class="f">
      <label>Дата начала фильтра</label>
      <input type="date" id="dateStart" value="${escAttr(globalMin || "")}">
    </div>
    <div class="f">
      <label>Дата конца фильтра</label>
      <input type="date" id="dateEnd" value="${escAttr(globalMax || "")}">
    </div>
    <div class="f">
      <label>Тип</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="typeToggle">Выбрать тип</button>
        <div class="dropdown-list" id="typeList">
          ${typeOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Статус</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="statusToggle">Выбрать статус</button>
        <div class="dropdown-list" id="statusList">
          ${statusOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Маска</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="maskToggle">Выбрать маску</button>
        <div class="dropdown-list" id="maskList">
          ${maskOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Участник</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="playerToggle">Выбрать участника</button>
        <div class="dropdown-list" id="playerList">
          ${playerOptions}
        </div>
      </div>
    </div>
    <div class="f">
      <label>Локация</label>
      <div class="dropdown-wrapper">
        <button class="dropdown-toggle" id="locationToggle">Выбрать локацию</button>
        <div class="dropdown-list" id="locationList">
          ${locationOptions}
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="button" id="resetBtn">Сбросить</button>
    </div>
  </div>
  
  <div class="list" id="list">
    `;
   
    // Эпизоды
    if (!episodes.length) {
      html += `<div class="meta">Нет эпизодов</div></section>`;
      return html;
    }

    episodes.forEach((ep, idx) => {
      const typeMeta   = TYPE_RU[ep?.type] || TYPE_RU.au;
      const statusMeta = STATUS_RU[ep?.status] || STATUS_RU.archived;

      const typeLabel   = ep?.type || "";
      const typeBadge   = `${capitalize(typeLabel)} ${typeMeta.emoji}`;
      const statusLabel = ep?.status || "";
      const statusBadge = `${capitalize(statusLabel)} ${statusMeta.emoji}`;

      const masks = Array.isArray(ep?.masks) ? ep.masks.filter(Boolean) : [];
      // массив с токенами для data-players (как раньше: маски или имя)
      const participantTokens = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => {
          const masksArr = Array.isArray(p?.masks)
            ? p.masks.filter(Boolean).map(x => String(x).trim()).filter(Boolean)
            : (typeof p?.mask === 'string' && p.mask.trim() ? [p.mask.trim()] : []);
          const token = masksArr.length ? masksArr.join(", ") : String(p?.name || "").trim();
          return token.replace(/;/g, " ");
        })
        .filter(Boolean);
      
      const playersData = participantTokens.join(";"); // для data-players
      
      // а вот для текстового вывода делаем ссылки
      const playersHuman = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => {
          const display = (Array.isArray(p?.masks) && p.masks.length)
            ? p.masks.join(", ")
            : String(p?.name || "").trim();
          const id = p?.id ? String(p.id).trim() : "";
          return id
            ? `<a href="/profile.php?id=${escAttr(id)}">${esc(display)}</a>`
            : esc(display);
        })
        .filter(Boolean)
        .join(", ");
      const loc = ep?.location || "";

      const b = boundsArr[idx];
      const human = formatHumanRange(ep?.dateStart, ep?.dateEnd);
      const dateBlock = human ? `<span class="muted">${esc(human)} — </span>` : "";

       
      
      html += `
  <div class="episode" 
       data-type="${escAttr(typeLabel)}" 
       data-status="${escAttr(statusLabel)}" 
       data-start-l="${escAttr(b.startL)}" data-start-r="${escAttr(b.startR)}" 
       data-end-l="${escAttr(b.endL)}" data-end-r="${escAttr(b.endR)}"
       ${masks.length ? `data-mask="${escAttr(masks.join(';'))}"` : ``}
       ${loc ? `data-location="${escAttr(loc)}"` : ``}
       ${participantTokens.length ? `data-players="${escAttr(playersData)}"` : ``}>
    <div>тип: ${esc(typeBadge)}; статус: ${esc(statusBadge)}</div>
    <div>${dateBlock}<span class="title"><a href="${esc(ep?.href || "#")}">${esc(ep?.title || "")}</a></span>
      ${masks.length ? ` [as ${esc(masks.join(", "))}]` : ""}</div>
    <div>локация: ${esc(loc)}</div>
    <div>участники: ${playersHuman}</div>
  </div>`;
    });

    html += `</div>\n<script type="text/javascript" src="https://odeshock.github.io/QuadroBoards-Automatizations/additional_functional/private_pages/chrono_filter.js"></script>`;
    return html;
  };
})();
(function () {
  // ==== настройки ====
  const SOURCE_BLOCK = '#pun-main .container';
  const INFO_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const REDIR_SKIN_RE = /<!--\s*main:\s*usr(\d+)_skin\s*-->/i;
  const CHARACTER_SELECTOR = '.character[data-id]';
  const SKIN_TARGET_SEL = '.skin_info';
  const CHRONO_TARGET_SEL = '.chrono_info';
  const DEBUG = false;
  // ====================

  const log = (...a) => DEBUG && console.log('[collect]', ...a);

  async function fetchDecoded(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();
    try { return new TextDecoder(charset).decode(buf); }
    catch { return new TextDecoder('utf-8').decode(buf); }
  }

  function extractNode(html) {
    if (!html || html.includes(INFO_TEXT)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(SOURCE_BLOCK);
  }

  function injectNodeClone(target, node) {
    if (!target || !node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  // Переносит .skin_info / .chrono_info внутрь .character, если они оказались соседями
  function normalizeStructure(scope) {
    const char = scope.querySelector(CHARACTER_SELECTOR);
    if (!char) return;
    const skin = scope.querySelector(SKIN_TARGET_SEL);
    const chrono = scope.querySelector(CHRONO_TARGET_SEL);
    if (skin && skin.parentElement !== char) char.appendChild(skin);
    if (chrono && chrono.parentElement !== char) char.appendChild(chrono);
  }

  // Находим «узкий» scope вокруг конкретного персонажа
  function scopeForCharacter(el) {
    return el.closest('.modal_wrap, .reveal-modal, .container, #character') || el.parentElement || document;
  }

  async function loadSkin(N, scope) {
    const target = scope.querySelector(SKIN_TARGET_SEL);
    if (!target) return;

    const firstHTML = await fetchDecoded(`/pages/usr${N}_skin`);
    if (!firstHTML) return;

    const redirectMatch = REDIR_SKIN_RE.exec(firstHTML);
    if (redirectMatch) {
      const M = redirectMatch[1];
      const secondHTML = await fetchDecoded(`/pages/usr${M}_skin`);
      if (!secondHTML || REDIR_SKIN_RE.test(secondHTML)) return;
      const node = extractNode(secondHTML);
      injectNodeClone(target, node);
      return;
    }

    const node = extractNode(firstHTML);
    injectNodeClone(target, node);
  }

  async function loadChrono(N, scope) {
    const target = scope.querySelector(CHRONO_TARGET_SEL);
    if (!target) return;
    const html = await fetchDecoded(`/pages/usr${N}_chrono`);
    const node = extractNode(html);
    injectNodeClone(target, node);
  }

  async function initIn(root) {
    if (!root) return;
    // берём конкретного character, а не первый на документе
    const charEl = root.querySelector(CHARACTER_SELECTOR) || document.querySelector(CHARACTER_SELECTOR);
    if (!charEl) { log('no character'); return; }

    const scope = scopeForCharacter(charEl);
    normalizeStructure(scope);             // <— выравниваем вложенность

    const N = charEl.getAttribute('data-id')?.trim();
    if (!N) return;

    await Promise.all([ loadSkin(N, scope), loadChrono(N, scope) ]);
  }

  // ручной запуск
  window.loadUserSections = function ({ root, rootSelector } = {}) {
    const r = root || (rootSelector ? document.querySelector(rootSelector) : document);
    initIn(r);
  };

  // автозапуск
  document.addEventListener('DOMContentLoaded', () => initIn(document));

  // динамика (модалки)
  const seen = new WeakSet();
  const observer = new MutationObserver((recs) => {
    recs.forEach(rec => {
      rec.addedNodes && rec.addedNodes.forEach(n => {
        if (!(n instanceof Element)) return;
        // если добавили .character — запускаемся в его scope
        if (n.matches && n.matches(CHARACTER_SELECTOR) && !seen.has(n)) {
          seen.add(n);
          initIn(scopeForCharacter(n));
        }
        // или если .character появился как потомок
        n.querySelectorAll && n.querySelectorAll(CHARACTER_SELECTOR).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          initIn(scopeForCharacter(el));
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
// === проверка через ?edit_page=SLUG ===
async function pageExistsViaEditEndpoint(slug){
  // если в slug есть небезопасные символы — энкодим как в адресной строке (но сам движок принимает ASCII)
  const url = `/admin_pages.php?edit_page=${encodeURIComponent(slug)}`;
  const doc = await fetchCP1251Doc(url);

  // надёжные признаки страницы «редактирование»:
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const h1    = (doc.querySelector('h1, .pagetitle, .tclcon h2')?.textContent || '').trim();

  const looksLikeEditTitle = /Страница создана/i.test(title);

  // форма редактирования обычно содержит hidden name="edit_page" или submit "Сохранить"
  const hasEditHidden = !!doc.querySelector('input[name="edit_page"]');
  const hasSaveBtn = !![...doc.querySelectorAll('input[type="submit"],button[type="submit"]')]
    .find(b => /сохран/i.test(b.value||b.textContent||''));

  // страница «Информация»:
  const looksLikeInfo = /Информация/i.test(title) || /Информация/i.test(h1);

  if (looksLikeEditTitle || hasEditHidden || hasSaveBtn) return true;
  if (looksLikeInfo) return false;

  // fallback: если нет явных признаков, считаем что не существует
  return false;
}

// тянем текст сообщения из «Информация»
function extractInfoMessage(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const containers = [
    ...doc.querySelectorAll('.message, .msg, .infobox, .warn, .error, #pun-main p, .block p, .box p')
  ];
  const text = containers.map(n => n.textContent.trim()).filter(Boolean).join('\n').trim();
  return (title ? `[${title}] ` : '') + (text || '').trim();
}

function classifyResult(html){
  const msg = extractInfoMessage(html).toLowerCase();
  if (/уже существует|занято|должно быть уникаль/.test(msg)) return {status:'duplicate', msg};
  if (/страница создана|добавлен|успешно|сохранена/.test(msg))  return {status:'created', msg};
  if (/ошибка|forbidden|нет прав|не удалось|некоррект|заполните/.test(msg)) return {status:'error', msg};
  // когда движок просто возвращает список без явного сообщения
  return {status:'unknown', msg};
}

// === ГЛАВНЫЙ ФЛОУ ===
/**
 * @typedef {Object} CreatePageResult
 * @property {'created'|'exists'|'error'|'uncertain'} status
 * @property {string} title
 * @property {string} name
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} url
 * @property {string=} details
 */

/**
 * Возвращает промис с результатом; транспортные сбои — через throw/reject.
 */
async function FMVcreatePersonalPage(new_title, new_name, new_content, new_tags, enable_group_ids, announcement) {
  const addUrl = '/admin_pages.php?action=adddel';

  try {
    // A) проверка существования
    const existedBefore = await pageExistsViaEditEndpoint(new_name);
    if (existedBefore) {
      return /** @type {CreatePageResult} */({
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: `Страница "${new_name}" уже существует (до отправки формы).`,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      });
    }

    // B) загрузка формы
    const doc = await fetchCP1251Doc(addUrl);
    const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('/admin_pages.php'))
              || doc.querySelector('form[action*="admin_pages.php"]');
    if (!form) {
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: 'Форма добавления не найдена',
        details: 'admin_pages.php без формы'
      };
    }

    // C) заполнение
    (form.querySelector('[name="title"]')   || {}).value = new_title;
    (form.querySelector('[name="name"]')    || {}).value = new_name;
    (form.querySelector('[name="content"]') || {}).value = new_content;
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = new_tags;
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = announcement;
    else [...form.querySelectorAll('input[name="announcement"]')].forEach(r => r.checked = (r.value===announcement));
    for (const id of enable_group_ids) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }

    let submitName = 'add_page';
    const addBtn = [...form.elements].find(el => el.type==='submit' && (el.name==='add_page' || /создать/i.test(el.value||'')));
    if (addBtn?.name) submitName = addBtn.name;

    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST
    const {res, text} = await fetchCP1251Text(addUrl, {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      referrer: addUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    const resultParsed = classifyResult(text);          // ваша текущая функция-классификатор
    const serverMsg = extractInfoMessage(text) || '';   // ваша функция извлечения сообщения

    // E) окончательная проверка
    const existsAfter = await pageExistsViaEditEndpoint(new_name);

    // --- нормализация в единый формат ---
    if (resultParsed.status === 'created' || existsAfter) {
      console.log(serverMsg || 'Страница создана');
      return {
        status: 'created',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Страница создана',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'duplicate') {
      console.log(serverMsg || 'Уже существует страница с таким адресным именем');
      return {
        status: 'exists',
        title: new_title,
        name: new_name,
        serverMessage: serverMsg || 'Уже существует страница с таким адресным именем',
        httpStatus: res.status,
        url: `/admin_pages.php?edit_page=${encodeURIComponent(new_name)}`
      };
    }

    if (resultParsed.status === 'error') {
      console.log(resultParsed.msg || serverMsg || 'Ошибка при создании');
      return {
        status: 'error',
        title: new_title,
        name: new_name,
        serverMessage: resultParsed.msg || serverMsg || 'Ошибка при создании',
        httpStatus: res.status
      };
    }

    console.log(serverMsg || 'Не удалось подтвердить создание. Проверьте админку.');
    return {
      status: 'uncertain',
      title: new_title,
      name: new_name,
      serverMessage: serverMsg || 'Не удалось подтвердить создание. Проверьте админку.',
      httpStatus: res.status
    };

  } catch (e) {
    // транспорт/исключения — наружу
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    console.log(err);
    throw wrapped;
  }
}
// ============================= EDIT (update) =============================
/**
 * Обновляет персональную страницу в админке.
 *
 * @param {string} name               Адресное имя (например "usr2_skin")
 * @param {Object} patch              Что меняем
 * @param {string=} patch.title       Новый заголовок (если нужно)
 * @param {string=} patch.content     Новый HTML для textarea (#page-content)
 * @param {string|number=} patch.announcement  "0"|"1" или соответствующее значение селекта/радио
 * @param {string=} patch.tags        Строка тегов
 * @param {number[]=} patch.groupsOn  Список ID групп, которые должны быть включены (галочки)
 * @param {number[]=} patch.groupsOff Список ID групп, которые должны быть сняты
 *
 * @returns {Promise<{status:'saved'|'error'|'forbidden'|'notfound'|'unknown', serverMessage?:string, httpStatus?:number, url?:string}>}
 */
async function FMVeditPersonalPage(name, patch = {}) {
  if (!name) throw new Error('FMVeditPersonalPage: "name" is required');

  const editUrl = `/admin_pages.php?edit_page=${encodeURIComponent(name)}`;

  // --- 1) грузим HTML формы в CP1251 ---
  const doc = await (typeof fetchCP1251Doc === 'function'
    ? fetchCP1251Doc(editUrl)
    : (async () => {
        const html = await fetch(editUrl, { credentials:'include' }).then(r => r.text());
        return new DOMParser().parseFromString(html, 'text/html');
      })()
  );

  // Проверка на «нет доступа / устаревшая ссылка / инфо-страница»
  const bodyText = (doc.body && doc.body.textContent || '').trim();
  if (/Ссылка, по которой Вы пришли, неверная или устаревшая\./i.test(bodyText)) {
    return { status:'forbidden', serverMessage:'Ссылка неверная или устаревшая', url:editUrl };
  }

  const form = [...doc.querySelectorAll('form')].find(f => (f.action||'').includes('admin_pages.php'))
            || doc.querySelector('form');
  if (!form) {
    return { status:'notfound', serverMessage:'Форма редактирования не найдена', url:editUrl };
  }

  // --- 2) подставляем значения в DOM формы ---
  // title
  if (patch.title != null) {
    const t = form.querySelector('[name="title"]'); if (t) t.value = String(patch.title);
  }
  // content
  if (patch.content != null) {
    const ta = form.querySelector('#page-content,[name="content"]'); if (ta) ta.value = String(patch.content);
  }
  // announcement (select или radio)
  if (patch.announcement != null) {
    const annSel = form.querySelector('select[name="announcement"]');
    if (annSel) annSel.value = String(patch.announcement);
    else {
      const radios = [...form.querySelectorAll('input[name="announcement"]')];
      if (radios.length) radios.forEach(r => r.checked = (r.value == patch.announcement));
    }
  }
  // tags
  if (patch.tags != null) {
    const tags = form.querySelector('[name="tags"]'); if (tags) tags.value = String(patch.tags);
  }
  // groups (checkboxes like name="group[ID]")
  if (Array.isArray(patch.groupsOn)) {
    for (const id of patch.groupsOn) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = true;
    }
  }
  if (Array.isArray(patch.groupsOff)) {
    for (const id of patch.groupsOff) {
      const cb = form.querySelector(`[name="group[${id}]"]`); if (cb) cb.checked = false;
    }
  }

  // --- 3) выбираем корректное имя сабмита ---
  // Обычно "save", но подстрахуемся: ищем submit-кнопку с текстом "Сохранить"
  let submitName = 'save';
  const saveBtn = [...form.elements].find(el =>
    el.type === 'submit' && (
      el.name === 'save' || /сохр|save/i.test(el.value || el.textContent || '')
    )
  );
  if (saveBtn?.name) submitName = saveBtn.name;

  // --- 4) сериализация формы в CP1251 + POST ---
  let res, text;
  
  // ВАЖНО: постим на фактический action формы (обычно "/admin_pages.php")
  const postUrl = new URL(form.getAttribute('action') || editUrl, location.origin).toString();
  
  if (typeof serializeFormCP1251_SelectSubmit === 'function' && typeof fetchCP1251Text === 'function') {
    const body = serializeFormCP1251_SelectSubmit(form, submitName);
    ({ res, text } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=windows-1251' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    }));
  } else {
    const fd = new FormData(form);
    fd.append(submitName, saveBtn?.value || '1');
    res  = await fetch(postUrl, { method:'POST', credentials:'include', body: fd });
    text = await res.text();
  }

  // --- 5) анализ ответа ---
  const okByText = /Сохранено|успешн|изменени[яй]\s+сохранены/i.test(text);
  const msg = (typeof extractInfoMessage === 'function' ? extractInfoMessage(text) : '') || '';

  const redirectedToAdminList =
    res.ok &&
    (res.url && /\/admin_pages\.php(?:\?|$)/.test(res.url)) &&
    !/ошибк|forbidden|нет прав|устаревш/i.test((text || '').toLowerCase());

  // NEW: содержимое ответа похоже на страницу списка админ-страниц
  const looksLikeAdminList =
    /Администрировани[ея]\s*[–-]\s*Страниц[ыь]/i.test(text) ||      // «Администрирование – Страницы»
    /Список\s+персональных\s+страниц/i.test(text);                   // на некоторых шаблонах так

  if (res.ok && (okByText || redirectedToAdminList || looksLikeAdminList)) {
    return { status:'saved', serverMessage: msg || 'Изменения сохранены', httpStatus: res.status, url: editUrl };
  }

  // если есть твой классификатор — используем
  let cls = { status:'unknown', msg };
  if (typeof classifyResult === 'function') {
    try { cls = classifyResult(text); } catch {}
  }
  if (/ошибк|forbidden|нет прав|устаревш/i.test((msg || cls.msg || '').toLowerCase())) {
    return { status:'forbidden', serverMessage: msg || cls.msg || 'Нет прав/ошибка сохранения', httpStatus: res.status, url: editUrl };
  }

  return { status:'error', serverMessage: msg || 'Ошибка сохранения', httpStatus: res.status, url: editUrl };
}
// =========================== /EDIT (update) ============================

/**
 * Удобный шорткат: заменить только textarea (#page-content).
 * @param {string} name
 * @param {string} newHtml
 */
async function FMVeditTextareaOnly(name, newHtml) {
  return FMVeditPersonalPage(name, { content: newHtml });
}
function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    return /\/profile\.php$/i.test(u.pathname) &&
           u.searchParams.get('section') === 'fields' &&
           /^\d+$/.test(u.searchParams.get('id') || '');
  } catch { return false; }
}

function getProfileId() {
  const u = new URL(location.href);
  return u.searchParams.get('id') || '';
}

// Универсальный fetch→Document
async function fetchDocSmart(url) {
  if (window.FMV?.fetchDoc) return await FMV.fetchDoc(url);
  if (typeof window.fetchHtml === 'function') {
    const html = await window.fetchHtml(url);
    return new DOMParser().parseFromString(html, 'text/html');
  }
  const res = await fetch(url, { credentials: 'include' });
  const html = await res.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

// Ищем комментарий <!-- main: usrN_skin -->
function findMainPointerId(doc) {
  const container =
    doc.querySelector('#pun-main .container') ||
    doc.querySelector('.pun-main .container');
  if (!container) return null;

  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const m = /main:\s*usr(\d+)_skin/i.exec(n.nodeValue || '');
    if (m) return m[1];
  }
  return null;
}

// Берём innerHTML каждого .item
function pickItemsHTML(doc, selector) {
  return Array.from(doc.querySelectorAll(selector))
    .map(el => (el.innerHTML || '').trim())
    .filter(Boolean);
}

/**
 * Загружает /pages/usrN_skin и возвращает три массива:
 * { icons: string[], plashki: string[], backs: string[] }
 */
async function collectSkinSets() {
  if (!isProfileFieldsPage()) return { icons: [], plashki: [], backs: [] };

  const profileId = getProfileId();

  // 1) открываем /pages/usr<profileId>_skin
  const doc1 = await fetchDocSmart(`/pages/usr${profileId}_skin`);
  if (!doc1) return { icons: [], plashki: [], backs: [] };

  // 2) смотрим "маяк" на ПЕРВОЙ открытой странице
  const ptr1 = findMainPointerId(doc1);

  // Если "маяка" нет — парсим doc1 и выходим
  if (!ptr1) {
    return {
      icons:   pickItemsHTML(doc1, '#pun-main ._icon .item, .pun-main ._icon .item'),
      plashki: pickItemsHTML(doc1, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
      backs:   pickItemsHTML(doc1, '#pun-main ._background .item, .pun-main ._background .item')
    };
  }

  // 3) "маяк" есть → переходим НА СЛЕДУЮЩУЮ страницу /pages/usr<ptr1>_skin
  const doc2 = await fetchDocSmart(`/pages/usr${ptr1}_skin`);
  if (!doc2) return { icons: [], plashki: [], backs: [] };

  // 4) если и здесь снова есть "маяк" — это цикл
  const ptr2 = findMainPointerId(doc2);
  if (ptr2) {
    console.log('Найден цикл');
    return { icons: [], plashki: [], backs: [] };
  }

  // 5) иначе парсим вторую страницу
  return {
    icons:   pickItemsHTML(doc2, '#pun-main ._icon .item, .pun-main ._icon .item'),
    plashki: pickItemsHTML(doc2, '#pun-main ._plashka .item, .pun-main ._plashka .item'),
    backs:   pickItemsHTML(doc2, '#pun-main ._background .item, .pun-main ._background .item')
  };
}

/* Forms */
// button_personal_page.init.js
(() => {
  'use strict';

  createForumButton({
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Создать страницу',
    order: 1, // чем меньше — тем выше среди других кнопок

    async onClick({ setStatus, setDetails, setLink }) {
      // --- арг1: имя темы
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ нет имени темы', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      // --- арг2: usr{id} из ссылки профиля
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const arg2 = `usr${idMatch[1]}`;

      // --- остальные аргументы из PROFILE_CHECK
      const arg3 = window.PROFILE_CHECK?.PPageTemplate;
      const arg4 = '';
      const arg5 = window.PROFILE_CHECK?.PPageGroupID;
      const arg6 = '0';

      if (typeof window.FMVcreatePersonalPage !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6)');
        return;
      }

      // --- вызов
      setStatus('Создаём…', '#555');
      setDetails('');
      setLink(null);

      try {
        const res = await window.FMVcreatePersonalPage(arg1, arg2, arg3, arg4, arg5, arg6);

        switch (res?.status) {
          case 'created': setStatus('✔ создано', 'green'); break;
          case 'exists':  setStatus('ℹ уже существует', 'red'); break;
          case 'error':   setStatus('✖ ошибка', 'red'); break;
          default:        setStatus('❔ не удалось подтвердить', '#b80');
        }

        if (res?.url) setLink(res.url, 'Открыть страницу');

        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        if (res?.title)         lines.push('Пользователь: ' + res.title);
        if (res?.name)          lines.push('Адресное имя: ' + res.name);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails(err?.message || String(err));
        console.error('[button_personal_page]', err);
      }
    }
  });
})();
// button_update_group.init.js
(() => {
  'use strict';

  createForumButton({
    // доступ ограничиваем извне заданными списками
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Сменить группу',
    order: 4,

    async onClick({ setStatus, setDetails }) {
      // --- 0) Проверка конфигурации PROFILE_CHECK ---
      const fromStr = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupUserID) || '';
      const toStr   = (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupPlayerID) || '';

      if (!fromStr || !toStr) {
        const missing = [
          !fromStr ? 'PROFILE_CHECK.GroupUserID' : null,
          !toStr   ? 'PROFILE_CHECK.GroupPlayerID' : null
        ].filter(Boolean).join(', ');
        setStatus('✖ Замена не выполнена', 'red');
        setDetails(
          'Не удалось запустить изменение группы: ' +
          (missing
            ? `не заданы параметры ${missing}. Укажите значения и повторите.`
            : 'отсутствуют необходимые параметры.')
        );
        return;
      }

      // --- 1) Контекст: извлекаем userId из ссылки "Профиль" в теме ---
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      if (!userId) {
        setStatus('✖ не найден userId', 'red');
        setDetails('Не удалось извлечь profile.php?id=... из страницы темы');
        return;
      }

      // --- 2) Наличие основной функции ---
      if (typeof window.FMVupdateGroupIfEquals !== 'function') {
        setStatus('✖ функция недоступна', 'red');
        setDetails('Ожидалась window.FMVupdateGroupIfEquals(userId, fromId, toId)');
        return;
      }

      // --- 3) Запуск смены группы (только если текущая == fromStr) ---
      setStatus('Проверяю и обновляю…', '#555');
      setDetails('');
      try {
        const res = await window.FMVupdateGroupIfEquals(userId, fromStr, toStr);

        // пробуем вытащить текущее значение из details (формат: "current=..."), если есть
        let currentVal = '';
        if (res?.details) {
          const m = String(res.details).match(/current=([^\s]+)/);
          if (m) currentVal = m[1];
        }

        switch (res?.status) {
          case 'updated':
            setStatus('✔ Группа изменена', 'green');
            break;

          case 'nochange':
            setStatus('ℹ Изменений нет — пользователь уже в целевой группе', '#555');
            break;

          case 'skipped':
            setStatus('✖ Исходная группа не совпадает', 'red');
            setDetails(
              `Исходное значение группы — ${currentVal || 'не определено'}.\n` +
              'Либо вы пытаетесь поправить не тот профиль, либо выполните замену вручную ' +
              'для дополнительной валидации.'
            );
            return;

          case 'uncertain':
            setStatus('❔ Не удалось подтвердить результат', '#b80');
            break;

          case 'error':
          default:
            setStatus('✖ Ошибка при сохранении', 'red');
        }

        // Доп. сведения — в «детали»
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push(`Замена: ${fromStr} → ${toStr}`);
        if (currentVal)         lines.push('Текущее (до попытки): ' + currentVal);
        if (res?.details && !currentVal) lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');

      } catch (err) {
        setStatus('✖ Сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_group]', err);
      }
    }
  });
})();
// button_update_money_field.init.js
(() => {
  'use strict';

  createForumButton({
    // доступы передаём параметрами (ничего не объединяем внутри)
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Выдать монетки',
    order: 3, // задайте нужное место среди других кнопок

    async onClick({ setStatus, setDetails }) {
      // 1) Контекст: userId (для кого обновляем поле)
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }
      const userId = idMatch[1];

      // 2) Поле и значение (как в исходнике: берём шаблон «как есть»)
      const fieldId = window.PROFILE_CHECK?.MoneyFieldID;
      const rawTemplate = window.PROFILE_CHECK?.MoneyFieldTemplate;
      const fieldValue = String(rawTemplate);

      if (typeof window.FMVreplaceFieldData !== 'function') {
        setStatus('✖ функция обновления не найдена', 'red');
        setDetails('Ожидалась window.FMVreplaceFieldData(userId, fieldId, value)');
        return;
      }

      // 3) Вызов обновления
      setStatus('Обновляем…', '#555');
      setDetails('');
      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статусы
        switch (res?.status) {
          case 'updated':  setStatus('✔ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'red'); break;
          case 'error':    setStatus('✖ ошибка', 'red'); break;
          default:         setStatus('❔ не удалось подтвердить', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение: ' + fieldValue);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n'));

      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_money_field]', err);
      }
    }
  });
})();
// button_update_personal_field.init.js
(() => {
  'use strict';

  // выносим всю механику в универсальную кнопку
  createForumButton({
    // передаём правила доступа параметрами (ничего не объединяем внутри)
    allowedGroups: (window.PROFILE_CHECK && window.PROFILE_CHECK?.GroupID) || [],
    allowedForums: (window.PROFILE_CHECK && window.PROFILE_CHECK?.ForumID) || [],
    label: 'Установить плашку',
    order: 2, // при необходимости расстановки — можно менять

    async onClick({ setStatus, setDetails }) {
      // 1) Контекст: arg1 из заголовка темы, userId/arg2 из ссылки на профиль
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) { setStatus('✖ не найдено имя темы (arg1)', 'red'); setDetails('Ожидался #pun-main h1 span'); return; }

      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await FMV.waitForSelector('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      const idMatch = profLink?.href?.match(/profile\.php\?id=(\d+)/i);
      const userId = idMatch ? idMatch[1] : '';
      const arg2 = userId ? `usr${userId}` : '';
      if (!userId) { setStatus('✖ не найден userId', 'red'); setDetails('Не удалось извлечь profile.php?id=...'); return; }

      // 2) Поле и значение: берём из PROFILE_CHECK и подставляем ID → arg2
      const fieldId = window.PROFILE_CHECK?.PPageFieldID;
      const rawTemplate = window.PROFILE_CHECK?.PPageFieldTemplate;
      const fieldValue = String(rawTemplate).replace(/\bID\b/g, arg2);

      if (typeof window.FMVreplaceFieldData !== 'function') {
        setStatus('✖ функция не найдена', 'red');
        setDetails('Ожидалась window.FMVreplaceFieldData(userId, fieldId, value)');
        return;
      }

      // 3) Вызов обновления
      setStatus('Обновляю…', '#555');
      setDetails('');
      try {
        // контракт: FMVreplaceFieldData(userId, fieldId, value)
        const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);

        // статусы
        switch (res?.status) {
          case 'updated':  setStatus('✔ обновлено', 'green'); break;
          case 'nochange': setStatus('ℹ изменений нет', 'red'); break;
          case 'error':    setStatus('✖ ошибка', 'red'); break;
          default:         setStatus('❔ неизвестный результат', '#b80');
        }

        // детали
        const lines = [];
        if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
        if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
        lines.push('Поле: ' + (res?.fieldId ?? fieldId));
        lines.push('Пользователь: ' + (res?.userId ?? userId));
        lines.push('Значение (template→arg2): ' + fieldValue);
        if (res?.details)       lines.push('Details: ' + res.details);
        setDetails(lines.join('\n') || 'Нет дополнительных данных');
      } catch (err) {
        setStatus('✖ сеть/транспорт', 'red');
        setDetails((err && err.message) ? err.message : String(err));
        console.error('[button_update_personal_field]', err);
      }
    }
  });
})();

/* Profile */
// Admin: универсальные панели выбора (external-режим + builder)
// createChoicePanel({ title, targetClass, library, ...opts })
// Точечные правки:
// 1) Добавлен buildSelectedInnerAll() — собирает HTML всех выбранных.
// 2) В PANELS.getSelectedInner теперь buildSelectedInnerAll, а не buildSelectedInnerHTML одиночного ряда.
// 3) В builder() и submit-хуке используем buildSelectedInnerAll().
// Остальная логика — без изменений.

(function(){
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const ready = (sel, root = document) => new Promise((res) => {
    const el = root.querySelector(sel);
    if (el) return res(el);
    const obs = new MutationObserver(() => {
      const el2 = root.querySelector(sel);
      if (el2) { obs.disconnect(); res(el2); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
  const ensureTextarea = async (sel) => ready(sel);

  const baseCSS = `
  details.ufo-panel{margin-top:12px;border:1px solid #d0d0d7;border-radius:10px;background:#fff}
  details.ufo-panel>summary{cursor:pointer;list-style:none;padding:10px 14px;font-weight:600;background:#f6f6f8;border-bottom:1px solid #e6e6ef;border-radius:10px}
  details.ufo-panel>summary::-webkit-details-marker{display:none}
  .ufo-wrap{display:flex;flex-direction:column;gap:16px;padding:14px}
  .ufo-col{display:flex;flex-direction:column;gap:8px}
  .ufo-col h4{margin:0;font-size:14px;opacity:.8;display:flex;justify-content:space-between;align-items:center}
  .ufo-search{padding:6px 10px;font-size:13px;border:1px solid #d0d0d7;border-radius:8px;background:#f5f2e8}
  .ufo-lib,.ufo-selected{border:1px dashed #c9c9d9;border-radius:8px;background:#fafafd;padding:8px;overflow:auto}
  .ufo-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  .ufo-lib .ufo-card{margin:0}
  .ufo-card{display:grid;grid-template-columns:auto 1fr auto auto;grid-template-rows:auto auto;grid-template-areas:"id full date actions" "id title title actions";gap:8px;background:#fff;border:1px solid #e7e7ef;border-radius:8px;padding:8px;margin:6px 0;max-width:100%;position:relative;overflow:hidden}
  .ufo-idtag{grid-area:id;font-size:11px;opacity:.7;align-self:start}
  .ufo-actions{grid-area:actions;display:flex;align-items:center;gap:6px}
  .ufo-btn{border:1px solid #d7d7e0;background:#f3f3f7;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;line-height:1.15;display:inline-flex;align-items:center}
  .ufo-btn:hover{background:#ececf4}
  .ufo-card.disabled{opacity:.4;pointer-events:none}
  .ufo-full{grid-area:full;box-sizing:border-box;margin:0;padding:0;border:0;background:transparent;overflow:hidden}
  .ufo-full .item{position:relative;margin:0}
  .ufo-full .item .modal-link{display:block}
  .ufo-full .item img{display:block;max-width:100%;height:auto;border-radius:6px}
  .ufo-lib .ufo-full .item img{height:90px;width:100%;object-fit:cover}
  .ufo-lib .ufo-full a{pointer-events:none}
  .ufo-title-edit{grid-area:title;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;white-space:pre-wrap;overflow:visible}
  .ufo-title-edit:focus{outline:none;background:#fffdf1}
  .ufo-date-edit{grid-area:date;border:1px dashed #aaa;border-radius:6px;padding:6px 8px;background:#fffef7;font-size:13px;align-self:start}
  .ufo-date-edit input{border:none;background:transparent;font-size:13px;width:100%;font-family:inherit}
  .ufo-date-edit input:focus{outline:none}
  `;
  (function injectCSS(){
    const s=document.createElement('style'); s.textContent=baseCSS; document.head.appendChild(s);
    if (typeof GM_addStyle==='function') GM_addStyle(baseCSS);
  })();

  const PANELS = [];
  const mkBtn = (txt, onClick) => { const b=document.createElement('button'); b.type='button'; b.className='ufo-btn'; b.textContent=txt; b.addEventListener('click', onClick); return b; };

  function computeTwoRowMaxSelected(container){
    const first = container.querySelector('.ufo-card');
    if (!first) { container.style.maxHeight = ''; return; }
    const style = getComputedStyle(first);
    const h = first.getBoundingClientRect().height;
    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;
    const cStyle = getComputedStyle(container);
    const pt = parseFloat(cStyle.paddingTop) || 0;
    const pb = parseFloat(cStyle.paddingBottom) || 0;
    const max = Math.round(h * 2 + (mt + mb) * 3 + pt + pb);
    container.style.maxHeight = max + 'px';
  }
  function firstVisibleCard(container){ const cards = [...container.querySelectorAll('.ufo-card')]; return cards.find(c => getComputedStyle(c).display !== 'none') || null; }
  function computeTwoRowMaxLib(container){ const card = firstVisibleCard(container); if (!card) { container.style.maxHeight=''; return; } const ch = card.getBoundingClientRect().height; const cs = getComputedStyle(container); const rowGap = parseFloat(cs.rowGap) || 0; const pt = parseFloat(cs.paddingTop) || 0; const pb = parseFloat(cs.paddingBottom) || 0; const max = Math.round(ch * 2 + rowGap + pt + pb); container.style.maxHeight = max + 'px'; }
  function observeSelected(container){ const mo = new MutationObserver(()=> computeTwoRowMaxSelected(container)); mo.observe(container, { childList: true, subtree: true, attributes: true }); window.addEventListener('resize', ()=> computeTwoRowMaxSelected(container)); computeTwoRowMaxSelected(container); }
  function observeLib(container){ const mo = new MutationObserver(()=> computeTwoRowMaxLib(container)); mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter:['style','class'] }); window.addEventListener('resize', ()=> computeTwoRowMaxLib(container)); computeTwoRowMaxLib(container); }
  const safeComment = (s) => String(s).replace(/--/g,'—');

  function rewriteSectionHTML(pageHtml, opts, selectedInner, selectedIds){
    const { targetClass, itemSelector = '.item', idAttr = 'data-id' } = opts;
    const libIds = new Set((opts.library || []).map(x => String(x.id)));
    
    const root=document.createElement('div'); root.innerHTML=pageHtml;
    const block=root.querySelector('div.'+targetClass);
    
    const nodeToPreservedComment = (node) => {
      if (node.nodeType===1){
        const el=node;
        if (el.matches(itemSelector)) {
          let id = el.getAttribute(idAttr);
          if (id == null) id = 'undefined';
          // новый порядок:
          // 1) любые элементы из библиотеки — УДАЛЯЕМ (секцию строим заново из выбранных)
          if (libIds.has(String(id))) return '';
          // 2) всё, что не из библиотеки — сохраняем в комментарии
          return `<!-- preserved (${idAttr}="${safeComment(id)}")\n${safeComment(el.outerHTML)}\n-->`;
        }
        // не .item — тоже сохраняем как preserved
        return `<!-- preserved (${idAttr}="undefined")\n${safeComment(el.outerHTML)}\n-->`;
     } else if (node.nodeType===8){
        return `<!--${safeComment(node.nodeValue)}-->`;
      } else if (node.nodeType===3){
        const txt=node.nodeValue; if (txt.trim()==='') return '';
        return `<!-- preserved (${idAttr}="undefined")\n${safeComment(txt)}\n-->`;
      }
      return '';
    };
    if (block){
      const preserved=[];
      block.childNodes.forEach(n=>preserved.push(nodeToPreservedComment(n)));
      block.innerHTML = (selectedInner?selectedInner+'\n':'') + preserved.filter(Boolean).join('\n');
    } else {
      const div=document.createElement('div'); div.className=targetClass; div.innerHTML=selectedInner; root.appendChild(div);
    }
    return root.innerHTML;
  }

  function ensureGlobalSubmitHook(textareaSelector){
    if (ensureGlobalSubmitHook._installed) return; ensureGlobalSubmitHook._installed = true;
    const form = $('#editpage') || $('form[action*="admin_pages.php"]'); if (!form) return;
    form.addEventListener('submit', ()=>{
      const ta = $(textareaSelector) || $('#page-content');
      const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
      let current = ''; if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      for (const p of PANELS) {
        const selectedInner = p.getSelectedInner(); // FIX: берём общий HTML всех выбранных
        const selectedIds = p.getSelectedIds();
        current = rewriteSectionHTML(current, p.opts, selectedInner, selectedIds);
      }
      if (tm) tm.setContent(current); if (ta) ta.value = current;
    }, true);
  }

  function createChoicePanel(userOpts){
    const opts = Object.assign({
      title: 'Библиотека и выбранные', targetClass: '_section', library: [], startOpen: false,
      textareaSelector: '#page-content', anchorSelector: null, itemSelector: '.item', idAttr: 'data-id', editableAttr: 'title',
      searchPlaceholder: 'поиск по id', mountEl: null, initialHtml: null, external: false,
      allowMultiAdd: false,            // ← НОВОЕ: разрешать многоразовое добавление одного и того же id
      expirableAttr: null              // ← НОВОЕ: если задано (например 'data-expired-date'), добавляем инпут для даты
    }, userOpts || {});
    if (!Array.isArray(opts.library)) opts.library = [];

    const uid = 'ufo_' + (opts.targetClass || 'section').replace(/\W+/g,'_') + '_' + Math.random().toString(36).slice(2,7);

    const details = document.createElement('details'); details.className = 'ufo-panel'; details.open = !!opts.startOpen;
    const summary = document.createElement('summary'); summary.textContent = opts.title || 'Панель';
    const wrap = document.createElement('div'); wrap.className='ufo-wrap';

    const libCol = document.createElement('div'); libCol.className='ufo-col';
    const hLib = document.createElement('h4'); hLib.textContent='Библиотека';
    const search = document.createElement('input'); search.type='text'; search.placeholder = opts.searchPlaceholder || 'поиск по id'; search.className='ufo-search'; hLib.appendChild(search);
    const libBox = document.createElement('div'); libBox.className='ufo-lib'; libBox.id = uid+'-lib';
    libCol.append(hLib, libBox);

    const selCol = document.createElement('div'); selCol.className='ufo-col'; selCol.innerHTML = '<h4>Выбранные (сверху — новее)</h4>';
    const selBox = document.createElement('div'); selBox.className='ufo-selected'; selBox.id = uid+'-selected';
    selCol.appendChild(selBox);

    wrap.append(libCol, selCol); details.append(summary, wrap);

    (async ()=>{ if (opts.mountEl) { opts.mountEl.appendChild(details); } else { await ensureTextarea(opts.textareaSelector); const anchor = opts.anchorSelector ? $(opts.anchorSelector) : $(opts.textareaSelector); if (anchor) anchor.insertAdjacentElement('afterend', details);} })();

    function renderLibItem(item){
      const card=document.createElement('div'); card.className='ufo-card'; card.dataset.id=item.id;
      const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
      const full=document.createElement('div'); full.className='ufo-full';
      const tmp=document.createElement('div'); tmp.innerHTML=item.html.trim(); full.appendChild(tmp.firstElementChild);
      const actions=document.createElement('div'); actions.className='ufo-actions';
      actions.appendChild(mkBtn('Добавить ↑', (e)=>{e.preventDefault(); e.stopPropagation(); addToSelected(item); }));
      card.append(id, full, actions); return card;
    }
    opts.library.forEach(x => libBox.appendChild(renderLibItem(x)));

    function addToSelected(item, o){
      o = o || {};
      const libCard = libBox.querySelector(`.ufo-card[data-id="${item.id}"]`);
      // в обычных секциях — блокируем дубль и «гасим» карточку в библиотеке
      if (!opts.allowMultiAdd) {
        if (libCard) libCard.classList.add('disabled');
        if (selBox.querySelector(`.ufo-card[data-id="${item.id}"]`)) return;
      }
      const row=document.createElement('div'); row.className='ufo-card'; row.draggable=true; row.dataset.id=item.id;
      const id=document.createElement('div'); id.className='ufo-idtag'; id.textContent='#'+item.id;
      const full=document.createElement('div'); full.className='ufo-full';
      const tmp=document.createElement('div'); tmp.innerHTML=(o.usePageHtml ? o.usePageHtml : item.html).trim(); full.appendChild(tmp.firstElementChild);
      const editor=document.createElement('div'); editor.className='ufo-title-edit'; editor.contentEditable=true;
      const elItem = full.querySelector(opts.itemSelector); const currentAttr = elItem ? (elItem.getAttribute(opts.editableAttr) || '') : '';
      editor.textContent = currentAttr;

      // Если включен expirableAttr, добавляем поле для даты
      let dateEditor = null;
      if (opts.expirableAttr) {
        dateEditor = document.createElement('div');
        dateEditor.className = 'ufo-date-edit';
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        const currentDate = elItem ? (elItem.getAttribute(opts.expirableAttr) || '') : '';
        dateInput.value = currentDate;
        dateEditor.appendChild(dateInput);
      }

      const actions=document.createElement('div'); actions.className='ufo-actions';
      const recalc = ()=> computeTwoRowMaxSelected(selBox);
      const btnUp=mkBtn('↑', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling); recalc();});
      const btnDown=mkBtn('↓', (e)=>{e.preventDefault(); e.stopPropagation(); if (row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row); recalc();});
      const btnRemove=mkBtn('✕', (e)=>{
        e.preventDefault(); e.stopPropagation();
        row.remove();
        if (!opts.allowMultiAdd && libCard) libCard.classList.remove('disabled');
        recalc();
      });
      actions.append(btnUp, btnDown, btnRemove);
      row.dataset.html = item.html.trim();
      // если карточка пришла из текущей страницы — сохраним этот HTML,
      // чтобы при сборке не терять её фактический title:
      if (o.usePageHtml) {
        row.dataset.pageHtml = o.usePageHtml.trim();
      }
      if (o.usePageHtml) {
        // запомним «как было на странице», чтобы при сборке беречь его title
        row.dataset.pageHtml = o.usePageHtml.trim();
      }
      row.append(id, full, actions, editor);
      if (dateEditor) row.appendChild(dateEditor);
      selBox.insertBefore(row, selBox.firstChild); recalc();
    }

    (function enableDnd(container){
      let dragEl=null;
      container.addEventListener('dragstart', (e)=>{const card=e.target.closest('.ufo-card'); if(!card) return; dragEl=card; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','');});
      container.addEventListener('dragover', (e)=>{e.preventDefault(); const over=e.target.closest('.ufo-card'); if(!over || over===dragEl) return; const r=over.getBoundingClientRect(); const before=(e.clientY-r.top)/r.height<0.5; over.parentElement.insertBefore(dragEl, before?over:over.nextSibling);});
      container.addEventListener('drop', (e)=>{e.preventDefault(); dragEl=null; computeTwoRowMaxSelected(container);});
      container.addEventListener('dragend', ()=>{dragEl=null; computeTwoRowMaxSelected(container);});
    })(selBox);

    search.addEventListener('input', ()=>{
      const v = search.value.trim();
      libBox.querySelectorAll('.ufo-card').forEach(c=>{ c.style.display = (!v || c.dataset.id.includes(v)) ? '' : 'none'; });
      computeTwoRowMaxLib(libBox);
    });

    const mo1=new MutationObserver(()=>computeTwoRowMaxSelected(selBox)); mo1.observe(selBox,{childList:true,subtree:true,attributes:true});
    const mo2=new MutationObserver(()=>computeTwoRowMaxLib(libBox)); mo2.observe(libBox,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
    window.addEventListener('resize',()=>{computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);});
    computeTwoRowMaxLib(libBox); computeTwoRowMaxSelected(selBox);

    // Гидратация: переносим уже присутствующие в секции элементы (если их id есть в библиотеке) в «Выбранные»
    (function hydrateFromPage(){
      let current='';
      if (typeof opts.initialHtml === 'string') current = opts.initialHtml;
      else {
        const ta = $(opts.textareaSelector);
        const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
        if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      }
      if (!current) return;
      const root=document.createElement('div'); root.innerHTML=current;
      const block=root.querySelector('div.'+opts.targetClass); if (!block) return;
      const libIds = new Set(opts.library.map(x=>x.id));
      const items=[];
      block.childNodes.forEach(n=>{
        if (n.nodeType===1 && n.matches(opts.itemSelector)){
          const id = n.getAttribute(opts.idAttr) || '';
          if (id && libIds.has(id)) items.push({ id, pageHtml:n.outerHTML, lib: opts.library.find(x=>x.id===id) });
        }
      });
      for (let i=items.length-1; i>=0; i--){
        const it=items[i];
        addToSelected({ id: it.id, html: it.lib.html }, { usePageHtml: it.pageHtml });
        const libCard = libBox.querySelector(`.ufo-card[data-id="${it.id}"]`);
        if (!opts.allowMultiAdd && libCard) libCard.classList.add('disabled');
      }
    })();

    function getSelectedIds(){ return new Set([...selBox.querySelectorAll('.ufo-card')].map(r=>r.dataset.id||'').filter(Boolean)); }

    // Билдер для одной «выбранной» карточки (как было)
    function buildSelectedInnerHTML(row, html, opts = {}) {
      if (!row || typeof row.querySelector !== 'function') return String(html || '');
    
      const ATTR = opts.editableAttr || 'title';
      // База: предпочитаем HTML, который реально был на странице (с текущим title),
      // затем — библиотечный, затем — то, что пришло в аргументах.
      const base = row.dataset.pageHtml || row.dataset.html || String(html || '');
    
      // Текст из редактора
      const ed = row.querySelector('.ufo-title-edit');
      const cleanTitle = String(ed ? ed.innerHTML : '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
      // Работаем через DOM, чтобы править только .item
      const tmp = document.createElement('div');
      tmp.innerHTML = base.trim();
      const itemEl = tmp.querySelector((opts && opts.itemSelector) || '.item');
    
      if (itemEl) {
        if (cleanTitle) {
          itemEl.setAttribute(ATTR, cleanTitle);
        } // если пусто — оставляем исходный title как есть

        // Если включен expirableAttr, читаем дату и применяем атрибут + span.coupon_deadline
        if (opts.expirableAttr) {
          const dateEdit = row.querySelector('.ufo-date-edit input');
          if (dateEdit) {
            const dateValue = (dateEdit.value || '').trim(); // yyyy-mm-dd из input type="date"

            // Удаляем старый span.coupon_deadline если есть
            const oldSpan = itemEl.querySelector('.coupon_deadline');
            if (oldSpan) oldSpan.remove();

            // Создаём новый span.coupon_deadline после img
            const imgEl = itemEl.querySelector('img');
            const newSpan = document.createElement('span');
            newSpan.className = 'coupon_deadline';

            if (dateValue) {
              // Конвертируем yyyy-mm-dd -> dd/mm/yy для отображения
              const parts = dateValue.split('-');
              if (parts.length === 3) {
                const year = parts[0].slice(2); // берём последние 2 цифры года
                const month = parts[1];
                const day = parts[2];
                newSpan.textContent = `${day}/${month}/${year}`;
              }
              // Устанавливаем data-expired-date в формате yyyy-mm-dd
              itemEl.setAttribute(opts.expirableAttr, dateValue);
            } else {
              // Если дата не заполнена, span остаётся пустым
              newSpan.textContent = '';
              itemEl.removeAttribute(opts.expirableAttr);
            }

            // Вставляем span после img (или в конец если img нет)
            if (imgEl && imgEl.nextSibling) {
              itemEl.insertBefore(newSpan, imgEl.nextSibling);
            } else if (imgEl) {
              imgEl.parentNode.appendChild(newSpan);
            } else {
              itemEl.appendChild(newSpan);
            }
          }
        }
      }

      // (Опционально) перенести текст в <wrds> из .ufo-text-edit
      const edText = row.querySelector('.ufo-text-edit');
      if (edText && itemEl) {
        const rawText = edText.innerHTML || edText.textContent || '';
        const cleanText = String(rawText)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/&nbsp;|[\u00A0\u200B-\u200D\u2060\uFEFF]/g, '')
          .replace(/\s+$/g, '')
          .trim();
        const wrdsEl = itemEl.querySelector('wrds');
        if (cleanText && wrdsEl) wrdsEl.textContent = cleanText;
      }
    
      return tmp.innerHTML;
    }

    // NEW: собрать HTML ВСЕХ «выбранных»
    function buildSelectedInnerAll(){
      const rows = [...selBox.querySelectorAll('.ufo-card')];
      return rows.map(row => {
        const html = row.dataset.html || '';
        return buildSelectedInnerHTML(row, html, {
          editableAttr: opts.editableAttr,
          expirableAttr: opts.expirableAttr,
          itemSelector: opts.itemSelector
        });
      }).join('\n');
    }

    // регистрируем панель для submit-хука (админка)
    PANELS.push({ uid, opts, rootEl: details, selectedBox: selBox, libBox, getSelectedInner: buildSelectedInnerAll, getSelectedIds });

    if (!opts.external) ensureGlobalSubmitHook(opts.textareaSelector);

    // external-builder: переписывает секцию targetClass, вставляя ВСЕ выбранные в начало
    function builder(fullHtmlOpt){
      let current = '';
      if (typeof fullHtmlOpt === 'string') current = fullHtmlOpt;
      else if (typeof opts.initialHtml === 'string') current = opts.initialHtml;
      else {
        const ta = $(opts.textareaSelector);
        const tm = (window.tinymce && window.tinymce.get && window.tinymce.get(ta?.id || 'page-content')) || null;
        if (tm) current = tm.getContent(); else if (ta) current = ta.value || '';
      }
      const inner = buildSelectedInnerAll();
      const ids = getSelectedIds();
      return rewriteSectionHTML(current, opts, inner, ids);
    }

    return { details, builder, getSelectedIds };
  }

  window.createChoicePanel = createChoicePanel;
})();
/*!
 * money-upd-slim.js — один экспорт: getFieldValue({ doc, fieldId }) -> string
 * - Заменяет <!-- main: usrN --> в li#pa-fldN
 * - Предоставляет window.MainUsrFieldResolver.getFieldValue
 */
(function () {
  "use strict";

  // Проверка наличия MoneyID
  if (!window.PROFILE_FIELDS?.MoneyID) {
    console.error("Ошибка: не найдено значение PROFILE_FIELDS.MoneyID");
    return; // Останавливаем выполнение скрипта
  }

  // ===== Настройки поля =====
  const idNum = String(window.PROFILE_FIELDS?.MoneyID);
  const fieldName = `pa-fld${idNum}`;

  // ===== Утилиты =====
  const esc = CSS.escape || ((s) => String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
  const RE_MAIN = /^\s*main:\s*usr(\d+)\s*$/i;
  const selectorForField = (fname) => `#${esc(fname)}, .${esc(fname)}`;

  // Декодирование HTML с возможной windows-1251
  const tdUtf8 = new TextDecoder("utf-8");
  let tdWin1251;
  const win1251 = () => (tdWin1251 ||= new TextDecoder("windows-1251"));
  async function fetchHtml(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    const buf = await r.arrayBuffer();
    let html = tdUtf8.decode(buf);
    if (/charset\s*=\s*windows-1251/i.test(html) || html.includes("�")) {
      try { html = win1251().decode(buf); } catch {}
    }
    return html;
  }

  function extractLocalValue(rootDoc, fname) {
    const li = rootDoc.querySelector(selectorForField(fname));
    const strong = li?.querySelector("strong, b");
    let v = strong?.textContent?.trim();
    if (!v) {
      const t = (li?.textContent || "").trim();
      v = t.split(":").slice(-1)[0]?.trim();
    }
    return (v || "").replace(/\u00A0/g, " ").trim();
  }

  // Кеш по uid -> Promise<string>
  const cache = new Map();
  function getRemoteFieldValue(uid, fname) {
    if (cache.has(uid)) return cache.get(uid);
    const p = (async () => {
      const html = await fetchHtml(`/profile.php?id=${encodeURIComponent(uid)}`);
      const doc = new DOMParser().parseFromString(html, "text/html");
      return extractLocalValue(doc, fname);
    })();
    cache.set(uid, p);
    return p;
  }

  function findUsrFromComment(liEl) {
    if (!liEl) return null;
    const walker = liEl.ownerDocument.createTreeWalker(liEl, NodeFilter.SHOW_COMMENT);
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) return m[1];
    }
    return null;
  }

  // ===== Публичное API (единственная функция) =====
  async function getFieldValue({ doc = document, fieldId } = {}) {
    const id = String(fieldId ?? idNum).replace(/\D/g, "") || idNum;
    const fname = `pa-fld${id}`;
    const li = doc.querySelector(selectorForField(fname));

    // если есть <!-- main: usrN -->, берём значение у usrN
    const refUid = findUsrFromComment(li);
    if (refUid) {
      try { return await getRemoteFieldValue(refUid, fname); }
      catch (e) { console.warn("[main-field] remote error:", e); }
    }
    // иначе — локальное значение
    return extractLocalValue(doc, fname);
  }

  // Экспорт в window (без перетирания)
  window.MainUsrFieldResolver = window.MainUsrFieldResolver || {};
  if (!window.MainUsrFieldResolver.getFieldValue) {
    window.MainUsrFieldResolver.getFieldValue = getFieldValue;
  }

  // ===== Поведение «как раньше»: заменить комментарии на текст в DOM =====
  function replaceCommentsUnder(root, fname) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const items = [];
    for (let n; (n = walker.nextNode()); ) {
      const m = (n.nodeValue || "").match(RE_MAIN);
      if (m) items.push({ node: n, uid: m[1] });
    }
    items.forEach(({ node, uid }) => {
      getRemoteFieldValue(uid, fname)
        .then((val) => { if (node?.isConnected) node.replaceWith(document.createTextNode(val)); })
        .catch((e) => console.error("[main-field] replace error usr" + uid, e));
    });
  }

  function run() {
    document.querySelectorAll(selectorForField(fieldName)).forEach((el) => replaceCommentsUnder(el, fieldName));
  }

  (document.readyState === "loading")
    ? document.addEventListener("DOMContentLoaded", run, { once: true })
    : run();
})();
// profile_runner.js — запуск панелей со страницы профиля (EDIT-режим)
(function () {
  'use strict';

  if (window.__profileRunnerMounted) return;
  window.__profileRunnerMounted = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  function onReady() {
    return new Promise((res) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') return res();
      document.addEventListener('DOMContentLoaded', () => res(), { once: true });
    });
  }
  function getProfileIdFromURL() {
    const u = new URL(location.href);
    const id = u.searchParams.get('id');
    return id ? String(id).trim() : '';
  }
  function normalizeHtml(s) {
    return String(s || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/&quot;/g, '"')  // приводим кавычки
      .replace(/>\s+</g, '><')  // убираем пробелы между тегами
      .replace(/[ \t\n]+/g, ' ')// схлопываем пробелы/таб/переносы
      .replace(/\s*=\s*/g, '=') // чистим пробелы вокруг =
      .trim();
  }

  async function waitMount() {
    await onReady();
    const box = qs('#viewprofile .container') || qs('#viewprofile') || qs('#pun-main') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'fmv-skins-panel';
    wrap.style.margin = '16px 0';
    wrap.innerHTML = `
       <details open style="border:1px solid #d6d6de;border-radius:10px;background:#fff">
        <summary style="list-style:none;padding:10px 14px;border-bottom:1px solid #e8e8ef;border-radius:10px;font-weight:600;background:#f6f7fb;cursor:pointer">
          Обновление скинов
        </summary>
        <div class="fmv-skins-body" style="padding:14px"></div>
        <div class="fmv-skins-footer" style="display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #eee">
          <button type="button" class="fmv-save"
            style="background:#2f67ff;color:#fff;border:1px solid #2f67ff;border-radius:8px;padding:8px 14px;cursor:pointer">
            Сохранить
          </button>
          <span class="fmv-status" style="margin-left:8px;font-size:14px;color:#666"></span>
        </div>
      </details>
    `;
    box.appendChild(wrap);
    return wrap.querySelector('.fmv-skins-body');
  }

  (async () => {
    // 1) URL-гейт: только /profile.php?id=N и никаких других параметров
    if (location.pathname !== '/profile.php') return;
    const sp = new URLSearchParams(location.search);
    if (!sp.has('id') || [...sp.keys()].some(k => k !== 'id')) return;
  
    const id = (sp.get('id') || '').trim();
    if (!id) return;
  
    const group_ids = window.SKIN?.GroupID || [];

    if (typeof window.ensureAllowed === 'function') {
      const ok = await window.ensureAllowed(group_ids);
      if (!ok) return; // не в нужной группе — выходим тихо
    } else {
      return; // подстраховка: нет функции — никому не показываем
    }

    if (!window.skinAdmin || typeof window.skinAdmin.load !== 'function') {
      console.error('[profile_runner] skinAdmin.load не найден.');
      return;
    }

    const { status, initialHtml, save, targetUserId } = await window.skinAdmin.load(id);
    if (status !== 'ok' && status !== 'ок') {
      console.error('[profile_runner] Не удалось загрузить страницу со скинами');
      return;
    }

    const mount = await waitMount();

    let build = null;
    if (typeof window.setupSkins === 'function') {
      try {
        const api = await window.setupSkins(mount, initialHtml);
        if (api && typeof api.build === 'function') build = api.build;
      } catch (e) {
        console.error('setupSkins() error:', e);
      }
    }

    if (!build) {
      console.error('[profile_runner] Не удалось инициализировать панели');
      return;
    }

    const panelRoot = document.getElementById('fmv-skins-panel');
    const btnSave  = panelRoot?.querySelector('.fmv-save');
    const statusEl = panelRoot?.querySelector('.fmv-status');
    if (!btnSave) return;

    const pageName = `usr${(targetUserId || id)}_skin`;

    btnSave.addEventListener('click', async () => {
      try {
        if (statusEl) {
          statusEl.textContent = 'Сохраняю…';
          statusEl.style.color = '#666';
        }
        const finalHtml = build ? build() : '';
        if (!finalHtml) {
          if (statusEl) {
            statusEl.textContent = 'Нечего сохранять';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        let r = null;
        if (typeof window.FMVeditTextareaOnly === 'function') {
          r = await window.FMVeditTextareaOnly(pageName, finalHtml);
        } else if (typeof save === 'function') {
          r = await save(finalHtml);
        } else {
          if (statusEl) {
            statusEl.textContent = 'Нет функции сохранения';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        let ok = !!(r && (r.ok || r.status === 'saved' || r.status === 'успешно' || r.status === 'ok'));

        if (!ok && window.skinAdmin && typeof window.skinAdmin.load === 'function') {
          try {
            const check = await window.skinAdmin.load(id);
            if (check && (check.status === 'ok' || check.status === 'ок')) {
              ok = normalizeHtml(check.initialHtml) === normalizeHtml(finalHtml);
            }
          } catch (e) {
            console.warn('[profile_runner] verify failed:', e);
          }
        }

        if (statusEl) {
          if (ok) {
            statusEl.textContent = '✓ Успешно сохранено';
            statusEl.style.color = '#16a34a';
            // перезагрузка через 1 секунду
            setTimeout(() => location.reload(), 1000);
          } else {
            statusEl.textContent = 'Ошибка сохранения';
            statusEl.style.color = '#c24141';
          }
        }
      } catch (e) {
        console.error(e);
        if (statusEl) {
          statusEl.textContent = 'Ошибка сохранения';
          statusEl.style.color = '#c24141';
        }
      }
    });
  })();
})();
/* ================== КОНСТАНТЫ UI ================== */
const IP_ROWS = 1;        // сколько строк карточек видно без скролла
const IP_GAP  = 8;        // расстояние между карточками, px
const IP_REQUIRED = true; // если есть варианты — пустым не оставляем

/* ================== УТИЛИТЫ ================== */
function isProfileFieldsPage() {
  try {
    const u = new URL(location.href);
    if (!/\/profile\.php$/i.test(u.pathname)) return false;
    const s = u.searchParams;
    if (s.get('section') !== 'fields') return false;
    const id = s.get('id');
    return !!id && /^\d+$/.test(id);
  } catch { return false; }
}

const STYLE_ID = 'ip-style-clean';
function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = `
    /* скрываем исходный textarea/input */
    .ip-hidden {
      display: none !important;
      resize: none !important;
      visibility: hidden !important;
    }

    /* Белый контейнер подстраивается под ширину контента */
    .ip-box {
      position: relative;
      display: inline-block;          /* ширина = контенту */
      max-width: 100%;
      border: 1px solid #ccc;
      border-radius: 10px;
      background: #fff;
      padding: 6px;
    }

    /* Вертикальный скролл */
    .ip-scroll {
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      max-height: calc(var(--ip-rows,1) * var(--ip-h,44px)
                      + (var(--ip-rows,1) - 1) * var(--ip-gap,8px));
    }

    /* Сетка: перенос вниз, ширина по контенту */
    .ip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ip-gap,8px);
      align-content: flex-start;
      justify-content: flex-start;
    }

    .ip-btn {
      position: relative;
      overflow: hidden;
      width: var(--ip-w,44px);
      height: var(--ip-h,44px);
      border: 2px solid #d0d0d0;
      border-radius: 10px;
      background: #fff;
      padding: 0;
      cursor: pointer;
      touch-action: manipulation;
    }
    .ip-btn[selected] {
      border-color: #0b74ff;
      box-shadow: 0 0 0 3px rgba(11,116,255,.15);
    }

    .ip-slot {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .ip-slot img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .ip-slot * {
      pointer-events: none;
    }
  `;
  document.head.appendChild(st);
}

// поиск поля по суффиксу: работает и для input, и для textarea
function resolveFieldBySuffix(suffix) {
  const id = `fld${String(suffix)}`;
  const name = `form[fld${String(suffix)}]`;
  return (
    document.querySelector(`#${CSS.escape(id)}[name="${name}"]`) ||
    document.getElementById(id) ||
    document.querySelector(`[name="${name}"]`)
  );
}

// нормализация на ЗАГРУЗКЕ: у <a.modal-link> сохраняем только class и style
function normalizeModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  t.content.querySelectorAll('a.modal-link').forEach(a => {
    Array.from(a.attributes).forEach(attr => {
      if (attr.name !== 'class' && attr.name !== 'style') a.removeAttribute(attr.name);
    });
  });
  return t.innerHTML.trim();
}

// ПЕРЕД СОХРАНЕНИЕМ: каждой <a.modal-link> добавить data-reveal-id и id="usrN"
function prepareModalLinkAttrs(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  const anchors = t.content.querySelectorAll('a.modal-link');
  if (anchors.length) {
    const u = new URL(location.href);
    const n = u.searchParams.get('id');
    const usrId = (n && /^\d+$/.test(n)) ? `usr${n}` : null;
    anchors.forEach(a => {
      a.setAttribute('data-reveal-id', 'character');
      if (usrId) a.setAttribute('id', usrId);
    });
  }
  return t.innerHTML.trim();
}

// превью карточки: если строка даёт DOM — вставляем, иначе <img>
function createThumbSlot(htmlOrUrl) {
  const slot = document.createElement('div');
  slot.className = 'ip-slot';
  const raw = String(htmlOrUrl ?? '').trim();
  if (!raw) return slot;
  const t = document.createElement('template'); t.innerHTML = raw;
  if (t.content.querySelector('*')) {
    slot.appendChild(t.content.cloneNode(true));
  } else {
    const img = document.createElement('img');
    img.src = raw; img.alt = ''; img.loading = 'lazy';
    slot.appendChild(img);
  }
  return slot;
}

function keyFor(str) { const s=String(str??''); let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return 'k'+(h>>>0).toString(36); }

// реестр полей на форме: form -> { entries: [{input, fieldSuffix, prepareOne}], hooked }
const FORM_STATE = new WeakMap();

/* ================== ОСНОВНАЯ ФУНКЦИЯ ==================
   image_set: массив СТРОК (HTML или URL)
   fieldSuffix (number): 5 → 'fld5' / 'form[fld5]' 
   opts: { btnWidth?: number, btnHeight?: number, gridColSize?: number, modalLinkMode?: boolean }
*/
function applyImagePicker(image_set, fieldSuffix, opts = {}) {
  if (!isProfileFieldsPage()) return;
  injectStylesOnce();

  const modalLinkMode = !!opts.modalLinkMode;
  const RAW = Array.isArray(image_set) ? image_set : [];
  const ITEMS = RAW.map(s => String(s ?? ''));

  const input = resolveFieldBySuffix(fieldSuffix);
  if (!input) return;

  // скрываем исходный контрол
  input.classList.add('ip-hidden');

  // размеры карточек / сетки
  const w   = Number.isFinite(opts.btnWidth)   ? Math.max(1, opts.btnWidth)   : 44;
  const h   = Number.isFinite(opts.btnHeight)  ? Math.max(1, opts.btnHeight)  : 44;
  const col = Number.isFinite(opts.gridColSize)? Math.max(1, opts.gridColSize): w;

  // нормализованные строки (как храним внутри textarea/input)
  const NORMS = ITEMS.map(v => modalLinkMode ? normalizeModalLinkAttrs(v) : v);
  const allowed = new Set(NORMS);
  const keyByNorm = new Map(NORMS.map(n => [n, keyFor(n)]));

  // берём текущее значение поля (textarea.value уже отдаёт текст)
  const currentNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

  // строим UI, если есть варианты
  let grid = null;
  if (ITEMS.length > 0) {
    const box = document.createElement('div');
    box.className = 'ip-box';
    box.style.setProperty('--ip-rows', String(IP_ROWS));
    box.style.setProperty('--ip-gap',  `${IP_GAP}px`);
    box.style.setProperty('--ip-w',    `${w}px`);
    box.style.setProperty('--ip-h',    `${h}px`);
    box.style.setProperty('--ip-col',  `${col}px`);

    const scroll = document.createElement('div'); scroll.className = 'ip-scroll';
    const g = document.createElement('div'); g.className = 'ip-grid';

    const byFor = input.id ? document.querySelector(`label[for="${input.id}"]`) : null;
    const anchor = input.closest('label') || byFor || input;
    anchor.insertAdjacentElement('afterend', box);

    // клики по сетке не должны триггерить внешние хэндлеры
    scroll.addEventListener('pointerdown', e => e.stopPropagation());
    scroll.addEventListener('click', e => e.stopPropagation());

    NORMS.forEach((norm, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ip-btn';
      btn.dataset.key = keyByNorm.get(norm);

      // превью показываем: при modalLinkMode — нормализованную версию, иначе исходную
      const display = modalLinkMode ? norm : ITEMS[idx];
      btn.appendChild(createThumbSlot(display));

      const pick = (e) => { e.preventDefault(); e.stopPropagation(); setValue(norm); };
      btn.addEventListener('pointerdown', pick);
      btn.addEventListener('click', pick);

      g.appendChild(btn);
    });

    scroll.appendChild(g);
    box.appendChild(scroll);
    grid = g;
  }

  // подсветка выбранной
  function highlight(normStr) {
    if (!grid) return;
    const key = keyByNorm.get(String(normStr)) || '';
    grid.querySelectorAll('.ip-btn').forEach(b => b.removeAttribute('selected'));
    if (key) {
      const btn = grid.querySelector(`.ip-btn[data-key="${key}"]`);
      if (btn) btn.setAttribute('selected', '');
    }
  }

  // установка значения в скрытый контрол
  let internal = false;
  function setValue(normVal) {
    const v = String(normVal ?? '');
    if (input.value !== v) {
      internal = true;
      input.value = v;
      input.dispatchEvent(new Event('input',  { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      internal = false;
    }
    highlight(v);
  }

  // начальное значение
  const firstNorm   = NORMS[0] || '';
  const initialNorm = ITEMS.length
    ? (allowed.has(currentNorm) ? currentNorm : (IP_REQUIRED ? firstNorm : ''))
    : '';
  input.dataset.ipInitial = initialNorm;
  setValue(initialNorm);

  // синхронизация внешних правок
  input.addEventListener('input',  () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });
  input.addEventListener('change', () => { if (!internal) highlight(modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '')); });

  /* ===== РЕЕСТР ФОРМЫ: готовим ВСЕ поля перед отправкой ===== */
  const form = input.closest('form');
  if (!form) return { set: setValue };

  let state = FORM_STATE.get(form);
  if (!state) {
    state = { entries: [], hooked: false };
    FORM_STATE.set(form, state);
  }

  // подготовка одного поля
  const prepareOne = () => {
    let curNorm = modalLinkMode ? normalizeModalLinkAttrs(String(input.value ?? '')) : String(input.value ?? '');

    if (!ITEMS.length) {
      const preparedEmpty = modalLinkMode ? prepareModalLinkAttrs('') : '';
      input.value = preparedEmpty;
      return preparedEmpty;
    }

    if (!allowed.has(curNorm)) {
      const fallback = input.dataset.ipInitial ?? (IP_REQUIRED ? firstNorm : '');
      curNorm = String(fallback);
      setValue(curNorm);
    }

    const finalVal = modalLinkMode ? prepareModalLinkAttrs(curNorm) : curNorm;
    input.value = finalVal;
    return finalVal;
  };

  state.entries.push({ input, fieldSuffix, prepareOne });

  if (!state.hooked) {
    state.hooked = true;
    const nativeSubmit = form.submit;

    const prepareAll = () => {
      state.entries.forEach(({ prepareOne }) => { prepareOne(); });
    };

    // обычный submit
    form.addEventListener('submit', (e) => {
      if (form.dataset.ipResuming === '1') return;
      prepareAll();
    }, true);

    // new FormData(form)
    form.addEventListener('formdata', (e) => {
      prepareAll();
      // гарантируем, что в FormData уйдут обновлённые значения
      state.entries.forEach(({ input, fieldSuffix }) => {
        try {
          const name = input.name || `form[fld${fieldSuffix}]`;
          e.formData.set(name, input.value);
        } catch(_) {}
      });
    });

    // программный form.submit()
    form.submit = function(...args){
      if (form.dataset.ipResuming === '1') return nativeSubmit.apply(this, args);
      prepareAll();
      return nativeSubmit.apply(this, args);
    };
  }

  return { set: setValue };
}
// const icon_set = [
//  `<img class="icon" src="https://static.thenounproject.com/png/2185221-200.png">`,
//  `<img class="icon" src="https://cdn2.iconfinder.com/data/icons/harry-potter-colour-collection/60/07_-_Harry_Potter_-_Colour_-_Golden_Snitch-512.png">`,
//  `<img class="icon" src="https://i.pinimg.com/474x/c2/72/cb/c272cbe4f31c5a8d96f8b95256924e95.jpg">`,
// ];

// const plashka_set = [
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/247944.gif" class="plashka">
//    <wrds>я не подарок, но и ты не шаверма</wrds></a>`,
//   `<a class="modal-link">
//    <img src="https://upforme.ru/uploads/001c/14/5b/440/561829.gif" class="plashka">
//    <wrds>twinkle twinkle little star</wrds></a>`
// ];

// const back_set = [
//  `<img class="back" src="https://upforme.ru/uploads/001c/14/5b/440/238270.gif">`,
//  `<img class="back" src="https://forumstatic.ru/files/001c/83/91/88621.png">`,
// ];

(async () => {
  const { icons, plashki, backs } = await collectSkinSets();

  // Плашка
  if (window.SKIN?.PlashkaFieldID) {
    applyImagePicker(plashki, SKIN.PlashkaFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  }

  // Фон
  if (window.SKIN?.BackFieldID) {
    applyImagePicker(backs, SKIN.BackFieldID, {
      btnWidth: 229,
      btnHeight: 42,
      modalLinkMode: true,
    });
  }

  // Иконка
  if (window.SKIN?.IconFieldID) {
    applyImagePicker(icons, SKIN.IconFieldID, {
      btnWidth: 44,
    });
  }
})();
// skin_set_up.js
// setupSkins(container, initialHtml, opts?) -> Promise<{ build(fullHtml?) => string, panels }>

(function () {
  'use strict';

  /**
   * @param {HTMLElement} container         куда рисовать панели
   * @param {string}      initialHtml       ПОЛНЫЙ HTML из textarea админки
   * @param {Object=}     opts
   *   @param {boolean=}  opts.withHeaders  показывать заголовки секций (по умолчанию true)
   *   @param {boolean=}  opts.startOpen    панели раскрыты при старте (по умолчанию false)
   *
   * @returns {Promise<{ build: (fullHtmlOpt?:string)=>string, panels: { plashka:any, icon:any, back:any, gift:any } }>}
   */
  async function setupSkins(container, initialHtml, opts = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('[setupSkins] container обязателен и должен быть HTMLElement');
    }
    if (typeof window.createChoicePanel !== 'function') {
      throw new Error('[setupSkins] createChoicePanel не найден. Подключите файл с панелью раньше.');
    }

    if (window.__skinsSetupMounted) {
      return window.__skinsSetupMounted;
    }

    const withHeaders = opts.withHeaders ?? true;
    const startOpen   = opts.startOpen   ?? false;

    // --- тянем библиотеки через fetchCardsWrappedClean
    const SKIN = window.SKIN;

    // если SKIN не объявлен — выходим и логируем предупреждение
    if (!SKIN) {
      console.warn('[setupSkins] window.SKIN не найден — прекращаю выполнение.');
      return;
    }

    // --- тянем библиотеки через fetchCardsWrappedClean
    let [libPlashka0, libIcon0, libBack0, libGift0, libCoupon0] = await Promise.all([
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryPlashkaPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryIconPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryBackPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryGiftPostID),
      fetchCardsWrappedClean(SKIN.LibraryFieldID, SKIN.LibraryCouponPostID),
    ]);

    // подстраховка от null/undefined
    libPlashka0 = Array.isArray(libPlashka0) ? libPlashka0 : [];
    libIcon0    = Array.isArray(libIcon0)    ? libIcon0    : [];
    libBack0    = Array.isArray(libBack0)    ? libBack0    : [];
    libGift0    = Array.isArray(libGift0)    ? libGift0    : [];
    libCoupon0  = Array.isArray(libCoupon0)  ? libCoupon0  : [];

    // --- контейнер под панели
    let grid = container.querySelector('.skins-setup-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'skins-setup-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      container.appendChild(grid);
    }

    // --- панели
    const panelGift = window.createChoicePanel({
      title: withHeaders ? 'Подарки' : undefined,
      targetClass: '_gift',
      library: libGift0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen,
      allowMultiAdd: true
    });

    const panelCoupon = window.createChoicePanel({
      title: withHeaders ? 'Купоны' : undefined,
      targetClass: '_coupon',
      library: libCoupon0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen,
      allowMultiAdd: true,
      expirableAttr: 'data-expired-date'  // добавляем поддержку даты истечения
    });

    const panelPlashka = window.createChoicePanel({
      title: withHeaders ? 'Плашки' : undefined,
      targetClass: '_plashka',
      library: libPlashka0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelIcon = window.createChoicePanel({
      title: withHeaders ? 'Иконки' : undefined,
      targetClass: '_icon',
      library: libIcon0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    const panelBack = window.createChoicePanel({
      title: withHeaders ? 'Фон' : undefined,
      targetClass: '_background',
      library: libBack0,
      mountEl: grid,
      initialHtml,
      external: true,
      startOpen
    });

    // --- builder
    function build(fullHtmlOpt) {
      let current = (typeof fullHtmlOpt === 'string') ? fullHtmlOpt : (initialHtml || '');
      if (panelPlashka?.builder) current = panelPlashka.builder(current);
      if (panelIcon?.builder)    current = panelIcon.builder(current);
      if (panelBack?.builder)    current = panelBack.builder(current);
      if (panelGift?.builder)    current = panelGift.builder(current);
      if (panelCoupon?.builder)  current = panelCoupon.builder(current);
      return current;
    }

    const api = {
      build,
      panels: { plashka: panelPlashka, icon: panelIcon, back: panelBack, gift: panelGift, coupon: panelCoupon},
    };
    window.__skinsSetupMounted = api;
    return api;
  }

  window.setupSkins = setupSkins;
})();
/**
 * @typedef {Object} ReplaceFieldResult
 * @property {'updated'|'error'|'uncertain'} status
 * @property {string} fieldId
 * @property {string} value
 * @property {string=} serverMessage
 * @property {number=} httpStatus
 * @property {string=} details
 */

/**
 * Обновляет пользовательское поле профиля «как из формы», даже если вы не на странице редактирования.
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} field_id           // без # — только номер (например "3")
 * @param {string} new_value
 * @param {boolean} [overwriteIfExists=false] // если true — перезаписывать даже если там уже «что-то» есть
 * @returns {Promise<ReplaceFieldResult>}
 */
async function FMVreplaceFieldData(user_id, field_id, new_value, overwriteIfExists = false) {
  const editUrl = `/profile.php?section=fields&id=${encodeURIComponent(user_id)}&nohead`;
  const FIELD_SELECTOR = '#fld' + field_id;

  // helper: "есть ли что-то" — всё, кроме "", " ", "0"
  const hasSomething = (v) => v !== '' && v !== ' ';

  try {
    // A) загрузка формы редактирования
    const doc = await fetchCP1251Doc(editUrl);

    // форма редактирования (часто id="profile8"; подстрахуемся по action)
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));

    if (!form) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Форма редактирования профиля не найдена',
        details: 'profile.php без формы'
      };
    }

    // B0) найдём поле и прочитаем текущее значение ДО изменения
    const fld = form.querySelector(FIELD_SELECTOR);
    if (!fld) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: `Поле ${FIELD_SELECTOR} не найдено. Проверьте номер fld.`
      };
    }

    const prevValue = fld.value ?? '';

    // B1) если уже есть «что-то» и перезаписывать нельзя — выходим с ошибкой и сообщением
    if (hasSomething(prevValue) && !overwriteIfExists) {
      return {
        status: 'nochange',
        fieldId: String(field_id),
        value: new_value,
        serverMessage: 'Поле уже содержит значение. Перезапись запрещена.',
        details: `Прежнее значение: ${String(prevValue)}`
      };
    }

    // B2) заполнение нового значения
    fld.value = new_value;

    // ensure name="update" (некоторые шаблоны требуют наличия этого поля)
    if (![...form.elements].some(el => el.name === 'update')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'update';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // C) выбрать реальное имя submit-кнопки (как в create)
    let submitName = 'update';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // сериализация формы с учётом выбранного submit
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // D) POST «как будто со страницы редактирования» — важен referrer
    const postUrl = form.getAttribute('action') || '/profile.php';
    const { res } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    if (!res.ok) {
      return {
        status: 'error',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // E) контрольное чтение — подтверждаем, что значение действительно сохранилось
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const v2 = form2?.querySelector(FIELD_SELECTOR)?.value ?? null;

    if (v2 === new_value) {
      return {
        status: 'updated',
        fieldId: String(field_id),
        value: new_value,
        httpStatus: res.status,
        serverMessage: 'Значение успешно обновлено'
      };
    }

    // сервер ответил 200, но подтвердить новое значение не удалось
    return {
      status: 'uncertain',
      fieldId: String(field_id),
      value: new_value,
      httpStatus: res.status,
      serverMessage: 'Не удалось подтвердить новое значение, проверьте вручную'
    };

  } catch (e) {
    // транспорт/исключения — наружу в виде throw (как в create)
    const err = (e && e.message) ? e.message : String(e);
    const wrapped = new Error('Transport/Runtime error: ' + err);
    wrapped.cause = e;
    throw wrapped;
  }
}

// (по желанию) экспорт в глобал, если требуется из других скриптов
// window.FMVreplaceFieldData = FMVreplaceFieldData;
/**
 * @typedef {Object} UpdateGroupResult
 * @property {'updated'|'skipped'|'nochange'|'uncertain'|'error'} status
 * @property {string} userId
 * @property {string} fromGroupId
 * @property {string} toGroupId
 * @property {number=} httpStatus
 * @property {string=} serverMessage
 * @property {string=} details
 */

/**
 * Смена группы пользователя «как из формы администрирования», но только если текущее значение
 * равно указанному fromGroupId. Иначе — пропуск без изменений.
 *
 * Требует: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit.
 *
 * @param {string|number} user_id
 * @param {string|number} fromGroupId  // менять только из этой группы…
 * @param {string|number} toGroupId    // …вот на эту
 * @param {{ overwriteSame?: boolean }} [opts]
 * @returns {Promise<UpdateGroupResult>}
 */
async function FMVupdateGroupIfEquals(user_id, fromGroupId, toGroupId, opts = {}) {
  const overwriteSame = !!opts.overwriteSame;
  const uid = String(user_id);
  const editUrl = `/profile.php?section=admin&id=${encodeURIComponent(uid)}&nohead`;

  try {
    // A) Загрузка страницы администрирования (режим без шапки — быстрее парсится)
    const doc = await fetchCP1251Doc(editUrl);

    // На некоторых стилях id формы различается — ищем по action
    const form =
      doc.querySelector('form#profile8') ||
      [...doc.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    if (!form) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Форма администрирования профиля не найдена',
        details: 'profile.php?section=admin без ожидаемой формы'
      };
    }

    // B) Определяем select группы
    const sel =
      form.querySelector('select[name="group_id"]') ||
      form.querySelector('#group_id');
    if (!sel) {
      return {
        status: 'error',
        userId: uid, fromGroupId: String(fromGroupId), toGroupId: String(toGroupId),
        serverMessage: 'Селектор group_id не найден',
      };
    }

    // C) Читаем актуальное значение
    const current = (sel.value ?? '').trim();
    const fromStr = String(fromGroupId).trim();
    const toStr   = String(toGroupId).trim();

    // Если уже в целевой группе
    if (current === toStr && !overwriteSame) {
      return {
        status: 'nochange',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Пользователь уже в целевой группе; перезапись отключена',
        details: `current=${current}`
      };
    }

    // Если текущее значение НЕ совпадает с «разрешённым исходным» — пропускаем
    if (current !== fromStr && !(current === toStr && overwriteSame)) {
      return {
        status: 'skipped',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        serverMessage: 'Текущая группа не совпадает с fromGroupId — изменения не требуются',
        details: `current=${current}`
      };
    }

    // D) Готовим форму к отправке «как из UI»
    sel.value = toStr;

    // Убедимся, что присутствует скрытое поле form_sent=1
    if (![...form.elements].some(el => el.name === 'form_sent')) {
      const hidden = doc.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'form_sent';
      hidden.value = '1';
      form.appendChild(hidden);
    }

    // Определяем имя submit-кнопки (на rusff обычно update_group_membership)
    let submitName = 'update_group_membership';
    const submitEl = [...form.elements].find(el =>
      el.type === 'submit' && (el.name || /сохран|обнов/i.test(el.value || ''))
    );
    if (submitEl?.name) submitName = submitEl.name;

    // E) Сериализуем так же, как «нажатие нужной кнопки» (CP1251)
    const body = serializeFormCP1251_SelectSubmit(form, submitName);

    // F) POST на action формы с корректным referrer
    const postUrl = form.getAttribute('action') || `/profile.php?section=admin&id=${encodeURIComponent(uid)}`;
    const { res, text } = await fetchCP1251Text(postUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      referrer: editUrl,
      referrerPolicy: 'strict-origin-when-cross-origin',
      body
    });

    if (!res.ok) {
      return {
        status: 'error',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: `HTTP ${res.status} при сохранении`
      };
    }

    // G) Контрольное чтение — убедимся, что селект действительно стал toStr
    const doc2 = await fetchCP1251Doc(editUrl);
    const form2 =
      doc2.querySelector('form#profile8') ||
      [...doc2.querySelectorAll('form')].find(f => (f.action || '').includes('/profile.php'));
    const sel2 = form2?.querySelector('select[name="group_id"]') || form2?.querySelector('#group_id');
    const v2 = (sel2?.value ?? '').trim();

    if (v2 === toStr) {
      return {
        status: 'updated',
        userId: uid, fromGroupId: fromStr, toGroupId: toStr,
        httpStatus: res.status,
        serverMessage: 'Группа успешно обновлена'
      };
    }

    return {
      status: 'uncertain',
      userId: uid, fromGroupId: fromStr, toGroupId: toStr,
      httpStatus: res.status,
      serverMessage: 'Сервер ответил 200, но подтвердить новое значение не удалось — проверьте вручную',
      details: `readback=${v2}`
    };

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return {
      status: 'error',
      userId: String(user_id),
      fromGroupId: String(fromGroupId),
      toGroupId: String(toGroupId),
      serverMessage: 'Transport/Runtime error',
      details: msg
    };
  }
}

/* Пример использования:
   // Если пользователь (id=4) сейчас в группе 1 — перевести в 3
   FMVupdateGroupIfEquals(4, 1, 3).then(console.log).catch(console.error);

   // То же, но если он уже в 3 — повторно «сохранить» (редко нужно)
   FMVupdateGroupIfEquals(4, 1, 3, { overwriteSame: true }).then(console.log);
*/

/* Comments & Chrono */
// ==UserScript==
// @name         Profile → last post in topic by title (search with pagination)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const PROFILE_PATH_RE = /\/profile\.php$/i;
  const PROFILE_ID_RE = /[?&]id=\d+/;
  const PROFILE_RIGHT_SEL = '#viewprofile #profile-right';

  if (!PROFILE_PATH_RE.test(location.pathname)) return;
  if (!PROFILE_ID_RE.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    #pa-bank-link a.is-empty {
      color: #999 !important;
      text-decoration: none !important;
      pointer-events: none;
      cursor: default;
      opacity: .8;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  function insertSlot() {
    const right = document.querySelector(PROFILE_RIGHT_SEL);
    if (!right) return null;

    const li = document.createElement('li');
    li.id = 'pa-bank-link';
    li.innerHTML = `
      <span>Банковская операция:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li.querySelector('a');
  }

  function setEmpty(anchor, reason) {
    const text = 'Не найдена';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(anchor, href) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = 'Последняя';
  }

  ready(async () => {
    const anchor = insertSlot();
    if (!anchor) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) {
      setEmpty(anchor, 'нет доступа к поиску');
      return;
    }

    if (!window.UserLogin) {
      setEmpty(anchor, 'нет данных пользователя');
      return;
    }

    const forumsRaw = window.BANK_FORUMS;
    const forums = Array.isArray(forumsRaw)
      ? forumsRaw
      : typeof forumsRaw === 'string' && forumsRaw.trim()
        ? forumsRaw.split(',').map(id => id.trim()).filter(Boolean)
        : [];

    try {
      const posts = await window.scrapePosts(window.UserLogin, forums, {
        title_prefix: 'Гринготтс',
        stopOnFirstNonEmpty: true,
        keywords: 'ДОХОДЫ OR РАСХОДЫ AND ИТОГО'
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const siteBase = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${siteBase}/viewtopic.php?${posts[0].src}`;
        setLink(slot, href, posts[0].date_text || posts[0].text || 'Последняя операция');
      } else {
        setEmpty(anchor);
      }
    } catch (error) {
      console.error('[bank_last_comment] scrapePosts failed', error);
      setEmpty(anchor, 'ошибка поиска');
    }
  });
})();
/**
 * Загружает карточки из текущего домена.
 * @param {number} topic_id  id темы (viewtopic.php?id=<topic_id>)
 * @param {Array<number>} comment_ids  id поста (#p<comment_id>-content)
 * @returns {Promise<Array<{id:string, html:string}>>}
 */
async function fetchCardsWrappedClean(topic_id, comment_ids) {
  const topicUrl = `${location.origin.replace(/\/$/, '')}/viewtopic.php?id=${encodeURIComponent(String(topic_id))}`;

  const decodeEntities = s => {
    const d = document.createElement('div');
    d.innerHTML = String(s ?? '');
    return d.textContent || d.innerText || '';
  };
  const toDoc = html => new DOMParser().parseFromString(html, 'text/html');

  async function smartFetchHtml(url) {
    if (typeof window.fetchHtml === 'function') return window.fetchHtml(url);
    const res = await fetch(url, { credentials: 'include' });
    const buf = await res.arrayBuffer();
    const declared = /charset=([^;]+)/i.exec(res.headers.get('content-type') || '')?.[1]?.toLowerCase();
    const tryDec = enc => { try { return new TextDecoder(enc).decode(buf); } catch { return null; } };
    if (declared) { const s = tryDec(declared); if (s) return s; }
    const utf = tryDec('utf-8') ?? '';
    const cp  = tryDec('windows-1251') ?? '';
    const bad = s => (s.match(/\uFFFD/g) || []).length;
    if (bad(cp) && !bad(utf)) return utf;
    if (bad(utf) && !bad(cp)) return cp;
    const cyr = s => (s.match(/[\u0400-\u04FF]/g) || []).length;
    return cyr(cp) > cyr(utf) ? cp : utf;
  }

  const pageHtml = await smartFetchHtml(topicUrl);
  const doc = toDoc(pageHtml);

  const allResults = [];

  for (const comment_id of comment_ids) {
    const post = doc.querySelector(`#p${String(comment_id)}-content`);
    if (!post) {
      console.warn(`Не найден #p${comment_id}-content на ${topicUrl}`);
      continue;
    }

    const scripts = [...post.querySelectorAll('script[type="text/html"]')];
    if (!scripts.length) continue;

    const combined = scripts.map(s => s.textContent || s.innerHTML || '').join('\n');
    const decoded = decodeEntities(combined).replace(/\u00A0/g, ' ');
    const innerDoc = toDoc(decoded);

    const result = [...innerDoc.querySelectorAll('#grid .card')].map(card => {
      const id        = FMV.normSpace(card.querySelector('.id')?.textContent || '');
      const rawTitle  = FMV.normSpace(card.querySelector('.desc')?.textContent || '');
      const content   = (card.querySelector('.content')?.innerHTML || '').replace(/\u00A0/g, ' ').trim();
      const titleAttr = rawTitle ? ` title="${rawTitle}"` : '';
      const html      = `<div class="item" data-id="${id}"${titleAttr}>${content}</div>`;
      return { id, html };
    });

    allResults.push(...result); // 🔸 добавляем карточки в общий массив
  }

  return allResults;
}
// ==UserScript==
// @name         Profile → Последний пост (bank/post_last_comment, без jQuery)
// @match        *://*/profile.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const PROFILE_PATH_RE = /\/profile\.php$/i;
  const PROFILE_ID_RE = /[?&]id=\d+/;
  const PROFILE_RIGHT_SEL = '#viewprofile #profile-right';

  if (!PROFILE_PATH_RE.test(location.pathname)) return;
  if (!PROFILE_ID_RE.test(location.search)) return;

  const style = document.createElement('style');
  style.textContent = `
    #pa-lastpost-link a.is-empty {
      color: #999 !important;
      text-decoration: none !important;
      pointer-events: none;
      cursor: default;
      opacity: .8;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function ensureScrapePosts(timeoutMs = 8000, intervalMs = 250) {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      if (typeof window.scrapePosts === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return false;
  }

  function insertSlot() {
    const right = document.querySelector(PROFILE_RIGHT_SEL);
    if (!right) return null;

    const li = document.createElement('li');
    li.id = 'pa-lastpost-link';
    li.innerHTML = `
      <span>Последний пост:</span>
      <strong><a href="#" target="_blank" rel="nofollow noopener" class="is-empty">Загрузка…</a></strong>
    `;

    const after = right.querySelector('#pa-last-visit');
    if (after && after.parentElement === right) {
      after.insertAdjacentElement('afterend', li);
    } else {
      right.appendChild(li);
    }

    return li;
  }

  function setEmpty(reason) {
    const text = 'Не найден';
    anchor.classList.add('is-empty');
    anchor.href = '#';
    anchor.title = reason || text;
    anchor.textContent = text;
  }

  function setLink(href, dateText) {
    anchor.classList.remove('is-empty');
    anchor.href = href;
    anchor.textContent = dateText || 'Последний пост';
  }

  ready(async () => {
    const anchor = insertSlot();
    if (!anchor) return;

    const hasScrape = await ensureScrapePosts();
    if (!hasScrape) {
      setEmpty(anchor, 'нет доступа к поиску');
      return;
    }

    if (!window.UserLogin) {
      setEmpty(anchor, 'нет данных пользователя');
      return;
    }

    const forumsRaw = window.BANK_FORUMS;
    const forums = Array.isArray(forumsRaw)
      ? forumsRaw
      : typeof forumsRaw === 'string' && forumsRaw.trim()
        ? forumsRaw.split(',').map(id => id.trim()).filter(Boolean)
        : [];

    try {
      const posts = await window.scrapePosts(window.UserLogin, forums, {
        stopOnFirstNonEmpty: true,
        comments_only: true
      });

      if (Array.isArray(posts) && posts.length && posts[0]?.src) {
        const base = (typeof window.SITE_URL === 'string' && window.SITE_URL.trim())
          ? window.SITE_URL.trim().replace(/\/$/, '')
          : location.origin.replace(/\/$/, '');
        const href = `${base}/viewtopic.php?${posts[0].src}`;
        setLink(slot, href, posts[0].date_text || posts[0].text || 'Последний пост');
      } else {
        setEmpty(slot);
      }
    } catch (error) {
      console.error('[post_last_comment] scrapePosts failed', error);
      setEmpty(slot, 'ошибка поиска');
    }
  });
})();
// fmv.replace_comment.js
(() => {
  'use strict';

  // страховки, если common.js чего-то не дал
  if (typeof window.extractErrorMessage !== 'function') window.extractErrorMessage = () => '';
  if (typeof window.extractInfoMessage  !== 'function') window.extractInfoMessage  = () => '';
  if (typeof window.classifyResult      !== 'function') window.classifyResult      = () => 'unknown';

  /**
   * Заменить текст комментария поста через /edit.php?id=PID&action=edit
   * Требует helpers/common: fetchCP1251Doc, fetchCP1251Text, serializeFormCP1251_SelectSubmit
   */
  async function replaceComment(allowedGroups, postId, newText) {
    // 0) доступ по группе
    const gid = (typeof window.getCurrentGroupId === 'function') ? window.getCurrentGroupId() : null;
    const allow = new Set((allowedGroups || []).map(x => String(Number(x))));
    if (!gid || !allow.has(String(Number(gid)))) {
      return { ok:false, status:'forbidden', postId:String(postId), newText, errorMessage:'Нет доступа по группе' };
    }

    // 1) валидный PID
    const pidNum = parseInt(postId, 10);
    if (!Number.isFinite(pidNum)) {
      return { ok:false, status:'badid', postId:String(postId), newText, errorMessage:`Некорректный postId: ${postId}` };
    }
    const PID = String(pidNum);
    const editUrl = `/edit.php?id=${encodeURIComponent(PID)}&action=edit`;

    try {
      // 2) GET формы редактирования
      let doc, form, msgField, pageHtml = '';
      try {
        doc = await fetchCP1251Doc(editUrl);
        pageHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
        msgField = doc.querySelector('textarea#main-reply[name="req_message"], textarea[name="req_message"]');
        if (msgField) form = msgField.closest('form');
      } catch (e) {
        return { ok:false, status:'transport', postId:PID, newText, errorMessage:(e?.message || String(e)) };
      }
      if (!form || !msgField) {
        const infoMessage  = extractInfoMessage(pageHtml)  || '';
        const errorMessage = extractErrorMessage(pageHtml) || '';
        const status       = classifyResult(pageHtml) || 'noform';
        return { ok:false, status, postId:PID, newText, infoMessage, errorMessage };
      }

      // 3) подмена текста
      const oldText = String(msgField.value || '').trim();
      msgField.value = newText;

      // 4) сериализация + POST
      const submitName =
        [...form.elements].find(el => el.type === 'submit' && (el.name || /Отправ|Сохран|Submit|Save/i.test(el.value || '')))?.name
        || 'submit';

      const body = serializeFormCP1251_SelectSubmit(form, submitName);

      const { res, text } = await fetchCP1251Text(editUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        referrer: editUrl,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });

      // 5) разбираем ответ аккуратно (без простыней)
      const infoMessage  = extractInfoMessage(text) || '';
      const errorMessage = extractErrorMessage(text) || '';
      const raw          = classifyResult(text);

      // ► нормализуем статус в СТРОКУ
      let statusText =
        (typeof raw === 'string')
          ? raw
          : (raw && (raw.status || raw.code))
            ? String(raw.status || raw.code)
            : 'unknown';

      // ► если HTTP 200 и явной ошибки нет — принимаем как успех
      if (res.ok && (statusText === 'unknown' || statusText === '')) {
        statusText = 'ok';
      }

      // 6) финал (не логируем содержимое текста)
      if (res.ok && statusText === 'ok') {
        return {
          ok: true,
          status: 'ok',
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status
        };
      } else {
        return {
          ok: false,
          status: statusText,
          postId: PID,
          oldText,
          newText,
          httpStatus: res.status,
          infoMessage:  infoMessage.slice(0, 200),
          errorMessage: errorMessage.slice(0, 200)
        };
      }

    } catch (err) {
      return { ok:false, status:'transport', postId:String(postId), newText, errorMessage:(err?.message || String(err)) };
    }
  }

  window.FMV = window.FMV || {};
  window.FMV.replaceComment = replaceComment;
})();
// Проверка, что все указанные поля присутствуют и не пусты в window.CHRONO_CHECK
// Пример:
// if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID'])) return;

(function () {
  'use strict';

  /**
   * Проверяет, что в window.CHRONO_CHECK заданы все указанные поля
   * @param {string[]} keys - список имён полей для проверки
   * @returns {boolean} true, если все поля есть и непустые
   */
  window.checkChronoFields = function (keys = []) {
    const ch = window.CHRONO_CHECK;
    if (!ch || typeof ch !== 'object') return false;
    if (!Array.isArray(keys) || !keys.length) return true;

    return keys.every(k => {
      const v = ch[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  };
})();
/* ===================== поиск поста / блока ===================== */
function findChronoRendered(root) {
  const cand = Array.from(root.querySelectorAll('*')).find(n => /Собранная\s+хронология/i.test(n.textContent || ''));
  if (!cand) return null;
  return cand.closest('.quote-box, .media, .spoiler-box, .content, .post, div, section') || cand;
}

function renderStatus(type, status) {
  const MAP_TYPE = window.CHRONO_CHECK?.EpisodeMapType || {
    personal: ['personal', 'black'],
    plot:     ['plot',     'black'],
    au:       ['au',       'black']
  };

  const MAP_STAT = window.CHRONO_CHECK?.EpisodeMapStat || {
    on:       ['active',   'green'],
    off:      ['closed',   'teal'],
    archived: ['archived', 'maroon']
  };
  
  const t = MAP_TYPE[type] || MAP_TYPE.au;
  const s = MAP_STAT[status] || MAP_STAT.archived;
  return `[color=${t[1]}]${t[0]}[/color] / [color=${s[1]}]${s[0]}[/color]`;
}

// --- parseParagraph: делим <p> на 4 логические строки по <br> ---
function parseParagraph(p) {
  const lines = [[], [], [], []]; // 0: дата+тема, 1: мета, 2: участники, 3: локация (+ всё остальное)
  let i = 0;
  for (const node of p.childNodes) {
    if (node.nodeType === 1 && node.tagName === 'BR') { i = Math.min(i + 1, 3); continue; }
    lines[i].push(node);
  }
  const dateTitleNodes = lines[0];
  const metaNodes      = lines[1];
  const partNodes      = lines[2];
  const locNodes       = lines[3];

  // ссылка темы — только <a href*="viewtopic.php?id="> из первой строки
  const tmp = document.createElement('div');
  dateTitleNodes.forEach(n => tmp.appendChild(n.cloneNode(true)));
  const a = tmp.querySelector('a[href*="viewtopic.php?id="]') || p.querySelector('a[href*="viewtopic.php?id="]');

  const { type, status, order, dateStart, dateEnd, title } =
    parseHeaderNew(dateTitleNodes, metaNodes, a);

  const { participants, masksLines } = parseParticipants(partNodes);
  const location = cleanLocation(textFromNodes(locNodes));

  const start = (type === 'au') ? '' : (dateStart || '');
  const end   = (type === 'au') ? '' : (dateEnd   || start || '');

  return {
    type, status,
    title, href: a?.href || '',
    dateStart: start, dateEnd: end,
    order: Number.isFinite(order) ? order : 0,
    participants, masksLines, location
  };
}

// --- parseHeaderNew: 1-я строка (дата — тема), 2-я строка ([тип / статус / порядок]) ---
function parseHeaderNew(dateTitleNodes, metaNodes, linkEl) {
  // ТЕМА: только текст из <a>
  const title = (linkEl?.textContent || '').trim();

  // 1-я строка как временный DOM
  const wrap = document.createElement('div');
  dateTitleNodes.forEach(n => wrap.appendChild(n.cloneNode(true)));
  const l1Text = (wrap.textContent || '').replace(/\s+/g, ' ').trim();

  // --- ДАТА: только если реально дата ---
  let dateStart = '', dateEnd = '';

  // (а) strong приоритетнее
  let datePart = (wrap.querySelector('strong')?.textContent || '').trim();

  if (!datePart) {
        // (б) пытаемся взять префикс до первого « —/–/- » как кандидата на дату
    const head = l1Text.split(/\s[—–-]\s/)[0]?.trim() || '';
    const d = parseDateFlexible(head); // уже умеет все нужные форматы и диапазоны
    if (d && d.hasDate) {
      // сохраняем как текстовые значения для твоей дальнейшей логики
      const show = (a) =>
        a?.y != null
          ? (a.d != null ? `${String(a.d).padStart(2,'0')}.${String(a.m).padStart(2,'0')}.${a.y}`
             : a.m != null ? `${String(a.m).padStart(2,'0')}.${a.y}`
             : String(a.y))
          : '';
      dateStart = show(d.left);
      // ставим dateEnd только если диапазон реально есть
      dateEnd = (d.right && (d.right.y !== d.left.y || d.right.m != null || d.right.d != null))
                  ? show(d.right)
                  : '';
    }
  } else {
    // распарсить диапазон из strong, если он есть
    const norm = datePart.replace(/[\u2012-\u2015\u2212—–−]/g, '-').replace(/\s*-\s*/g, '-');
    const duo = norm.split('-').slice(0, 2).map(s => s.trim());
    dateStart = duo[0] || '';
    dateEnd   = duo[1] || '';
  }

  // если встречается "дата не указана" — пусто
  if (/дата\s+не\s+указан/i.test(datePart || '')) { dateStart = ''; dateEnd = ''; }

  // --- МЕТА: [тип / статус / порядок] — 2-я строка
  const metaText = textFromNodes(metaNodes);
  let type = '', status = '', order = 0;
  const box = metaText.match(/\[([^\]]+)\]/);
  if (box) {
    const parts = box[1].split('/').map(s => s.trim());
    type   = (parts[0] || '').toLowerCase();
    status = (parts[1] || '').toLowerCase();
    if (parts[2]) { const n = parseInt(parts[2], 10); if (Number.isFinite(n)) order = n; }
  }

  return { type, status, order, dateStart, dateEnd, title };
}

function parseParticipants(nodes) {
  // расплющим DOM в токены "link" и "text"
  const toks = [];
  (function flat(nl){
    Array.from(nl).forEach(n => {
      if (n.nodeType === 3) toks.push({ t:'text', v:n.nodeValue || '' });
      else if (n.nodeType === 1) {
        if (n.tagName === 'A') toks.push({ t:'link', name:(n.textContent||'').trim(), href:n.href||'' });
        else flat(n.childNodes);
      }
    });
  })(nodes);

  const participants = [];            // {name, href}
  const maskMap = new Map();          // name -> [mask,...]
  let lastName = null;

  const addMask = (name, list) => {
    if (!name || !list || !list.length) return;
    if (!maskMap.has(name)) maskMap.set(name, []);
    maskMap.get(name).push(...list);
  };

  for (const tk of toks) {
    if (tk.t === 'link') {
      const name = tk.name;
      participants.push({ name, href: tk.href });
      lastName = name;
      continue;
    }

    if (tk.t === 'text') {
      let t = tk.v || '';
      // если встречаем "не указаны" — обе колонки пустые
      if (/\bне\s*указан/i.test(t)) return { participants: [], masksLines: [] };

      // вытащить маски и привязать к последнему участнику
      t = t.replace(/\[\s*as\s*([^\]]+)\]/ig, (_m, g) => {
        const arr = g.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
        addMask(lastName, arr);
        return ''; // удалить из текста
      });

      // оставшиеся имена (без масок) через запятую
      t.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
        if (/^[–—-]+$/.test(name)) return;                 // мусорные тире
        if (/^\[.*\]$/.test(name)) return;                 // остаточные скобки
        participants.push({ name, href: '' });
        lastName = name;
      });
    }
  }

  // собрать строки для колонки "Маски" (по одной маске в строке)
  const masksLines = [];
  for (const p of participants) {
    const arr = maskMap.get(p.name);
    if (arr && arr.length) arr.forEach(msk => masksLines.push(`${p.name} — ${msk}`));
  }

  return { participants, masksLines };
}
function cleanLocation(s) {
  const t=String(s||'').trim();
  if (!t) return '';
  if (/^локац/i.test(t) && /не\s+указан/i.test(t)) return '';
  if (/^не\s+указан/i.test(t)) return '';
  return t;
}

/**
 * collectEpisodesFromForums (без forumIds/topicId/postId и без CHRONO_CHECK.ForumInfo)
 * Обходит разделы форума и возвращает массив эпизодов:
 * {
 *   dateStart, dateEnd, title, href, type, status, order, location,
 *   participants: [ { id?, name, masks: [] }, ... ]
 * }
 *
 * Параметры (все опциональны):
 *   - sections: [{ id, type?, status? }, ...]  // если не задано — автообнаружение по документу
 *   - maxPagesPerSection: число страниц на раздел (по умолчанию 50)
 *   - groupIds: допустимые группы (если ваша логика доступа это использует где-то снаружи)
 *   - respectAccess: флаг для внешних проверок доступа (пробрасывается как есть)
 */
async function collectEpisodesFromForums(opts = {}) {
    // --- вспомогательная функция для ограниченной параллельной загрузки ---
    async function asyncPool(limit, items, iteratee) {
      const ret = [];
      const executing = new Set();
      for (const item of items) {
        const p = Promise.resolve().then(() => iteratee(item));
        ret.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= limit) {
          await Promise.race(executing);
        }
      }
      return Promise.all(ret);
    }
  
  // разделы: либо из opts.sections, либо автообнаружение по текущему документу
  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  if (!SECTIONS.length) {
    // авто: собрать все уникальные forum-id из текущей страницы
    const ids = new Set();
    document.querySelectorAll('a[href*="viewforum.php?id="]').forEach(a => {
      const m = String(a.getAttribute('href') || '').match(/viewforum\.php\?id=(\d+)/i);
      if (m) ids.add(m[1]);
    });
    SECTIONS = Array.from(ids).map(id => ({ id })); // type/status можно добавить позднее при необходимости
  }

  if (!SECTIONS.length) {
    console.warn('[collectEpisodesFromForums] Не удалось определить список разделов (sections)');
    return [];
  }

  const MAX_PAGES_PER_SECTION = 100;

  // ==== утилиты ====
  const abs  = (base, href)=>{ try { return new URL(href, base).href; } catch { return href; } };
  const text = node => (node && (node.innerText ?? node.textContent) || '').trim();

  // чтение заголовка темы: из <title> или хвоста крошек после последнего "»"
  function topicTitleFromCrumbs(doc) {
    const t = (doc.querySelector('title')?.textContent || '').trim();
    if (/\[.+\]\s+.+/.test(t)) return t;
    const crumbs = doc.querySelector('.crumbs, .crumbs-nav, #pun-crumbs1 .crumbs, #pun-crumbs1');
    if (crumbs) {
      const full = (crumbs.textContent || '').replace(/\s+/g, ' ').trim();
      const tail = full.split('»').pop()?.trim() || '';
      if (tail) return tail;
    }
    const a = doc.querySelector('a[href*="viewtopic.php?id="]');
    return (a?.textContent || '').trim();
  }

  // [дата] Заголовок — только если внутри реально дата/диапазон
  function parseTitle(str) {
    const s = String(str || '').trim();
  
    const m = s.match(/^\s*\[(.*?)\]\s*(.*)$/s);
    if (m) {
      const inner = (m[1] || '').trim();
      const rest  = (m[2] || '').trim();
      const d = parseDateFlexible(inner);   // ваша функция разбора дат
  
      if (d && d.hasDate) {
        // это действительно дата → отделяем
        return { dateRaw: inner, episode: rest.replace(/\s+/g, ' ') };
      }
      // НЕ дата → ничего не откусываем
    }
  
    return { dateRaw: '', episode: s.replace(/\s+/g, ' ') };
  }


  // ---- парсинг дат ----
  const DASH_RX = /[\u2012-\u2015\u2212—–−]/g;
  const DOT_RX  = /[.\u2024\u2219\u00B7\u2027\u22C5·∙•]/g;
  const pad2 = x => String(x).padStart(2,'0');
  function toYYYY(n){ const num = Number(n); if (!Number.isFinite(num)) return null; return String(n).length === 2 ? (num > 30 ? 1900 + num : 2000 + num) : num; }
  function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }
  function parseToken(t) {
    const s = String(t || '').trim().replace(DOT_RX, '.');
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const d  = +m[1], mo = +m[2], y = toYYYY(m[3]);
      if (mo<1 || mo>12) return null;
      if (d<1 || d>daysInMonth(y,mo)) return null;
      return { y, m: mo, d };
    }
    m = s.match(/^(\d{1,2})\.(\d{2}|\d{4})$/);
    if (m) {
      const mo = +m[1], y = toYYYY(m[2]);
      if (mo>=1 && mo<=12) return { y, m: mo };
    }
    m = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (m) {
      const d = +m[1], mo = +m[2];
      if (mo>=1 && mo<=12 && d>=1 && d<=31) return { m: mo, d };
      return null;
    }
    m = s.match(/^(\d{2}|\d{4})$/);
    if (m) return { y: toYYYY(m[1]) };
    return null;
  }
  function displaySingle(a){ return a.d!=null ? `${pad2(a.d)}.${pad2(a.m)}.${a.y}`
                          : a.m!=null ? `${pad2(a.m)}.${a.y}` : String(a.y); }
  function parseDateFlexible(raw) {
    let s = String(raw || '').trim();
    if (!s) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    s = s.replace(DASH_RX, '-').replace(DOT_RX, '.').replace(/\s*-\s*/g, '-');
    const parts = s.split('-').slice(0,2);
    if (parts.length === 1) {
      const one = parseToken(parts[0]);
      if (!one || !one.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
      const k = [one.y, one.m ?? 0, one.d ?? 0];
      return { hasDate:true, display:displaySingle(one), startSort:k, endSort:k, left:one, right:one };
    }
    const leftRaw  = parts[0].trim();
    const rightRaw = parts[1].trim();
    const R0 = parseToken(rightRaw);
    if (!R0 || !R0.y) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    let L0 = parseToken(leftRaw);
    const mSolo = leftRaw.match(/^\d{1,2}$/);
    if (mSolo) {
      const v = +mSolo[0];
      if (R0.d != null && R0.m != null)      L0 = { y:R0.y, m:R0.m, d:v };
      else if (R0.m != null)                 L0 = { y:R0.y, m:v };
      else                                   L0 = { y: toYYYY(v) };
    }

    // если оба — чисто двухзначные годы и получился "перевёрнутый" диапазон,
    // подгоняем век левой границы под правую
    const left2  = /^\d{1,2}$/.test(leftRaw);
    const right2 = /^\d{1,2}$/.test(rightRaw);
    if (left2 && right2 && L0?.y && R0?.y && (L0.m==null && L0.d==null) && (R0.m==null && R0.d==null)) {
      if (L0.y > R0.y) {
        // примем век правой границы для левой
        const century = Math.floor(R0.y / 100) * 100;       // 1900 или 2000
        const yy = +leftRaw;                                 // 22
        L0.y = century + yy;                                 // 1922
      }
    }

    
    if (L0 && L0.y == null && L0.d != null && L0.m != null && R0.y) L0.y = R0.y;
    const okDay = (o)=> (o.d==null) || (o.y && o.m && o.d>=1 && o.d<=daysInMonth(o.y,o.m));
    if (!okDay(L0) || !okDay(R0)) return { hasDate:false, display:'', startSort:[0,0,0], endSort:[0,0,0] };
    const startKey = [L0.y, L0.m ?? 0, L0.d ?? 0];
    const endKey   = [R0.y ?? L0.y, R0.m ?? 0, R0.d ?? 0];
    function displayRange(a,b){
      if (a.d!=null && b.d!=null) return `${pad2(a.d)}.${pad2(a.m)}.${a.y}-${pad2(b.d)}.${b.m}.${b.y}`;
      if (a.m!=null && b.m!=null) return `${pad2(a.m)}.${a.y}-${pad2(b.m)}.${b.y}`;
      return `${a.y}-${b.y}`;
    }
    return { hasDate:true, startSort:startKey, endSort:endKey, display:displayRange(L0,R0), left:L0, right:R0 };
  }
  function cmpTriple(a, b) { for (let i=0;i<3;i++) { const d = (a[i]??0)-(b[i]??0); if (d) return d; } return 0; }
  function compareEpisodes(a, b) {
    const aHas = !!a.__hasDate, bHas = !!b.__hasDate;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas) {
      const s = cmpTriple(a.__startSort, b.__startSort); if (s) return s;
      const e = cmpTriple(a.__endSort,   b.__endSort);   if (e) return e;
    }
    const ao = a.order ?? 0, bo = b.order ?? 0;
    if (ao !== bo) return ao - bo;
    return String(a.title||'').toLowerCase()
      .localeCompare(String(b.title||'').toLowerCase(), 'ru', { sensitivity:'base' });
  }
  function normalizeEpisodeTitle(type, rawTitle, hasDateForType) {
    const title = String(rawTitle || '').trim();
    let ok = true;
  
    if (type === 'plot') {
      // Требуем: валидная дата есть И суффикс "... [c]" или "... [с]" в самом конце
      const suffixRx = /\s\[\s*(?:c|с)\s*\]$/i; // лат. c или кир. с
      const hasSuffix = suffixRx.test(title);
      ok = !!hasDateForType && hasSuffix;
  
      return {
        title: hasSuffix ? title.replace(suffixRx, '').trim() : title,
        ok
      };
    }
  
    if (type === 'au') {
      // Требуем: начало либо "[au] ", либо "[AU] " (смешанный регистр не допускаем)
      const prefixRx = /^(?:\[\s*au\s*\]\s+|\[\s*AU\s*\]\s+)/;
      const hasPrefix = prefixRx.test(title);
      ok = hasPrefix;
  
      return {
        title: hasPrefix ? title.replace(prefixRx, '').trim() : title,
        ok
      };
    }
  
    return { title, ok };
  }

  // ==== скрапперы ====
  async function scrapeSection(section, seenTopics) {
  let url = abs(location.href, `/viewforum.php?id=${section.id}`);
  const seenPages = new Set();
  const out  = [];
  let n = 0;

  // [NEW] Зафиксируем какие темы уже встречали в этом разделе:
  const sectionSeen = new Set();

  let lastSig = '';

  while (url && !seenPages.has(url) && n < MAX_PAGES_PER_SECTION) {
    n++; seenPages.add(url);
    const doc = await FMV.fetchDoc(url);

    // список тем на странице (id → {url,title})
    const topics = new Map();
    doc.querySelectorAll('a[href*="viewtopic.php?id="]').forEach(a => {
      const href = abs(url, a.getAttribute('href'));
      const m = href.match(/viewtopic\.php\?id=(\d+)/i);
      const ttl = text(a);
      if (!m) return;
      if (/^\s*(RSS|Atom)\s*$/i.test(ttl)) return;
      if (/#p\d+$/i.test(href)) return;
      if (/^\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?$/.test(ttl)) return;
      topics.set(m[1], { url: href, title: ttl });
    });

    // === РАННИЕ ВЫХОДЫ ===

    // (а) Совпала сигнатура со страницей N-1 → дальше листать нет смысла
    const pageIds = Array.from(topics.keys()).sort();
    const sig = pageIds.join(',');
    if (sig && sig === lastSig) break;
    lastSig = sig;

    // (б) На странице нет ни одного нового id относительно уже виденных в этом разделе
    const newIds = pageIds.filter(id => !sectionSeen.has(id));
    if (newIds.length === 0) break;
    newIds.forEach(id => sectionSeen.add(id));

    // --- параллельная загрузка тем с лимитом потоков ---
    const CONCURRENCY = Number.isFinite(+opts?.concurrencyPerPage)
      ? +opts.concurrencyPerPage
      : 6; // дефолт: 6 запросов одновременно
    
    const topicEntries = Array.from(topics.entries());
    
    const rows = await asyncPool(CONCURRENCY, topicEntries,
      async ([tid, { url: turl, title }]) => {
        const key = tid ? `id:${tid}` : `url:${turl.replace(/#.*$/,'')}`;
        if (seenTopics.has(key)) return null;
        const row = await scrapeTopic(turl, title, section.type, section.status);
        return row ? { key, row } : null;
      });
    
    for (const r of rows) {
      if (!r) continue;
      seenTopics.add(r.key);
      out.push(r.row);
    }

    // Переход на следующую страницу
    const next = (function findNextPage(doc){
      const a = doc.querySelector('a[rel="next"], a[href*="&p="]:not([rel="prev"])');
      return a ? a.getAttribute('href') : null;
    })(doc);
    const nextUrl = next ? abs(url, next) : null;
    if (!nextUrl || seenPages.has(nextUrl)) { url = null; break; }
    url = nextUrl;
  }
  return out;
}


  async function scrapeTopic(topicUrl, rawTitle, type, status) {
    try {
      const doc   = await FMV.fetchDoc(topicUrl);
      const first = doc.querySelector('.post.topicpost .post-content')
                   || doc.querySelector('.post.topicpost') || doc;

      const titleFromCrumbs = topicTitleFromCrumbs(doc);
      const safeTitle = rawTitle || titleFromCrumbs || '';

      const { dateRaw, episode } = parseTitle(safeTitle);
      const parsed = parseDateFlexible(dateRaw);

      const norm = normalizeEpisodeTitle(type, episode || '', parsed.hasDate);

      const rawChars = FMV.readTagText(first, 'characters');
      const rawLoc   = FMV.readTagText(first, 'location');
      const rawOrder = FMV.readTagText(first, 'order');

      const idToNameMap = await FMV.buildIdToNameMapFromTags(rawChars);
      const uni = FMV.parseCharactersUnified(rawChars, idToNameMap, window.profileLink);
      const participantsLower = uni.ok ? uni.participantsLower : [];
      const masksByCharLower  = uni.ok ? uni.masksByCharLower  : new Map();

      const order = (FMV.parseOrderStrict(rawOrder).ok ? FMV.parseOrderStrict(rawOrder).value : 0);

      const locationsLower = rawLoc
        ? rawLoc.split(/\s*[,;]\s*/).map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

      const participants = participantsLower.map(low => {
        const masks = Array.from(masksByCharLower.get(low) || []);
        const m = /^user(\d+)$/i.exec(String(low));
        if (m) {
          const id = m[1];
          if (idToNameMap && idToNameMap.has(id)) {
            return { id, name: idToNameMap.get(id), masks };
          }
          return { name: `user${id}`, masks };
        }
        return { name: String(low), masks };
      });

      const dateStartStr = parsed.hasDate
        ? ((parsed.left?.d != null) ? displaySingle(parsed.left)
          : (parsed.left?.m != null) ? displaySingle(parsed.left)
          : String(parsed.left?.y ?? ''))
        : '';
      
      const dateEndStr = parsed.hasDate
        ? ((parsed.right?.d != null) ? displaySingle(parsed.right)
          : (parsed.right?.m != null) ? displaySingle(parsed.right)
          : String(parsed.right?.y ?? parsed.left?.y ?? ''))
        : (dateStartStr || '');

      return {
        dateStart: dateStartStr,
        dateEnd:   dateEndStr,
        title:     norm.title || '',
        href:      topicUrl,
        type, status,
        order:     Number(order) || 0,
        location:  locationsLower.join(', '),
        participants,
        isTitleNormalized: norm.ok,
        __hasDate: parsed.hasDate,
        __startSort: parsed.startSort,
        __endSort:   parsed.endSort
      };
    } catch {
      return null;
    }
  }

  // ==== обход и сортировка ====
  const seenTopics = new Set();
  let all = [];
  for (const sec of SECTIONS) {
    const part = await scrapeSection(sec, seenTopics);
    all = all.concat(part);
  }

  all = all.filter(Boolean).sort(compareEpisodes);

  // подчистим служебные поля
  all.forEach(e => { delete e.__hasDate; delete e.__startSort; delete e.__endSort; });

  return all;
}


/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * Параметры:
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию берётся из CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 *
 * Возвращает:
 * Promise<{ [userId: string]: { name: string, episodes: Episode[] } }>
 *
 * Episode = {
 *   dateStart: string,
 *   dateEnd:   string,
 *   type:      string,
 *   status:    string,
 *   title:     string,
 *   href:      string,
 *   order:     number,
 *   location:  string,
 *   masks:     string[],  // маски владельца
 *   participants: Array<{ id:string, name:string, masks:string[] }>
 * }
 */
/**
 * Собирает словарь по пользователям на основе collectEpisodesFromForums.
 * Учитывает только участников со ссылкой на профиль (есть p.id).
 *
 * @param {Object} [opts]
 * @param {Array<number|string>} [opts.groupIds] - допустимые группы; по умолчанию CHRONO_CHECK.GroupID
 * @param {boolean} [opts.respectAccess=true]    - выполнять проверки доступа (если есть хелперы)
 * @param {Array<{id:string|number,type?:string,status?:string}>} [opts.sections] - список разделов
 * @param {number} [opts.maxPagesPerSection]     - лимит страниц на раздел
 *
 * @returns {Promise<Object>} { "<userId>": { name: string, episodes: Episode[] } }
 */
async function collectChronoByUser(opts = {}) {
  if (typeof collectEpisodesFromForums !== 'function') {
    throw new Error('collectEpisodesFromForums недоступна');
  }

  let SECTIONS = Array.isArray(opts.sections) && opts.sections.length ? opts.sections.slice() : [];
  const maxPagesPerSection =
    Number.isFinite(+opts.maxPagesPerSection) ? +opts.maxPagesPerSection : undefined;

  // получаем эпизоды с учётом sections
  const episodes = await collectEpisodesFromForums({
    sections: SECTIONS,
    maxPagesPerSection
  });

  const byUser = Object.create(null);

  // стабилизируем порядок
  episodes.forEach((e, i) => { if (!Number.isFinite(e.order)) e.order = i; });

  for (const ep of episodes) {
    const participants = (ep.participants || [])
      .map(p => {
        const id = p?.id ? String(p.id).trim() : '';
        if (!id) return null; // игнорируем ники без id/профиля
        return {
          id,
          name: (p.name || '').trim(),
          masks: Array.isArray(p.masks) ? p.masks.slice() : []
        };
      })
      .filter(Boolean);

    for (const self of participants) {
      const others = participants
        .filter(p => p !== self)
        .map(p => ({ id: p.id, name: p.name, masks: p.masks.slice() }));

      const outEpisode = {
        dateStart: ep.dateStart || '',
        dateEnd:   ep.dateEnd   || ep.dateStart || '',
        type:      ep.type      || '',
        status:    ep.status    || '',
        title:     ep.title     || '',
        href:      ep.href      || '',
        order:     Number(ep.order || 0),
        location:  ep.location  || '',
        masks:     self.masks || [],
        participants: others,
        // если нужно использовать дальше: пробросим валидность названия
        isTitleNormalized: !!ep.isTitleNormalized
      };

      if (!byUser[self.id]) {
        byUser[self.id] = { name: self.name || '', episodes: [] };
      }
      byUser[self.id].episodes.push(outEpisode);
    }
  }

  return byUser;
}
// button_total_to_excel (через collectEpisodesFromForums)
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'TotalChronoPostID', 'ForumInfo'])) {
    console.warn('[button_total_to_excel] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const PID        = String(window.CHRONO_CHECK.TotalChronoPostID).trim();
  const OPEN_URL   = new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href).href;
  const SITE_URL = (window.SITE_URL || location.origin).replace(/\/+$/, '');
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;


  let lastBlobUrl = '';

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'выгрузить общее хроно в excel',
    order: 2,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Скачать',
    linkHref: '',

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      api?.setLink?.('', ''); // прячем ссылку на время работы

      try {
        setStatus('Собираю…');
        setDetails('');

        // === берём готовые эпизоды из парсера
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });
        if (!episodes.length) throw new Error('Эпизоды не найдены.');

        // Маппинг эпизодов → строки таблицы
        // Столбцы: Тип | Статус | Тема (ссылка) | Дата начала | Дата конца | Порядок | Участники | Маски | Локация
        const rows = episodes.map(ep => {
          // колонка «Участники»: "Имя — {SITE_URL}/profile.php?id=ID" или просто "Имя"
          const participantsText = (ep.participants || []).map(p => {
            const name = String(p.name || '').trim();
            if (!name) return '';
            if (p.id != null && p.id !== '') {
              const href = `${SITE_URL}/profile.php?id=${encodeURIComponent(String(p.id))}`;
              return `${name} — ${href}`;
            }
            return name;
          }).filter(Boolean).join('\n');

          // колонка «Маски»: "Имя — mask1, mask2" (только если маски есть)
          const masksLines = (ep.participants || []).flatMap(p => {
            const masks = Array.isArray(p.masks) ? p.masks.filter(Boolean) : [];
            const name  = String(p.name || '').trim() || (p.id != null ? `user${p.id}` : '');
            // Для каждой маски — своя строка "Имя — маска"
            return masks.map(m => `${name} — ${m}`);
          }).filter(Boolean);

          return {
            type: ep.type || '',
            status: ep.status || '',
            title: ep.title || '',
            href: ep.href || '',
            dateStart: ep.dateStart || '',
            dateEnd: ep.dateEnd || ep.dateStart || '',
            order: Number(ep.order || 0) || 0,
            participantsText,
            masksLines,
            location: ep.location || ''
          };
        });

        setStatus('Формирую файл…');
        const { blob, filename } = buildXLSX(rows);

        if (lastBlobUrl) { try { URL.revokeObjectURL(lastBlobUrl); } catch {} }
        lastBlobUrl = URL.createObjectURL(blob);

        setStatus('Готово');
        setDetails(`Строк: ${rows.length}\nИсточник: ${FMV.escapeHtml(OPEN_URL)}\nФайл: ${FMV.escapeHtml(filename)}`);
        setLink(lastBlobUrl, 'Скачать');
        const a = api?.wrap?.querySelector('a.fmv-action-link');
        if (a) a.setAttribute('download', filename);

      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLink?.('', '');
      }
    }
  });

  /* ===================== XLSX builder ===================== */

  // helpers
  const str2u8 = s => new TextEncoder().encode(s);
  const u16 = n => new Uint8Array([n&255,(n>>>8)&255]);
  const u32 = n => new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const concat = arrs => { let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let o=0; arrs.forEach(a=>{out.set(a,o); o+=a.length;}); return out; };
  const CRC_TABLE = (()=>{ let t=new Uint32Array(256), c; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0;} return t;})();
  const crc32 = (u8)=>{ let c=0^(-1); for(let i=0;i<u8.length;i++) c=(c>>>8)^CRC_TABLE[(c^u8[i])&255]; return (c^(-1))>>>0; };
  const dosDateTime=(d=new Date())=>{
    const time=((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31);
    const date=(((d.getFullYear()-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31);
    return {time,date};
  };
  const xmlEscape = s => String(s||'').replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const q = s => String(s||'').replace(/"/g,'""');

  function cellInline(v){ return `<c t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v).replace(/\r?\n/g,'&#10;')}</t></is></c>`; }
  function cellNumber(n){ return `<c><v>${Number(n)||0}</v></c>`; }
  function cellFormula(f){ return `<c><f>${xmlEscape(f)}</f></c>`; }
  function linkCell(url, label){
    if (url && label) return cellFormula(`HYPERLINK("${q(url)}","${q(label)}")`);
    if (url && !label) return cellFormula(`HYPERLINK("${q(url)}","${q(url)}")`);
    return cellInline(label||'');
  }

  // Лист: 9 колонок
  function sheetChronoXML(rows){
    const header = ['Тип','Статус','Тема','Дата начала','Дата конца','Порядок','Участники','Маски','Локация'];
    const headerRow = `<row r="1">${header.map(cellInline).join('')}</row>`;
    const dataRows = rows.map((r,i)=>{
      const cells = [
        cellInline(r.type||''),
        cellInline(r.status||''),
        linkCell(r.href||'', r.title || r.href || ''),
        cellInline(r.dateStart||''),
        cellInline(r.dateEnd||r.dateStart||''),
        cellNumber(r.order||0),
        cellInline(r.participantsText||''),
        cellInline((r.masksLines||[]).join('\n')),
        cellInline(r.location||'')
      ];
      return `<row r="${i+2}">${cells.join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
  }

  // Минимальный рабочий пакет XLSX: workbook + 1 worksheet (без компрессии)
  function buildXLSX(rows){
    const files=[], add=(name,content)=>files.push({name, data:str2u8(content)});
    const wbRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
    const wbXML = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Хронология" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"          ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
    add('[Content_Types].xml', contentTypes);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
    add('xl/workbook.xml', wbXML);
    add('xl/_rels/workbook.xml.rels', wbRels);
    add('xl/worksheets/sheet1.xml', sheetChronoXML(rows));
    const blobZip = makeZip(files);
    const filename = `chronology_${new Date().toISOString().slice(0,10)}.xlsx`;
    return { blob: blobZip, filename };
  }

  // ZIP (без сжатия)
  function makeZip(files){
    const now=dosDateTime();
    const locals=[], centrals=[]; let offset=0;
    files.forEach(f=>{
      const nameU8=str2u8(f.name), data=f.data, crc=crc32(data);
      const local=concat([ u32(0x04034b50), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), nameU8, data ]);
      const central=concat([ u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(now.time), u16(now.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameU8.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameU8 ]);
      locals.push(local); centrals.push(central); offset += local.length;
    });
    const centralDir = concat(centrals);
    const cdOffset = locals.reduce((a,b)=>a+b.length,0);
    const cdSize = centralDir.length;
    const end = concat([ u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdOffset), u16(0) ]);
    return new Blob([concat([...locals, centralDir, end])], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

})();
// button_collect_chrono_to_media.js — через collectChronoByUser (sections)
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'PerPersonChronoPostID', 'ForumInfo'])) {
    console.warn('[button_update_per_user] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, PerPersonChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const TARGET_PID = String(window.CHRONO_CHECK.PerPersonChronoPostID).trim();
  const SITE_URL   = (window.SITE_URL || location.origin).replace(/\/+$/, '');
  const SECTIONS = window.CHRONO_CHECK.ForumInfo;

  // хелперы ссылок
  if (typeof window.userLink !== 'function') {
    window.userLink = (id, name, asBB = true) =>
      asBB ? `[url=/profile.php?id=${FMV.escapeHtml(String(id))}]${FMV.escapeHtml(String(name))}[/url]`
           : `<a href="/profile.php?id=${FMV.escapeHtml(String(id))}">${FMV.escapeHtml(String(name))}</a>`;
  }
  if (typeof window.missingUser !== 'function') {
    window.missingUser = (name, asBB = true) =>
      asBB ? `[i]${FMV.escapeHtml(String(name))}[/i]`
           : `<i>${FMV.escapeHtml(String(name))}</i>`;
  }

  const lc = s => String(s || '').trim();

  function fmtDateBold(start, end) {
    const s = lc(start), e = lc(end);
    if (!s && !e) return '';
    if (!e || e === s) return `[b]${s}[/b]`;
    return `[b]${s}-${e}[/b]`;
  }
  function fmtParticipants(arr = []) {
    if (!arr.length) return '';
    const items = arr.map(p => {
      const asBB = true;
      const link = (p.id != null && String(p.id) !== '')
        ? userLink(String(p.id), p.name, asBB)
        : missingUser(String(p.name || ''), asBB);
      const masks = Array.isArray(p.masks) && p.masks.length ? ` [as ${FMV.escapeHtml(p.masks.join(', '))}]` : '';
      return `${link}${masks}`;
    });
    return `[i]${items.join(', ')}[/i]`;
  }

  // одна запись-эпизод пользователя
  function fmtEpisode(ep) {
    const headDate   = fmtDateBold(ep.dateStart, ep.dateEnd);
    const linkTitle  = `[url=${FMV.escapeHtml(lc(ep.href))}]${FMV.escapeHtml(lc(ep.title) || lc(ep.href))}[/url]`;
    const ownerMasks = (Array.isArray(ep.masks) && ep.masks.length) ? ` [as ${FMV.escapeHtml(ep.masks.join(', '))}]` : '';
    const head = headDate ? `${headDate} — ${linkTitle}${ownerMasks}` : `${linkTitle}${ownerMasks}`;

    const metaStatus = renderStatus(ep.type, ep.status);
    const metaOrder  = `${FMV.escapeHtml(String(ep.order ?? 0))}`;
    const meta = `[${metaStatus} / ${metaOrder}]`;

    const ppl = fmtParticipants(ep.participants || []);
    const out = [head, meta];
    if (ppl) out.push(ppl);
    if (lc(ep.location)) out.push(FMV.escapeHtml(lc(ep.location)));
    return out.join('\n');
  }

  // блок для одного персонажа (media с кликабельным названием)
  function buildPersonBlock(name, episodes = []) {
    const topicLink = `[url=${SITE_URL}/viewtopic.php?id=${TID}]${FMV.escapeHtml(lc(name))}[/url]`;
    const body = episodes.map(fmtEpisode).join('\n\n');
    return `[media="${topicLink}"]\n${body}\n[/media]`;
  }
  // общий контейнер
  const wrapAll = blocksText => `[media="Хронология по персонажам"]\n${blocksText}\n[/media]`;

  const OPEN_URL = `${SITE_URL}/viewtopic.php?id=${TID}#p${TARGET_PID}`;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить хроно по персам',
    order: 3,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть пост',
    linkHref: OPEN_URL,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      const setLink    = api?.setLink    || (()=>{});
      const setLinkVis = api?.setLinkVisible || (()=>{});

      setLink('', ''); setLinkVis?.(false);

      try {
        setStatus('Собираю…'); setDetails('');

        // 1) берём готовую раскладку: { "<userId>": { name, episodes[] } }
        const byUser = await (window.collectChronoByUser
          ? window.collectChronoByUser({ sections: SECTIONS })
          : Promise.reject(new Error('collectChronoByUser недоступна')));

        // 2) в массив и сортировка по name
        const users = Object.entries(byUser || {})
          .map(([id, v]) => ({ id, name: v?.name || '', episodes: Array.isArray(v?.episodes) ? v.episodes : [] }))
          .filter(u => u.name)
          .sort((a,b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));

        if (!users.length) {
          setStatus('Пусто');
          setDetails('Нет данных для вывода.');
          return;
        }

        setStatus('Формирую текст…');

        // 3) блоки по персонажам
        const perPerson = users.map(u => buildPersonBlock(u.name, u.episodes)).join('\n\n');

        // 4) общий блок
        const finalBb = wrapAll(perPerson);

        // 5) записываем в целевой пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(finalBb);
        const res  = await FMV.replaceComment(GID, TARGET_PID, html);

        const st = String(res?.status || '');
        const success = !!res?.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');

        if (success) { setLink(OPEN_URL, 'Открыть пост'); setLinkVis?.(true); }
        else         { setLink('', ''); setLinkVis?.(false); }

        const info  = (res?.infoMessage || '').replace(/<[^>]*>/g,' ').trim();
        const error = (res?.errorMessage || '').replace(/<[^>]*>/g,' ').trim();
        const lines = [`Статус: ${success ? 'ok' : (st || 'unknown')}`];
        if (info)  lines.push(info);
        if (error) lines.push(error);
        setDetails(lines.join('\n'));
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
        setLink('', ''); setLinkVis?.(false);
      }
    }
  });
})();
// update_personal (1).js
// Делает точечный апдейт персональной страницы usr{ID}_chrono,
// используя collectChronoByUser и общий билдер FMV.buildChronoHtml.
// Плюс — массовое обновление поверх этого же вызова.

// === КНОПКА: массовое обновление персоналок (обёртка над runBulkChronoUpdate) ===
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ForumInfo'])) {
    console.warn('[button_update_personal_page] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;

  if (!window.FMV) window.FMV = {};

  /** ============================
   *  Валидации окружения
   *  ============================ */
  function requireFn(name) {
    const fn = getByPath(name);
    if (typeof fn !== "function") {
      throw new Error(`${name} не найден — подключите соответствующий скрипт`);
    }
    return fn;
  }
  function getByPath(path) {
    return path.split(".").reduce((o,k)=>o && o[k], window);
  }

  /** ============================
   *  Точечный апдейт одного пользователя
   *  ============================ */
  /**
  * @param {string|number} userId
  * @param {Object} [opts]
  * @param {Array}  [opts.sections]   список секций (если у вас есть CHRONO_CHECK.ForumInfo, можно оставить пустым)
  * @returns {Promise<{id:string,status:string, page?:string}>}
  */
  async function updateChronoForUser(userId, opts = {}) {
    const FMVeditPersonalPage = requireFn("FMVeditPersonalPage");
    const collectChronoByUser = requireFn("collectChronoByUser");
    const buildChronoHtml     = requireFn("FMV.buildChronoHtml");

    const id = String(userId);
    const pageName = `usr${id}_chrono`;

    // Источник секций (не обязательно)
    const sectionsArg = opts.sections;

    // 1) Собираем хронологию по пользователям
    let byUser;
    try {
      byUser = await collectChronoByUser({ sections: sectionsArg });
    } catch (e) {
      return { id, status: `ошибка collectChronoByUser: ${e?.message || e}` };
    }

    // 2) Берём только нужного юзера
    const data = byUser?.[id];
    if (!data) {
      return { id, status: "нет данных (пользователь не найден в хроно-коллекции)" };
    }

    // 3) Строим HTML через общий билдер
    let html;
    try {
      html = buildChronoHtml(data, { titlePrefix: "Хронология" });
    } catch (e) {
      return { id, status: `ошибка buildChronoHtml: ${e?.message || e}` };
    }

    // 4) Сохраняем личную страницу
    let res;
    try {
      res = await FMVeditPersonalPage(pageName, { content: html });
    } catch (e) {
      return { id, status: `ошибка сохранения: ${e?.message || e}` };
    }

    const saved = normalizeSaveStatus(res);
    return { id, status: saved, page: pageName };
  };

  /** ============================
   *  Массовое обновление
   *  ============================ */
  /**
  * @param {Object} [opts]
  * @param {Array<string|number>} [opts.ids] — явный список id; если не задан, будет вызван FMV.fetchUsers()
  * @param {number} [opts.delayMs=200] — пауза между сохранениями
  * @param {Array} [opts.sections]
  * @returns {Promise<Array<{id:string,status:string,page?:string}>>}
  */
  async function runBulkChronoUpdate(opts = {}) {
    const delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : 200;

    // Источник пользователей
    let users;
    if (Array.isArray(opts.ids) && opts.ids.length) {
      users = opts.ids.map(x => ({ id: String(x) }));
    } else {
      // Пробуем взять из FMV.fetchUsers()
      const fetchUsers = getByPath("FMV.fetchUsers");
      if (typeof fetchUsers !== "function") {
        throw new Error("Не заданы ids и отсутствует FMV.fetchUsers()");
      }
      const arr = await fetchUsers();
      users = Array.isArray(arr) ? arr : [];
    }

    const results = [];
    for (const u of users) {
      const r = await updateChronoForUser(u.id, {
        sections: opts.sections
      });
      results.push(r);
      if (delayMs) await FMV.sleep(delayMs);
    }
    try { console.table(results.map(x => ({ id: x.id, status: x.status }))); } catch {}
    return results;
  };

  /** ============================
   *  Вспомогательные
   *  ============================ */
  function normalizeSaveStatus(res) {
    // Набор типичных статусов, подстройтесь под ваш FMVeditPersonalPage.
    const s = (res && (res.status || res.result || res.ok)) ?? "unknown";
    if (s === true || s === "ok" || s === "saved" || s === "success") return "обновлено";
    if (s === "forbidden" || s === "noaccess") return "нет доступа";
    if (s === "notfound") return "страница не найдена";
    return String(s);
  }

  // Хелперы ссылок/экрановки — совместимы с другими кнопками
  if (typeof window.userLinkHtml !== 'function') {
    window.userLinkHtml = (id, name) =>
      `${FMV.escapeHtml(String(name || id))}`;
  }

  // Получаем карту имен для красивых ссылок
  async function getUserNameMap(explicitIds) {
    // 1) если есть FMV.fetchUsers(), возьмём оттуда
    const fetchUsers = (window.FMV && typeof FMV.fetchUsers === 'function') ? FMV.fetchUsers : null;
    let list = [];
    if (Array.isArray(explicitIds) && explicitIds.length) {
      list = explicitIds.map(x => ({ id: String(x) }));
    } else if (fetchUsers) {
      try {
        const arr = await fetchUsers();
        list = Array.isArray(arr) ? arr : [];
      } catch { /* no-op */ }
    }
    const map = new Map();
    for (const u of list) {
      if (!u) continue;
      const id = String(u.id ?? '');
      const nm = String(u.name ?? '').trim();
      if (id) map.set(id, nm || id);
    }
    return map;
  }

  function normalizeInfoStatus(status) {
    const s = String(status || '').toLowerCase();
    // маппим внутренние формулировки на требуемые пользователем
    if (s.includes('нет доступа')) return 'нет доступа';
    if (s.includes('нет данных') || s.includes('не найден')) return 'пользователь не упоминается в хронологии';
    return ''; // не интересует для "Показать детали"
  }

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    label: 'обновить личные страницы',
    order: 4,
    showStatus: true,
    showDetails: true,
    showLink: false,

    async onClick(api) {
      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});

      setDetails('');
      try {
        // Этап 1: сбор подготовительных данных/сечений
        setStatus('Собираю…');

        const explicitIds = Array.isArray(window.CHRONO_CHECK?.UserIDs) ? window.CHRONO_CHECK.UserIDs : undefined;
        const nameMap = await getUserNameMap(explicitIds);

        // Этап 2: массовое обновление
        setStatus('Обновляю…');

        const results = await runBulkChronoUpdate({
          ids: explicitIds,
          sections: SECTIONS
        }); // вернёт [{ id, status, page? }] — см. реализацию в update_personal

        // Пост-обработка результатов
        const lines = [];
        for (const r of (results || [])) {
          const info = normalizeInfoStatus(r?.status);
          if (!info) continue; // нас интересуют только 2 типа
          const id = String(r?.id || '');
          const name = nameMap.get(id) || id;
          lines.push(`${userLinkHtml(id, name)} — ${FMV.escapeHtml(info)}`);
        }

        // Если сам вызов отработал — это «Готово», даже если были частичные "нет доступа"/"не упоминается"
        setStatus('Готово');
        setDetails(lines.length ? lines.join('\n') : ''); // пусто — если нет «проблемных» юзеров
      } catch (e) {
        setStatus('Ошибка');
        setDetails(e?.message || String(e));
      }
    }
  });
})();
// button_update_total — собирает через collectEpisodesFromForums({sections}) и пишет в "Общую хронологию"
(() => {
  'use strict';

  // Проверяем наличие нужных полей
  if (!checkChronoFields(['GroupID', 'AmsForumID', 'ChronoTopicID', 'TotalChronoPostID', 'ForumInfo'])) {
    console.warn('[button_update_total] Требуются CHRONO_CHECK.GroupID[], AmsForumID[], ChronoTopicID, TotalChronoPostID, ForumInfo');
    return;
  }

  // Если всё ок — продолжаем
  const GID        = (window.CHRONO_CHECK.GroupID).map(Number);
  const FID        = (window.CHRONO_CHECK.AmsForumID).map(String);
  const TID        = String(window.CHRONO_CHECK.ChronoTopicID).trim();
  const PID        = String(window.CHRONO_CHECK.TotalChronoPostID).trim();
  const OPEN_URL   = new URL(`/viewtopic.php?id=${TID}#p${PID}`, location.href).href;
  const SECTIONS   = window.CHRONO_CHECK.ForumInfo;

  let busy = false;

  createForumButton({
    allowedGroups: GID,
    allowedForums: FID,
    topicId: TID,
    label: 'обновить общее хроно',
    order: 1,
    showStatus: true,
    showDetails: true,
    showLink: true,
    linkText: 'Открыть ссылку',
    linkHref: OPEN_URL,

    async onClick(api) {
      if (busy) return;
      busy = true;

      const setStatus  = api?.setStatus  || (()=>{});
      const setDetails = api?.setDetails || (()=>{});
      api?.setLinkVisible?.(false);
      api?.setLink?.('', '');

      try {
        setStatus('Собираю…');
        setDetails('');

        // 1) Сбор эпизодов из парсера (через sections)
        if (typeof collectEpisodesFromForums !== 'function') {
          throw new Error('collectEpisodesFromForums недоступна');
        }
        const episodes = await collectEpisodesFromForums({ sections: SECTIONS });

        // 2) Рендер BBCode
        setStatus('Формирую текст…');
        const bb = renderChronoFromEpisodes(episodes);

        // 3) Запись в пост
        setStatus('Записываю…');
        const html = FMV.toCp1251Entities(bb);
        const res  = await FMV.replaceComment(GID, PID, html);

        const st = normStatus(res.status);
        const success = !!res.ok || st === 'ok';

        setStatus(success ? 'Готово' : 'Ошибка');
        if (success) {
          api?.setLink?.(OPEN_URL, 'Открыть ссылку');
          api?.setLinkVisible?.(true);
        } else {
          api?.setLink?.('', '');
          api?.setLinkVisible?.(false);
        }

        const info  = toPlainShort(res.infoMessage || '');
        const error = toPlainShort(res.errorMessage || '');
        const lines = [`Статус: ${success ? 'ok' : st || 'unknown'}`];
        if (info)  lines.push(info);
        if (error) lines.push(`<span style="color:#b00020">${FMV.escapeHtml(error)}</span>`);
        setDetails(lines.join('<br>'));

      } catch (e) {
        setStatus('Ошибка');
        setDetails(FMV.escapeHtmlShort(e?.message || String(e)));
        api?.setLinkVisible?.(false);
        api?.setLink?.('', '');
      } finally {
        busy = false;
      }
    }
  });

  /* ===================== РЕНДЕР ===================== */
  function renderChronoFromEpisodes(episodes) {
    const rows = (episodes || []).map(e => {
      const status = renderStatus(e.type, e.status);

      const dateDisplay = (e.type === 'au')
        ? ''
        : (e.dateStart
            ? `[b]${FMV.escapeHtml(
                e.dateEnd && e.dateEnd !== e.dateStart
                  ? `${e.dateStart}-${e.dateEnd}`
                  : e.dateStart
              )}[/b]`
            : `[mark]дата не указана[/mark]`);

      const url = FMV.escapeHtml(e.href || '');
      const ttl = FMV.escapeHtml(e.title || '');

      const errBeforeOrder = e.isTitleNormalized
        ? ''
        : (e.type === 'au'
            ? ' [mark]в названии нет [au][/mark]'
            : ' [mark]в названии нет [с][/mark]');

      const ord = `${FMV.escapeHtml(String(e.order ?? 0))}`;

      const asBB = true;
      const names = (Array.isArray(e.participants) && e.participants.length)
        ? e.participants.map(p => {
            const display = (p.id != null && p.id !== '')
              ? userLink(String(p.id), p.name, asBB)
              : missingUser(String(p.name || ''), asBB);
            const roles = Array.isArray(p.masks) ? p.masks : [];
            const tail  = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';
            return `${display}${tail}`;
          }).join(', ')
        : `[mark]не указаны[/mark]`;

      const loc = e.location
        ? FMV.escapeHtml(e.location)
        : `[mark]локация не указана[/mark]`;

      const dash = dateDisplay ? ' — ' : ' ';

      return `${dateDisplay}${dash}[url=${url}]${ttl}[/url]${errBeforeOrder}\n[${status} / ${ord}]\n[i]${names}[/i]\n${loc}\n\n`;
    });

    return `[media="Общая хронология"]${rows.join('') || ''}[/media]`;
  }

  /* ===================== УТИЛИТЫ ===================== */

  function normStatus(s) {
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return String(s.status || s.code || (s.ok ? 'ok' : 'unknown'));
    return String(s);
  }

  function toPlainShort(s = '', limit = 200) {
    const t = String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > limit ? t.slice(0, limit) + '…' : t;
  }

  if (typeof window.userLink !== 'function') {
    window.userLink = (id, name, asBB = true) =>
      asBB ? `[url=/profile.php?id=${FMV.escapeHtml(String(id))}]${FMV.escapeHtml(String(name))}[/url]`
           : `<a href="/profile.php?id=${FMV.escapeHtml(String(id))}">${FMV.escapeHtml(String(name))}</a>`;
  }
  if (typeof window.missingUser !== 'function') {
    window.missingUser = (name, asBB = true) =>
      asBB ? `[i]${FMV.escapeHtml(String(name))}[/i]`
           : `<i>${FMV.escapeHtml(String(name))}</i>`;
  }
})();

/* Episodes */
// ui.js — FMV: виджет участников/масок/локации/порядка + автоподключение + ручной режим для админов
(function(){
  'use strict';

  // ───────────────────── helpers-конфиг ─────────────────────
  // ожидаем, что check_group.js уже подключен и экспортирует getCurrentGroupId / getCurrentUserId
  function isAllowedAdmin(){
    const groups = (window.CHRONO_CHECK?.GroupID || []).map(String);
    const users  = (window.CHRONO_CHECK?.AllowedUser || []).map(String);
    const gid = (typeof window.getCurrentGroupId === 'function') ? String(window.getCurrentGroupId()) : '';
    const uid = (typeof window.getCurrentUserId === 'function') ? String(window.getCurrentUserId()) : '';
    return (gid && groups.includes(gid)) || (uid && users.includes(uid));
  }

  if (!window.FMV) window.FMV = {};
  if (!window.FMV.fetchUsers) {
    console.warn('[FMV] Подключите общий модуль с FMV.fetchUsers до ui.js');
  }

  // ───────────────────── UI-модуль ─────────────────────
  if (!window.FMV.UI) {
    (function(){
      // mini utils
      function splitBySemicolon(s){
        return String(s || '').split(';').map(v => v.trim()).filter(Boolean);
      }
      function parseFMVcast(text){
        const mc = String(text || '').match(/\[FMVcast\]([\s\S]*?)\[\/FMVcast\]/i);
        const items = mc && mc[1] ? splitBySemicolon(mc[1]) : [];
        const by = {};
        items.forEach(tok => {
          const m = tok.match(/^(user\d+)(?:=(.+))?$/i);
          if (!m) return;
          const code = m[1];
          const mask = (m[2] || '').trim();
          const ref = by[code] || (by[code] = { code, masks: [] });
          if (mask) ref.masks.push(mask);
        });
        return by;
      }
      function buildFMVcast(selected){
        const parts = [];
        (selected || []).forEach(it => {
          const masks = Array.isArray(it.masks) ? it.masks.filter(Boolean) : [];
          if (!masks.length) parts.push(it.code);
          else masks.forEach(msk => parts.push(it.code + '=' + msk));
        });
        return parts.length ? '[FMVcast]' + parts.join(';') + '[/FMVcast]' : '';
      }
      function buildFMVplace(val){
        val = String(val || '').trim();
        return val ? '[FMVplace]' + val + '[/FMVplace]' : '';
      }
      function buildFMVord(val){
        let n = parseInt(String(val||'').trim(), 10);
        if (Number.isNaN(n)) n = 0;
        return '[FMVord]' + n + '[/FMVord]';
      }
      function stripFMV(text){
        return String(text || '')
          .replace(/\[FMVcast\][\s\S]*?\[\/FMVcast\]/ig,'')
          .replace(/\[FMVplace\][\s\S]*?\[\/FMVplace\]/ig,'')
          .replace(/\[FMVord\][\s\S]*?\[\/FMVord\]/ig,'')
          .replace(/^\s+|\s+$/g,'');
      }

      // CSS (с защитой от переполнения по ширине)
      let cssInjected = false;
      function injectCSS(){
        if (cssInjected) return; cssInjected = true;
        const css = `
        :root{
          --fmv-bg:#f7f4ea; --fmv-b:#d8d1c3; --fmv-chip:#fff;
          --fmv-radius:10px; --fmv-gap:8px; --fmv-text:#2d2a26; --fmv-muted:#6b6359;
        }

        .msg-with-characters.fmv,
        .msg-with-characters.fmv * { box-sizing: border-box; }
        .msg-with-characters.fmv { width:100%; max-width:100%; overflow-x:hidden; }

        .msg-with-characters.fmv{margin:10px 0; padding:10px; border:1px solid var(--fmv-b); background:var(--fmv-bg); border-radius:var(--fmv-radius)}
        .fmv .char-row{display:flex; gap:var(--fmv-gap); align-items:flex-start; flex-wrap:wrap}
        .fmv .combo{position:relative; flex:1 1 480px; width:100%; max-width:100%}
        .fmv .combo input,
        .fmv .place-row input,
        .fmv .order-row input{
          width:100%; max-width:100%; height:36px;
          padding:8px 10px; border:1px solid var(--fmv-b); border-radius:8px;
          background:#efe9dc; color:var(--fmv-text); font-size:14px;
        }
        .fmv .place-row,.fmv .order-row{margin-top:8px; width:100%; max-width:100%}
        .fmv .order-row label{display:block; margin-bottom:4px; font-weight:600; color:var(--fmv-text)}
        .fmv .order-hint,.fmv .hint{font-size:12.5px; color:var(--fmv-muted); margin-top:4px; overflow-wrap:anywhere}

        .fmv .ac-list{
          position:absolute; z-index:50; left:0; right:0; max-width:100%; background:#fff;
          border:1px solid var(--fmv-b); border-radius:8px; margin-top:4px; max-height:240px; overflow:auto
        }
        .fmv .ac-item{padding:.45em .65em; cursor:pointer; font-size:14px}
        .fmv .ac-item.active,.fmv .ac-item:hover{background:#f0efe9}
        .fmv .ac-item .muted{color:var(--fmv-muted)}

        .fmv .chips{ max-width:100%; overflow-x:hidden; }
        .fmv .chips .chip{
          display:flex; align-items:center; justify-content:flex-start;
          gap:10px; padding:.45em .6em; background:var(--fmv-chip);
          border:1px solid var(--fmv-b); border-radius:8px; margin:.35em 0; font-size:14px
        }
        .fmv .chip .drag{cursor:grab; margin-right:.4em; color:#8b8378}
        .fmv .chip .name{font-weight:600}

        .fmv .masks{display:flex; align-items:center; gap:6px; flex-wrap:wrap; color:var(--fmv-muted)}
        .fmv .masks .masks-label{ color:var(--fmv-muted); margin-right:2px; }
        .fmv .mask-badge{
          display:inline-flex; align-items:center; gap:6px;
          padding:2px 8px; border:1px solid var(--fmv-b); border-radius:999px;
          background:#efe9dc; font-size:13px; color:var(--fmv-text);
        }
        .fmv .mask-badge .mask-remove{
          border:0; background:none; cursor:pointer; line-height:1;
          color:#8b8378; font-size:14px; padding:0 2px;
        }

        .fmv .chip .add-mask{border:0; background:none; color:#2e5aac; cursor:pointer; padding:0; text-decoration:underline; margin-left:auto}
        .fmv .chip .x{border:0; background:none; font-size:16px; line-height:1; cursor:pointer; color:#8b8378; margin-left:8px}

        .fmv .chip .mask-input{ display:none; margin-left:auto; }
        .fmv .chip .mask-input.is-open{ display:flex; align-items:center; gap:8px; }
        .fmv .chip .mask-input input{
          flex:1; min-width:220px; height:30px;
          padding:6px 8px; border:1px solid var(--fmv-b); border-radius:6px;
          background:#efe9dc; color:var(--fmv-text);
        }
        .fmv .chip .btn{ border:1px solid var(--fmv-b); border-radius:6px; background:#fff; padding:6px 10px; cursor:pointer; line-height:1; }
        .fmv .chip .btn-ok{ background:#e9f6e9; }
        .fmv .chip .btn-cancel{ background:#f4eeee; }

        .fmv-admin-tools{display:flex;justify-content:flex-end;margin:6px 0 8px}
        .fmv-admin-tools .fmv-toggle{border:1px solid var(--fmv-b);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}

        /* заголовок блока */
        .fmv .section-title{
          font-weight:700;
          font-size:14px;
          text-align: center;
          line-height:1.25;
          margin:4px 0 12px;
          color: var(--fmv-text);
        }

        /* делаем «колонку» с равным шагом и без внутренних margin */
        .fmv .combo,
        .fmv .place-row,
        .fmv .order-row {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 8px;             /* вот этим управляем расстоянием между label ↔ input ↔ hint */
        }
        
        .fmv .place-row label,
        .fmv .order-row label,
        .fmv .combo label,
        .fmv .place-row .hint,
        .fmv .order-row .order-hint,
        .fmv .combo .hint {
          margin: 0;                /* убираем наследованные отступы, чтобы они не «схлопывались» */
        }
        
        /* (оставляем общий верхний зазор секции) */
        .fmv .place-row, .fmv .order-row { margin-top: 8px; }

        .fmv .chip .name { font-weight: 600; }
        .fmv .chip .name .name-code { font-weight: 400; color: var(--fmv-muted); }

        `;
        const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
      }

      function attach(opts){
        injectCSS();

        const $form = typeof opts.form === 'string' ? $(opts.form) : opts.form;
        const $area = typeof opts.textarea === 'string' ? $(opts.textarea) : opts.textarea;
        if (!$form?.length || !$area?.length) return null;

        // исходный текст и решение "монтироваться ли"
        const initialRaw = $area.val() || '';
        const hasAnyFMV = /\[FMV(?:cast|place|ord)\][\s\S]*?\[\/FMV(?:cast|place|ord)\]/i.test(initialRaw);
        if (opts.showOnlyIfFMVcast && !hasAnyFMV) return null;

        // мгновенно скрываем мету в textarea (edit)
        if (opts.stripOnMount) {
          $area.val( stripFMV(initialRaw) );
        }

        if ($form.data('fmvBoundUI')) return $form.data('fmvBoundUI');

        // ── UI ──
        const wrapClass='msg-with-characters fmv '+(opts.className||'');
        const $wrap=$('<div/>',{class:wrapClass});
        const $title = $('<div class="section-title">Для автоматического сбора хронологии</div>');

        // поиск/добавление участника
        const $row  = $('<div class="char-row"/>');
        const $combo = $('<div class="combo"/>');
        const $comboLabel = $('<label for="character-combo" style="font-weight:600;display:block;margin-bottom:4px">Участники эпизода:</label>');
        const $comboInput = $('<input type="text" id="character-combo" placeholder="Наберите имя персонажа…" autocomplete="off">');
        const $ac   = $('<div class="ac-list" role="listbox" aria-label="Варианты персонажей"></div>');
        const $comboHint = $('<div class="hint">Если что-то не работает, напишите в Приемную.</div>');
        $combo.append($comboLabel, $comboInput, $ac, $comboHint);
        $row.append($combo);

        const $chips=$('<div class="chips"/>');

        // локация
        const $placeRow   = $('<div class="place-row"/>');
        const $placeLabel = $('<label for="fmv-place" style="font-weight:600">Локация:</label>');
        const $placeInput = $('<input type="text" id="fmv-place" placeholder="Укажите локацию">');
        const $placeHint  = $('<div class="hint">Лучше указывать в едином формате: Хогвартс, Косой переулок, Лютный переулок, Министерство и т.д.</div>');
        $placeRow.append($placeLabel, $placeInput, $placeHint);

        // порядок в день
        const $ordRow   = $('<div class="order-row"/>');
        const $ordLabel = $('<label for="fmv-ord" style="font-weight:600">Для сортировки эпизодов в один день</label>');
        const $ordInput = $('<input type="number" id="fmv-ord" placeholder="0" value="0" step="1">');
        const $ordHint  = $('<div class="order-hint">Помогает упорядочить эпизоды, которые стоят в один день. Чем больше значение, тем позже эпизод. Лучше оставлять 0.</div>');
        $ordRow.append($ordLabel, $ordInput, $ordHint);

        $area.before($wrap);
        $wrap.append($title, $row, $chips, $placeRow, $ordRow);

        let selected=[], knownUsers=[];

        function renderChips(){
          $chips.empty();
          selected.forEach(function(item, idx){
            const $chip=$('<div class="chip" draggable="true" data-idx="'+idx+'"/>');
            $chip.append('<span class="drag" title="Перетащите для изменения порядка">↕</span>');
            
            const $name = $('<span class="name"/>');
            $name.append(document.createTextNode(item.name + ' '));
            $name.append($('<span class="name-code"/>').text('(' + item.code + ')'));
            $chip.append($name);


            const $masks=$('<span class="masks"/>');
            if (item.masks?.length){
              $masks.append('<span class="masks-label">— маски:</span>');
              item.masks.forEach(function(msk,mi){
                const $b=$('<span class="mask-badge" data-mi="'+mi+'"><span class="mask-text"></span><button type="button" class="mask-remove" aria-label="Удалить маску">×</button></span>');
                $b.find('.mask-text').text(msk); $masks.append($b);
              });
            } else { $masks.text(' — масок нет'); }

            const $addMask=$('<button class="add-mask" type="button">добавить маску</button>');
            const $remove =$('<button class="x" type="button" aria-label="Удалить">×</button>');
            const $maskBox=$('<span class="mask-input"></span>').hide();
            const $maskInput=$('<input type="text" placeholder="маска (текст)">');
            const $maskOk  =$('<button type="button" class="btn btn-ok">Ок</button>');
            const $maskCancel=$('<button type="button" class="btn btn-cancel">Отмена</button>');
            $maskBox.append($maskInput,$maskOk,$maskCancel);

            $maskInput.on('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $maskOk.click(); }});
            $addMask.on('click',()=>{ $chip.find('.mask-input').removeClass('is-open').hide(); $maskBox.addClass('is-open').show(); $maskInput.val('').focus(); });
            $maskOk.on('click',()=>{ const v=$.trim($maskInput.val()); if(!v) return; (item.masks||(item.masks=[])).push(v); renderChips(); });
            $maskCancel.on('click',()=>{ $maskBox.removeClass('is-open').hide(); });

            $remove.on('click',()=>{ selected.splice(idx,1); renderChips(); });

            $chip.append($masks,$addMask,$maskBox,$remove);
            $chips.append($chip);
          });
        }

        // DnD
        $chips.on('dragstart','.chip',function(e){ $(this).addClass('dragging'); e.originalEvent.dataTransfer.setData('text/plain',$(this).data('idx')); });
        $chips.on('dragend','.chip',function(){ $(this).removeClass('dragging'); });
        $chips.on('dragover',function(e){ e.preventDefault(); });
        $chips.on('drop',function(e){
          e.preventDefault();
          const from=+e.originalEvent.dataTransfer.getData('text/plain');
          const $t=$(e.target).closest('.chip'); if(!$t.length) return;
          const to=+$t.data('idx'); if(isNaN(from)||isNaN(to)||from===to) return;
          const it=selected.splice(from,1)[0]; selected.splice(to,0,it); renderChips();
        });
        // удалить одну маску
        $chips.on('click','.mask-remove',function(){
          const $chip=$(this).closest('.chip'); const idx=+$chip.data('idx'); const mi=+$(this).closest('.mask-badge').data('mi');
          if(!isNaN(idx)&&!isNaN(mi)&&Array.isArray(selected[idx].masks)){ selected[idx].masks.splice(mi,1); renderChips(); }
        });

        // добавление участника
        function addByCode(code){
          if(!code || selected.some(x=>x.code===code)) return;
          const u=knownUsers.find(x=>x.code===code);
          selected.push({ code, name:(u?u.name:code), masks:[] });
          renderChips(); $comboInput.val(''); $ac.hide().empty();
        }
        // поиск
        function pickByInput(){
          const q=($.trim($comboInput.val())||'').toLowerCase(); if(!q) return null;
          const pool=knownUsers.filter(u=>!selected.some(x=>x.code===u.code));
          const exact=pool.find(u=>u.name.toLowerCase()===q)||pool.find(u=>u.code.toLowerCase()===q);
          if(exact) return exact.code;
          const list=pool.filter(u=>u.name.toLowerCase().includes(q)||u.code.toLowerCase().includes(q));
          if(list.length===1) return list[0].code;
          const pref=list.filter(u=>u.name.toLowerCase().startsWith(q));
          if(pref.length===1) return pref[0].code;
          return null;
        }
        // автокомплит
        function renderAC(q){
          const qq=(q||'').trim().toLowerCase();
          const items=knownUsers
            .filter(u=>!selected.some(x=>x.code===u.code))
            .filter(u=>!qq || u.name.toLowerCase().includes(qq) || u.code.toLowerCase().includes(qq))
            .slice().sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}));
          $ac.empty();
          if(!items.length){ $ac.append('<div class="ac-item"><span class="muted">Ничего не найдено</span></div>').show(); return; }
          items.slice(0,40).forEach(u=>{ $ac.append($('<div class="ac-item" role="option"/>').attr('data-code',u.code).text(u.name+' ('+u.code+')')); });
          $ac.show(); setActive(0);
        }
        function setActive(i){ const $it=$ac.children('.ac-item'); $it.removeClass('active'); if(!$it.length) return; i=(i+$it.length)%$it.length; $it.eq(i).addClass('active'); $ac.data('activeIndex',i); }
        function getActiveCode(){ const i=$ac.data('activeIndex')|0; const $it=$ac.children('.ac-item').eq(i); return $it.data('code'); }
        $comboInput.on('input',function(){ renderAC(this.value); });
        $comboInput.on('keydown',function(e){
          const idx=$ac.data('activeIndex')|0;
          if(e.key==='ArrowDown'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx+1); }
          else if(e.key==='ArrowUp'&&$ac.is(':visible')){ e.preventDefault(); setActive(idx-1); }
          else if(e.key==='Enter'){ e.preventDefault(); const code=$ac.is(':visible')?getActiveCode():pickByInput(); if(code) addByCode(code); else renderAC(this.value); }
          else if(e.key==='Escape'){ $ac.hide(); }
        });
        $ac.on('mousedown','.ac-item',function(){ const code=$(this).data('code'); if(code) addByCode(code); });
        $(document).on('click',function(e){ if(!$(e.target).closest($combo).length) $ac.hide(); });

        // префилл
        function prefillFrom(text){
          selected=[]; const by=parseFMVcast(text||'');
          const mp=String(text||'').match(/\[FMVplace\]([\s\S]*?)\[\/FMVplace\]/i);
          if(mp && typeof mp[1]==='string') $placeInput.val(mp[1].trim());
          const mo=String(text||'').match(/\[FMVord\]([\s\S]*?)\[\/FMVord\]/i);
          if(mo && typeof mo[1]==='string'){ let n=parseInt(mo[1].trim(),10); if(Number.isNaN(n)) n=0; $ordInput.val(n); }
          Object.keys(by).forEach(code=>{ const u=knownUsers.find(x=>x.code===code); selected.push({ code, name:(u?u.name:code), masks:by[code].masks }); });
          renderChips();
        }
        function metaLine(){ return [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''); }

        // загрузка участников и префилл
        if (typeof FMV.fetchUsers==='function'){
          FMV.fetchUsers().then(function(list){
            knownUsers=(list||[]).slice();
            if (opts.prefill!==false) prefillFrom(initialRaw);
          }).catch(function(msg){
            $ac.html('<div class="ac-item"><span class="muted">'+(msg||'Ошибка загрузки')+'</span></div>').show();
          });
        }

        // submit-hook (alert вместо блока ошибки; глушим другие обработчики)
        $form.off('submit.fmv.ui').on('submit.fmv.ui', function(e){
          const $subject=$form.find('input[name="req_subject"]');
          const haveSubject=!$subject.length || $.trim($subject.val()||'').length>0;

          const rest=stripFMV($area.val()||'');
          const haveMessage=$.trim(rest).length>0;

          const haveParticipants=selected.length>0;
          const havePlace=$.trim($placeInput.val()||'').length>0;

          if(!(haveSubject && haveMessage && haveParticipants && havePlace)){
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            const miss=[]; if(!haveSubject)miss.push('Заголовок'); if(!haveMessage)miss.push('Основной текст'); if(!haveParticipants)miss.push('Участники'); if(!havePlace)miss.push('Локация');
            alert('Заполните: ' + miss.join(', '));
            return false;
          }

          const meta = metaLine();
          let base = rest.replace(/[ \t]+$/, '');
          const sep = (!base || /\n$/.test(base)) ? '' : '\n';
          $area.val(base + sep + meta);
        });

        // ── admin toggle (ручной режим) — создаём один раз и переиспользуем ──
        if (isAllowedAdmin()) {
          // ищем/создаём один общий контейнер для этой формы
          let $tools = $form.data('fmvAdminTools');
          if (!$tools || !$tools.length) {
            $tools = $(
              '<div class="fmv-admin-tools">' +
                '<button type="button" class="fmv-toggle">Режим ручного редактирования</button>' +
              '</div>'
            );
            $form.data('fmvAdminTools', $tools);
          }
          // размещаем кнопку перед текущим $wrap
          $wrap.before($tools);
        
          const $btn = $tools.find('.fmv-toggle');
        
          // важно: каждый раз при новом attach() снимаем старый обработчик
          $btn.off('click.fmv');
        
          const toRaw = () => {
            const meta = [buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())]
              .filter(Boolean).join('');
            const base = stripFMV($area.val() || '').replace(/[ \t]+$/, '');
            const sep  = (!base || /\n$/.test(base)) ? '' : '\n';
            $area.val(base + (meta ? sep + meta : ''));
        
            // удаляем только UI и наш сабмит-хук, кнопку НЕ трогаем
            $wrap.remove();
            $form.off('submit.fmv.ui').removeData('fmvBoundUI');
        
            $btn.data('raw', true).text('Вернуться к удобной форме');
          };
        
          const toUI = () => {
            // повторно монтируем UI; внутри attach() этот же блок снова
            // привяжет обработчик к той же кнопке, но уже с новыми замыканиями
            FMV.UI.attach({
              form: $form,
              textarea: $area,
              prefill: true,
              showOnlyIfFMVcast: false,
              className: 'fmv--compact',
              stripOnMount: true
            });
            $btn.data('raw', false).text('Режим ручного редактирования');
          };
        
          // биндим актуальный обработчик для ТЕКУЩЕГО $wrap
          $btn.on('click.fmv', () => ($btn.data('raw') ? toUI() : toRaw()));
        }

        const api={ serialize:()=>[buildFMVcast(selected), buildFMVplace($placeInput.val()), buildFMVord($ordInput.val())].filter(Boolean).join(''),
                    stripFMV, mountPoint:$wrap };
        $form.data('fmvBoundUI',api);
        return api;
      }

      window.FMV.UI = { attach };
    })();
  }

  // ───────────────────── Bootstraps (автоподключение) ─────────────────────
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  onReady(function(){
    // защита от повторного монтирования
    if (window.__FMV_BOOTSTRAPPED__) return;
    window.__FMV_BOOTSTRAPPED__ = true;

    if (!FMV.UI || typeof FMV.UI.attach !== 'function') return;

    const url  = new URL(location.href);
    const path = url.pathname;
    const q    = url.searchParams;

    function attachToPage({ strip=false, showOnlyIfCast=false } = {}){
      const $form = $('#post form, form[action*="post.php"], form[action*="edit.php"]').first();
      const $area = $form.find('textarea[name="req_message"], #main-reply, .questionary-post textarea').first();
      if (!$form.length || !$area.length) return null;
      return FMV.UI.attach({
        form: $form,
        textarea: $area,
        prefill: true,
        showOnlyIfFMVcast: !!showOnlyIfCast, // ← «любой FMV-тег»
        className: 'fmv--compact',
        stripOnMount: !!strip
      });
    }

    // /post.php?fid=N без action (старое создание)
    if (/\/post\.php$/i.test(path) && !q.has('action')) {
      const fid = +(q.get('fid')||0);
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (allowed.includes(fid)) attachToPage({ strip:false, showOnlyIfCast:false });
    }

    // /edit.php?topicpost=1 (редактирование первого поста) — только если есть FMV-теги
    if (/\/edit\.php$/i.test(path) && q.get('topicpost') === '1') {
      attachToPage({ strip:true, showOnlyIfCast:true });
    }

    // /post.php?action=post&fid=8 — создание, UI всегда (с очисткой textarea)
    if (/\/post\.php$/i.test(path) && q.get('action') === 'post') {
      // 🚫 не подключаем UI если открыто «ответить в теме» (есть tid)
      if (q.has('tid')) return;
    
      const fid = Number(q.get('fid'));
      const allowed = (window.CHRONO_CHECK?.ForumID || []).map(Number);
      if (!fid || allowed.includes(fid)) {
        attachToPage({ strip: true, showOnlyIfCast: false });
      }
    }

    // /edit.php?id=N&action=edit — только если есть любые FMV-теги
    if (/\/edit\.php$/i.test(path) && q.has('id') && document.querySelector('input[name="firstpost"]')) {
      attachToPage({ strip:true, showOnlyIfCast:false });
    }
  });

})();
// tags_visibility_button.init.js
(() => {
  'use strict';

  // ----- настройки кнопки -----
  const BUTTON_LABEL = 'Показать скрытые теги';
  const BUTTON_ORDER = 1;

  // ----- утилиты -----
  async function waitFor(fn, { timeout = 10000, interval = 100 } = {}) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      try { const v = fn(); if (v) return v; } catch {}
      await FMV.sleep(interval);
    }
    return null;
  }

  function topicKey() {
    try {
      const u = new URL(location.href);
      const id = u.searchParams.get('id') || u.searchParams.get('tid') || '';
      return `fmv:meta:enabled:${id || u.pathname}`;
    } catch {
      return `fmv:meta:enabled:${location.href}`;
    }
  }

  function injectStyleOnce() {
    if (document.getElementById('fmv-meta-style')) return;
    const style = document.createElement('style');
    style.id = 'fmv-meta-style';
    style.textContent = `
      .fmv-meta{
        margin:8px 0; padding:8px; border:1px solid #d7d7d7;
        background:#f7f7f7; border-radius:6px;
      }
      .fmv-row{margin:.25em 0}
      .fmv-label{font-weight:700;margin-right:.25em}
      .fmv-missing{color:#c00;background:#ffe6e6;border-radius:6px;padding:0 .25em;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  // найти контейнер именно этой кнопки
  function findOwnWrap() {
    const container = document.querySelector('.ams_info');
    if (!container) return null;
    return Array.from(container.querySelectorAll('div[data-order]')).find(el => {
      const btn = el.querySelector('button.button');
      return Number(el.dataset.order) === BUTTON_ORDER &&
             btn && btn.textContent.trim() === BUTTON_LABEL;
    }) || null;
  }

  // ---- рендер участников через profileLinkMeta (подсветка не найденных) ----
  function renderParticipantsWithMeta(rawChars, map) {
    const parsed = FMV.parseCharactersUnified(rawChars);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    const parts = items.map((it) => {
      const id = it?.id != null ? String(it.id) : null;
      const knownName = id ? (map.get(id) || null) : null;

      // используем обновлённый profile_from_user
      let headHtml;
      if (id) {
        const meta = (typeof window.profileLinkMeta === 'function')
          ? window.profileLinkMeta(id, knownName)
          : { html: window.profileLink(id, knownName), found: !!knownName };

        if (meta.found) {
          headHtml = meta.html;
        } else {
          const rawText = it?.text ?? knownName ?? `user${id}`;
          headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
        }
      } else {
        const rawText = it?.text ?? it?.name ?? it?.label ?? '';
        headHtml = `<span class="fmv-missing">${FMV.escapeHtml(String(rawText))}</span>`;
      }

      const masks = Array.isArray(it?.masks) && it.masks.length
        ? ` [${it.masks.join(', ')}]`
        : '';
      return headHtml + masks;
    });

    return parts.join('; ');
  }

  // ----- сбор данных и построение блока -----
  async function buildMetaHtml() {
    const ok = await waitFor(() =>
      window.FMV &&
      typeof FMV.readTagText === 'function' &&
      typeof FMV.escapeHtml === 'function' &&
      typeof FMV.parseOrderStrict === 'function' &&
      typeof FMV.buildIdToNameMapFromTags === 'function' &&
      typeof FMV.parseCharactersUnified === 'function' &&
      typeof window.profileLink === 'function'
    , { timeout: 15000 });
    if (!ok) return null;

    const first = await waitFor(() =>
      document.querySelector('.topic .post.topicpost, .post.topicpost, .message:first-of-type')
    , { timeout: 15000 });
    if (!first) return null;

    const group_ids = window.CHRONO_CHECK?.GroupID || [];

    if (typeof window.ensureAllowed === 'function' && !window.ensureAllowed(group_ids)) return null;

    const rawChars = FMV.readTagText(first, 'characters');
    const rawLoc   = FMV.readTagText(first, 'location');
    const rawOrder = FMV.readTagText(first, 'order');

    const map = await FMV.buildIdToNameMapFromTags(rawChars);
    const parts = [];

    if (rawChars) {
      const participantsHtml = FMV.renderParticipantsHtml(
        rawChars,
        map,
        (id, name) => window.profileLink(id, name) // profileLink вернёт <span class="fmv-missing">…</span> если не найден
      );

      parts.push(`<div class="fmv-row"><span class="fmv-label">Участники:</span>${participantsHtml}</div>`);
    }
    if (rawLoc) {
      parts.push(`<div class="fmv-row"><span class="fmv-label">Локация:</span>${FMV.escapeHtml(rawLoc)}</div>`);
    }
    if (rawOrder) {
      const ord = FMV.parseOrderStrict(rawOrder);
      parts.push(`<div class="fmv-row"><span class="fmv-label">Для сортировки:</span>${ord.html}</div>`);
    }

    if (!parts.length) return null;

    injectStyleOnce();
    const block = document.createElement('div');
    block.className = 'fmv-meta';
    block.innerHTML = parts.join('\n');
    return block;
  }

  function isMounted() {
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    return !!(next && next.classList.contains('fmv-meta'));
  }

  function unmountMetaBlock() {
    const wrap = findOwnWrap();
    const next = wrap?.nextElementSibling;
    if (next && next.classList.contains('fmv-meta')) next.remove();
  }

  async function mountMetaBlock() {
    const wrap = findOwnWrap();
    if (!wrap) return;
    unmountMetaBlock();                       // убираем старый
    const block = await buildMetaHtml();
    if (!block) return;
    wrap.parentNode.insertBefore(block, wrap.nextSibling);
  }

  // ----- кнопка-тумблер -----
  if (
    window.CHRONO_CHECK &&
    Array.isArray(window.CHRONO_CHECK.GroupID) &&
    Array.isArray(window.CHRONO_CHECK.ForumID)
  ) {
    createForumButton({
      allowedGroups: window.CHRONO_CHECK.GroupID,
      allowedForums: window.CHRONO_CHECK.ForumID,
      label: BUTTON_LABEL,
      order: BUTTON_ORDER,
      showStatus: false,
      showDetails: false,
      showLink: false,

      async onClick({ wrap }) {
        if (wrap.nextElementSibling?.classList.contains('fmv-meta')) {
          wrap.nextElementSibling.remove();
          localStorage.setItem('fmv:meta:enabled', '0');
        } else {
          const block = await buildMetaHtml();
          if (block) {
            wrap.parentNode.insertBefore(block, wrap.nextSibling);
            localStorage.setItem('fmv:meta:enabled', '1');
          }
        }
      }
    });
  } else {
    console.warn('[tags_visibility] Требуются CHRONO_CHECK.GroupID, ForumID');
  }


  // авто-восстановление состояния
  (async () => {
    if (localStorage.getItem(topicKey()) === '1' && !isMounted()) {
      await mountMetaBlock();
    }
  })();
})();
