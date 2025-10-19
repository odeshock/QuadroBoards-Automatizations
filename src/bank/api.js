(function (w, ns) {
  const API_URL = "/api.php";
  const USER_ID = () => 1; // всегда 1 в запросах
  let ticket = false;

  // utils
  const enc = (o) => new URLSearchParams(o);
  const parseStorage = (json, key) => {
    try {
      const raw = json?.response?.storage?.data?.[key];
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  // авто-подхват токена
  (function autoDetectToken() {
    const guess =
      w.ForumAPITicket ||
      w.ticket ||
      w.TOKEN ||
      w.API_TOKEN ||
      (w.session && w.session.token) ||
      (w.FORUM && w.FORUM.ticket) ||
      null;

    if (guess) {
      ticket = guess;
    } else {
      let tries = 5;
      const iv = setInterval(() => {
        if (ticket || --tries < 0) { clearInterval(iv); return; }
        const late =
          w.ForumAPITicket ||
          w.ticket ||
          w.TOKEN ||
          w.API_TOKEN ||
          (w.session && w.session.token) ||
          (w.FORUM && w.FORUM.ticket) ||
          null;
        if (late) {
          ticket = late;
          clearInterval(iv);
        }
      }, 200);
    }
  })();

  // базовый вызов
  async function callStorage(method, payload = {}, NEEDED_USER_ID = 1, api_key_label = "fmv_bank_info_") {
    const API_KEY = api_key_label + NEEDED_USER_ID;

    if (method === "storage.get") {
      const qs = enc({ user_id: USER_ID(), method, key: API_KEY });
      const res = await fetch(`${API_URL}?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error(`GET ${res.status}`);
      return res.json();
    }

    if (method === "storage.set") {
      const body = enc({ user_id: USER_ID(), token: ticket, method, key: API_KEY, ...payload });
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        credentials: "same-origin",
        body
      });
      if (!res.ok) throw new Error(`POST ${res.status}`);
      return true;
    }

    throw new Error("Unknown method");
  }

  // публичные функции
  async function storageGet(NEEDED_USER_ID = 1, { api_key_label = "fmv_bank_info_" }) {
    const API_KEY = api_key_label + NEEDED_USER_ID;
    const json = await callStorage("storage.get", {}, NEEDED_USER_ID, api_key_label);
    const parsed = parseStorage(json, API_KEY);
    return parsed;
  }

  async function storageSet(valueObj, NEEDED_USER_ID = 1, api_key_label = "fmv_bank_info_") {
    if (!valueObj || typeof valueObj !== "object" || Array.isArray(valueObj)) {
      console.log("[FMVbank] storageSet: ожидался объект JSON");
      return false;
    }
    const stringValue = JSON.stringify(valueObj);
    await callStorage("storage.set", { value: stringValue }, NEEDED_USER_ID, api_key_label);
    return true;
  }

  function setTicket(value) { ticket = value; }

  // экспорт
  w[ns] = { setTicket, storageGet, storageSet };

})(window, "FMVbank");

// Пример использования:
// const dataStr = await FMVbank.storageGet(15);
// const dataStr = await FMVbank.storageGet(15, "custom_label_");
// FMVbank.storageSet({}, 15)
//   .then(ok => {
//     if (ok) console.log("✅ данные успешно записаны");
//     else console.warn("⚠ не удалось подтвердить запись");
//   })
//   .catch(err => console.error("❌ ошибка при записи:", err));
// FMVbank.storageSet({}, 15, "custom_label_")
