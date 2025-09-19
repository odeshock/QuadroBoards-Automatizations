/* ====== FMV unified characters & helpers (new format) ====== */
(function () {
  const FMV = (window.FMV = window.FMV || {});

  // пригодится внизу — но не перезаписываем, если уже есть
  FMV.escapeHtml = FMV.escapeHtml || function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };
  FMV.normSpace = FMV.normSpace || function (s) {
    return String(s ?? '').replace(/\s+/g, ' ').trim();
  };
  FMV.readTagText = FMV.readTagText || function (root, tag) {
    return FMV.normSpace(root?.querySelector(tag)?.textContent || '');
  };

  // 1) вытащить userID из ЕДИНОГО текста <characters>
  FMV.extractUserIdsFromTags = function (charsText) {
    const ids = new Set();
    String(charsText || '').replace(/user(\d+)/gi, (_, d) => { ids.add(String(Number(d))); return _; });
    return Array.from(ids);
  };

  // 2) построить карту id->имя по указанным в <characters> userID
  FMV.buildIdToNameMapFromTags = async function (charsText) {
    // если кто-то заранее положил кэш — используем
    if (window.__FMV_ID_TO_NAME_MAP__ instanceof Map && window.__FMV_ID_TO_NAME_MAP__.size) {
      return window.__FMV_ID_TO_NAME_MAP__;
    }
    const ids = FMV.extractUserIdsFromTags(charsText);
    const map = new Map();
    if (typeof window.getProfileNameById !== 'function') return map;

    await Promise.all(ids.map(async (id) => {
      try {
        const name = await window.getProfileNameById(id);
        if (name) map.set(id, name);
      } catch {}
    }));
    return map;
  };

  // 3) строгая проверка order (оставляем единую)
  FMV.parseOrderStrict = FMV.parseOrderStrict || function(orderText){
    const raw = FMV.normSpace(orderText);
    if (!raw) return { ok:false, html:'' };
    if (/^-?\d+$/.test(raw)) return { ok:true, value:parseInt(raw,10), html:FMV.escapeHtml(raw) };
    return {
      ok:false,
      html:`<span class="fmv-missing">Ошибка! Нужен формат целого числа (пример: -3 или 5)</span> — ${FMV.escapeHtml(raw)}`
    };
  };

  // 4) ЕДИНЫЙ ПАРСЕР нового формата <characters>
  //    "userN; userM=mask; userM=mask; userK"
  FMV.parseCharactersUnified = function (charsText, idToNameMap, profileLink = window.profileLink) {
    const raw = String(charsText || '').trim();
    if (!raw) {
      return {
        ok:false,
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError: ''
      };
    }

    // только user\d+ либо user\d+=не-«;», разделитель «;»
    const TEMPLATE = /^\s*user\d+(?:\s*=\s*[^;]+)?(?:\s*;\s*user\d+(?:\s*=\s*[^;]+)?)*\s*$/i;
    const human = raw.split(/\s*;\s*/).filter(Boolean).join('; ');
    if (!TEMPLATE.test(raw)) {
      return {
        ok:false,
        participantsLower: [],
        masksByCharLower: new Map(),
        htmlParticipants: '',
        htmlMasks: '',
        htmlError:
          `<span class="fmv-missing">Аааа! Надо пересобрать всё по шаблону: ` +
          `userN; userM=маска; userM=маска; userK</span> — ${FMV.escapeHtml(human)}`
      };
    }

    const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
    const participantsSet = new Set();                 // 'user5', 'user11' …
    const masksByCharLower = new Map();                // 'user5' -> Set(['mask1','mask2'])
    const htmlMaskPairs = [];

    // собираем участников и пары «масок»
    for (const p of parts) {
      const [left, right] = p.split('=');
      const id = String(Number((left.match(/user(\d+)/i) || [,''])[1]));
      const key = ('user' + id).toLowerCase();
      participantsSet.add(key);

      const personHtml = profileLink(id, idToNameMap?.get(id));
      if (right) {
        const mask = FMV.normSpace(right);
        if (!masksByCharLower.has(key)) masksByCharLower.set(key, new Set());
        masksByCharLower.get(key).add(mask.toLowerCase());
        htmlMaskPairs.push(`${personHtml}=${FMV.escapeHtml(mask)}`);
      }
    }

    const participantsLower = Array.from(participantsSet);

    // «Участники:» — имя + [as …] если есть маски у этого user
    const htmlParticipants = participantsLower.map(low => {
      const roles = Array.from(masksByCharLower.get(low) || []);
      const id = String(+low.replace(/^user/i,''));
      const base = profileLink(id, idToNameMap?.get(id));
      return roles.length ? `${base} [as ${FMV.escapeHtml(roles.join(', '))}]` : base;
    }).join('; ');

    return {
      ok:true,
      participantsLower,
      masksByCharLower,
      htmlParticipants,
      htmlMasks: htmlMaskPairs.join('; '),
      htmlError: ''
    };
  };
})();
