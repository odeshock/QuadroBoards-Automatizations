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
    personal: { label: "личный", emoji: "🪄" },
    plot:     { label: "сюжетный", emoji: "🪄" },
    au:       { label: "au",       emoji: "🪄" },
  };
  const STATUS_RU = {
    active:   { label: "активен",     emoji: "🟢" },
    archived: { label: "архивирован", emoji: "🟤" },
    closed:   { label: "закрыт",      emoji: "🟦" },
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

  // ==== helpers для дат (поддерживаем dd.mm.yyyy / yyyy-mm-dd / mm.yyyy / yyyy) ====
  const pad = n => String(n).padStart(2, "0");
  function lastDayOfMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function parseDateSmart(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;

    // dd.mm.yyyy
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return { y:+m[3], m:+m[2], d:+m[1], g:"day" };

    // yyyy-mm-dd
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return { y:+m[1], m:+m[2], d:+m[3], g:"day" };

    // mm.yyyy
    m = s.match(/^(\d{1,2})\.(\d{4})$/);
    if (m) return { y:+m[2], m:+m[1], d:1, g:"month" };

    // yyyy
    m = s.match(/^(\d{4})$/);
    if (m) return { y:+m[1], m:1, d:1, g:"year" };

    return null;
  }
  function toISO(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

  // Границы для data-атрибутов:
  // start-l = минимально возможная дата начала (по гранулярности)
  // start-r = фактический старт
  // end-l   = фактический конец (или старт, если конец не задан)
  // end-r   = максимально возможная дата конца (по гранулярности)
  function calcBounds(startRaw, endRaw) {
    const ps = parseDateSmart(startRaw);
    const pe = endRaw ? parseDateSmart(endRaw) : null;

    if (!ps && !pe) {
      // нет дат — пустые строки
      return { startL:"", startR:"", endL:"", endR:"" };
    }

    // фактический старт
    const sY = ps?.y ?? pe.y;
    const sM = ps?.m ?? (pe.g === "year" ? 1 : pe.m ?? 1);
    const sD = ps?.d ?? 1;
    const startActual = toISO(sY, sM, sD);

    // фактический конец
    const eY = (pe?.y ?? ps.y);
    const eM = (pe?.m ?? (ps.g === "year" ? 12 : ps.m ?? 12));
    const eD = (pe?.d ?? (pe?.g === "month" ? lastDayOfMonth(eY, eM)
                           : pe?.g === "year" ? 31
                           : ps.g === "month" ? lastDayOfMonth(eY, eM)
                           : ps.g === "year" ? 31
                           : ps.d));
    const endActual = toISO(eY, eM, eD);

    // нижняя/верхняя «рамки» по гранулярности
    const startMin = (() => {
      if (!ps) return toISO(sY, 1, 1);
      if (ps.g === "day")   return toISO(ps.y, ps.m, 1);
      if (ps.g === "month") return toISO(ps.y, ps.m, 1);
      return toISO(ps.y, 1, 1); // year
    })();

    const endMax = (() => {
      if (pe) {
        if (pe.g === "day")   return toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
        if (pe.g === "month") return toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m));
        return toISO(pe.y, 12, 31); // year
      }
      // если конец не задан — растянуть по старту
      if (ps.g === "day")   return toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      if (ps.g === "month") return toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      return toISO(ps.y, 12, 31); // year
    })();

    return { startL: startMin, startR: startActual, endL: endActual, endR: endMax };
  }

  const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  // ===== шапка + фильтры =====
  let html = `
<h1 style="margin:0 0 8px 0;font-size:22px">${esc(titlePrefix)} — ${userName}</h1>

<section class="filters" id="filters">
  <div class="f">
    <label>Дата начала фильтра</label>
    <input type="date" id="dateStart">
  </div>
  <div class="f">
    <label>Дата конца фильтра</label>
    <input type="date" id="dateEnd">
  </div>
  <div class="f">
    <label>Тип</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="typeToggle">Выбрать тип</button>
      <div class="dropdown-list" id="typeList"></div>
    </div>
  </div>
  <div class="f">
    <label>Статус</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="statusToggle">Выбрать статус</button>
      <div class="dropdown-list" id="statusList"></div>
    </div>
  </div>
  <div class="f">
    <label>Маска</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="maskToggle">Выбрать маску</button>
      <div class="dropdown-list" id="maskList"></div>
    </div>
  </div>
  <div class="f">
    <label>Соигрок</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="playerToggle">Выбрать соигрока</button>
      <div class="dropdown-list" id="playerList"></div>
    </div>
  </div>
  <div class="f">
    <label>Локация</label>
    <div class="dropdown-wrapper">
      <button class="dropdown-toggle" id="locationToggle">Выбрать локацию</button>
      <div class="dropdown-list" id="locationList"></div>
    </div>
  </div>
  <div class="actions">
    <button class="btn" id="resetBtn">Сбросить</button>
  </div>
</section>

<section class="list" id="list">
`;

  // ===== список эпизодов =====
  if (!episodes.length) {
    html += `<div class="meta">Нет эпизодов</div></section>`;
    return html; // стиль/обёртка остаются как в файле
  }

  for (const ep of episodes) {
    // ✅ используем глобальные TYPE_RU / STATUS_RU
    const typeMeta   = (window.TYPE_RU || TYPE_RU)[ep?.type] || (window.TYPE_RU || TYPE_RU).au;
    const statusMeta = (window.STATUS_RU || STATUS_RU)[ep?.status] || (window.STATUS_RU || STATUS_RU).archived;

    const typeLabel   = typeMeta.label;                 // "личный" | "сюжетный" | "au"
    const typeBadge   = `${capitalize(typeLabel)} ${typeMeta.emoji}`;
    const statusLabel = statusMeta.label;               // "активен" | "архивирован" | "закрыт"
    const statusBadge = `${capitalize(statusLabel)} ${statusMeta.emoji}`;

    const masks = Array.isArray(ep?.masks) ? ep.masks.filter(Boolean) : [];
    const participants = (Array.isArray(ep?.participants) ? ep.participants : [])
      .map(p => p?.name).filter(Boolean);
    const loc = ep?.location || "";

    const bounds = calcBounds(ep?.dateStart, ep?.dateEnd);
    const rangeHuman = (()=>{
      const s = parseDateSmart(ep?.dateStart);
      const e = ep?.dateEnd ? parseDateSmart(ep?.dateEnd) : s;
      if (!s && !e) return "";
      const toIsoHuman = obj => toISO(obj.y, obj.m, obj.d);
      return `${toIsoHuman(s || e)} — ${toIsoHuman(e || s)}`;
    })();

    html += `
  <div class="episode" 
       data-type="${escAttr(typeLabel)}" 
       data-status="${escAttr(statusLabel)}" 
       data-start-l="${escAttr(bounds.startL)}" data-start-r="${escAttr(bounds.startR)}" 
       data-end-l="${escAttr(bounds.endL)}" data-end-r="${escAttr(bounds.endR)}"
       ${masks.length ? `data-mask="${escAttr(masks.join(','))}"` : ``}
       ${loc ? `data-location="${escAttr(loc)}"` : ``}
       ${participants.length ? `data-players="${escAttr(participants.join(','))}"` : ``}>
    <div>тип: ${esc(typeBadge)}; статус: ${esc(statusBadge)}</div>
    <div><span class="muted">${esc(rangeHuman)}</span> <span class="title">${esc(ep?.title || "")}</span>${masks.length ? ` as ${esc(masks.join(", "))}` : ""}</div>
    <div>локация: ${esc(loc)}</div>
    <div>соигроки: ${esc(participants.join(", "))}</div>
  </div>`;
  }

  html += `</section>`;
  return html;
};


  /** ============================
   *  (Опционально) Экспорт вспомогательного
   *  билдера для внешних сценариев
   *  ============================ */
  FMV.utils = { esc, escAttr, unique, fmtRange };
})();
