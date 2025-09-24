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
    const titlePrefix = opts.titlePrefix || "Хронология";
    const userName = esc(userData?.name || "");
    const episodes = Array.isArray(userData?.episodes) ? userData.episodes : [];

    // Заготовим справочники (могут пригодиться сверху страницы)
    const masksAll = unique(episodes.flatMap(e => Array.isArray(e?.masks) ? e.masks : []));
    const playersAll = unique(
      episodes.flatMap(e => Array.isArray(e?.participants) ? e.participants.map(p => p?.name).filter(Boolean) : [])
    );
    const locationsAll = unique(episodes.map(e => (e?.location || "").trim()).filter(Boolean));

    // Шапка
    let html = `
<h1 style="margin:0 0 8px 0;font-size:22px">${esc(titlePrefix)} — ${userName}</h1>
<div class="meta" style="color:#9fb2c7;margin:6px 0 14px">
  Масок: ${masksAll.length}; Соигроков: ${playersAll.length}; Локаций: ${locationsAll.length}
</div>
<section class="list" id="list">
`;

    if (!episodes.length) {
      html += `<div class="meta" style="color:#9fb2c7">Нет эпизодов</div></section>`;
      return wrapStyles(html);
    }

    // Элементы
    for (const ep of episodes) {
      const t = TYPE_RU[ep?.type] || TYPE_RU.au;
      const s = STATUS_RU[ep?.status] || STATUS_RU.archived;

      const masks = Array.isArray(ep?.masks) ? ep.masks.filter(Boolean) : [];
      const players = (Array.isArray(ep?.participants) ? ep.participants : [])
        .map(p => p?.name).filter(Boolean);

      const maskStr     = masks.join(";");       // для data-атрибутов
      const maskHuman   = masks.join(", ");      // для текста
      const playersStr  = players.join(";");
      const playersHuman= players.join(", ");

      const ds = ep?.dateStart || "";
      const de = ep?.dateEnd || "";
      const dateRange = fmtRange(ds, de);

      html += `
  <div class="episode" 
       data-type="${escAttr(t.label)}" 
       data-status="${escAttr(s.label)}" 
       data-mask="${escAttr(maskStr)}" 
       data-location="${escAttr(ep?.location || "")}" 
       data-players="${escAttr(playersStr)}"
       style="background:#121824;border:1px solid #263246;border-radius:10px;padding:10px 12px;line-height:1.5;margin:8px 0">
    <div>тип: ${esc(t.label)} ${t.emoji}; статус: ${esc(s.label)} ${s.emoji}</div>
    <div>
      <span class="muted" style="color:#9fb2c7">${dateRange}</span> 
      ${ep?.href ? `<a class="title" href="${escAttr(ep.href)}" target="_blank" rel="noopener noreferrer" style="font-weight:700">${esc(ep?.title || "")}</a>` 
                  : `<span class="title" style="font-weight:700">${esc(ep?.title || "")}</span>`}
      ${maskHuman ? ` as ${esc(maskHuman)}` : ""}
    </div>
    <div>локация: ${esc(ep?.location || "")}</div>
    <div>соигроки: ${esc(playersHuman)}</div>
  </div>`;
    }

    html += `</section>`;
    return wrapStyles(html);
  };

  // Оборачиваем в базовые стили (легковесно)
  function wrapStyles(content) {
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
    return css + "\n" + content;
  }

  /** ============================
   *  (Опционально) Экспорт вспомогательного
   *  билдера для внешних сценариев
   *  ============================ */
  FMV.utils = { esc, escAttr, unique, fmtRange };
})();
