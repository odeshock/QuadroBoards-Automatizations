(function () {
  'use strict';

  if (window.__profileRunnerMounted) return;   // <== защита от повторного запуска
  window.__profileRunnerMounted = true;

  // --- небольшие утилиты ---
  function qs(sel, root = document) { return root.querySelector(sel); }
  function toast(msg, ok = false) {
    const d = document.createElement('div');
    d.textContent = msg;
    d.style.cssText = 'position:fixed;right:14px;bottom:14px;padding:8px 12px;border-radius:8px;color:#fff;z-index:999999;' +
      (ok ? 'background:#16a34a;' : 'background:#c24141;');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
  function onReady() {
    return new Promise(res => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') return res();
      document.addEventListener('DOMContentLoaded', () => res(), { once: true });
    });
  }
  function getProfileIdFromURL() {
    const u = new URL(location.href);
    const id = u.searchParams.get('id');
    return id ? String(id).trim() : '';
  }

  // аккуратно ждём ноду-подложку, куда будем рисовать
  async function waitMount() {
    await onReady();
    // у вас просили рисовать «внутри #viewprofile , под #container».
    // #viewprofile -> .container
    const box = qs('#viewprofile .container') || qs('#viewprofile') || qs('#pun-main') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'fmv-skins-panel';
    wrap.style.margin = '16px 0';
    // отдельный блок, чуть похожий на карточку
    wrap.innerHTML = `
      <details open style="border:1px solid #d6d6de;border-radius:10px;background:#fff">
        <summary style="list-style:none;padding:10px 14px;border-bottom:1px solid #e8e8ef;border-radius:10px;font-weight:600;background:#f6f7fb;cursor:pointer">
          Плашки: библиотека и выбранные
        </summary>
        <div class="fmv-skins-body" style="padding:14px"></div>
        <div class="fmv-skins-footer" style="display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #eee">
          <button type="button" class="fmv-save" style="background:#2f67ff;color:#fff;border:1px solid #2f67ff;border-radius:8px;padding:8px 14px;cursor:pointer">Сохранить</button>
          <span class="fmv-hint" style="opacity:.7">После выбора во всех секциях нажмите «Сохранить»</span>
        </div>
      </details>
    `;
    box.appendChild(wrap);
    return wrap.querySelector('.fmv-skins-body');
  }

  // попытка получить библиотеки из глобалов в fallback-режиме
  function getLib(nameCandidates) {
    for (const n of nameCandidates) {
      if (window[n]) return window[n];
    }
    return [];
  }

  // основной сценарий
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

    // загружаем админскую страницу (edit)
    const { status, initialHtml, save } = await window.skinAdmin.load(id);
    if (status !== 'ok') {
      // status может быть: 'forbidden' | 'notfound' | 'error' | 'unknown' | ...
      const msg = (status === 'forbidden')
        ? 'Страница со скинами недоступна'
        : 'Не удалось загрузить страницу со скинами';
      toast(msg, false);
      return;
    }

    // монтируем визуальную панель на странице профиля
    const mount = await waitMount();

    // ДВА ВАРИАНТА:
    // 1) Если в skin_set_up.js есть функция setupSkins(container, initialHtml) — используем её.
    //    Она должна отрисовать три секции (_plashka, _icon, _background) и вернуть { build() }.
    // 2) Иначе — падаем в fallback: вызываем createChoicePanel трижды и собираем итог через их билдеры.

    let build;
    if (typeof window.setupSkins === 'function') {
      // «родной» путь
      try {
        const api = await window.setupSkins(mount, initialHtml); // <— ЖДЁМ промис
        if (api && typeof api.build === 'function') {
          build = api.build;
        }
      } catch (e) {
        console.error('setupSkins() error:', e);
      }
    }

    if (!build) {
      // --- Fallback: ручной вызов createChoicePanel ---
      if (typeof window.createChoicePanel !== 'function') {
        toast('createChoicePanel не найден — не могу отрисовать панели', false);
        return;
      }

      // библиотеки стараемся угадать из глобалов
      const LIB_P = getLib(['LIB_P', 'LIB_PLASHKI', 'LIB_PL', 'LIB_PLA']);
      const LIB_I = getLib(['LIB_I', 'LIB_ICON', 'LIB_IC']);
      const LIB_B = getLib(['LIB_B', 'LIB_BACKGROUND', 'LIB_BG', 'LIB_BACK']);

      // контейнер под 3 панели
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '16px';
      mount.appendChild(grid);

      const panels = [];

      // плашки
      panels.push(window.createChoicePanel({
        title: 'Плашки',
        targetClass: '_plashka',
        library: LIB_P,
        mountEl: grid,
        initialHtml,
        external: true
      }));

      // иконки
      panels.push(window.createChoicePanel({
        title: 'Иконки',
        targetClass: '_icon',
        library: LIB_I,
        mountEl: grid,
        initialHtml,
        external: true
      }));

      // фон
      panels.push(window.createChoicePanel({
        title: 'Фон',
        targetClass: '_background',
        library: LIB_B,
        mountEl: grid,
        initialHtml,
        external: true
      }));

      // билдер: конкатенация по targetClass в порядке (_plashka, _icon, _background)
      build = () => {
        let result = '';
        for (const p of panels) {
          if (p && typeof p.build === 'function') {
            const part = p.build(); // ожидаем HTML фрагмента секции
            if (part) {
              result += (result ? '\n\n' : '') + part;
            }
          }
        }
        return result;
      };
    }

    // обработчик «Сохранить»
    const btnSave = document.querySelector('#fmv-skins-panel .fmv-save');
    btnSave?.addEventListener('click', async () => {
      try {
        const finalHtml = build ? build() : '';
        if (!finalHtml) {
          toast('Нечего сохранять', false);
          return;
        }
        const r = await save(finalHtml);
        if (r && (r.ok || r.status === 'saved')) {
          toast('Успешно', true);
        } else {
          toast('Ошибка сохранения', false);
          if (r && r.serverMessage) console.warn('save message:', r.serverMessage);
        }
      } catch (e) {
        console.error(e);
        toast('Ошибка сохранения', false);
      }
    });
  })();
})();
