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
          Плашки: библиотека и выбранные
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
    if (location.pathname !== '/profile.php') return;
    const sp = new URLSearchParams(location.search);
    if (!sp.has('id') || [...sp.keys()].some(k => k !== 'id')) return;

    const id = getProfileIdFromURL();
    if (!id) return;

    if (!window.skinAdmin || typeof window.skinAdmin.load !== 'function') {
      console.error('[profile_runner] skinAdmin.load не найден.');
      return;
    }

    const { status, initialHtml, save } = await window.skinAdmin.load(id);
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

    const pageName = `usr${id}_skin`;

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
