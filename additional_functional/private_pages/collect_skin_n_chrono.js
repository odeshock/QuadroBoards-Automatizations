(function () {
  // === настройки, при желании можно менять прямо здесь ===
  const CHARACTER_SELECTOR = '.character[data-id]';
  const SKIN_TARGET = '.skin_info';
  const CHRONO_TARGET = '.chrono_info';
  const SOURCE_BLOCK = '#pun-main .container';
  const INFO_TEXT = 'Ссылка, по которой Вы пришли, неверная или устаревшая.';
  const DEFAULT_CHARSET = 'windows-1251';
  const REDIR_SKIN_RE = /<!--\s*main:\s*usr(\d+)_skin\s*-->/i;
  // ========================================================

  async function fetchDecoded(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;

    const buf = await res.arrayBuffer();
    const ct = res.headers.get('content-type') || '';
    const m = ct.match(/charset=([^;]+)/i);
    const charset = (m ? m[1] : DEFAULT_CHARSET).toLowerCase();

    try {
      return new TextDecoder(charset).decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }

  function extractNode(html) {
    if (!html || html.includes(INFO_TEXT)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector(SOURCE_BLOCK);
  }

  async function loadSkin(N) {
    const target = document.querySelector(SKIN_TARGET);
    if (!target) return;

    const firstHTML = await fetchDecoded(`/pages/usr${N}_skin`);
    if (!firstHTML) return;

    const redirectMatch = REDIR_SKIN_RE.exec(firstHTML);
    if (redirectMatch) {
      const M = redirectMatch[1];
      const secondHTML = await fetchDecoded(`/pages/usr${M}_skin`);
      if (!secondHTML) return;
      if (REDIR_SKIN_RE.test(secondHTML)) return; // второй редирект — выходим
      const node = extractNode(secondHTML);
      if (!node) return;
      target.innerHTML = '';
      target.appendChild(node.cloneNode(true));
      return;
    }

    const node = extractNode(firstHTML);
    if (!node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  async function loadChrono(N) {
    const target = document.querySelector(CHRONO_TARGET);
    if (!target) return;

    const html = await fetchDecoded(`/pages/usr${N}_chrono`);
    if (!html) return;
    const node = extractNode(html);
    if (!node) return;
    target.innerHTML = '';
    target.appendChild(node.cloneNode(true));
  }

  // ---- автозапуск после полной загрузки DOM ----
  document.addEventListener('DOMContentLoaded', () => {
    const characterEl = document.querySelector(CHARACTER_SELECTOR);
    const N = characterEl && characterEl.getAttribute('data-id')?.trim();
    if (!N) return;
    Promise.all([loadSkin(N), loadChrono(N)]).catch(() => {});
  });
})();
