// profile_runner.js — запуск панелей со страницы профиля (EDIT-режим)
(function () {
  'use strict';

  // защита от повторного запуска скрипта
  if (window.__profileRunnerMounted) return;
  window.__profileRunnerMounted = true;

  // --- утилиты ---
  const qs = (sel, root = document) => root.querySelector(sel);
  function toast(msg, ok = false) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText =
      'position:fixed;right:14px;bottom:14px;padding:8px 12px;border-radius:8px;color:#fff;z-index:999999;' +
      (ok ? 'background:#16a34a;' : 'background:#c24141;');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
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
      .replace(/\s+$/g, '')
      .trim();
  }

  // создаём оболочку для панелей и кнопку "Сохранить"
  async function waitMount() {
    await onReady();
    const box = qs('#viewprofile .container') || qs('#viewprofile') || qs('#pun-main') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'fmv-skins-panel';
    wrap.style.margin = '16px 0';
    wrap.innerHTML = `
      <details open style="border:1px solid #d6d6de;border-radius:10px;background:#fff">
        <summary style="list-style:none;padding:10px 14px;border-bottom:1px solid #e8e8ef;border-radius:10px;font-weight:600;background:#f6f7fb;cursor:pointer">
          Плашки: библиотека и выбранные
        </summary>
        <div class="fmv-skins-body" style="padding:14px"></div>
        <div class="fmv-skins-footer" style="display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #eee">
          <button type="button" class="fmv-save"
            style="background:#2f67ff;color:#fff;border:1px solid #2f67ff;border-radius:8px;padding:8px 14px;cursor:pointer">
            Сохранить
          </button>
          <span class="fmv-status" style="margin-left:8px;font-size:14px;color:#666"></span>
          <span class="fmv-hint" style="opacity:.7">После выбора во всех секциях нажмите «Сохранить»</span>
        </div>
      </details>
    `;
    box.appendChild(wrap);
    return wrap.querySelector('.fmv-skins-body');
  }

  // --- основной сценарий ---
  (async () => {
    // работаем только на странице профиля
    if (!/\/profile\.php$/i.test(location.pathname)) return;

    const id = getProfileIdFromURL();
    if (!id) return;

    if (!window.skinAdmin || typeof window.skinAdmin.load !== 'function') {
      console.error('[profile_runner] skinAdmin.load не найден. Подключите admin_bridge.js раньше этого файла.');
      toast('admin_bridge.js не подключён', false);
      return;
    }

    // грузим HTML страницы редактирования
    const { status, initialHtml, save } = await window.skinAdmin.load(id);
    if (status !== 'ok' && status !== 'ок') {
      const msg = status === 'ошибка доступа к персональной странице'
        ? 'Страница со скинами недоступна'
        : 'Не удалось загрузить страницу со скинами';
      toast(msg, false);
      return;
    }

    // монтируем контейнер и запускаем панели
    const mount = await waitMount();

    let build = null;
    if (typeof window.setupSkins === 'function') {
      try {
        // ВАЖНО: ждём Promise от setupSkins
        const api = await window.setupSkins(mount, initialHtml);
        if (api && typeof api.build === 'function') build = api.build;
      } catch (e) {
        console.error('setupSkins() error:', e);
      }
    }

    if (!build) {
      toast('Не удалось инициализировать панели', false);
      return;
    }

    // кнопка "Сохранить"
    const panelRoot = document.getElementById('fmv-skins-panel');
    const btnSave = panelRoot ? panelRoot.querySelector('.fmv-save') : null;
    const statusEl = panelRoot ? panelRoot.querySelector('.fmv-status') : null;
    if (!btnSave) {
      console.error('[profile_runner] Кнопка .fmv-save не найдена');
      return;
    }

    const pageName = `usr${id}_skin`;

    btnSave.addEventListener('click', async () => {
      try {
        if (statusEl) {
          statusEl.textContent = 'Сохраняю…';
          statusEl.style.color = '#666';
        }
        const finalHtml = build ? build() : '';
        if (!finalHtml) {
          toast('Нечего сохранять', false);
          return;
        }

        // 1) сохраняем: сначала через FMVeditTextareaOnly, иначе — через admin_bridge.save
        let r = null;
        if (typeof window.FMVeditTextareaOnly === 'function') {
          r = await window.FMVeditTextareaOnly(pageName, finalHtml);
        } else if (typeof save === 'function') {
          r = await save(finalHtml);
        } else {
          toast('Нет функции сохранения', false);
          return;
        }

        // 2) первичный признак успеха
        let ok = !!(r && (r.ok || r.status === 'saved' || r.status === 'успешно' || r.status === 'ok'));

        // 3) пост-верификация: перечитываем страницу редактирования и сравниваем textarea
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

        if (ok) {
          toast('Успешно', true);
          if (statusEl) {
            statusEl.textContent = '✓ Успешно сохранено';
            statusEl.style.color = '#16a34a';
          }
        } else {
          toast('Ошибка сохранения', false);
          if (statusEl) {
            statusEl.textContent = 'Ошибка сохранения';
            statusEl.style.color = '#c24141';
          }
        }
      } catch (e) {
        console.error(e);
        toast('Ошибка сохранения', false);
      }
    });
  })();
})();
