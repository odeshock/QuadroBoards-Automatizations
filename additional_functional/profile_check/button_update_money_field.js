(() => {
  'use strict';

  // ----- локальные утилиты -----
  const waitFor = (selector, timeout = 8000) =>
    new Promise((resolve, reject) => {
      const node = document.querySelector(selector);
      if (node) return resolve(node);
      const obs = new MutationObserver(() => {
        const n = document.querySelector(selector);
        if (n) { obs.disconnect(); resolve(n); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('timeout: ' + selector)); }, timeout);
    });

  const ready = new Promise(res => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') res();
    else document.addEventListener('DOMContentLoaded', res, { once: true });
  });

  (async () => {
    try {
      await ready;
  
      // дожидаемся AMS, как в примере
      if (!window.__ams_ready) {
        await new Promise(resolve =>
          window.addEventListener('ams:ready', () => resolve(), { once: true })
        );
      }
  
      // проверка наличия ams блока и прав/форумов — по аналогии
      const amsDiv = document.querySelector('div.ams_info');
      if (!amsDiv) return;
  
      const bodyGroup = Number(document.body?.dataset?.groupId || NaN);
      const groupId = Number(window.GroupID ?? window?.PUNBB?.group_id ?? window?.PUNBB?.user?.g_id ?? bodyGroup);
      if (!PROFILE_CHECK.GroupID.includes(groupId)) return;
  
      const crumbs = document.querySelector('.crumbs') || document.querySelector('#pun-crumbs') ||
                     document.querySelector('.pun_crumbs') || document.querySelector('.container .crumbs');
      if (!crumbs) return;
      const inAllowedForum = Array.from(crumbs.querySelectorAll('a[href]')).some(a => {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          return u.pathname.endsWith('/viewforum.php') &&
                 PROFILE_CHECK.ForumIDs.includes(u.searchParams.get('id'));
        } catch { return false; }
      });
      if (!inAllowedForum) return;
  
      // arg1 из заголовка темы (как в примере)
      const nameSpan = document.querySelector('#pun-main h1 span');
      const arg1 = nameSpan ? nameSpan.textContent.trim().toLowerCase() : '';
      if (!arg1) return;
  
      // userId и arg2 — 1-в-1 с примером
      let profLink =
        document.querySelector('.topic .post-links .profile a[href*="profile.php?id="]') ||
        document.querySelector('.topic .post .post-links a[href*="profile.php?id="]') ||
        document.querySelector('a[href*="profile.php?id="]');
      if (!profLink) {
        try { await waitFor('a[href*="profile.php?id="]', 3000); profLink = document.querySelector('a[href*="profile.php?id="]'); } catch {}
      }
      if (!profLink) return;
      const idMatch = profLink.href.match(/profile\.php\?id=(\d+)/i);
      if (!idMatch) return;
      const userId = idMatch[1];
      const arg2 = `usr${userId}`;
  
      // готовим поле и шаблон
      const fieldId = PROFILE_CHECK.MoneyFieldID;                 // что обновляем
      const rawTemplate = PROFILE_CHECK.MoneyFieldTemplate;       // откуда берём значение
      const fieldValue = String(rawTemplate);
  
      // куда добавляем
      let bodies = document.querySelectorAll('.ams_info');
      if (!bodies.length) {
        try { await waitFor('.ams_info', 5000); bodies = document.querySelectorAll('.ams_info'); }
        catch { return; }
      }
      const target = bodies[bodies.length - 1];
      if (!target || target.querySelector('.fmv-update-money-field')) return;
  
      // узлы UI
      const br = document.createElement('br');
      const wrap = document.createElement('div');
      wrap.className = 'fmv-update-money-field';
  
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button';
      btn.textContent = 'Выдать монетки';
  
      const statusSpan = document.createElement('span');
      statusSpan.style.marginLeft = '10px';
      statusSpan.style.fontSize = '14px';
      statusSpan.style.color = '#555';
  
      const details = document.createElement('details');
      details.style.marginTop = '6px';
      const summary = document.createElement('summary');
      summary.textContent = 'Показать детали';
      summary.style.cursor = 'pointer';
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.margin = '6px 0 0';
      pre.style.fontSize = '12px';
      details.appendChild(summary);
      details.appendChild(pre);
  
      // обработчик нажатия
      btn.addEventListener('click', async () => {
        statusSpan.textContent = 'Обновляем…';
        statusSpan.style.color = '#555';
        pre.textContent = '';
  
        if (typeof window.FMVreplaceFieldData !== 'function') {
          statusSpan.textContent = '✖ функция обновления не найдена';
          statusSpan.style.color = 'red';
          pre.textContent = 'Ожидалась window.FMVreplaceFieldData(fieldId, value, userId)';
          return;
        }
  
        try {
          const res = await window.FMVreplaceFieldData(userId, fieldId, fieldValue);
          // ожидаем контракт в стиле {status, httpStatus, serverMessage, details, fieldId, userId, value}
          switch (res?.status) {
            case 'updated': statusSpan.textContent = '✔ обновлено'; statusSpan.style.color = 'green'; break;
            case 'nochange':statusSpan.textContent = 'ℹ без изменений'; statusSpan.style.color = '#b80'; break;
            case 'error':   statusSpan.textContent = '✖ ошибка'; statusSpan.style.color = 'red'; break;
            default:        statusSpan.textContent = '❔ не удалось подтвердить'; statusSpan.style.color = '#b80';
          }
          const lines = [];
          if (res?.serverMessage) lines.push('Сообщение сервера: ' + res.serverMessage);
          if (res?.httpStatus)    lines.push('HTTP: ' + res.httpStatus);
          if (res?.fieldId ?? fieldId) lines.push('Поле: ' + (res?.fieldId ?? fieldId));
          if (res?.userId ?? userId)   lines.push('Пользователь: ' + (res?.userId ?? userId));
          // показываем фактическое значение, которое пытались записать
          lines.push('Значение (template→arg2):\n' + fieldValue);
          if (res?.details)       lines.push('Details: ' + res.details);
          pre.textContent = lines.join('\n');
        } catch (err) {
          statusSpan.textContent = '✖ сеть/транспорт';
          statusSpan.style.color = 'red';
          pre.textContent = (err && err.message) ? err.message : String(err);
        }
      });
  
      wrap.appendChild(btn);
      wrap.appendChild(statusSpan);
      wrap.appendChild(details);
      target.appendChild(br);
      target.appendChild(br);
      target.appendChild(wrap);
  
      console.log('[FMV injector] кнопка обновления поля добавлена');
    } catch (e) {
      console.log('[FMV injector] error:', e);
    }
  })();
})();
