// IMPORTANT: everything in this template string executes inside the
// headless Chromium PAGE (browser context), not in our Node process.
// Playwright's `context.addInitScript()` injects it before any page
// script runs — the direct equivalent of your userscript's
// `@run-at document-start`.
//
// This is a straight port of your linkpoi.in.user.js "BEGIN/END INLINED
// CORE" block. Only change: instead of a hardcoded SITE_HANDLER + auto-run,
// it exposes `window.__adskipperStart(handler)` so Node decides when/what
// to run, and it also exposes `window.__adskipperState` so Node can read
// back progress (clicks fired, whether still on a protected/captcha page).

export const BROWSER_CORE_SRC = `
(function () {
  'use strict';

  window.__adskipperState = { clicks: 0, protected: false, tag: null };

  function isProtectedPage() {
    const title = (document.title || '').toLowerCase();
    if (
      title.includes('just a moment') ||
      title.includes('content protection') ||
      title.includes('attention required') ||
      title.startsWith('verifying')
    ) return true;

    const sel =
      'iframe[src*="hcaptcha.com"], iframe[src*="challenges.cloudflare.com"], ' +
      'iframe[src*="recaptcha"], iframe[src*="turnstile"], ' +
      'script[src*="hcaptcha.com"], script[src*="challenges.cloudflare.com"], ' +
      '#challenge-form, #challenge-running, #cf-challenge-running, ' +
      '[class*="hcaptcha" i], [id*="hcaptcha" i], [class*="cf-challenge" i]';
    if (document.querySelector(sel)) return true;

    const text = (document.body && document.body.innerText || '').toLowerCase();
    if (
      text.includes('verifying you are human') ||
      text.includes('needs to review the security of your connection') ||
      text.includes('blocking hcaptcha')
    ) return true;

    return false;
  }

  function isInsideCaptcha(el) {
    return !!(el && el.closest && el.closest(
      '[class*="captcha" i], [id*="captcha" i], [class*="challenge" i], [id*="challenge" i], iframe'
    ));
  }

  function forceEnable(el) {
    if (!el) return;
    try {
      if (el.disabled) el.disabled = false;
      el.removeAttribute('disabled');
      el.removeAttribute('aria-disabled');
      if (el.classList) el.classList.remove('disabled', 'btn-disabled');
      if (el.style && el.style.pointerEvents === 'none') el.style.pointerEvents = '';
      if (el.style && el.style.opacity === '0') el.style.opacity = '';
    } catch (_) {}
  }

  const _clicked = new WeakSet();
  function clickOnce(el, opts) {
    if (!el || _clicked.has(el)) return false;
    if (isInsideCaptcha(el) && !(opts && opts.allowInCaptcha)) return false;
    if (!(opts && opts.allowHidden) && el.offsetParent === null) return false;
    forceEnable(el);
    _clicked.add(el);
    try {
      if (opts && opts.eventBurst) {
        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(name => {
          el.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true }));
        });
      } else {
        el.click();
      }
    } catch (e) {
      return false;
    }
    window.__adskipperState.clicks++;
    return true;
  }

  function boostTimers(opts) {
    opts = opts || {};
    const guard = typeof opts.guard === 'function' ? opts.guard : (() => !isProtectedPage());
    const maxTimeout = typeof opts.maxTimeout === 'number' ? opts.maxTimeout : 30000;
    const maxInterval = typeof opts.maxInterval === 'number' ? opts.maxInterval : 2000;
    const minTimeout = typeof opts.minTimeout === 'number' ? opts.minTimeout : 0;
    const minInterval = typeof opts.minInterval === 'number' ? opts.minInterval : 1;

    const _setTimeout = window.setTimeout;
    const _setInterval = window.setInterval;

    window.setTimeout = function (fn, delay, ...args) {
      try {
        if (typeof delay === 'number' && delay > 0 && delay <= maxTimeout && guard()) delay = minTimeout;
      } catch (_) {}
      return _setTimeout.call(window, fn, delay, ...args);
    };

    window.setInterval = function (fn, delay, ...args) {
      try {
        if (typeof delay === 'number' && delay > 0 && delay <= maxInterval && guard()) delay = minInterval;
      } catch (_) {}
      return _setInterval.call(window, fn, delay, ...args);
    };
  }

  function driftClock(opts) {
    opts = opts || {};
    const guard = typeof opts.guard === 'function' ? opts.guard : (() => !isProtectedPage());
    const stepMs = typeof opts.stepMs === 'number' ? opts.stepMs : 200;

    const origDateNow = Date.now.bind(Date);
    let dateOffset = 0;
    Date.now = function () {
      try { if (guard()) dateOffset += stepMs; } catch (_) {}
      return origDateNow() + dateOffset;
    };

    if (window.performance && typeof performance.now === 'function') {
      const origPerfNow = performance.now.bind(performance);
      let perfOffset = 0;
      performance.now = function () {
        try { if (guard()) perfOffset += stepMs; } catch (_) {}
        return origPerfNow() + perfOffset;
      };
    }
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function startWatcher(fn, lifetimeMs) {
    lifetimeMs = lifetimeMs || 60000;
    const safeFn = () => { try { fn(); } catch (e) {} };
    safeFn();
    const obs = new MutationObserver(safeFn);
    const attach = () => obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
    setTimeout(() => obs.disconnect(), lifetimeMs);
    return obs;
  }

  function clickSelectors(selectors, opts) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    let clicks = 0;
    for (const sel of list) $$(sel).forEach(el => { if (clickOnce(el, opts)) clicks++; });
    return clicks;
  }

  function clickByText(hints, opts) {
    const list = (Array.isArray(hints) ? hints : [hints]).map(h => h.toLowerCase());
    let clicks = 0;
    $$('a, button, input[type="button"], input[type="submit"]').forEach(el => {
      const t = (el.textContent || el.value || '').trim().toLowerCase();
      if (!t) return;
      if (list.some(h => t === h || t.startsWith(h) || t.includes(h))) {
        if (clickOnce(el, opts)) clicks++;
      }
    });
    return clicks;
  }

  function clearOnclickAds() {
    $$('*[onclick*="window.open"]').forEach(el => el.removeAttribute('onclick'));
    $$('*[href*="https:///"]').forEach(el => el.removeAttribute('href'));
  }

  // Entry point Node calls (via an init script that appends a call to this
  // with the JSON-serialized handler baked in — see core/bypass.ts).
  window.__adskipperStart = function (handler) {
    window.__adskipperState.tag = handler.tag;

    if (handler.timerSpeedup) {
      boostTimers();
      driftClock();
    }

    function tick() {
      window.__adskipperState.protected = isProtectedPage();
      if (window.__adskipperState.protected) return;
      clearOnclickAds();
      clickSelectors(handler.selectors, { eventBurst: handler.eventBurst });
      clickByText(handler.textHints, { eventBurst: handler.eventBurst });
    }

    function run() {
      if (handler.selectors.length || handler.textHints.length) startWatcher(tick, 60000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  };
})();
`;
