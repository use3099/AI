// ===== 核心：接口请求、登录会话、金额换算、通用界面小工具 =====
(function () {
  const t = (k, v) => window.I18N.t(k, v);
  const BASE = (window.SITE && window.SITE.apiBase ? window.SITE.apiBase : location.origin).replace(/\/+$/, '');

  // ---------- 小工具 ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function toast(msg, isErr) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), isErr ? 4200 : 2400);
  }

  async function copy(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    toast(msg || t('c.copied'));
  }

  // 弹窗：返回 { el, close }，内容用 HTML 字符串
  function modal(html, opts) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal panel pad" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); opts && opts.onClose && opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    const first = back.querySelector('input,select,textarea,button');
    if (first) setTimeout(() => first.focus(), 30);
    $$('[data-close]', back).forEach((b) => b.addEventListener('click', close));
    return { el: back, close };
  }

  function confirmBox(text, okLabel, danger) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal(`<p>${esc(text)}</p><div class="foot"><button class="btn ghost" data-close>${t('c.cancel')}</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(okLabel || t('c.confirm'))}</button></div>`,
        { onClose: () => { if (!done) resolve(false); } });
      $('[data-ok]', m.el).addEventListener('click', () => { done = true; m.close(); resolve(true); });
    });
  }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span>'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function fmtTime(sec, withSec) {
    if (!sec || sec < 0) return '-';
    const d = new Date(sec * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}${withSec ? ':' + p(d.getSeconds()) : ''}`;
  }
  function fmtDate(sec) { return fmtTime(sec).slice(0, 10); }
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // ---------- 站点状态（/api/status） ----------
  let statusCache = null;
  async function getStatus(force) {
    if (statusCache && !force) return statusCache;
    try {
      const r = await fetch(BASE + '/api/status', { credentials: 'same-origin', cache: 'no-store' });
      const j = await r.json();
      statusCache = j.data || {};
    } catch (e) {
      statusCache = statusCache || {};
    }
    return statusCache;
  }

  // ---------- 金额：额度(quota) ⇄ 显示金额 ----------
  function money() {
    const s = statusCache || {};
    const qpu = Number(s.quota_per_unit) || 500000;
    const type = s.quota_display_type || (s.display_in_currency === false ? 'TOKENS' : 'USD');
    let sym = '$', rate = 1;
    if (type === 'CNY') { sym = '¥'; rate = Number(s.usd_exchange_rate) || 7.3; }
    else if (type === 'CUSTOM') { sym = s.custom_currency_symbol || '¤'; rate = Number(s.custom_currency_exchange_rate) || 1; }
    return { qpu, type, sym, rate };
  }
  // 额度 → "$1.23"
  function fmtQuota(quota, digits) {
    const m = money();
    if (m.type === 'TOKENS') return fmtNum(quota);
    const v = (Number(quota) || 0) / m.qpu * m.rate;
    let d = digits;
    if (d == null) d = Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 2 : Math.abs(v) >= 0.01 ? 4 : v === 0 ? 2 : 6;
    return m.sym + v.toFixed(d);
  }
  // 美元价格（模型价格表用）→ 显示货币
  function fmtUsd(usd) {
    const m = money();
    const sym = m.type === 'TOKENS' ? '$' : m.sym;
    const rate = m.type === 'TOKENS' ? 1 : m.rate;
    const v = usd * rate;
    const d = v >= 100 ? 2 : v >= 1 ? 2 : v >= 0.01 ? 3 : 4;
    return sym + Number(v.toFixed(d)).toString();
  }
  // 显示金额 → 额度（创建密钥填额度上限时用）
  function toQuota(display) {
    const m = money();
    if (m.type === 'TOKENS') return Math.round(Number(display) || 0);
    return Math.round((Number(display) || 0) / m.rate * m.qpu);
  }

  // ---------- 登录会话 ----------
  // access token 只放内存；刷新靠 HttpOnly 的 new_api_refresh cookie
  const auth = { token: '', exp: 0, sid: '', user: null };
  let refreshing = null;
  let refreshTimer = null;
  const listeners = new Set();

  function hasSessionHint() { return /(?:^|;\s*)new_api_has_session=1/.test(document.cookie); }

  function acceptBundle(d) {
    if (!d || !d.access_token) return false;
    auth.token = d.access_token;
    auth.exp = Number(d.access_expires_at) || 0;
    if (d.session && d.session.sid) auth.sid = d.session.sid;
    if (d.user) auth.user = d.user;
    scheduleRefresh();
    listeners.forEach((fn) => fn(auth));
    return true;
  }
  function clearAuth() {
    auth.token = ''; auth.exp = 0; auth.sid = ''; auth.user = null;
    clearTimeout(refreshTimer);
    listeners.forEach((fn) => fn(auth));
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    if (!auth.exp) return;
    const ms = auth.exp * 1000 - Date.now() - 60000;
    refreshTimer = setTimeout(() => { if (document.visibilityState === 'visible') refresh(); }, Math.max(ms, 5000));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && auth.token && auth.exp * 1000 - Date.now() < 60000) refresh();
  });

  // 刷新登录：多个请求同时 401 时只刷新一次
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const delays = [80, 200, 500];
      let useSid = true;
      for (let attempt = 0; attempt < 5; attempt++) {
        let r;
        try {
          const headers = { 'Cache-Control': 'no-cache' };
          if (useSid && auth.sid) headers['X-Auth-Session'] = auth.sid;
          r = await fetch(BASE + '/api/user/auth/refresh', { method: 'POST', credentials: 'same-origin', headers });
        } catch (e) {
          return 'network';
        }
        let j = {};
        try { j = await r.json(); } catch (e) {}
        if (r.ok && j.success && acceptBundle(j.data)) return 'ok';
        if (r.status === 409 && j.code === 'AUTH_REFRESH_RACE' && attempt < delays.length) { await sleep(delays[attempt]); continue; }
        if (r.status === 409 && j.code === 'AUTH_SESSION_MISMATCH' && useSid) { useSid = false; auth.sid = ''; continue; }
        if (r.status === 401 || r.status === 409) { clearAuth(); return 'anonymous'; }
        return 'error';
      }
      return 'error';
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function bootstrap() {
    await getStatus();
    if (hasSessionHint()) await refresh();
    return !!auth.token;
  }

  class ApiError extends Error {
    constructor(msg, status, code) { super(msg); this.status = status; this.code = code; }
  }

  // 通用请求：自动带 Bearer，401 时刷新后重试一次
  async function api(path, opts) {
    opts = opts || {};
    const method = opts.method || 'GET';
    const doFetch = async () => {
      const headers = Object.assign({ 'Cache-Control': 'no-cache, no-store' }, opts.headers || {});
      if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
      let body;
      if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
      return fetch(BASE + path, { method, headers, body, credentials: 'same-origin' });
    };
    let r;
    try { r = await doFetch(); } catch (e) { throw new ApiError(t('c.network'), 0, 'NETWORK'); }
    if (r.status === 401 && !opts.noRetry) {
      const out = await refresh();
      if (out === 'ok') {
        try { r = await doFetch(); } catch (e) { throw new ApiError(t('c.network'), 0, 'NETWORK'); }
      } else if (out === 'anonymous') {
        onExpired();
        throw new ApiError(t('c.sessionExpired'), 401, 'AUTH_UNAUTHORIZED');
      }
    }
    let j = null;
    const text = await r.text();
    try { j = text ? JSON.parse(text) : {}; } catch (e) {
      throw new ApiError(r.ok ? t('c.error', { m: 'invalid response' }) : `HTTP ${r.status}`, r.status);
    }
    if (r.status === 401) { onExpired(); throw new ApiError(j.message || t('c.sessionExpired'), 401, j.code); }
    // 支付相关接口返回 {message:'success'|'error', data}，其余返回 {success, message, data}
    const ok = j.success === true || j.message === 'success';
    if (!r.ok || !ok) {
      let msg = j.message;
      if (j.message === 'error' && typeof j.data === 'string') msg = j.data;
      throw new ApiError(msg || `HTTP ${r.status}`, r.status, j.code);
    }
    return opts.full ? j : j.data;
  }

  function onExpired() {
    const had = !!auth.user;
    clearAuth();
    if (had) toast(t('c.sessionExpired'), true);
    if (!/^#\/(login|register|forgot|reset|download|pricing)?$/.test(location.hash.split('?')[0] || '#/')) location.hash = '#/login';
  }

  async function loadSelf() {
    const u = await api('/api/user/self');
    auth.user = u;
    listeners.forEach((fn) => fn(auth));
    return u;
  }

  async function logout() {
    try {
      const headers = {};
      if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
      if (auth.sid) headers['X-Auth-Session'] = auth.sid;
      await fetch(BASE + '/api/user/auth/logout', { method: 'POST', credentials: 'same-origin', headers });
    } catch (e) {}
    clearAuth();
    location.hash = '#/login';
  }

  // ---------- 密码加密（后台开启「登录密码加密」时使用） ----------
  let keyCache = null;
  function b64(buf) { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); }
  function pemToDer(pem) {
    const body = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
    const bin = atob(body); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  async function encryptPassword(password) {
    if (!keyCache || Date.now() - keyCache.at > 300000) {
      const d = await api('/api/user/login/encryption-key', { noRetry: true });
      if (!d || !d.enabled) return null;
      keyCache = { kid: d.kid, pem: d.public_key, at: Date.now() };
    }
    try {
      const subtle = crypto.subtle;
      const pub = await subtle.importKey('spki', pemToDer(keyCache.pem), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
      const plain = new TextEncoder().encode(password);
      if (plain.byteLength <= pub.algorithm.modulusLength / 8 - 66) {
        const ct = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, plain);
        return { password_encrypted: b64(ct), encryption_key_id: keyCache.kid };
      }
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      const aes = await subtle.importKey('raw', secret, 'AES-GCM', false, ['encrypt']);
      const wrapped = await subtle.encrypt({ name: 'RSA-OAEP', label: new TextEncoder().encode('password-v2') }, pub, secret);
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new TextEncoder().encode('password-v2:' + keyCache.kid) }, aes, plain);
      return { password_encrypted: ['v2', b64(wrapped), b64(nonce.buffer), b64(ct)].join('.'), encryption_key_id: keyCache.kid };
    } catch (e) {
      keyCache = null;
      throw new ApiError(t('c.error', { m: 'encrypt' }), 0);
    }
  }
  async function passwordFields(password) {
    const s = statusCache || {};
    if (s.password_login_encryption_enabled) {
      const enc = await encryptPassword(password);
      if (enc) return enc;
    }
    return { password };
  }

  // ---------- Cloudflare Turnstile 人机验证（后台开启时） ----------
  let tsLoading = null;
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (tsLoading) return tsLoading;
    tsLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return tsLoading;
  }
  // 在容器里放一个人机验证框，返回 { get(): token, reset() }
  function turnstile(container) {
    const s = statusCache || {};
    if (!s.turnstile_check || !s.turnstile_site_key || !container) return { get: () => '', reset() {}, needed: false };
    let token = '', wid = null;
    loadTurnstile().then(() => {
      wid = window.turnstile.render(container, {
        sitekey: s.turnstile_site_key,
        theme: 'auto',
        callback: (tk) => { token = tk; },
        'expired-callback': () => { token = ''; }
      });
    }).catch(() => {});
    return {
      needed: true,
      get: () => token,
      reset() { token = ''; if (wid != null && window.turnstile) window.turnstile.reset(wid); }
    };
  }

  // 是否运行在 App 外壳里（Capacitor / Electron）
  const inApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || /Electron/i.test(navigator.userAgent);

  window.Core = {
    BASE, esc, $, $$, toast, copy, modal, confirmBox, busy, fmtTime, fmtDate, fmtNum,
    getStatus, money, fmtQuota, fmtUsd, toQuota,
    auth, api, ApiError, refresh, bootstrap, acceptBundle, clearAuth, loadSelf, logout, passwordFields,
    turnstile, inApp, onAuth: (fn) => listeners.add(fn)
  };
})();
