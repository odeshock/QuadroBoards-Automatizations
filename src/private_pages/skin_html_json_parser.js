// skin_html_json_parser.js — Парсинг HTML ↔ JSON для данных скинов

(function () {
  'use strict';

  if (!window.FMV) window.FMV = {};

  /**
   * Парсит HTML в JSON структуру
   * @param {string} html - HTML с секциями ._icon, ._plashka, ._background, ._gift, ._coupon
   * @returns {Object} - { icon: [...], plashka: [...], background: [...], gift: [...], coupon: [...] }
   */
  function parseHtmlToJson(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const result = {
      icon: [],
      plashka: [],
      background: [],
      gift: [],
      coupon: []
    };

    // Маппинг классов на ключи
    const sectionMap = {
      '_icon': 'icon',
      '_plashka': 'plashka',
      '_background': 'background',
      '_gift': 'gift',
      '_coupon': 'coupon'
    };

    for (const [className, key] of Object.entries(sectionMap)) {
      const section = doc.querySelector(`.${className}`);
      if (!section) continue;

      const items = section.querySelectorAll('.item');
      items.forEach(item => {
        const itemData = {
          title: item.getAttribute('title') || '',
          id: item.getAttribute('data-id') || '',
          content: item.innerHTML || ''
        };

        // Собираем все data-* атрибуты
        Array.from(item.attributes).forEach(attr => {
          if (attr.name.startsWith('data-') && attr.name !== 'data-id') {
            const attrKey = attr.name.replace('data-', '').replace(/-/g, '_');
            itemData[attrKey] = attr.value;
          }
        });

        result[key].push(itemData);
      });
    }

    return result;
  }

  /**
   * Конвертирует JSON в HTML
   * @param {Object} data - { icon: [...], plashka: [...], background: [...], gift: [...], coupon: [...] }
   * @returns {string} - HTML строка
   */
  function parseJsonToHtml(data) {
    let html = '';

    const sections = [
      { key: 'icon', className: '_icon' },
      { key: 'plashka', className: '_plashka' },
      { key: 'background', className: '_background' },
      { key: 'gift', className: '_gift' },
      { key: 'coupon', className: '_coupon' }
    ];

    sections.forEach(({ key, className }) => {
      const items = data[key] || [];
      if (items.length === 0) return;

      html += `<div class="${className}">\n`;

      items.forEach(item => {
        const attrs = [
          `title="${escapeHtml(item.title || '')}"`,
          `data-id="${escapeHtml(item.id || '')}"`
        ];

        // Добавляем все остальные data-* атрибуты
        Object.keys(item).forEach(k => {
          if (k !== 'title' && k !== 'id' && k !== 'content') {
            const attrName = 'data-' + k.replace(/_/g, '-');
            attrs.push(`${attrName}="${escapeHtml(item[k] || '')}"`);
          }
        });

        html += `  <div class="item" ${attrs.join(' ')}>${item.content || ''}</div>\n`;
      });

      html += `</div>\n`;
    });

    return html;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Экспорт
  window.FMV.parseHtmlToJson = parseHtmlToJson;
  window.FMV.parseJsonToHtml = parseJsonToHtml;

  console.log('[skin_html_json_parser] Загружен');
})();
