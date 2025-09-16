(() => {
  const cache = new Map(); // twinId -> Promise<HTML string>

  async function fetchInventoryHTML(twinId) {
    if (!cache.has(twinId)) {
      const url = `https://testfmvoice.rusff.me/pages/${encodeURIComponent(twinId)}`;
      cache.set(
        twinId,
        (async () => {
          // пробуем прямой fetch, если CORS — уходим на прокси
          try {
            const r = await fetch(url, { credentials: 'include' });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.text();
          } catch (e) {
            const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const r2 = await fetch(proxy);
            if (!r2.ok) throw new Error(`Proxy HTTP ${r2.status}`);
            return await r2.text();
          }
        })()
      );
    }
    return cache.get(twinId);
  }

  async function fillTwin(el) {
    if (!el || el.dataset.twinLoaded === '1') return;
    const twinId = el.getAttribute('twin_id');
    if (!twinId) return;

    el.dataset.twinLoaded = '1';
    el.innerHTML = '<div style="opacity:.7;font-size:12px">загрузка…</div>';

    try {
      const html = await fetchInventoryHTML(twinId);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const inv = doc.querySelector('.inventory');
      if (inv) {
        el.innerHTML = inv.innerHTML;
      } else {
        el.textContent = 'Инвентарь не найден';
      }
    } catch (err) {
      console.error('Ошибка для', twinId, err);
      el.textContent = 'Ошибка загрузки данных';
    }
  }

  function scanAndFill(root = document) {
    const nodes = root.querySelectorAll?.('.main_twin[twin_id]:not([data-twin-loaded])');
    if (!nodes || !nodes.length) return;
    nodes.forEach(fillTwin);
  }

  // 1) стартовый проход (на случай, если модалка уже открыта)
  scanAndFill();

  // 2) наблюдаем за появлением новых узлов (модалки, динамические вставки)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.main_twin[twin_id]:not([data-twin-loaded])')) fillTwin(node);
          // также ищем внутри добавленного поддерева
          scanAndFill(node);
        });
      }
      if (m.type === 'attributes' && m.target instanceof Element) {
        // если элемент сменил класс/атрибут и стал подходить под селектор
        if (m.target.matches('.main_twin[twin_id]:not([data-twin-loaded])')) {
          fillTwin(m.target);
        }
      }
    }
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'twin_id']
  });

  // 3) на всякий случай — после любого клика пробуем сканировать (часто модалки открываются по клику)
  document.addEventListener('click', () => {
    // небольшой таймаут, чтобы DOM успел отрендериться
    setTimeout(scanAndFill, 0);
  });

  console.log('Инициализирован наблюдатель для .main_twin[twin_id]');
})();
