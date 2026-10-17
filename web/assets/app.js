// ===== 页面与路由 =====
(function () {
  const C = window.Core;
  const { esc, $, $$, toast, api, auth } = C;
  const t = (k, v) => window.I18N.t(k, v);
  const SITE = window.SITE || {};
  const root = document.getElementById('app');

  const brandName = () => (window.I18N.lang === 'en' ? (SITE.nameEn || SITE.name) : SITE.name) || 'AI API';
  const apiUrl = () => C.BASE + '/v1';

  // ---------- 图标 ----------
  const I = {
    home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 2 2m-4 0 1.5 1.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.6 3.8-5.5 7-5.5s6 1.9 7 5.5"/>',
    tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    power: '<path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
    down: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M12 9v11M3.5 13h17M12 9S10.5 4 8 4.5 7 9 12 9zm0 0s1.5-5 4-4.5S17 9 12 9z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'
  };
  const icon = (n, size) => `<svg viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  // ---------- 路由 ----------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { path: path || '', q: new URLSearchParams(qs || '') };
  }
  const PUBLIC = { '': pageLanding, login: pageLogin, register: pageRegister, forgot: pageForgot, reset: pageReset, download: pageDownload, pricing: pagePricing };
  const PRIVATE = { dashboard: pageDashboard, keys: pageKeys, topup: pageTopup, billing: pageBilling, me: pageMe };
  let renderSeq = 0;

  async function route() {
    const seq = ++renderSeq;
    const { path, q } = parseHash();
    window.scrollTo(0, 0);
    if (path === '' && (auth.token && C.inApp)) { location.hash = '#/dashboard'; return; }
    if (PRIVATE[path]) {
      if (!auth.token) {
        const out = await C.refresh();
        if (out !== 'ok') { location.hash = '#/login?next=' + encodeURIComponent(path); return; }
      }
      if (seq !== renderSeq) return;
      if (!auth.user) { try { await C.loadSelf(); } catch (e) { return; } }
      if (seq !== renderSeq) return;
      shell(path);
      try { await PRIVATE[path]($('#page'), q, () => seq === renderSeq); }
      catch (e) { if (seq === renderSeq && e.status !== 401) errorBox($('#page'), e); }
      return;
    }
    if ((path === 'login' || path === 'register') && auth.token) { location.hash = '#/dashboard'; return; }
    const fn = PUBLIC[path] || pageLanding;
    try { await fn(root, q, () => seq === renderSeq); } catch (e) { errorBox(root, e); }
  }

  function errorBox(el, e) {
    el.innerHTML = `<div class="empty"><h3>${esc(t('c.error', { m: e.message || e }))}</h3><button class="btn ghost" id="retry">${t('c.retry')}</button></div>`;
    $('#retry', el).onclick = route;
  }
  const loading = () => '<div class="loading"><div class="spinner"></div></div>';

  // ---------- 外壳：侧栏 / 底部标签栏 ----------
  const NAV = [['dashboard', 'home', 'nav.home'], ['keys', 'key', 'nav.keys'], ['topup', 'wallet', 'nav.topup'], ['billing', 'list', 'nav.billing'], ['me', 'user', 'nav.me']];
  function shell(active) {
    const navLinks = (cls) => NAV.map(([p, ic, k]) => `<a href="#/${p}" class="${p === active ? 'on' : ''}" ${p === active ? 'aria-current="page"' : ''}>${icon(ic, cls ? 22 : 19)}<span>${t(k)}</span></a>`).join('');
    root.innerHTML = `
      <div class="shell">
        <aside class="side">
          <a class="brand" href="#/">${logo()}<span>${esc(brandName())}</span></a>
          <nav class="nav">${navLinks()}<a href="#/pricing">${icon('tag', 19)}<span>${t('nav.pricing')}</span></a></nav>
          <div class="side-foot nav">
            ${C.inApp ? '' : `<a href="#/download">${icon('down', 19)}<span>${t('nav.download')}</span></a>`}
            ${SITE.support && SITE.support.url ? `<a href="${esc(SITE.support.url)}" target="_blank" rel="noopener">${icon('chat', 19)}<span>${t('me.support')}</span></a>` : ''}
            <a href="#" id="side-logout">${icon('out', 19)}<span>${t('nav.logout')}</span></a>
          </div>
        </aside>
        <div>
          <header class="mobile-head"><a class="brand" href="#/dashboard">${logo()}<span>${esc(brandName())}</span></a>
            <a class="iconbtn" href="#/pricing" aria-label="${t('nav.pricing')}">${icon('tag')}</a></header>
          <main class="main" id="page">${loading()}</main>
        </div>
        <nav class="tabbar">${navLinks(true)}</nav>
      </div>`;
    $('#side-logout').onclick = (e) => { e.preventDefault(); C.logout(); };
  }
  const logo = () => `<img src="/favicon.svg" alt="" width="30" height="30">`;
  const head = (title, sub, actions) => `<div class="page-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${actions || ''}</div>`;

  function langSelect(id) {
    return `<select class="lang-pick" id="${id}" aria-label="${t('me.lang')}">${window.I18N.langs.map(([v, n]) => `<option value="${v}" ${v === window.I18N.lang ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  }
  function bindLang(id) { const s = document.getElementById(id); if (s) s.onchange = () => { window.I18N.set(s.value); route(); }; }

  // =====================================================================
  // 首页
  // =====================================================================
  async function pageLanding(el) {
    document.title = brandName();
    const loggedIn = !!auth.token;
    const webApp = SITE.webApp === undefined ? '/app/' : SITE.webApp;
    const dl = SITE.downloads || {};
    const apps = [
      dl.android ? { href: dl.android, name: 'Android', meta: t('land.app.apk') } : null,
      dl.windows ? { href: dl.windows, name: 'Windows', meta: t('land.app.exe') } : null,
      dl.mac ? { href: dl.mac, name: 'macOS', meta: t('land.app.dmg') } : null,
    ].filter(Boolean);
    el.innerHTML = `
      <div class="landing">
        <header class="topbar">
          <a class="brand" href="#/">${logo()}<span>${esc(brandName())}</span></a>
          <nav class="topnav" aria-label="${t('nav.main')}">
            <a href="#/pricing">${t('land.allPrices')}</a>
            ${C.inApp ? '' : `<a href="#/download">${t('nav.download')}</a>`}
          </nav>
          <div class="row">
            ${langSelect('lang-top')}
            ${loggedIn ? `<a class="btn sm" href="#/dashboard">${t('nav.console')}</a>`
              : `<a class="btn plain" href="#/login">${t('land.login')}</a>${webApp && !C.inApp ? `<a class="btn sm dark" href="${esc(webApp)}">${t('land.web')}</a>` : ''}`}
          </div>
        </header>
        <section class="hero">
          <div class="hero-copy">
            <h1 class="serif">${revealTitle(t('land.title'))}</h1>
            <p class="rise" style="--d:1">${esc(t('land.sub'))}</p>
            <div class="endpoint rise" style="--d:2" title="${t('land.endpoint')}"><span class="muted">${t('land.endpoint')}</span><b>${esc(apiUrl())}</b>
              <button class="iconbtn" id="copy-ep" aria-label="${t('c.copy')}">${icon('copy', 18)}</button></div>
            <div class="hero-cta rise" style="--d:3">
              ${loggedIn ? `<a class="btn" href="#/dashboard">${t('nav.console')}</a>` : `<a class="btn" href="#/register">${t('land.start')}</a>`}
              <a class="btn ghost" href="#/pricing">${t('land.allPrices')}</a>
            </div>
          </div>
          <div class="confluence" id="board"></div>
        </section>
        <section class="facts">
          <div class="fact"><h3>${t('land.f1.t')}</h3><p>${t('land.f1.p')}</p></div>
          <div class="fact"><h3>${t('land.f2.t')}</h3><p>${t('land.f2.p')}</p></div>
          <div class="fact"><h3>${t('land.f3.t')}</h3><p>${t('land.f3.p')}</p></div>
        </section>
        <section class="dev">
          <div class="dev-in">
            <div>
              <h2 class="serif">${esc(t('land.dev.t')).replace('\n', '<br>')}</h2>
              <p>${esc(t('land.dev.p'))}</p>
              ${loggedIn ? `<a class="btn outline-light" href="#/keys">${t('land.dev.keys')}</a>` : `<a class="btn outline-light" href="#/register">${t('land.start')}</a>`}
            </div>
            <div class="code-win"><div class="code-bar"><i></i><i></i><i></i></div>
<pre><span class="k">from</span> openai <span class="k">import</span> OpenAI

client = OpenAI(
    base_url=<span class="s">"${esc(apiUrl())}"</span>,
    api_key=<span class="s">"sk-…"</span>,
)
client.chat.completions.create(
    model=<span class="s">"gpt-6-sol"</span>,
    messages=[{<span class="s">"role"</span>: <span class="s">"user"</span>, <span class="s">"content"</span>: <span class="s">"${esc(t('land.dev.hello'))}"</span>}],
)</pre></div>
          </div>
        </section>
        <section class="price-strip" id="price-strip"></section>
        ${apps.length ? `<section class="apps"><h2 class="serif">${t('land.apps')}</h2>
          ${webApp && !C.inApp ? `<p class="apps-web">${t('land.noInstall')}<a href="${esc(webApp)}">${t('land.web')}</a></p>` : ''}
          <div class="app-grid">${apps.map(a => `<a class="app-tile" href="${esc(a.href)}" download><b>${esc(a.name)}</b><span>${esc(a.meta)}</span></a>`).join('')}</div></section>` : ''}
        <footer class="footer">© ${new Date().getFullYear()} ${esc(brandName())}${C.inApp ? '' : ` · <a href="#/download">${t('nav.download')}</a>`}</footer>
      </div>`;
    bindLang('lang-top');
    $('#copy-ep').onclick = () => C.copy(apiUrl());

    let models = (SITE.showcaseModels || []).slice(0, 6);
    let pricing = null;
    try { pricing = await loadPricing(); } catch (e) {}
    if (pricing && pricing.rows.length) {
      const set = new Set(pricing.rows.map((r) => r.name));
      const picked = models.filter((m) => set.has(m));
      models = (picked.length >= 3 ? picked : pricing.rows.slice(0, 6).map((r) => r.name)).slice(0, 6);
      const rows = models.map((m) => pricing.rows.find((r) => r.name === m)).filter(Boolean);
      $('#price-strip', el).innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:12px"><h2>${t('land.prices')}</h2><a class="btn plain" href="#/pricing">${t('land.allPrices')}</a></div>
        <div class="panel table-wrap"><table class="t"><thead><tr><th>${t('bill.model')}</th><th class="num">${t('price.in')}</th><th class="num">${t('price.out')}</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="mono">${esc(r.name)}</td>${r.perCall != null ? `<td class="num" colspan="2">${C.fmtUsd(r.perCall)} / ${t('price.per')}</td>` : `<td class="num">${C.fmtUsd(r.inp)}</td><td class="num">${C.fmtUsd(r.out)}</td>`}</tr>`).join('')}</tbody></table></div>`;
    }
    drawConfluence($('#board', el), models.length ? models : ['claude', 'gpt', 'gemini', 'deepseek']);
  }

  // 标题逐字浮现：中文按字，英文按词内的字母（词不拆行，空格保留）
  function revealTitle(text) {
    let d = 0;
    return text.split('\n').map(line => line.split(/(\s+)/).map(part => {
      if (!part) return '';
      if (/^\s+$/.test(part)) return ' ';
      return `<span class="w">${[...part].map(ch => `<span class="ch" style="--d:${d++}">${esc(ch)}</span>`).join('')}</span>`;
    }).join('')).join('<br>');
  }

  // 首页主视觉「潮线汇流」：十几条发丝细线从左侧散开，汇入一个光点，再接到用户的一个 Key。
  // 带模型名的线上会依次有一束光流过去。
  function drawConfluence(box, models) {
    if (!box) return;
    const W = 1000, H = 560, hx = 800, hy = 280, N = 13;
    const labeled = [1, 4, 6, 8, 11, 2].slice(0, Math.min(models.length, 6)).sort((a, b) => a - b);
    const lines = [];
    for (let i = 0; i < N; i++) {
      const y0 = 30 + (H - 60) * (i / (N - 1));
      let d = '';
      for (let x = 0; x <= hx; x += 16) {
        const k = Math.pow(1 - x / hx, 1.5);
        const y = hy + (y0 - hy) * k + 14 * Math.sin(x / 90 + i * 0.7) * k;
        d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
      }
      lines.push({ d, y0 });
    }
    const tags = labeled.map((li, n) => ({ li, name: (models[n] || '').length > 18 ? models[n].slice(0, 17) + '…' : models[n] }));
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('land.board'))}">
      <defs><radialGradient id="glow"><stop offset="0" stop-color="var(--jade)" stop-opacity=".35"/><stop offset="1" stop-color="var(--jade)" stop-opacity="0"/></radialGradient></defs>
      <g class="strands">${lines.map((l, i) => `<path class="strand${labeled.includes(i) ? ' named' : ''}" d="${l.d}" style="--i:${i}" pathLength="1000"/>`).join('')}</g>
      <g class="flows">${tags.map((tg, n) => `<path class="flow" d="${lines[tg.li].d}" pathLength="1000" style="--n:${n};--c:${tags.length}"/>`).join('')}</g>
      <path class="out" d="M${hx} ${hy} H${W - 34}" pathLength="1000"/>
      <circle class="halo" cx="${hx}" cy="${hy}" r="64" fill="url(#glow)"/>
      <circle class="hub" cx="${hx}" cy="${hy}" r="11"/>
      <circle class="tip" cx="${W - 28}" cy="${hy}" r="6"/>
      <text class="key" x="${hx}" y="${hy + 62}" text-anchor="middle">${esc(t('land.yourKey'))}</text>
      ${tags.map((tg, n) => { const y = lines[tg.li].y0; const w = 32 + tg.name.length * 12.6; return `<g class="tag" style="--n:${n}"><rect x="2" y="${y - 21}" width="${w}" height="42" rx="21"/><text x="${2 + w / 2}" y="${y + 7}" text-anchor="middle">${esc(tg.name)}</text></g>`; }).join('')}
    </svg>`;
  }

  // =====================================================================
  // 登录 / 注册 / 找回密码
  // =====================================================================
  function authFrame(el, title, inner, foot) {
    el.innerHTML = `<div class="auth-wrap"><div class="auth-card">
      <a class="brand" href="#/">${logo()}<span>${esc(brandName())}</span></a>
      <div class="panel pad" style="display:grid;gap:18px"><h2>${esc(title)}</h2>${inner}</div>
      ${foot ? `<p class="auth-switch">${foot}</p>` : ''}
      <div class="row" style="justify-content:center">${langSelect('lang-auth')}</div>
    </div></div>`;
    bindLang('lang-auth');
  }

  async function pageLogin(el, q) {
    const st = await C.getStatus();
    document.title = t('auth.login') + ' · ' + brandName();
    authFrame(el, t('auth.login'), `
      <form id="f" novalidate>
        <label class="field"><span>${t('auth.username')}</span><input class="input" name="username" autocomplete="username" required></label>
        <label class="field"><span>${t('auth.password')}</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        <div id="ts"></div>
        <button class="btn block" type="submit">${t('auth.login')}</button>
        <a href="#/forgot" class="small muted" style="justify-self:end;text-decoration:none">${t('auth.forgot')}</a>
      </form>`,
      st.register_enabled === false ? '' : `${t('auth.noAccount')} <a href="#/register">${t('auth.toRegister')}</a>`);
    const ts = C.turnstile($('#ts', el));
    const f = $('#f', el);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const username = f.username.value.trim(), password = f.password.value;
      if (!username || !password) return;
      if (ts.needed && !ts.get()) return toast(t('auth.humanCheck'), true);
      const btn = f.querySelector('button[type=submit]'); C.busy(btn, true);
      try {
        const body = Object.assign({ username }, await C.passwordFields(password));
        const d = await api('/api/user/login' + (ts.get() ? '?turnstile=' + encodeURIComponent(ts.get()) : ''), { method: 'POST', body, noRetry: true });
        if (d && d.require_verification) return twoFactor(d, q);
        finishLogin(d, q);
      } catch (err) { toast(err.message, true); ts.reset(); }
      finally { C.busy(btn, false); }
    };
  }

  function finishLogin(d, q) {
    if (!C.acceptBundle(d)) { toast(t('c.error', { m: 'login' }), true); return; }
    toast(t('auth.welcome'));
    const next = q && q.get('next');
    location.hash = '#/' + (next && /^[a-z]+$/.test(next) ? next : 'dashboard');
  }

  function twoFactor(challenge, q) {
    const has2fa = (challenge.methods || []).some((m) => m.method === '2fa' && m.available !== false);
    const m = C.modal(`<h2>${t('auth.2fa')}</h2><p class="muted">${t('auth.2faHint')}</p>
      <form id="f2" style="display:grid;gap:14px">
        <input class="input" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="${t('auth.2faCode')}" ${has2fa ? '' : 'disabled'}>
        <div class="foot"><button type="button" class="btn ghost" data-close>${t('c.cancel')}</button><button class="btn" type="submit">${t('auth.verify')}</button></div>
      </form>`);
    const f = $('#f2', m.el);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const code = f.code.value.trim(); if (!code) return;
      const btn = f.querySelector('[type=submit]'); C.busy(btn, true);
      try {
        const d = await api('/api/user/login/2fa', { method: 'POST', body: { flow_token: challenge.flow_token, code, method: '2fa' }, noRetry: true });
        m.close(); finishLogin(d, q);
      } catch (err) { toast(err.message, true); }
      finally { C.busy(btn, false); }
    };
  }

  async function pageRegister(el, q) {
    const st = await C.getStatus();
    document.title = t('auth.register') + ' · ' + brandName();
    if (st.register_enabled === false || st.password_register_enabled === false) {
      authFrame(el, t('auth.register'), `<p class="muted">${t('auth.regClosed')}</p><a class="btn ghost" href="#/login">${t('auth.toLogin')}</a>`);
      return;
    }
    const aff = q.get('aff') || (function () { try { return localStorage.getItem('aff') || ''; } catch (e) { return ''; } })();
    if (q.get('aff')) { try { localStorage.setItem('aff', q.get('aff')); } catch (e) {} }
    const needEmail = !!st.email_verification;
    authFrame(el, t('auth.register'), `
      <form id="f" novalidate>
        <label class="field"><span>${t('auth.username')}</span><input class="input" name="username" maxlength="20" autocomplete="username" required></label>
        <label class="field"><span>${t('auth.password')}</span><input class="input" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label>
        <label class="field"><span>${t('auth.password2')}</span><input class="input" name="password2" type="password" autocomplete="new-password" required></label>
        ${needEmail ? `
        <label class="field"><span>${t('auth.email')}</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>${t('auth.code')}</span><div class="row"><input class="input grow" name="code" inputmode="numeric" required><button type="button" class="btn ghost" id="send">${t('auth.sendCode')}</button></div></label>` : ''}
        <label class="field"><span>${t('auth.aff')}</span><input class="input" name="aff" value="${esc(aff)}"></label>
        <div id="ts"></div>
        <button class="btn block" type="submit">${t('auth.register')}</button>
      </form>`,
      `${t('auth.haveAccount')} <a href="#/login">${t('auth.toLogin')}</a>`);
    const ts = C.turnstile($('#ts', el));
    const f = $('#f', el);
    if (needEmail) {
      const send = $('#send', el);
      send.onclick = async () => {
        const email = f.email.value.trim();
        if (!email) return f.email.focus();
        if (ts.needed && !ts.get()) return toast(t('auth.humanCheck'), true);
        C.busy(send, true);
        try {
          await api(`/api/verification?email=${encodeURIComponent(email)}&turnstile=${encodeURIComponent(ts.get())}`, { noRetry: true });
          toast(t('auth.codeSent'));
          C.busy(send, false);
          let n = 60; send.disabled = true;
          const iv = setInterval(() => { n--; send.textContent = t('auth.resend', { n }); if (n <= 0) { clearInterval(iv); send.disabled = false; send.textContent = t('auth.sendCode'); } }, 1000);
          ts.reset();
        } catch (err) { C.busy(send, false); toast(err.message, true); ts.reset(); }
      };
    }
    f.onsubmit = async (e) => {
      e.preventDefault();
      const username = f.username.value.trim(), password = f.password.value;
      if (!username) return f.username.focus();
      if (password.length < 8) return toast(t('auth.pwdShort'), true);
      if (password !== f.password2.value) return toast(t('auth.pwdMismatch'), true);
      if (ts.needed && !ts.get()) return toast(t('auth.humanCheck'), true);
      const body = { username, password, aff_code: f.aff.value.trim() };
      if (needEmail) { body.email = f.email.value.trim(); body.verification_code = f.code.value.trim(); }
      const btn = f.querySelector('[type=submit]'); C.busy(btn, true);
      try {
        await api('/api/user/register' + (ts.get() ? '?turnstile=' + encodeURIComponent(ts.get()) : ''), { method: 'POST', body, noRetry: true });
        try { localStorage.removeItem('aff'); } catch (e2) {}
        // 注册成功后自动登录（未开启人机验证时）
        if (!ts.needed) {
          try {
            const d = await api('/api/user/login', { method: 'POST', body: Object.assign({ username }, await C.passwordFields(password)), noRetry: true });
            if (d && !d.require_verification && C.acceptBundle(d)) { toast(t('auth.welcome')); location.hash = '#/dashboard'; return; }
          } catch (e3) {}
        }
        toast(t('auth.registered'));
        location.hash = '#/login';
      } catch (err) { toast(err.message, true); ts.reset(); }
      finally { C.busy(btn, false); }
    };
  }

  async function pageForgot(el) {
    await C.getStatus();
    authFrame(el, t('auth.forgot').replace(/[？?]$/, ''), `
      <p class="muted">${t('auth.forgotHint')}</p>
      <form id="f" style="display:grid;gap:14px">
        <label class="field"><span>${t('auth.email')}</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <div id="ts"></div>
        <button class="btn block" type="submit">${t('auth.sendReset')}</button>
      </form>`, `<a href="#/login">${t('auth.back')}</a>`);
    const ts = C.turnstile($('#ts', el));
    const f = $('#f', el);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(); if (!email) return;
      if (ts.needed && !ts.get()) return toast(t('auth.humanCheck'), true);
      const btn = f.querySelector('[type=submit]'); C.busy(btn, true);
      try { await api(`/api/reset_password?email=${encodeURIComponent(email)}&turnstile=${encodeURIComponent(ts.get())}`, { noRetry: true }); toast(t('auth.resetSent')); }
      catch (err) { toast(err.message, true); ts.reset(); }
      finally { C.busy(btn, false); }
    };
  }

  // 邮件里的重置链接：后台会生成一个新密码
  async function pageReset(el, q) {
    await C.getStatus();
    authFrame(el, t('auth.forgot').replace(/[？?]$/, ''), loading());
    const box = $('.panel', el);
    try {
      const pwd = await api('/api/user/reset', { method: 'POST', body: { email: q.get('email') || '', token: q.get('token') || '' }, noRetry: true });
      box.innerHTML = `<h2>${t('me.newPwd')}</h2><div class="copyline"><code>${esc(pwd)}</code><button class="iconbtn" id="cp">${icon('copy', 18)}</button></div>
        <a class="btn block" href="#/login">${t('auth.toLogin')}</a>`;
      $('#cp', box).onclick = () => C.copy(pwd);
    } catch (err) {
      box.innerHTML = `<p>${esc(err.message)}</p><a class="btn ghost" href="#/forgot">${t('c.retry')}</a>`;
    }
  }

  // =====================================================================
  // 总览
  // =====================================================================
  async function firstKey() {
    const d = await api('/api/token/?p=1&size=20');
    const items = (d && d.items) || [];
    return items.find((k) => k.status === 1) || items[0] || null;
  }
  const fullKeyCache = {};
  async function fullKey(id) {
    if (!fullKeyCache[id]) { const d = await api(`/api/token/${id}/key`, { method: 'POST' }); fullKeyCache[id] = 'sk-' + String(d.key).replace(/^sk-/, ''); }
    return fullKeyCache[id];
  }

  async function pageDashboard(el, q, alive) {
    const u = auth.user;
    document.title = t('nav.home') + ' · ' + brandName();
    let user = u;
    try { user = await C.loadSelf(); } catch (e) {}
    if (!alive()) return;
    const total = (user.quota || 0) + (user.used_quota || 0);
    const pct = total > 0 ? Math.max(2, Math.round((user.quota / total) * 100)) : 0;
    const low = user.quota < C.money().qpu * 1;
    el.innerHTML = `
      ${head(t('home.hello', { name: user.display_name || user.username }), '')}
      <div class="dash">
        <section class="panel pad wallet">
          <div class="row" style="justify-content:space-between"><span class="muted">${t('home.balance')}</span><a class="btn sm" href="#/topup">${icon('plus', 16)}${t('home.topup')}</a></div>
          <div class="amount">${esc(C.fmtQuota(user.quota, 2))}</div>
          <div class="meter" title="${pct}%"><i style="width:${pct}%"></i></div>
          <div class="stats">
            <div><b>${esc(C.fmtQuota(user.used_quota, 2))}</b><span>${t('home.used')}</span></div>
            <div><b>${C.fmtNum(user.request_count)}</b><span>${t('home.requests')}</span></div>
            <div><b>${esc(user.group || 'default')}</b><span>${t('me.group')}</span></div>
          </div>
          ${low ? `<div class="notice">${t('home.low')}</div>` : ''}
        </section>
        <section class="panel pad connect" id="connect">${loading()}</section>
        <section class="panel pad full" id="quick"></section>
        <section class="panel full" id="usage"></section>
      </div>`;

    // 接入信息
    let key = null;
    try { key = await firstKey(); } catch (e) {}
    if (!alive()) return;
    const cbox = $('#connect', el);
    let shownKey = key ? 'sk-' + String(key.key).replace(/^sk-/, '') : '';
    const renderConnect = () => {
      cbox.innerHTML = `<h3>${t('home.connect')}</h3>
        <div class="kv"><span>${t('home.baseUrl')}</span><div class="copyline"><code>${esc(apiUrl())}</code><button class="iconbtn" data-copy="base" aria-label="${t('c.copy')}">${icon('copy', 18)}</button></div></div>
        <div class="kv"><span>${t('home.key')}${key ? ` · ${esc(key.name)}` : ''}</span>
          ${key ? `<div class="copyline"><code>${esc(shownKey)}</code><button class="iconbtn" data-reveal aria-label="eye">${icon('eye', 18)}</button><button class="iconbtn" data-copy="key" aria-label="${t('c.copy')}">${icon('copy', 18)}</button></div>`
            : `<div class="row"><span class="muted grow">${t('home.noKey')}</span><button class="btn sm" id="mk">${icon('plus', 16)}${t('home.createKey')}</button></div>`}
        </div>`;
      const cb = $('[data-copy=base]', cbox); cb.onclick = () => C.copy(apiUrl());
      const ck = $('[data-copy=key]', cbox);
      if (ck) ck.onclick = async () => { try { C.copy(await fullKey(key.id), t('keys.copied')); } catch (e) { toast(e.message, true); } };
      const rv = $('[data-reveal]', cbox);
      if (rv) rv.onclick = async () => { try { shownKey = await fullKey(key.id); renderConnect(); renderQuick(); } catch (e) { toast(e.message, true); } };
      const mk = $('#mk', cbox);
      if (mk) mk.onclick = async () => {
        C.busy(mk, true);
        try {
          await api('/api/token/', { method: 'POST', body: { name: 'default', remain_quota: 0, unlimited_quota: true, expired_time: -1, model_limits_enabled: false, model_limits: '', allow_ips: '', group: '' } });
          key = await firstKey(); shownKey = key ? await fullKey(key.id) : '';
          renderConnect(); renderQuick(); toast(t('keys.created'));
        } catch (e) { toast(e.message, true); C.busy(mk, false); }
      };
    };
    renderConnect();

    // 快速开始代码
    let tab = 'curl';
    const renderQuick = () => {
      const k = shownKey || 'sk-xxxx';
      const base = apiUrl(), host = C.BASE;
      const model = (SITE.showcaseModels && SITE.showcaseModels[0]) || 'gpt-4o-mini';
      const S = (s) => `<span class="s">${esc(s)}</span>`, K = (s) => `<span class="k">${esc(s)}</span>`, Cm = (s) => `<span class="c">${esc(s)}</span>`;
      const code = {
        curl: `${K('curl')} ${S(base + '/chat/completions')} \\\n  -H ${S('Authorization: Bearer ' + k)} \\\n  -H ${S('Content-Type: application/json')} \\\n  -d ${S(`{"model":"${model}","messages":[{"role":"user","content":"你好"}]}`)}`,
        python: `${K('from')} openai ${K('import')} OpenAI\n\nclient = OpenAI(base_url=${S(base)}, api_key=${S(k)})\nr = client.chat.completions.create(\n    model=${S(model)},\n    messages=[{${S('role')}: ${S('user')}, ${S('content')}: ${S('你好')}}],\n)\n${K('print')}(r.choices[0].message.content)`,
        claude: `${Cm('# ' + t('home.claudeCode'))}\n${K('export')} ANTHROPIC_BASE_URL=${S(host)}\n${K('export')} ANTHROPIC_AUTH_TOKEN=${S(k)}\nclaude`
      };
      $('#quick', el).innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:12px;flex-wrap:wrap"><h3>${t('home.quick')}</h3>
        <div class="seg" role="tablist">${['curl', 'python', 'claude'].map((x) => `<button role="tab" data-tab="${x}" class="${x === tab ? 'on' : ''}">${x === 'claude' ? 'Claude Code' : x === 'python' ? 'Python' : 'cURL'}</button>`).join('')}</div></div>
        <div style="position:relative"><pre class="code">${code[tab]}</pre><button class="iconbtn" id="cpq" style="position:absolute;top:8px;right:8px;color:#9fb0c6" aria-label="${t('c.copy')}">${icon('copy', 18)}</button></div>`;
      $$('[data-tab]', el).forEach((b) => b.onclick = () => { tab = b.dataset.tab; renderQuick(); });
      $('#cpq', el).onclick = () => { const tmp = document.createElement('div'); tmp.innerHTML = code[tab]; C.copy(tmp.textContent); };
    };
    renderQuick();

    // 最近 7 天消费 + 最近调用
    const now = Math.floor(Date.now() / 1000);
    const start = now - 6 * 86400;
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const dayStart = Math.floor(day0.getTime() / 1000) - 6 * 86400;
    let logs = [];
    try { const d = await api(`/api/log/self?p=1&page_size=100&type=2&start_timestamp=${dayStart}&end_timestamp=${now}`); logs = (d && d.items) || []; } catch (e) {}
    let rows = [];
    try { rows = (await api(`/api/data/self?start_timestamp=${dayStart}&end_timestamp=${now}`)) || []; } catch (e) {}
    if (!alive()) return;
    const days = Array.from({ length: 7 }, (_, i) => ({ ts: dayStart + i * 86400, q: 0 }));
    const src = rows.length ? rows.map((r) => ({ at: r.created_at, q: r.quota })) : logs.map((l) => ({ at: l.created_at, q: l.quota }));
    src.forEach((r) => { const i = Math.floor((r.at - dayStart) / 86400); if (i >= 0 && i < 7) days[i].q += r.q || 0; });
    const max = Math.max(...days.map((d) => d.q), 1);
    const chart = `<svg class="chart" viewBox="0 0 700 150" preserveAspectRatio="none" role="img" aria-label="${t('home.usage')}">
      ${days.map((d, i) => { const h = d.q > 0 ? Math.max(4, (d.q / max) * 146) : 2; return `<rect class="bar ${i === 6 ? 'today' : ''}" x="${i * 100 + 14}" y="${150 - h}" width="72" height="${h}" rx="5"><title>${C.fmtDate(d.ts)}  ${C.fmtQuota(d.q)}</title></rect>`; }).join('')}
    </svg><div class="chart-x">${days.map((d) => `<span>${C.fmtDate(d.ts).slice(5)}</span>`).join('')}</div>`;
    const sum = days.reduce((a, d) => a + d.q, 0);
    const recent = logs.slice(0, 5);
    $('#usage', el).innerHTML = `
      <div class="pad" style="padding-bottom:4px"><div class="row" style="justify-content:space-between"><h3>${t('home.usage')}</h3><b>${esc(C.fmtQuota(sum))}</b></div>${chart}</div>
      <div class="row pad" style="justify-content:space-between;padding-top:4px;padding-bottom:8px"><h3>${t('home.recent')}</h3><a class="btn plain" href="#/billing">${t('home.viewAll')}</a></div>
      ${recent.length ? `<div class="list">${recent.map(logItem).join('')}</div>` : `<div class="empty" style="padding-top:12px"><p>${t('bill.emptyP')}</p></div>`}`;
  }

  function logItem(l) {
    return `<div class="item"><div class="grow"><div class="name mono">${esc(l.model_name || typeName(l.type))}</div>
      <div class="meta"><span>${C.fmtTime(l.created_at)}</span>${l.token_name ? `<span>${esc(l.token_name)}</span>` : ''}${l.prompt_tokens || l.completion_tokens ? `<span>${C.fmtNum(l.prompt_tokens)} / ${C.fmtNum(l.completion_tokens)} tokens</span>` : ''}${l.use_time ? `<span>${l.use_time}s</span>` : ''}</div></div>
      <b>${l.type === 2 ? '-' : l.type === 1 || l.type === 6 ? '+' : ''}${esc(C.fmtQuota(l.quota))}</b></div>`;
  }
  const typeName = (ty) => ({ 1: t('bill.topup'), 2: t('bill.consume'), 3: t('bill.manage'), 4: t('bill.system'), 5: t('bill.error'), 6: t('bill.refund') }[ty] || '-');

  // =====================================================================
  // 密钥
  // =====================================================================
  async function pageKeys(el, q, alive) {
    document.title = t('keys.title') + ' · ' + brandName();
    let page = 1; const size = 20;
    el.innerHTML = head(t('keys.title'), t('keys.sub'), `<button class="btn" id="new">${icon('plus', 18)}${t('keys.create')}</button>`) + `<div class="panel" id="list">${loading()}</div>`;
    $('#new', el).onclick = () => keyForm(null, load);

    async function load() {
      const d = await api(`/api/token/?p=${page}&size=${size}`);
      if (!alive()) return;
      const items = (d && d.items) || [];
      const totalPages = Math.max(1, Math.ceil((d.total || 0) / size));
      const box = $('#list', el);
      if (!items.length && page === 1) {
        box.innerHTML = `<div class="empty">${icon('key', 32)}<h3>${t('keys.empty')}</h3><p>${t('keys.emptyP')}</p><button class="btn" id="new2">${t('keys.create')}</button></div>`;
        $('#new2', box).onclick = () => keyForm(null, load);
        return;
      }
      box.innerHTML = `<div class="list">${items.map((k) => {
        const st = k.status === 1 ? ['ok', t('keys.on')] : k.status === 3 ? ['warn', t('keys.expired')] : k.status === 4 ? ['warn', t('keys.exhausted')] : ['bad', t('keys.off')];
        return `<div class="item" data-id="${k.id}">
          <div class="grow">
            <div class="row" style="gap:8px"><span class="name">${esc(k.name || '-')}</span><span class="chip ${st[0]}"><i class="dot"></i>${st[1]}</span></div>
            <div class="meta"><span class="mono">sk-${esc(String(k.key).replace(/^sk-/, ''))}</span>
              <span>${t('keys.used', { v: C.fmtQuota(k.used_quota) })}</span>
              <span>${k.unlimited_quota ? t('keys.noLimit') : t('keys.left', { v: C.fmtQuota(k.remain_quota) })}</span>
              ${k.expired_time > 0 ? `<span>${t('keys.expires', { d: C.fmtDate(k.expired_time) })}</span>` : ''}</div>
          </div>
          <div class="acts">
            <button class="iconbtn" data-act="copy" title="${t('keys.copy')}" aria-label="${t('keys.copy')}">${icon('copy', 19)}</button>
            <button class="iconbtn" data-act="edit" title="${t('keys.edit')}" aria-label="${t('keys.edit')}">${icon('edit', 19)}</button>
            <button class="iconbtn" data-act="toggle" title="${k.status === 1 ? t('keys.disable') : t('keys.enable')}" aria-label="${k.status === 1 ? t('keys.disable') : t('keys.enable')}">${icon('power', 19)}</button>
            <button class="iconbtn" data-act="del" title="${t('keys.delete')}" aria-label="${t('keys.delete')}">${icon('trash', 19)}</button>
          </div></div>`;
      }).join('')}</div>
      ${totalPages > 1 ? `<div class="pager"><button class="btn ghost sm" id="prev" ${page <= 1 ? 'disabled' : ''}>${t('bill.prev')}</button><span>${t('bill.page', { p: page })} / ${totalPages}</span><button class="btn ghost sm" id="next" ${page >= totalPages ? 'disabled' : ''}>${t('bill.next')}</button></div>` : ''}`;
      const pv = $('#prev', box), nx = $('#next', box);
      if (pv) pv.onclick = () => { page--; load(); };
      if (nx) nx.onclick = () => { page++; load(); };
      $$('.item', box).forEach((row) => {
        const k = items.find((x) => String(x.id) === row.dataset.id);
        $$('[data-act]', row).forEach((b) => b.onclick = async () => {
          const act = b.dataset.act;
          try {
            if (act === 'copy') C.copy(await fullKey(k.id), t('keys.copied'));
            if (act === 'edit') keyForm(k, load);
            if (act === 'toggle') {
              await api('/api/token/?status_only=true', { method: 'PUT', body: { id: k.id, status: k.status === 1 ? 2 : 1 } });
              toast(t('keys.saved')); load();
            }
            if (act === 'del') {
              if (!(await C.confirmBox(t('keys.delConfirm', { name: k.name }), t('keys.delete'), true))) return;
              await api(`/api/token/${k.id}`, { method: 'DELETE' });
              toast(t('keys.deleted')); load();
            }
          } catch (e) { toast(e.message, true); }
        });
      });
    }
    await load();
  }

  function keyForm(k, onDone) {
    const isEdit = !!k;
    const m = C.money();
    const limitVal = k && !k.unlimited_quota ? (m.type === 'TOKENS' ? k.remain_quota : (k.remain_quota / m.qpu * m.rate).toFixed(2)) : '';
    const md = C.modal(`<h2>${isEdit ? t('keys.edit') : t('keys.create')}</h2>
      <form id="kf" style="display:grid;gap:14px">
        <label class="field"><span>${t('keys.name')}</span><input class="input" name="name" maxlength="50" placeholder="${t('keys.namePh')}" value="${esc(k ? k.name : '')}" required></label>
        <label class="check"><input type="checkbox" name="unl" ${!k || k.unlimited_quota ? 'checked' : ''}> ${t('keys.unlimited')}</label>
        <label class="field" id="lim"><span>${t('keys.limit')} (${m.type === 'TOKENS' ? 'quota' : m.sym})</span><input class="input" name="limit" type="number" min="0" step="0.01" placeholder="${t('keys.limitPh')}" value="${esc(limitVal)}"></label>
        ${isEdit ? '' : `<label class="field"><span>${t('keys.expire')}</span><select class="input" name="exp">
          <option value="-1">${t('keys.never')}</option><option value="1">${t('keys.d1')}</option><option value="30">${t('keys.d30')}</option><option value="90">${t('keys.d90')}</option><option value="365">${t('keys.d365')}</option></select></label>`}
        <label class="field"><span>${t('keys.models')}</span><input class="input mono" name="models" placeholder="gpt-4o-mini, claude-sonnet-4-5" value="${esc(k && k.model_limits_enabled ? k.model_limits : '')}"></label>
        <div class="foot"><button type="button" class="btn ghost" data-close>${t('c.cancel')}</button><button class="btn" type="submit">${t('c.save')}</button></div>
      </form>`);
    const f = $('#kf', md.el);
    const sync = () => { $('#lim', md.el).classList.toggle('hidden', f.unl.checked); };
    f.unl.onchange = sync; sync();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(); if (!name) return f.name.focus();
      const models = f.models.value.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).join(',');
      const unlimited = f.unl.checked;
      const body = Object.assign({}, k || {}, {
        name,
        unlimited_quota: unlimited,
        remain_quota: unlimited ? (k ? k.remain_quota : 0) : C.toQuota(f.limit.value),
        model_limits_enabled: !!models,
        model_limits: models
      });
      if (!isEdit) {
        const days = Number(f.exp.value);
        Object.assign(body, { expired_time: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : -1, allow_ips: '', group: '' });
      } else {
        delete body.key; // 列表里的 key 是打码的，不回传
      }
      const btn = f.querySelector('[type=submit]'); C.busy(btn, true);
      try {
        await api('/api/token/', { method: isEdit ? 'PUT' : 'POST', body });
        md.close(); toast(isEdit ? t('keys.saved') : t('keys.created')); onDone && onDone();
      } catch (err) { toast(err.message, true); C.busy(btn, false); }
    };
  }

  // =====================================================================
  // 充值
  // =====================================================================
  const PM_STYLE = { alipay: ['#1677FF', '支'], wxpay: ['#07C160', '微'], qqpay: ['#12B7F5', 'Q'], usdt: ['#26A17B', '₮'], stripe: ['#635BFF', 'S'] };
  function pmLabel(p) { const k = 'top.' + p.type; const s = t(k); return s === k ? p.name : s; }

  async function pageTopup(el, q, alive) {
    document.title = t('top.title') + ' · ' + brandName();
    el.innerHTML = head(t('top.title'), t('top.sub')) + loading();
    const info = await api('/api/user/topup/info');
    if (!alive()) return;
    const m = C.money();
    const methods = (info.pay_methods || []).filter((p) => p.type && !/stripe|creem|waffo/i.test(p.type));
    const online = info.enable_online_topup && methods.length;
    const options = (info.amount_options && info.amount_options.length ? info.amount_options : [10, 20, 50, 100, 200, 500]);
    const discount = info.discount || {};
    // 充值金额按「美元额度」计，显示时换成站点的显示货币（人民币模式下 $1 显示为 ¥7.3）
    const amt = (a) => { if (m.type === 'TOKENS') return C.fmtNum(a); const v = Number(a) * m.rate; return m.sym + (Number.isInteger(v) ? v : v.toFixed(2)); };
    let amount = options[1] || options[0];
    let method = methods[0] && methods[0].type;

    el.innerHTML = head(t('top.title'), t('top.sub')) + `
      ${q.get('paid') ? `<div class="notice info" style="margin-bottom:16px">${t('top.paid')}</div>` : ''}
      <div class="topup">
        <section class="panel pad" style="display:grid;gap:18px">
          ${online ? `
          <div class="field"><span>${t('top.amount')}</span>
            <div class="amounts">${options.map((a) => `<button type="button" data-amt="${a}">${amt(a)}${discount[a] && discount[a] < 1 ? `<small>${t('top.discount', { d: window.I18N.lang === 'en' ? discount[a] : +(discount[a] * 10).toFixed(1) })}</small>` : ''}</button>`).join('')}</div></div>
          <label class="field"><span>${t('top.custom')} · ${t('top.min', { v: amt(info.min_topup || 1) })}</span><input class="input" id="custom" type="number" min="${info.min_topup || 1}" step="1" inputmode="numeric"></label>
          <div class="field"><span>${t('top.method')}</span><div class="paymethods">${methods.map((p) => { const s = PM_STYLE[p.type] || [p.color || 'var(--slate)', (p.name || '?')[0]]; return `<button type="button" data-pm="${esc(p.type)}"><span class="pm-ico" style="background:${esc(s[0])}">${esc(s[1])}</span>${esc(pmLabel(p))}</button>`; }).join('')}</div></div>
          ` : `<div class="notice">${t('top.disabled')}</div>`}
        </section>
        <aside style="display:grid;gap:18px">
          ${online ? `<section class="panel pad summary">
            <div class="line"><span class="muted">${t('top.get')}</span><b id="get"></b></div>
            <div class="line" style="align-items:baseline"><span class="muted">${t('top.payable')}</span><span class="total" id="pay">-</span></div>
            <button class="btn block" id="go">${t('top.pay')}</button>
          </section>` : ''}
          ${info.enable_redemption !== false ? `<section class="panel pad" style="display:grid;gap:12px">
            <h3>${t('top.redeem')}</h3>
            <div class="row"><input class="input grow" id="code" placeholder="${t('top.redeemPh')}" autocomplete="off"><button class="btn ghost" id="redeem">${t('top.redeemBtn')}</button></div>
          </section>` : ''}
        </aside>
        <section class="panel full" style="grid-column:1/-1" id="hist">${loading()}</section>
      </div>`;

    if (online) {
      let timer = null, seq = 0;
      const quote = () => {
        clearTimeout(timer);
        $('#get', el).textContent = amt(amount);
        $('#pay', el).textContent = '…';
        timer = setTimeout(async () => {
          const my = ++seq;
          try {
            const price = await api('/api/user/amount', { method: 'POST', body: { amount: Number(amount) } });
            if (my === seq) $('#pay', el).textContent = '¥' + price;
          } catch (e) { if (my === seq) $('#pay', el).textContent = '-'; }
        }, 250);
      };
      const mark = () => {
        $$('[data-amt]', el).forEach((b) => b.classList.toggle('on', Number(b.dataset.amt) === Number(amount) && !$('#custom', el).value));
        $$('[data-pm]', el).forEach((b) => b.classList.toggle('on', b.dataset.pm === method));
      };
      $$('[data-amt]', el).forEach((b) => b.onclick = () => { amount = Number(b.dataset.amt); $('#custom', el).value = ''; mark(); quote(); });
      $$('[data-pm]', el).forEach((b) => b.onclick = () => { method = b.dataset.pm; mark(); });
      $('#custom', el).oninput = (e) => { const v = Math.floor(Number(e.target.value)); if (v > 0) { amount = v; quote(); } mark(); };
      mark(); quote();
      $('#go', el).onclick = async () => {
        const min = Number(info.min_topup) || 1;
        if (Number(amount) < min) return toast(t('top.min', { v: amt(min) }), true);
        const btn = $('#go', el); C.busy(btn, true);
        try {
          const j = await api('/api/user/pay', { method: 'POST', body: { amount: Number(amount), payment_method: method }, full: true });
          toast(t('top.jumping'));
          submitPayForm(j.url, j.data);
        } catch (e) { toast(e.message, true); }
        finally { C.busy(btn, false); }
      };
    }
    const rd = $('#redeem', el);
    if (rd) rd.onclick = async () => {
      const key = $('#code', el).value.trim(); if (!key) return $('#code', el).focus();
      C.busy(rd, true);
      try { const q2 = await api('/api/user/topup', { method: 'POST', body: { key } }); toast(t('top.redeemed', { v: C.fmtQuota(q2) })); $('#code', el).value = ''; C.loadSelf().catch(() => {}); loadHist(); }
      catch (e) { toast(e.message, true); }
      finally { C.busy(rd, false); }
    };

    async function loadHist() {
      let items = [];
      try { const d = await api('/api/user/topup/self?p=1&page_size=10'); items = (d && d.items) || []; } catch (e) {}
      if (!alive()) return;
      const stc = { success: 'ok', pending: 'warn', expired: '', failed: 'bad' };
      $('#hist', el).innerHTML = `<div class="pad" style="padding-bottom:6px"><h3>${t('top.history')}</h3></div>` + (items.length ? `<div class="list">${items.map((r) => `
        <div class="item"><div class="grow"><div class="name">${esc(amt(r.amount))}</div><div class="meta"><span>${C.fmtTime(r.create_time)}</span><span>${esc(pmLabel({ type: r.payment_method, name: r.payment_method }))}</span><span class="mono">${esc(r.trade_no)}</span></div></div>
        <div style="text-align:right"><b>¥${Number(r.money || 0).toFixed(2)}</b><div><span class="chip ${stc[r.status] || ''}">${t('top.status.' + r.status) === 'top.status.' + r.status ? esc(r.status) : t('top.status.' + r.status)}</span></div></div></div>`).join('')}</div>`
        : `<div class="empty" style="padding-top:10px"><p>${t('top.noHistory')}</p></div>`);
    }
    loadHist();
  }

  // 易支付：把参数做成表单 POST 过去（当前窗口打开，付完会跳回账单页）
  function submitPayForm(url, params) {
    const form = document.createElement('form');
    form.action = url; form.method = 'POST'; form.style.display = 'none';
    Object.entries(params || {}).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = String(v); form.appendChild(i); });
    document.body.appendChild(form);
    form.submit();
  }

  // =====================================================================
  // 账单
  // =====================================================================
  async function pageBilling(el, q, alive) {
    document.title = t('bill.title') + ' · ' + brandName();
    const st = { type: 2, range: 7, model: '', token: '', page: 1 };
    const size = 20;
    el.innerHTML = head(t('bill.title'), t('bill.sub')) + `
      ${q.get('paid') ? `<div class="notice info" style="margin-bottom:16px">${t('top.paid')}</div>` : ''}
      <div class="toolbar">
        <div class="seg" id="types">${[[2, 'bill.consume'], [1, 'bill.topup'], [5, 'bill.error'], [0, 'bill.all']].map(([v, k]) => `<button data-type="${v}" class="${v === st.type ? 'on' : ''}">${t(k)}</button>`).join('')}</div>
        <div class="seg" id="ranges">${[[1, 'bill.today'], [7, 'bill.d7'], [30, 'bill.d30']].map(([v, k]) => `<button data-range="${v}" class="${v === st.range ? 'on' : ''}">${t(k)}</button>`).join('')}</div>
        <input class="input mono" id="fm" placeholder="${t('bill.searchModel')}">
        <input class="input" id="fk" placeholder="${t('bill.searchKey')}">
      </div>
      <div class="panel" id="logs">${loading()}</div>`;
    if (q.get('paid')) C.loadSelf().catch(() => {});

    async function load() {
      const box = $('#logs', el);
      const now = Math.floor(Date.now() / 1000);
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const start = Math.floor(d0.getTime() / 1000) - (st.range - 1) * 86400;
      const qs = `p=${st.page}&page_size=${size}&type=${st.type}&start_timestamp=${start}&end_timestamp=${now}&model_name=${encodeURIComponent(st.model)}&token_name=${encodeURIComponent(st.token)}`;
      let d;
      try { d = await api('/api/log/self?' + qs); } catch (e) { if (alive()) box.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
      if (!alive()) return;
      const items = (d && d.items) || [];
      const pages = Math.max(1, Math.ceil((d.total || 0) / size));
      if (!items.length) { box.innerHTML = `<div class="empty">${icon('list', 30)}<h3>${t('bill.empty')}</h3><p>${t('bill.emptyP')}</p></div>`; return; }
      const pageSum = items.filter((l) => l.type === 2).reduce((a, l) => a + (l.quota || 0), 0);
      box.innerHTML = `
        <div class="table-wrap logtable"><table class="t"><thead><tr>
          <th>${t('bill.time')}</th><th>${t('bill.model')}</th><th>${t('bill.key')}</th><th class="num">${t('bill.in')}</th><th class="num">${t('bill.out')}</th><th class="num">${t('bill.dur')}</th><th class="num">${t('bill.cost')}</th></tr></thead>
          <tbody>${items.map((l) => `<tr title="${esc(l.content || '')}">
            <td>${C.fmtTime(l.created_at, true)}</td>
            <td class="mono">${esc(l.model_name || typeName(l.type))}${l.is_stream ? ` <span class="chip">${t('bill.stream')}</span>` : ''}</td>
            <td>${esc(l.token_name || '-')}</td>
            <td class="num">${l.prompt_tokens ? C.fmtNum(l.prompt_tokens) : '-'}</td>
            <td class="num">${l.completion_tokens ? C.fmtNum(l.completion_tokens) : '-'}</td>
            <td class="num">${l.use_time ? l.use_time + 's' : '-'}</td>
            <td class="num"><b>${l.quota ? esc(C.fmtQuota(l.quota)) : (l.type === 5 ? `<span class="chip bad">${t('bill.error')}</span>` : '-')}</b></td></tr>`).join('')}</tbody></table></div>
        <div class="list logcards">${items.map(logItem).join('')}</div>
        <div class="pager"><button class="btn ghost sm" id="prev" ${st.page <= 1 ? 'disabled' : ''}>${t('bill.prev')}</button>
          <span>${st.type === 2 ? t('bill.periodCost', { v: C.fmtQuota(pageSum) }) + ' · ' : ''}${t('bill.page', { p: st.page })} / ${pages}</span>
          <button class="btn ghost sm" id="next" ${st.page >= pages ? 'disabled' : ''}>${t('bill.next')}</button></div>`;
      $('#prev', box).onclick = () => { st.page--; load(); };
      $('#next', box).onclick = () => { st.page++; load(); };
    }
    $$('[data-type]', el).forEach((b) => b.onclick = () => { st.type = Number(b.dataset.type); st.page = 1; $$('[data-type]', el).forEach((x) => x.classList.toggle('on', x === b)); load(); });
    $$('[data-range]', el).forEach((b) => b.onclick = () => { st.range = Number(b.dataset.range); st.page = 1; $$('[data-range]', el).forEach((x) => x.classList.toggle('on', x === b)); load(); });
    let deb;
    const onFilter = () => { clearTimeout(deb); deb = setTimeout(() => { st.model = $('#fm', el).value.trim(); st.token = $('#fk', el).value.trim(); st.page = 1; load(); }, 400); };
    $('#fm', el).oninput = onFilter; $('#fk', el).oninput = onFilter;
    await load();
  }

  // =====================================================================
  // 模型价格（公开页面，登录后按用户分组计算）
  // =====================================================================
  async function loadPricing() {
    await C.getStatus();
    const j = await api('/api/pricing', { full: true, noRetry: !auth.token });
    const groupRatio = j.group_ratio || {};
    const rows = (j.data || []).map((p) => {
      const gs = (p.enable_groups || []).map((g) => groupRatio[g]).filter((r) => typeof r === 'number');
      const gr = gs.length ? Math.min(...gs) : 1;
      if (p.quota_type === 1) return { name: p.model_name, perCall: (p.model_price || 0) * gr, vendor: p.owner_by };
      const inp = (p.model_ratio || 0) * 2 * gr;
      return { name: p.model_name, inp, out: inp * (p.completion_ratio || 1), vendor: p.owner_by };
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { rows, groupRatio };
  }

  async function pagePricing(target, q, alive) {
    document.title = t('price.title') + ' · ' + brandName();
    let el = target;
    if (auth.token) {
      if (!auth.user) { try { await C.loadSelf(); } catch (e) {} }
      shell('pricing'); el = $('#page');
    } else {
      target.innerHTML = `<div class="landing"><header class="topbar"><a class="brand" href="#/">${logo()}<span>${esc(brandName())}</span></a>
        <div class="row">${langSelect('lang-p')}<a class="btn plain" href="#/login">${t('land.login')}</a><a class="btn sm" href="#/register">${t('land.start')}</a></div></header>
        <div class="main" style="margin:0 auto" id="page"></div></div>`;
      bindLang('lang-p'); el = $('#page');
    }
    el.innerHTML = head(t('price.title'), t('price.sub')) + `<div class="toolbar"><input class="input mono" id="ps" placeholder="${t('price.search')}" type="search"></div><div id="grid">${loading()}</div>`;
    let data;
    try { data = await loadPricing(); } catch (e) { if (alive()) $('#grid', el).innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    if (!alive()) return;
    const draw = (kw) => {
      const list = data.rows.filter((r) => !kw || r.name.toLowerCase().includes(kw.toLowerCase()));
      $('#grid', el).innerHTML = list.length ? `<div class="models">${list.map((r) => `<div class="panel model"><div class="mname">${esc(r.name)}</div>
        ${r.perCall != null ? `<div class="prices"><div style="grid-column:1/-1"><b>${C.fmtUsd(r.perCall)}</b><span>${t('price.per')}</span></div></div>`
          : `<div class="prices"><div><b>${C.fmtUsd(r.inp)}</b><span>${t('price.in')}</span></div><div><b>${C.fmtUsd(r.out)}</b><span>${t('price.out')}</span></div></div>`}</div>`).join('')}</div>`
        : `<div class="empty"><p>${t('price.empty')}</p></div>`;
    };
    draw('');
    $('#ps', el).oninput = (e) => draw(e.target.value.trim());
  }

  // =====================================================================
  // 我的
  // =====================================================================
  async function pageMe(el, q, alive) {
    document.title = t('me.title') + ' · ' + brandName();
    const st = await C.getStatus();
    let u = auth.user;
    try { u = await C.loadSelf(); } catch (e) {}
    if (!alive()) return;
    const theme = (function () { try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; } })();
    el.innerHTML = head(t('me.title'), '') + `
      <div class="settings">
        <section class="panel">
          <div class="menu-row"><span>${icon('user')}</span><div class="grow"><b>${esc(u.display_name || u.username)}</b><span>${t('me.id')} ${u.id} · ${t('me.group')} ${esc(u.group)}${u.email ? ' · ' + esc(u.email) : ''}</span></div></div>
          ${st.checkin_enabled ? `<button class="menu-row" id="checkin"><span>${icon('check')}</span><div class="grow"><b>${t('me.checkin')}</b><span id="ck-sub"></span></div></button>` : ''}
          <button class="menu-row" id="pwd"><span>${icon('lock')}</span><div class="grow"><b>${t('me.pwd')}</b></div></button>
        </section>

        <section class="panel pad sect">
          <div class="row" style="gap:12px">${icon('gift')}<h3 class="grow">${t('me.invite')}</h3></div>
          <p class="muted small">${t('me.inviteP')}</p>
          <div class="copyline"><code id="aff-link">…</code><button class="iconbtn" id="aff-cp" aria-label="${t('c.copy')}">${icon('copy', 18)}</button></div>
          <div class="stats">
            <div><b>${u.aff_count || 0}</b><span>${t('me.invited')}</span></div>
            <div><b>${esc(C.fmtQuota(u.aff_quota || 0, 2))}</b><span>${t('me.reward')}</span></div>
            <div><b>${esc(C.fmtQuota(u.aff_history_quota || 0, 2))}</b><span>${t('me.rewardTotal')}</span></div>
          </div>
          ${(u.aff_quota || 0) >= C.money().qpu ? `<button class="btn ghost" id="aff-tr">${t('me.transfer')}</button>` : ''}
        </section>

        <section class="panel pad sect">
          <div class="row" style="gap:12px">${icon('globe')}<h3>${t('me.lang')} / ${t('me.theme')}</h3></div>
          <label class="field"><span>${t('me.lang')}</span>${langSelect('lang-me').replace('lang-pick', 'input')}</label>
          <div class="field"><span>${t('me.theme')}</span><div class="seg" id="theme">${[['auto', 'me.auto'], ['light', 'me.light'], ['dark', 'me.dark']].map(([v, k]) => `<button data-th="${v}" class="${v === theme ? 'on' : ''}">${t(k)}</button>`).join('')}</div></div>
        </section>

        <section class="panel">
          ${C.inApp ? '' : `<a class="menu-row" href="#/download"><span>${icon('down')}</span><div class="grow"><b>${t('me.download')}</b></div></a>`}
          ${SITE.support && SITE.support.url ? `<a class="menu-row" href="${esc(SITE.support.url)}" target="_blank" rel="noopener"><span>${icon('chat')}</span><div class="grow"><b>${t('me.support')}</b><span>${esc(SITE.support.label || '')}</span></div></a>` : ''}
          <a class="menu-row" href="#/pricing"><span>${icon('tag')}</span><div class="grow"><b>${t('nav.pricing')}</b></div></a>
          <button class="menu-row" id="logout" style="color:var(--rose)"><span>${icon('out')}</span><div class="grow"><b>${t('nav.logout')}</b></div></button>
        </section>
      </div>`;
    bindLang('lang-me');
    $$('[data-th]', el).forEach((b) => b.onclick = () => {
      const v = b.dataset.th;
      try { localStorage.setItem('theme', v); } catch (e) {}
      if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v);
      $$('[data-th]', el).forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#logout', el).onclick = () => C.logout();
    $('#pwd', el).onclick = () => changePassword(u);

    // 邀请链接
    api('/api/user/aff').then((code) => {
      if (!alive()) return;
      const link = `${location.origin}/#/register?aff=${encodeURIComponent(code)}`;
      $('#aff-link', el).textContent = link;
      $('#aff-cp', el).onclick = () => C.copy(link);
    }).catch(() => { $('#aff-link', el).textContent = '-'; });
    const tr = $('#aff-tr', el);
    if (tr) tr.onclick = async () => {
      C.busy(tr, true);
      try { await api('/api/user/aff_transfer', { method: 'POST', body: { quota: u.aff_quota } }); toast(t('me.transferred')); route(); }
      catch (e) { toast(e.message, true); C.busy(tr, false); }
    };

    // 签到
    const ck = $('#checkin', el);
    if (ck) {
      const sub = $('#ck-sub', el);
      const month = new Date().toISOString().slice(0, 7);
      api('/api/user/checkin?month=' + month).then((d) => {
        const done = d && d.stats && d.stats.checked_in_today;
        sub.textContent = done ? t('me.checkedIn') : '';
        ck.disabled = !!done;
      }).catch(() => {});
      ck.onclick = async () => {
        if (st.turnstile_check) {
          const md = C.modal(`<h3>${t('me.checkin')}</h3><div id="ts"></div><div class="foot"><button class="btn ghost" data-close>${t('c.cancel')}</button><button class="btn" id="ok">${t('c.confirm')}</button></div>`);
          const ts = C.turnstile($('#ts', md.el));
          $('#ok', md.el).onclick = async () => { if (!ts.get()) return toast(t('auth.humanCheck'), true); md.close(); doCheckin(ts.get()); };
        } else doCheckin('');
      };
      const doCheckin = async (tk) => {
        try { const d = await api('/api/user/checkin' + (tk ? '?turnstile=' + encodeURIComponent(tk) : ''), { method: 'POST' }); toast(t('me.checkinOk', { v: C.fmtQuota(d.quota_awarded) })); sub.textContent = t('me.checkedIn'); ck.disabled = true; }
        catch (e) { toast(e.message, true); }
      };
    }
  }

  // 修改密码：先用旧密码换取一次性校验凭证，再提交新密码
  function changePassword(u) {
    const scope = u.has_password === false ? 'account.password.set' : 'account.password.change';
    const md = C.modal(`<h2>${t('me.pwd')}</h2>
      <form id="pf" style="display:grid;gap:14px">
        ${u.has_password === false ? '' : `<label class="field"><span>${t('me.oldPwd')}</span><input class="input" name="old" type="password" autocomplete="current-password" required></label>`}
        <label class="field"><span>${t('me.newPwd')}</span><input class="input" name="pw" type="password" minlength="8" autocomplete="new-password" required></label>
        <label class="field"><span>${t('auth.password2')}</span><input class="input" name="pw2" type="password" autocomplete="new-password" required></label>
        <label class="field hidden" id="tfa"><span>${t('auth.2faCode')}</span><input class="input" name="code" inputmode="numeric" autocomplete="one-time-code"></label>
        <div class="foot"><button type="button" class="btn ghost" data-close>${t('c.cancel')}</button><button class="btn" type="submit">${t('c.save')}</button></div>
      </form>`);
    const f = $('#pf', md.el);
    let methods = [];
    api('/api/verify/methods?scope=' + scope).then((d) => {
      methods = (d && d.methods) || [];
      const pwOk = methods.some((m) => m.method === 'password' && m.available !== false);
      const tfaOk = methods.some((m) => m.method === '2fa' && m.available !== false);
      if (!pwOk && tfaOk) $('#tfa', md.el).classList.remove('hidden');
    }).catch(() => {});
    f.onsubmit = async (e) => {
      e.preventDefault();
      const old = f.old ? f.old.value : '';
      const pw = f.pw.value;
      if (pw.length < 8) return toast(t('auth.pwdShort'), true);
      if (pw !== f.pw2.value) return toast(t('auth.pwdMismatch'), true);
      const btn = f.querySelector('[type=submit]'); C.busy(btn, true);
      try {
        const use2fa = !$('#tfa', md.el).classList.contains('hidden');
        let vbody;
        if (use2fa) vbody = { method: '2fa', scope, code: f.code.value.trim() };
        else if (u.has_password === false) vbody = { method: 'password', scope };
        else vbody = Object.assign({ method: 'password', scope }, await C.passwordFields(old));
        const proof = await api('/api/verify', { method: 'POST', body: vbody });
        const body = { password: pw };
        if (old) body.original_password = old;
        const d = await api('/api/user/self', { method: 'PUT', body, headers: { 'X-Security-Proof': proof.proof_token } });
        if (d && d.access_token) C.acceptBundle(d);
        md.close(); toast(t('keys.saved'));
      } catch (err) { toast(err.message, true); }
      finally { C.busy(btn, false); }
    };
  }

  // =====================================================================
  // 下载 App
  // =====================================================================
  async function pageDownload(el) {
    document.title = t('dl.title') + ' · ' + brandName();
    const dl = SITE.downloads || {};
    const webApp = SITE.webApp === undefined ? '/app/' : SITE.webApp;
    const items = [['android', 'dl.android', 'APK'], ['ios', 'dl.ios', 'IPA'], ['windows', 'dl.win', 'EXE'], ['mac', 'dl.mac', 'DMG']].filter(([k]) => dl[k]);
    el.innerHTML = `<div class="landing"><header class="topbar"><a class="brand" href="#/">${logo()}<span>${esc(brandName())}</span></a><div class="row">${langSelect('lang-d')}</div></header>
      <div class="main" style="margin:0 auto;max-width:720px">${head(t('dl.title'), t('dl.sub'))}
        <div class="panel">${webApp ? `<div class="item"><div class="grow"><div class="name">${t('dl.web')}</div><div class="meta"><span>${t('dl.webMeta')}</span></div></div><a class="btn sm" href="${esc(webApp)}">${t('dl.open')}</a></div>` : ''}${items.map(([k, label, ext]) => `<div class="item"><div class="grow"><div class="name">${t(label)}</div><div class="meta"><span>${ext}</span></div></div><a class="btn sm" href="${esc(dl[k])}" download>${icon('down', 16)}${t('dl.get')}</a></div>`).join('')}</div>
        ${dl.ios ? `<p class="muted small" style="margin-top:12px">${t('dl.iosNote')}</p>` : ''}
      </div></div>`;
    bindLang('lang-d');
  }

  // ---------- 启动 ----------
  window.addEventListener('hashchange', route);
  C.bootstrap().then((logged) => {
    if (logged && !location.hash.replace(/^#\/?/, '') && C.inApp) location.hash = '#/dashboard';
    route();
  });
})();
