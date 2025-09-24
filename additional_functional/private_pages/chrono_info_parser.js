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
  function toISO(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
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
  function calcBounds(startRaw, endRaw) {
    const ps = parseDateSmart(startRaw);
    const pe = endRaw ? parseDateSmart(endRaw) : null;
    if (!ps && !pe) return { startL:"", startR:"", endL:"", endR:"" };

    const sY = ps?.y ?? pe.y;
    const sM = ps?.m ?? (pe?.g === "year" ? 1 : pe?.m ?? 1);
    const sD = ps?.d ?? 1;
    const startActual = toISO(sY, sM, sD);

    const eY = pe?.y ?? ps.y;
    const eM = pe?.m ?? (ps?.g === "year" ? 12 : ps?.m ?? 12);
    const eD = pe?.d
      ?? (pe?.g === "month" ? lastDayOfMonth(eY, eM)
          : pe?.g === "year" ? 31
          : ps?.g === "month" ? lastDayOfMonth(eY, eM)
          : ps?.g === "year" ? 31
          : ps.d);
    const endActual = toISO(eY, eM, eD);

    const startMin = ps
      ? (ps.g === "year" ? toISO(ps.y, 1, 1)
         : toISO(ps.y, ps.m, 1))
      : toISO(sY, 1, 1);

    const endMax = pe
      ? (pe.g === "year" ? toISO(pe.y, 12, 31)
         : pe.g === "month" ? toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m))
         : toISO(pe.y, pe.m, lastDayOfMonth(pe.y, pe.m)))
      : (ps.g === "year" ? toISO(ps.y, 12, 31)
         : ps.g === "month" ? toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m))
         : toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m)));

    return { startL: startMin, startR: startActual, endL: endActual, endR: endMax };
  }

  const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  // ===== Уникальные значения для фильтров =====
  const masksAll = unique(episodes.flatMap(e => Array.isArray(e?.masks) ? e.masks : []));
  const playersAll = unique(
    episodes.flatMap(e => Array.isArray(e?.participants) ? e.participants.map(p => p?.name).filter(Boolean) : [])
  );
  const locationsAll = unique(episodes.map(e => e?.location).filter(Boolean));

  // генерируем чекбоксы для маски/соигрока/локации
  const maskOptions = masksAll.map(m => `<label><input type="checkbox" name="mask" value="${escAttr(m)}"> ${esc(m)}</label>`).join("");
  const playerOptions = playersAll.map(p => `<label><input type="checkbox" name="player" value="${escAttr(p)}"> ${esc(p)}</label>`).join("");
  const locationOptions = locationsAll.map(l => `<label><input type="checkbox" name="location" value="${escAttr(l)}"> ${esc(l)}</label>`).join("");

  // генерируем чекбоксы для типа/статуса из глобальных констант
  const typeOptions = Object.entries(TYPE_RU).map(([key, t]) =>
    `<label><input type="checkbox" name="type" value="${escAttr(key)}"> ${esc(t.label)}</label>`).join("");
  const statusOptions = Object.entries(STATUS_RU).map(([key, s]) =>
    `<label><input type="checkbox" name="status" value="${escAttr(key)}"> ${esc(s.label)}</label>`).join("");

  // ==== глобальные min/max дат для дефолтного value в input[type=date] ====
  let globalMin = null;
  let globalMax = null;
  const boundsArr = episodes.map(e => {
    const b = calcBounds(e?.dateStart, e?.dateEnd);
    if (b.startL && (!globalMin || b.startL < globalMin)) globalMin = b.startL;
    if (b.endR && (!globalMax || b.endR > globalMax)) globalMax = b.endR;
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

  // ===== Список эпизодов =====
  if (!episodes.length) {
    html += `<div class="meta">Нет эпизодов</div></section>`;
    return html;
  }

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
    const rangeHuman = b.startR && b.endL ? `${b.startR} — ${b.endL}` : "";

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
    <div><span class="muted">${esc(rangeHuman)}</span> <span class="title">
      <a href="${esc(ep?.href || '#')}">${esc(ep?.title.lowercase() || "")}</a>
      </span>${masks.length ? ` [as ${esc(masks.join(", "))}]` : ""}</div>
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
