/*
 * common.js — универсальный парсер characters/masks с выводом в HTML (дефолт) и BB-код (по флагу opts.asBB)
 *
 * Публичные функции:
 *   - FMV.parseCharactersUnified(charsText, idToNameMap, profileLink = window?.profileLink, opts)
 *       -> { ok, participantsLower, masksByCharLower, participants, masks, error,
 *            htmlParticipants, htmlMasks, htmlError, bbParticipants, bbMasks, bbError }
 *   - FMV.renderParticipantsHtml(charsText, idToNameMap, profileLink = window?.profileLink, opts)
 *       -> строка (HTML или BB)
 *
 * Обратная совместимость:
 *   htmlParticipants/htmlMasks/htmlError сохранены. Добавлены bbParticipants/bbMasks/bbError.
 */

(function (global) {
  'use strict';

  const FMV = (global.FMV = global.FMV || {});

  // ===== БАЗОВЫЕ УТИЛИТЫ =====
  FMV.escapeHtml = FMV.escapeHtml || function escapeHtml(str) {
    const s = String(str ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  FMV.normSpace = FMV.normSpace || function normSpace(str) {
    return String(str ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
  };

  // Нормализация токена участника к нижнему регистру
  function toKey(tok) {
    return FMV.normSpace(tok).toLowerCase();
  }

  // Линк на профиль (HTML/BB). Можно подменить через profileLink/bbProfileLink в opts
  function renderPersonTok(id, displayName, { asBB, profileLink, bbProfileLink }) {
    const safeName = FMV.escapeHtml(displayName || (id ? 'user' + id : ''));

    if (!asBB) {
      if (typeof profileLink === 'function') {
        try { return String(profileLink(id, displayName)); } catch (_) {}
      }
      // дефолтная ссылка HTML
      return `<a href="/profile.php?id=${id}">${safeName}</a>`;
    }

    // BB-версия
    if (typeof bbProfileLink === 'function') {
      try { return String(bbProfileLink(id, displayName)); } catch (_) {}
    }
    return `[url=/profile.php?id=${id}]${safeName}[/url]`;
  }

  function renderMissingTok(name, { asBB }) {
    const safe = FMV.escapeHtml(String(name || 'не найден'));
    return asBB
      ? `[i][color=gray]${safe}[/color][/i]`
      : `<span class="fmv-missing" data-found="0">${safe}</span>`;
  }

  // Разбор одной части: "user123" либо "user123=маска"
  function parsePart(partRaw) {
    const part = FMV.normSpace(partRaw);
    if (!part) return null;

    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) {
      return { left: part, right: null };
    }
    const left = FMV.normSpace(part.slice(0, eqIdx));
    const right = FMV.normSpace(part.slice(eqIdx + 1));
    return { left, right };
  }

  function extractUserIdFromLeft(left) {
    // поддержим формы: user123 / USER123 / User123
    const m = /(?:^|\b)user(\d+)(?:\b|$)/i.exec(left);
    return m ? String(Number(m[1])) : null;
  }

  function partsFromCharsText(charsText) {
    // Разделители — точка с запятой или перевод строки/запятая; допускаем смешанное
    const raw = String(charsText ?? '')
      .replace(/\r\n?/g, '\n')
      .split(/[;\n,]/);
    const parts = [];
    for (const chunk of raw) {
      const p = parsePart(chunk);
      if (p) parts.push(p);
    }
    return parts;
  }

  // Преобразовать Map<string, Set<string>> в plain-объект для удобного чтения/логирования
  function mapSetToPlain(map) {
    const out = Object.create(null);
    for (const [k, set] of map.entries()) {
      out[k] = Array.from(set.values());
    }
    return out;
  }

  // ===== ОСНОВНАЯ ФУНКЦИЯ =====
  FMV.parseCharactersUnified = function (
    charsText,
    idToNameMap,
    profileLink = (typeof window !== 'undefined' ? window.profileLink : undefined),
    opts
  ) {
    try {
      const asBB = !!(opts && opts.asBB);
      const bbProfileLink = opts && opts.bbProfileLink;

      // нормализуем карту: допускаем Map<string,string> или обычный объект {id: name}
      let idMapGet = null;
      if (idToNameMap && typeof idToNameMap.get === 'function') {
        idMapGet = (id) => idToNameMap.get(id);
      } else if (idToNameMap && typeof idToNameMap === 'object') {
        idMapGet = (id) => idToNameMap[id];
      } else {
        idMapGet = () => undefined;
      }

      const parts = partsFromCharsText(charsText);
      const participantsSet = new Set(); // ключи (lowercased) — user123 или произвольный токен
      const masksByCharLower = new Map(); // key -> Set(maskLower)

      // предварительный проход: соберём участников и маски
      for (const p of parts) {
        const leftKey = toKey(p.left);
        if (!leftKey) continue;
        participantsSet.add(leftKey);

        const uid = extractUserIdFromLeft(p.left);
        if (p.right && uid) {
          const maskLower = toKey(p.right);
          if (!masksByCharLower.has(leftKey)) masksByCharLower.set(leftKey, new Set());
          if (maskLower) masksByCharLower.get(leftKey).add(maskLower);
        }
      }

      // Списки для вывода
      const participantsLower = Array.from(participantsSet.values());

      function buildOne(tok, fmt) {
        // tok: уже lowercased
        const m = /user(\d+)/i.exec(tok);
        const id = m ? String(Number(m[1])) : null;
        const roles = Array.from(masksByCharLower.get(tok) || []);

        let found = false, displayName = tok;
        if (id) {
          const name = idMapGet(id);
          if (name) { found = true; displayName = String(name); } else { displayName = `user${id}`; }
        }

        const rolesTail = roles.length ? ` [as ${FMV.escapeHtml(roles.join(', '))}]` : '';

        if (found) {
          if (fmt === 'bb') {
            return `${renderPersonTok(id, displayName, { asBB: true, profileLink, bbProfileLink })}${rolesTail}`;
          }
          // html
          const link = typeof profileLink === 'function'
            ? String(profileLink(id, displayName))
            : `<a href="/profile.php?id=${id}">${FMV.escapeHtml(displayName)}</a>`;
          return `${link}${rolesTail}`;
        }

        // not found — исходный токен как есть (или user{id} без имени)
        const miss = renderMissingTok(displayName, { asBB: fmt === 'bb' });
        return `${miss}${rolesTail}`;
      }

      const htmlParticipants = participantsLower.map(tok => buildOne(tok, 'html')).join('; ');
      const bbParticipants   = participantsLower.map(tok => buildOne(tok, 'bb')).join('; ');

      // mask-pairs (только для тех, у кого есть права часть)
      const htmlMaskPairs = [];
      const bbMaskPairs = [];
      for (const p of parts) {
        if (!p.right) continue;
        const leftKey = toKey(p.left);
        const uid = extractUserIdFromLeft(p.left);
        const rawMask = FMV.normSpace(p.right);
        const escMask = FMV.escapeHtml(rawMask);
        if (uid) {
          const name = idMapGet(uid) || `user${uid}`;
          const personHtml = (typeof profileLink === 'function')
            ? String(profileLink(uid, name))
            : `<a href="/profile.php?id=${uid}">${FMV.escapeHtml(name)}</a>`;
          const personBB = renderPersonTok(uid, name, { asBB: true, profileLink, bbProfileLink });
          htmlMaskPairs.push(`${personHtml}=${escMask}`);
          bbMaskPairs.push(`${personBB}=${escMask}`);
        } else {
          // левая часть не распарсилась как user{id} — выводим как «missing»/сырой
          const missHtml = `<span class="fmv-missing" data-found="0">${FMV.escapeHtml(p.left)}</span>`;
          const missBB = renderMissingTok(p.left, { asBB: true });
          htmlMaskPairs.push(`${missHtml}=${escMask}`);
          bbMaskPairs.push(`${missBB}=${escMask}`);
        }
      }

      const result = {
        ok: true,
        participantsLower,
        masksByCharLower, // Map для удобства использования в коде
        masksByCharLowerPlain: mapSetToPlain(masksByCharLower), // plain-object для сериализации/логирования

        // Универсальные строки под запрос
        participants: (asBB ? bbParticipants : htmlParticipants),
        masks:        (asBB ? bbMaskPairs.join('; ') : htmlMaskPairs.join('; ')),
        error: '',

        // HTML-совместимость
        htmlParticipants,
        htmlMasks: htmlMaskPairs.join('; '),
        htmlError: '',

        // BB-выводы
        bbParticipants,
        bbMasks: bbMaskPairs.join('; '),
        bbError: ''
      };

      return result;
    } catch (err) {
      const raw = FMV.escapeHtml(String(charsText ?? ''));
      const msg = (err && err.message) ? String(err.message) : 'internal error';
      return {
        ok: false,
        participantsLower: [],
        masksByCharLower: new Map(),
        masksByCharLowerPlain: {},
        participants: `[color=red]Ошибка: ${FMV.escapeHtml(msg)}[/color] — ${raw}`,
        masks: `[color=red]Ошибка: ${FMV.escapeHtml(msg)}[/color]`,
        error: msg,
        htmlParticipants: `<span class="fmv-error">Ошибка: ${FMV.escapeHtml(msg)}</span> — ${raw}`,
        htmlMasks: `<span class="fmv-error">Ошибка: ${FMV.escapeHtml(msg)}</span>`,
        htmlError: msg,
        bbParticipants: `[color=red]Ошибка: ${FMV.escapeHtml(msg)}[/color] — ${raw}`,
        bbMasks: `[color=red]Ошибка: ${FMV.escapeHtml(msg)}[/color]`,
        bbError: msg
      };
    }
  };

  // Обёртка: рендер участников одной строкой
  FMV.renderParticipantsHtml = function (
    charsText,
    idToNameMap,
    profileLink = (typeof window !== 'undefined' ? window.profileLink : undefined),
    opts
  ) {
    const uni = FMV.parseCharactersUnified(charsText, idToNameMap, profileLink, opts);
    if (uni && uni.ok) return uni.participants;

    const raw = FMV.escapeHtml(String(charsText ?? ''));
    if (opts && opts.asBB) {
      const msg = uni && (uni.error || uni.bbError) ? (uni.error || uni.bbError) : 'Ошибка в characters';
      return `[color=red]${FMV.escapeHtml(msg)}[/color] — ${raw}`;
    }
    const msg = uni && (uni.error || uni.htmlError) ? (uni.error || uni.htmlError) : 'Ошибка в characters';
    return `<span class="fmv-error">${FMV.escapeHtml(msg)}</span> — ${raw}`;
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
