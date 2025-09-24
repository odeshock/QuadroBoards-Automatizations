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
      // нет дат — поставим заглушки пустыми строками
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
    // для start-l: если задан день → первый день месяца; месяц → 1 число; год → 1 янв
    // для end-r:   если задан день → последний день месяца; месяц → последний день; год → 31 дек
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
      // если конец не задан — растягиваем до конца месяца/года по старту
      if (ps.g === "day")   return toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      if (ps.g === "month") return toISO(ps.y, ps.m, lastDayOfMonth(ps.y, ps.m));
      return toISO(ps.y, 12, 31); // year
    })();

    return { startL: startMin, startR: startActual, endL: endActual, endR: endMax };
  }

  const css = `
<style>
    body{background:#f9f9fb;color:#1a1a1a;font-family:Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px}
    a{color:#3366cc;text-decoration:none}
    a:hover{text-decoration:underline}
    .filters{display:grid;grid-template-columns:repeat(12,1fr);gap:12px;background:#ffffff;padding:16px;border-radius:16px;border:1px solid #d0d0d0;position:sticky;top:0;z-index:5;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
    .f{grid-column:span 3}
    .f label{display:block;font-size:12px;color:#555;margin-bottom:6px}
    .f input[type="date"]{width:100%;background:#ffffff;color:#1a1a1a;border:1px solid #ccc;border-radius:10px;padding:10px;font-size:14px}
    .dropdown-wrapper{position:relative}
    .dropdown-toggle{width:100%;background:#ffffff;color:#1a1a1a;border:1px solid #ccc;border-radius:10px;padding:10px;text-align:left;cursor:pointer;font-size:14px}
    .dropdown-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#ffffff;border:1px solid #ccc;border-radius:10px;max-height:220px;overflow:auto;display:none;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,0.08)}
    .dropdown-list label{display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer}
    .dropdown-list label:hover{background:#f0f0f0}
    .actions{display:flex;gap:8px;align-items:end}
    .btn{background:linear-gradient(135deg,#4d9cff,#9b6cff);color:#fff;border:none;border-radius:12px;padding:10px 14px;font-weight:600;cursor:pointer}
    .list{display:flex;flex-direction:column;gap:8px;margin-top:16px}
    .episode{background:#ffffff;border:1px solid #d0d0d0;border-radius:10px;padding:10px 12px;line-height:1.5;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
    .episode .muted{color:#666}
    .episode .title{font-weight:700;color:#222}
    .meta{color:#555;margin:6px 0 14px}
    .f{grid-column:span 3}
  </style>`
  
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
    return html; // стиль обёртки уже есть в вашем файле
  }

  for (const ep of episodes) {
    const typeRu = (()=>{
      if (ep?.type === "personal") return {label:"личный", badge:"Личный 🪄"};
      if (ep?.type === "plot")     return {label:"сюжетный", badge:"Сюжетный 📜"};
      return {label:"au", badge:"AU ✨"};
    })();
    const statusRu = (()=>{
      if (ep?.status === "active")   return {label:"активен", badge:"Активен 🟢"};
      if (ep?.status === "closed")   return {label:"закрыт",  badge:"Закрыт 🔒"};
      return {label:"архивирован",    badge:"Архив 🗄️"};
    })();

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
       data-type="${escAttr(typeRu.label)}" 
       data-status="${escAttr(statusRu.label)}" 
       data-start-l="${escAttr(bounds.startL)}" data-start-r="${escAttr(bounds.startR)}" 
       data-end-l="${escAttr(bounds.endL)}" data-end-r="${escAttr(bounds.endR)}"
       ${masks.length ? `data-mask="${escAttr(masks.join(','))}"` : ``}
       ${loc ? `data-location="${escAttr(loc)}"` : ``}
       ${participants.length ? `data-players="${escAttr(participants.join(','))}"` : ``}>
    <div>тип: ${esc(typeRu.badge)}; статус: ${esc(statusRu.badge)}</div>
    <div><span class="muted">${esc(rangeHuman)}</span> <span class="title">${esc(ep?.title || "")}</span>${masks.length ? ` as ${esc(masks.join(", "))}` : ""}</div>
    <div>локация: ${esc(loc)}</div>
    <div>соигроки: ${esc(participants.join(", "))}</div>
  </div>`;
  }

  html += `</section>` + css;
  return html;
};


  /** ============================
   *  (Опционально) Экспорт вспомогательного
   *  билдера для внешних сценариев
   *  ============================ */
  FMV.utils = { esc, escAttr, unique, fmtRange };
})();
