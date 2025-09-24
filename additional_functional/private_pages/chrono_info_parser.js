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
  const unique = arr => Array.from(new Set(arr.filter(Boolean)));
  const fmtRange = (ds, de) => {
    if (!ds && !de) return "";
    if (!de || de === ds) return esc(ds || de || "");
    return `${esc(ds)} — ${esc(de)}`;
  };

  // Отображаемые метки для типа/статуса
  const TYPE_RU = {
    personal: { label: "личный", emoji: "<иконка>" },
    plot:     { label: "сюжетный", emoji: "<иконка>" },
    au:       { label: "au",       emoji: "<иконка>" },
  };
  const STATUS_RU = {
    active:   { label: "активен",     emoji: "<иконка>" },
    archived: { label: "неактуален", emoji: "<иконка>" },
    closed:   { label: "закрыт",      emoji: "<иконка>" },
  };

  /** ============================
   *  Общий билдер HTML персональной
   *  страницы хронологии usr{ID}_chrono
   *  ============================ */
  /**
   * @param {Object} userData  — { name, episodes: [...] }
   * @param {Object} [opts]
   * @param {string} [opts.titlePrefix="Хронология"] — заголовок страницы
   * @returns {string} HTML
   */
  // Замените существующую FMV.buildChronoHtml на эту версию
  FMV.buildChronoHtml = function buildChronoHtml(userData, opts = {}) {
    const { esc, escAttr, unique } = FMV.utils || {};
    const titlePrefix = opts.titlePrefix || "Хронология";
    const userName = esc(userData?.name || "");
    const episodes = Array.isArray(userData?.episodes) ? userData.episodes : [];

    // ===== Вспомогательные для дат =====
    const pad = n => String(n).padStart(2, "0");
    const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate();
    const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

    function parseDateSmart(raw) {
      const s = String(raw || "").trim();
      if (!s) return null;
      let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m) return { y:+m[3], m:+m[2], d:+m[1], g:"day" };      // dd.mm.yyyy
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return { y:+m[1], m:+m[2], d:+m[3], g:"day" };      // yyyy-mm-dd
      m = s.match(/^(\d{1,2})\.(\d{4})$/);
      if (m) return { y:+m[2], m:+m[1], d:1, g:"month" };        // mm.yyyy
      m = s.match(/^(\d{4})$/);
      if (m) return { y:+m[1], m:1, d:1, g:"year" };             // yyyy
      return null;
    }

    // === Рамки для start/end ===
    function calcBounds(startRaw, endRaw) {
      const ps = parseDateSmart(startRaw);
      const pe = endRaw ? parseDateSmart(endRaw) : null;

      // если вообще нет дат — пусто
      if (!ps && !pe) return { startL:"", startR:"", endL:"", endR:"" };

      // ---------- START ----------
      let startL = "", startR = "";
      if (ps) {
        if (ps.g === "day") {
          // dd: l = 1 число месяца, r = фактический день
          startL = toISO(ps.y, ps.m, 1);
          startR = toISO(ps.y, ps.m, ps.d);
        } else if (ps.g === "month") {
          // mm.yyyy: l = 1 число месяца, r = последний день месяца
          startL = toISO(ps.y, ps.m, 1);
          startR = toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
        } else { // year
          // yyyy: l = 01-01, r = 12-31
          startL = toISO(ps.y, 1, 1);
          startR = toISO(ps.y, 12, 31);
        }
      } else if (pe) {
        // старт не задан, но есть конец: используем год/месяц конца в качестве рамок старта
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

      // ---------- END ----------
      let endL = "", endR = "";
      if (pe) {
        if (pe.g === "day") {
          // dd: l = фактический день, r = последний день месяца
          endL = toISO(pe.y, pe.m, pe.d);
          endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
        } else if (pe.g === "month") {
          // mm.yyyy: l = 1-е число, r = последний день месяца
          endL = toISO(pe.y, pe.m, 1);
          endR = toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
        } else { // year
          // yyyy: l = 01-01, r = 12-31
          endL = toISO(pe.y, 1, 1);
          endR = toISO(pe.y, 12, 31);
        }
      } else if (ps) {
        // конец не задан, но есть старт: наследуем рамки по гранулярности старта
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

    // === ТОЛЬКО форматирование вывода дат в <span class="muted">…</span> ===
    function formatHumanRange(startRaw, endRaw) {
      const s = parseDateSmart(startRaw);
      const e = parseDateSmart(endRaw);

      const fmtDay  = (o) => `${pad(o.d)}.${pad(o.m)}.${o.y}`;
      const fmtMon  = (o) => `${pad(o.m)}.${o.y}`;
      const fmtYear = (o) => `${o.y}`;

      if (!s && !e) return ""; // 0) нет даже года — не выводим

      // Совпадающие даты по гранулярности и значению
      const equal = (() => {
        if (!s || !e) return false;
        if (s.g === 'day'   && e.g === 'day'   && s.y===e.y && s.m===e.m && s.d===e.d) return true;
        if (s.g === 'month' && e.g === 'month' && s.y===e.y && s.m===e.m)               return true;
        if (s.g === 'year'  && e.g === 'year'  && s.y===e.y)                            return true;
        return false;
      })();

      if (equal) {
        // 1.2 / 1.3 / 1.4 по вашим правилам
        if (s.g === 'day')   return fmtDay(s);
        if (s.g === 'month') return fmtMon(s);
        if (s.g === 'year')  return fmtYear(s);
      }

      // Разные даты
      if (!s || !e) return ""; // 0) одна из дат без года — не выводим

      // a/b/c нормализации
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

      // a) день vs месяц -> у месячной ставим 01
      if (S.g === 'day' && E.g === 'month') ensureDay(E, E.m, 1);
      if (E.g === 'day' && S.g === 'month') ensureDay(S, S.m, 1);

      // b) день vs год -> годовой = 01.01
      if (S.g === 'day' && E.g === 'year') ensureDay(E, 1, 1);
      if (E.g === 'day' && S.g === 'year') ensureDay(S, 1, 1);

      // c) месяц vs год -> годовой получает тот же месяц (без дня)
      if (S.g === 'month' && E.g === 'year') ensureMonth(E, S.m);
      if (E.g === 'month' && S.g === 'year') ensureMonth(S, E.m);

      // Дальше — классификация форматов
      if (S.g === 'day' && E.g === 'day') {
        if (S.y === E.y && S.m === E.m && S.d === E.d) return fmtDay(S);                            // 1
        if (S.y === E.y && S.m === E.m) return `${pad(S.d)}-${pad(E.d)}.${pad(S.m)}.${S.y}`;       // 2
        if (S.y === E.y && S.m !== E.m) return `${pad(S.d)}.${pad(S.m)}-${pad(E.d)}.${pad(E.m)}.${S.y}`; // 3
        return `${fmtDay(S)}-${fmtDay(E)}`;                                                         // 4
      }

      if (S.g === 'month' && E.g === 'month') {
        if (S.y === E.y && S.m === E.m) return fmtMon(S);                        // 5
        if (S.y === E.y && S.m !== E.m) return `${pad(S.m)}-${pad(E.m)}.${S.y}`; // 6
        return `${fmtMon(S)}-${fmtMon(E)}`;                                      // 7
      }

      if (S.g === 'year' && E.g === 'year') {
        if (S.y === E.y) return fmtYear(S);                 // 8 (один год)
        return `${fmtYear(S)}-${fmtYear(E)}`;               // yyyy-yyyy
      }

      // Смешанные остатки
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

    const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

    // ===== Уникальные значения для фильтров =====
    const masksAll = unique(episodes.flatMap(e => Array.isArray(e?.masks) ? e.masks : []));
    const playersAll = unique(
      episodes.flatMap(e => Array.isArray(e?.participants) ? e.participants.map(p => p?.name).filter(Boolean) : [])
    );
    const locationsAll = unique(episodes.map(e => e?.location).filter(Boolean));

    // фильтры
    const maskOptions = masksAll.map(m => `<label><input type="checkbox" name="mask" value="${escAttr(m)}"> ${esc(m)}</label>`).join("");
    const playerOptions = playersAll.map(p => `<label><input type="checkbox" name="player" value="${escAttr(p)}"> ${esc(p)}</label>`).join("");
    const locationOptions = locationsAll.map(l => `<label><input type="checkbox" name="location" value="${escAttr(l)}"> ${esc(l)}</label>`).join("");
    const typeOptions = Object.entries(TYPE_RU).map(([key, t]) =>
      `<label><input type="checkbox" name="type" value="${escAttr(key)}"> ${esc(t.label)}</label>`).join("");
    const statusOptions = Object.entries(STATUS_RU).map(([key, s]) =>
      `<label><input type="checkbox" name="status" value="${escAttr(key)}"> ${esc(s.label)}</label>`).join("");

    // глобальные min/max дат для дефолтов инпутов
    let globalMin = null, globalMax = null;
    const boundsArr = episodes.map(e => {
      const b = calcBounds(e?.dateStart, e?.dateEnd);
      if (b.startL && (!globalMin || b.startL < globalMin)) globalMin = b.startL;
      if (b.endR   && (!globalMax || b.endR   > globalMax)) globalMax = b.endR;
      return b;
    });

    // ===== Фильтры =====
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

    // ===== Эпизоды =====
    if (!episodes.length) {
      html += `<div class="meta">Нет эпизодов</div></section>`;
      return html;
    }

    const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

    episodes.forEach((ep, idx) => {
      const typeMeta   = TYPE_RU[ep?.type] || TYPE_RU.au;
      const statusMeta = STATUS_RU[ep?.status] || STATUS_RU.archived;

      const typeLabel   = typeMeta.label;
      const typeBadge   = `${capitalize(typeLabel)} ${typeMeta.emoji}`;
      const statusLabel = statusMeta.label;
      const statusBadge = `${capitalize(statusLabel)} ${statusMeta.emoji}`;

      const masks = Array.isArray(ep?.masks) ? ep.masks.filter(Boolean) : [];
      const participants = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => p?.name).filter(Boolean);
      const loc = ep?.location || "";

      const b = boundsArr[idx];

      // >>> единственное изменение отображения даты:
      const rangeHuman = formatHumanRange(ep?.dateStart, ep?.dateEnd);

      html += `
  <div class="episode" 
       data-type="${escAttr(typeLabel)}" 
       data-status="${escAttr(statusLabel)}" 
       data-start-l="${escAttr(b.startL)}" data-start-r="${escAttr(b.startR)}" 
       data-end-l="${escAttr(b.endL)}" data-end-r="${escAttr(b.endR)}"
       ${masks.length ? `data-mask="${escAttr(masks.join(';'))}"` : ``}
       ${loc ? `data-location="${escAttr(loc)}"` : ``}
       ${participants.length ? `data-players="${escAttr(participants.join(';'))}"` : ``}>
    <div>тип: ${esc(typeBadge)}; статус: ${esc(statusBadge)}</div>
    <div><span class="muted">${esc(rangeHuman)}</span> <span class="title">${esc(ep?.title || "")}</span>${masks.length ? ` as ${esc(masks.join(", "))}` : ""}</div>
    <div>локация: ${esc(loc)}</div>
    <div>соигроки: ${esc(participants.join(", "))}</div>
  </div>`;
    });

    html += `</section>`;
    return html;
  };

  /** ============================
   *  (Опционально) Экспорт вспомогательного
   *  билдера для внешних сценариев
   *  ============================ */
  FMV.utils = { esc, escAttr, unique, fmtRange };
})();
