/*
 * ChronoFilter — modal-ready version
 * Works when a modal appears; stays dormant otherwise.
 *
 * Usage examples:
 *  1) Auto-run for a modal that mounts/unmounts dynamically
 *     ChronoFilter.start({
 *       modalSelector: '.modal_wrap',
 *       listSelector: '#list',
 *       filtersSelector: '#filters',
 *       // Optional: provide filters template if your modal content lacks it
 *       ensureFiltersWith: () => `
 *         <div id="filters" class="chrono-filters">
 *           <input type="text" data-filter="search" placeholder="Поиск..." />
 *           <select data-filter="type">
 *             <option value="">Все типы</option>
 *             <option value="story">История</option>
 *             <option value="event">Событие</option>
 *           </select>
 *         </div>`
 *     });
 *
 *  2) Manually init inside a specific root (modal content element):
 *     ChronoFilter.initIn(document.querySelector('.modal_wrap'));
 *
 *  To stop watching entirely:
 *     ChronoFilter.stop();
 */
(function () {
  const DEFAULTS = {
    modalSelector: '.modal_wrap',
    listSelector: '#list',
    filtersSelector: '#filters',
    ensureFiltersWith: null, // () => string of HTML, appended before list if filters missing
    onInit: null,            // (root) => void
    onDestroy: null          // (root) => void
  };

  /** Utility: tiny event manager to simplify cleanup */
  class Disposables {
    constructor() { this._items = []; }
    add(fn) { if (typeof fn === 'function') this._items.push(fn); }
    run() { this._items.splice(0).forEach(fn => {
      try { fn(); } catch (_) {}
    }); }
  }

  /** Core filter bound to a specific root */
  class ChronoFilterCore {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts;
      this.disposables = new Disposables();
      this.filtersEl = null;
      this.listEl = null;
    }

    _q(sel) { return this.root.querySelector(sel); }

    /** Attempt to find or create UI and wire up listeners */
    init() {
      // Find list first; without it there is nothing to filter
      this.listEl = this._q(this.opts.listSelector);
      if (!this.listEl) return false;

      // Ensure filters exist under the same root
      this.filtersEl = this._q(this.opts.filtersSelector);
      if (!this.filtersEl && typeof this.opts.ensureFiltersWith === 'function') {
        const html = this.opts.ensureFiltersWith();
        if (html) {
          const tmp = document.createElement('div');
          tmp.innerHTML = String(html).trim();
          const node = tmp.firstElementChild;
          if (node) this.listEl.parentElement?.insertBefore(node, this.listEl);
          this.filtersEl = this._q(this.opts.filtersSelector);
        }
      }
      if (!this.filtersEl) return false;

      this._bind();
      this._apply();
      if (typeof this.opts.onInit === 'function') this.opts.onInit(this.root);
      return true;
    }

    /** Read current criteria from filters */
    _criteria() {
      const crit = {};
      this.filtersEl.querySelectorAll('[data-filter]')
        .forEach(el => {
          const key = el.getAttribute('data-filter');
          let val = '';
          if (el.tagName === 'INPUT') val = el.value.trim();
          else if (el.tagName === 'SELECT') val = el.value;
          else if (el.type === 'checkbox') val = el.checked ? '1' : '';
          else val = el.getAttribute('data-value') || '';
          crit[key] = val;
        });
      return crit;
    }

    /** Apply filter to items */
    _apply() {
      const crit = this._criteria();
      const items = Array.from(this.listEl.children);

      const text = (s) => (s || '').toLowerCase();
      const search = text(crit.search);
      const type = crit.type || '';

      items.forEach(el => {
        // You can adapt these getters to your DOM
        const title = text(el.getAttribute('data-title') || el.textContent);
        const itemType = (el.getAttribute('data-type') || '').toLowerCase();

        let ok = true;
        if (search) ok = ok && title.includes(search);
        if (type) ok = ok && itemType === type;
        el.style.display = ok ? '' : 'none';
      });
    }

    _bind() {
      const handler = (e) => {
        // Debounce input typing a bit
        if (e && e.target && e.target.matches('[data-filter]')) {
          if (e.type === 'input') {
            clearTimeout(this._t);
            this._t = setTimeout(() => this._apply(), 120);
          } else {
            this._apply();
          }
        }
      };

      // Delegate inside filters block
      this.filtersEl.addEventListener('input', handler);
      this.filtersEl.addEventListener('change', handler);
      this.disposables.add(() => {
        this.filtersEl.removeEventListener('input', handler);
        this.filtersEl.removeEventListener('change', handler);
      });

      // Optional: close popouts when clicking outside (if you add dropdowns)
      const outsideClick = (ev) => {
        if (!this.root.contains(ev.target)) return;
        // close logic for custom dropdowns could go here
      };
      document.addEventListener('click', outsideClick, true);
      this.disposables.add(() => document.removeEventListener('click', outsideClick, true));
    }

    destroy() {
      this.disposables.run();
      if (typeof this.opts.onDestroy === 'function') this.opts.onDestroy(this.root);
      this.root = null;
      this.filtersEl = null;
      this.listEl = null;
    }
  }

  /** Watches DOM for the modal and (re)initializes ChronoFilterCore when needed */
  class ModalWatcher {
    constructor(opts) {
      this.opts = opts;
      this.observer = null;
      this.instance = null; // ChronoFilterCore
      this.enabled = false;
    }

    start() {
      if (this.enabled) return;
      this.enabled = true;

      const tryMount = () => {
        if (!this.enabled) return;
        const root = document.querySelector(this.opts.modalSelector);
        if (root && !this.instance) {
          const inst = new ChronoFilterCore(root, this.opts);
          if (inst.init()) {
            this.instance = inst;
          } else {
            // If list/filters not ready yet, keep watching
          }
        }
        if (!root && this.instance) {
          this.instance.destroy();
          this.instance = null;
        }
      };

      // Initial check (covers already-open modal)
      tryMount();

      // Observe body for modal add/remove and for late children within modal
      this.observer = new MutationObserver(() => tryMount());
      this.observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    }

    stop() {
      this.enabled = false;
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
      if (this.instance) { this.instance.destroy(); this.instance = null; }
    }
  }

  // Public API
  const API = (() => {
    let watcher = null;

    function normalizeOptions(userOpts) {
      return Object.assign({}, DEFAULTS, userOpts || {});
    }

    return {
      /** Autostart: watch for modal appearance and init inside it. */
      start(userOpts) {
        const opts = normalizeOptions(userOpts);
        if (watcher) watcher.stop();
        watcher = new ModalWatcher(opts);
        watcher.start();
      },

      /** Stop watching and destroy current instance (if any). */
      stop() { if (watcher) watcher.stop(); watcher = null; },

      /** Manually init inside specific root */
      initIn(root, userOpts) {
        const opts = normalizeOptions(userOpts);
        const inst = new ChronoFilterCore(root, opts);
        if (!inst.init()) return null;
        return inst; // caller can hold and call .destroy()
      }
    };
  })();

  // Attach to window (non-intrusive if never used)
  if (typeof window !== 'undefined') {
    window.ChronoFilter = API;
  }
})();
