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
    active:   { label: "активен",     emoji: "<иконка>" },
    archived: { label: "неактуален",  emoji: "<иконка>" },
    closed:   { label: "закрыт",      emoji: "<иконка>" },
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
      episodes.flatMap(e => Array.isArray(e?.participants) ? e.participants.map(p => p?.name).filter(Boolean) : [])
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
    const maskOptions = masksAll
      .map(m => `<label><input type="checkbox" name="mask" value="${escAttr(m)}"> ${esc(m)}</label>`)
      .join("");
    const playerOptions = playersAll
      .map(p => `<label><input type="checkbox" name="player" value="${escAttr(p)}"> ${esc(p)}</label>`)
      .join("");
    const locationOptions = locationsAll
      .map(l => `<label><input type="checkbox" name="location" value="${escAttr(l)}"> ${esc(l)}</label>`)
      .join("");

    // Шапка + фильтры
    let html = `
<h1 style="margin:0 0 8px 0;font-size:22px">${esc(titlePrefix)} — ${userName}</h1>

<section class="filters" id="filters">
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
    <label>Соигрок</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="playerToggle">Выбрать соигрока</button>
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
    <button class="btn" id="resetBtn">Сбросить</button>
  </div>
</section>

<section class="list" id="list">
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
      const participantTokens = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => {
          // поддержим p.masks (массив) или p.mask (строка)
          const masksArr = Array.isArray(p?.masks)
            ? p.masks.filter(Boolean).map(x => String(x).trim()).filter(Boolean)
            : (typeof p?.mask === 'string' && p.mask.trim() ? [p.mask.trim()] : []);
      
          // если есть маски — используем их (через ", "), иначе имя
          const token = masksArr.length ? masksArr.join(", ") : String(p?.name || "").trim();
          return token;
        })
        .map(t => t.replace(/\s+/g, " "))     // нормализуем пробелы
        .map(t => t.replace(/;/g, " "))       // чтобы не ломать разделитель в data-атрибуте
        .filter(Boolean);
      const playersData  = participantTokens.join(";");
      const playersHuman = participantTokens.join(", ");
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
    <div>соигроки: ${esc(playersHuman)}</div>
  </div>`;
    });

    html += `</section>`;
    return html;
  };
})();
