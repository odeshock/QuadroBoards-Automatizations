// profile_runner_json.js — запуск JSON-панелей со страницы профиля (EDIT-режим)
(function () {
  'use strict';

  if (window.__profileRunnerJSONMounted) return;
  window.__profileRunnerJSONMounted = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  function onReady() {
    return new Promise((res) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') return res();
      document.addEventListener('DOMContentLoaded', () => res(), { once: true });
    });
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

    const mount = await waitMount();

    // Сначала создаём панели, чтобы получить libraryIds
    let getData = null;
    let getLibraryIds = null;
    if (typeof window.setupSkinsJSON === 'function') {
      try {
        const api = await window.setupSkinsJSON(mount, { initialData: {} });
        if (api && typeof api.getData === 'function') getData = api.getData;
        if (api && typeof api.getLibraryIds === 'function') getLibraryIds = api.getLibraryIds;
      } catch (e) {
        console.error('setupSkinsJSON() error:', e);
      }
    }

    if (!getData || !getLibraryIds) {
      console.error('[profile_runner_json] Не удалось инициализировать панели');
      return;
    }

    // Получаем libraryIds
    const libraryIds = getLibraryIds();

    if (!window.skinAdmin || typeof window.skinAdmin.load !== 'function') {
      console.error('[profile_runner_json] skinAdmin.load не найден.');
      return;
    }

    // Загружаем данные с учетом libraryIds
    const { status, visibleData, save } = await window.skinAdmin.load(id, libraryIds);
    if (status !== 'ok' && status !== 'ок') {
      console.error('[profile_runner_json] Не удалось загрузить данные со скинами');
      return;
    }

    // Инициализируем панели только видимыми данными
    if (window.__skinsSetupJSONMounted && window.__skinsSetupJSONMounted.panels) {
      const panels = window.__skinsSetupJSONMounted.panels;
      if (visibleData.gift && panels.gift) panels.gift.init(visibleData.gift);
      if (visibleData.coupon && panels.coupon) panels.coupon.init(visibleData.coupon);
      if (visibleData.plashka && panels.plashka) panels.plashka.init(visibleData.plashka);
      if (visibleData.icon && panels.icon) panels.icon.init(visibleData.icon);
      if (visibleData.background && panels.back) panels.back.init(visibleData.background);
    }

    const panelRoot = document.getElementById('fmv-skins-panel');
    const btnSave  = panelRoot?.querySelector('.fmv-save');
    const statusEl = panelRoot?.querySelector('.fmv-status');
    if (!btnSave) return;

    btnSave.addEventListener('click', async () => {
      try {
        if (statusEl) {
          statusEl.textContent = 'Сохраняю…';
          statusEl.style.color = '#666';
        }

        const jsonData = getData ? getData() : null;
        if (!jsonData) {
          if (statusEl) {
            statusEl.textContent = 'Нечего сохранять';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        let r = null;
        if (typeof save === 'function') {
          r = await save(jsonData);
        } else {
          if (statusEl) {
            statusEl.textContent = 'Нет функции сохранения';
            statusEl.style.color = '#c24141';
          }
          return;
        }

        const ok = !!(r && (r.ok || r.status === 'saved' || r.status === 'успешно' || r.status === 'ok'));

        if (statusEl) {
          if (ok) {
            statusEl.textContent = '✓ Успешно сохранено';
            statusEl.style.color = '#16a34a';
            // перезагрузка отключена для отладки
            // setTimeout(() => location.reload(), 1000);
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
