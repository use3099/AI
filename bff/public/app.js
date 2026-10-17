// 星枢 API App：只和本域名下的 BFF（./api/*）通信
// 界面「潮线」：logo 里的细线化成缓慢流动的发丝线，汇聚成一个光点
(function () {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const app = $('#app');
  const API = 'api';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── 本地存储（失败也不影响使用） ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 忽略 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 忽略 */ } },
  };
  let token = store.get('xs_token', '');
  let me = null;
  let cnyPerUsd = 7.2;
  let appCfg = null;   // /api/config：充值、生图是否开放

  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show ' + kind;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.className = ''; }, 2600);
  }

  async function api(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* 空 */ }
    if (res.status === 401 && token) { logout(true); }
    if (!res.ok) throw new Error((data && data.error) || `请求失败 (${res.status})`);
    return data;
  }

  function logout(expired) {
    token = ''; me = null;
    store.del('xs_token');
    if (expired) toast('登录已失效，请重新登录');
    go('#/chat');
  }

  const go = h => { if (location.hash !== h) location.hash = h; else render(); };
  const yuan = usd => (usd == null ? '--' : '¥' + (usd * cnyPerUsd).toFixed(2));
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 安全策略不允许内联 style 属性：模板里写 data-css="--i:3;width:16px"，这里用 DOM 接口设上（策略允许）
  function applyCss(root) {
    const els = root.matches && root.matches('[data-css]') ? [root] : [];
    if (root.querySelectorAll) els.push(...root.querySelectorAll('[data-css]'));
    for (const el of els) {
      for (const decl of el.getAttribute('data-css').split(';')) {
        const i = decl.indexOf(':'); if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
      }
      el.removeAttribute('data-css');
    }
  }
  new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) applyCss(n); })
    .observe(document.body, { childList: true, subtree: true });
  const initial = () => (me ? String(me.user.account).trim().charAt(0).toUpperCase() : '');

  const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
  const icon = {
    menu: svg('<path d="M4 8h16M4 16h10"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" stroke="none"/>'),
    back: svg('<path d="M15 5l-7 7 7 7"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
    chev: svg('<path d="M9 6l6 6-6 6"/>'),
    down: svg('<path d="M7 10l5 5 5-5"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    mail: svg('<path d="M4 6h16v12H4zM4 7l8 6 8-6"/>'),
    spark: svg('<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>'),
    globe: svg('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16"/>'),
    image: svg('<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9.5" cy="10" r="1.5"/><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5L20 18"/>'),
    chart: svg('<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>'),
    card: svg('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/>'),
    lock: svg('<rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    bubble: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  };
  const imageOn = () => !!(appCfg && appCfg.image && appCfg.image.enabled);

  // 品牌标志：三条线汇入一个光点
  const mark = (cls = '') => `<svg class="mark ${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="18" class="mark-bg"/>
    <path d="M13 19c12 0 14 13 21 13M13 32h21M13 45c12 0 14-13 21-13" class="mark-lines"/>
    <path d="M34 32h16" class="mark-out"/><circle cx="34" cy="32" r="4.8" class="mark-node"/><circle cx="51" cy="32" r="2.6" class="mark-tip"/></svg>`;

  // ── 潮线：发丝细线，宽度为画面两倍，向左平移一半即可无缝循环；其中一条青色线上有光点流过 ──
  const TIDE_W = 780, TIDE_H = 220;
  function linePath(i, n) {
    const t = i / (n - 1), base = 36 + 150 * t, amp = 6 + 10 * Math.sin(t * Math.PI), ph = i * 0.55;
    let d = '';
    for (let x = 0; x <= TIDE_W * 2; x += 12) d += `${x ? 'L' : 'M'}${x} ${(base + amp * Math.sin((x / 260) * Math.PI * 2 + ph)).toFixed(1)}`;
    return d;
  }
  const N_LINES = 9, SIGNAL = 3;
  const TIDE_PATHS = Array.from({ length: N_LINES }, (_, i) => linePath(i, N_LINES));
  const tide = (cls = '') => `<div class="tide ${cls}" aria-hidden="true"><svg viewBox="0 0 ${TIDE_W * 2} ${TIDE_H}" preserveAspectRatio="none">
    ${TIDE_PATHS.map((d, i) => `<path d="${d}" class="${i === SIGNAL ? 'sig' : 'ln'}" data-css="--i:${i};--o:${(0.25 + 0.4 * Math.sin((i / (N_LINES - 1)) * Math.PI)).toFixed(2)}"/>`).join('')}
    <path d="${TIDE_PATHS[SIGNAL]}" class="pulse"/></svg></div>`;
  const wavebars = '<span class="wavebars" aria-label="正在生成"><i></i><i></i><i></i><i></i><i></i></span>';

  // 逐字浮现（标题）
  const reveal = text => text.split('\n').map(line => [...line].map((ch, i) => `<span class="ch" data-css="--d:${i}">${esc(ch)}</span>`).join('')).join('<br>');
  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  }

  // 按下时的涟漪
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.btn, .send, .seg a, .ratio, .method, .amount');
    if (!el || el.disabled || reduceMotion()) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.left = `${e.clientX - r.left}px`; dot.style.top = `${e.clientY - r.top}px`;
    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });

  // 数字滚动到目标值
  function countUp(el, to, fmt) {
    if (!el || to == null || reduceMotion()) { if (el) el.textContent = fmt(to); return; }
    const start = performance.now(), dur = 1100;
    const step = now => {
      const t = Math.min(1, (now - start) / dur), k = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(to * k);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ───────── 登录 / 注册 ─────────
  function authCard(isReg, inModal, reason) {
    const pending = sessionStorage.getItem('xs_pending') || sessionStorage.getItem('xs_img_pending');
    const sw = inModal
      ? (isReg ? '已有账号？<button type="button" class="linkish" data-switch="login">登录</button>' : '还没有账号？<button type="button" class="linkish" data-switch="register">注册</button>')
      : (isReg ? '已有账号？<a href="#/login">登录</a>' : '还没有账号？<a href="#/register">注册</a>');
    const cta = isReg ? (pending && inModal ? '注册并发送' : '注册并开始使用') : (pending && inModal ? '登录并发送' : '登录');
    return `
        <div class="auth-card">
          ${inModal ? `<span class="grab" aria-hidden="true"></span><button type="button" class="icon-btn modal-close" aria-label="关闭">${icon.close}</button>` : mark('auth-mark')}
          <h1 class="serif auth-title">${isReg ? '创建账号' : '欢迎回来'}</h1>
          <p class="muted auth-sub">${esc(reason || (isReg ? '聊天、写作、生成图片，一个账号就够' : '登录后继续你的对话'))}</p>
          ${pending && inModal ? `<div class="pending-q">${icon.bubble}<p>${esc(pending)}</p></div>` : ''}
          <form class="authForm" novalidate>
            <label class="field">邮箱或手机号<input name="account" autocomplete="username" inputmode="email" required></label>
            <label class="field">${isReg ? '设置密码' : '密码'}<input name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="8" placeholder="${isReg ? '至少 8 位' : ''}" required></label>
            <button class="btn primary block" type="submit" data-label="${cta}">${cta}</button>
          </form>
          <p class="switch">${sw}</p>
        </div>`;
  }

  function bindAuth(root, isReg, onDone) {
    $('.authForm', root).addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const btn = $('button[type=submit]', f);
      const account = f.account.value.trim();
      const password = f.password.value;
      if (!account || !password) return toast('请填写账号和密码', 'warn');
      if (isReg && password.length < 8) return toast('密码至少 8 位', 'warn');
      btn.disabled = true; btn.innerHTML = wavebars;
      try {
        const r = await api('POST', `/auth/${isReg ? 'register' : 'login'}`, { account, password });
        token = r.token; store.set('xs_token', token); me = null;
        onDone();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false; btn.textContent = btn.dataset.label;
      }
    });
  }

  // 整页登录 / 注册（直接打开 #/login、#/register 时）
  function viewAuth(mode) {
    const isReg = mode === 'register';
    app.innerHTML = `<main class="auth"><a class="icon-btn auth-back" href="#/chat" aria-label="返回">${icon.back}</a>${authCard(isReg, false)}${tide('auth-tide')}</main>`;
    bindAuth(app, isReg, () => go('#/chat'));
  }

  // 弹窗登录 / 注册：游客发消息、生图时弹出，登录后留在原页面
  function openAuth(mode = 'register', reason = '') {
    closeAuth(true);
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.id = 'authModal';
    const paint = m => {
      const isReg = m === 'register';
      wrap.innerHTML = authCard(isReg, true, reason);
      bindAuth(wrap, isReg, () => { closeAuth(true); toast(isReg ? '注册成功' : '登录成功', 'ok'); render(); });
      const first = $('input', wrap); if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
    };
    wrap.addEventListener('click', e => {
      if (e.target === wrap || e.target.closest('.modal-close')) { sessionStorage.removeItem('xs_pending'); sessionStorage.removeItem('xs_img_pending'); closeAuth(); return; }
      const sw = e.target.closest('[data-switch]'); if (sw) paint(sw.dataset.switch);
    });
    document.body.appendChild(wrap);
    paint(mode);
  }
  function closeAuth(now) {
    const m = $('#authModal'); if (!m) return;
    if (now || reduceMotion()) return m.remove();
    m.classList.add('leaving');
    setTimeout(() => m.remove(), 260);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuth(); });

  // 账号按钮（右上角）
  const accountBtn = () => me
    ? `<a class="avatar" href="#/account" aria-label="我的">${esc(initial())}</a>`
    : '<button type="button" class="btn pill-outline" data-login>登录</button>';
  app.addEventListener('click', e => { if (e.target.closest('[data-login]')) openAuth('login'); });

  // ───────── 对话 ─────────
  const convKey = () => `xs_convs_${me ? me.user.id : 0}`;
  let convs = [];
  let current = null;
  let models = [];
  let streaming = null;

  function saveConvs() {
    // 只保留最近 50 个对话，防止本地存储撑爆
    convs = convs.slice(0, 50);
    store.set(convKey(), convs);
  }

  function newConv() {
    const c = { id: Date.now().toString(36), title: '新对话', model: store.get('xs_model', models[0] || ''), messages: [], at: Date.now() };
    convs.unshift(c); current = c; saveConvs();
    return c;
  }

  const HINTS = [
    { icon: 'mail', text: '帮我写一封请假邮件' },
    { icon: 'spark', text: '用三句话解释量子计算' },
    { icon: 'globe', text: '把这段话翻译成英文' },
    { icon: 'image', text: '画一张雨夜东京街头的图', image: '雨夜的东京街头，霓虹倒映在积水里，电影感' },
  ];

  async function viewChat() {
    convs = store.get(convKey(), []);
    if (!current || !convs.find(c => c.id === current.id)) current = convs[0] || null;
    app.innerHTML = `
      <div class="chat-layout">
        <aside class="sidebar" id="sidebar">
          <div class="side-head">${mark()}<strong>星枢 API</strong></div>
          <button class="btn dark side-btn" id="newChat">${icon.plus}新对话</button>
          ${imageOn() ? `<a class="side-link" href="#/image">${icon.image}AI 生图</a>` : ''}
          <nav class="conv-list" id="convList" aria-label="历史对话"></nav>
          ${me ? `<a class="side-account" href="#/account"><span class="avatar sm">${esc(initial())}</span><span class="who"><b>${esc(me.user.account)}</b><small id="sideBal">余额 ${yuan(me.balance_usd)}</small></span></a>`
               : `<button type="button" class="side-account guest" data-login><span class="avatar sm ghost">${svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8"/>')}</span><span class="who"><b>登录 / 注册</b><small>注册后就能开始对话</small></span></button>`}
        </aside>
        <div class="scrim" id="scrim"></div>
        <section class="chat-main">
          <header class="chat-head">
            <button class="icon-btn only-mobile" id="openSide" aria-label="打开对话列表">${icon.menu}</button>
            <label class="model-pill"><span class="dot"></span><span class="sr">选择模型</span><select id="modelSel"></select>${icon.down}</label>
            ${accountBtn()}
          </header>
          <div class="streamline" id="streamline"></div>
          ${tide('chat-tide')}
          <div class="messages" id="messages"></div>
          <form class="composer" id="composer">
            <label class="sr" for="input">消息</label>
            <textarea id="input" rows="1" placeholder="给星枢发消息" enterkeyhint="send"></textarea>
            <button class="send" id="sendBtn" type="submit" aria-label="发送">${icon.up}</button>
          </form>
        </section>
      </div>`;

    const sidebar = $('#sidebar'), scrim = $('#scrim');
    const closeSide = () => { sidebar.classList.remove('open'); scrim.classList.remove('show'); };
    $('#openSide').onclick = () => { sidebar.classList.add('open'); scrim.classList.add('show'); };
    scrim.onclick = closeSide;
    $('#newChat').onclick = () => { newConv(); renderConvList(); renderMessages(); closeSide(); $('#input').focus(); };

    const sel = $('#modelSel');
    try {
      if (!models.length) models = (await api('GET', '/models')).models;
    } catch (e) { toast(e.message, 'err'); }
    if (!$('#modelSel')) return; // 已离开页面
    sel.innerHTML = models.length ? models.map(m => `<option>${esc(m)}</option>`).join('') : `<option value="">${me ? '暂无可用模型' : '登录后选择模型'}</option>`;
    const pick = (current && current.model) || store.get('xs_model', models[0] || '');
    if (models.includes(pick)) sel.value = pick;
    sel.onchange = () => { store.set('xs_model', sel.value); if (current) { current.model = sel.value; saveConvs(); } };

    function renderConvList() {
      const list = $('#convList');
      if (!convs.length) { list.innerHTML = '<p class="conv-empty">还没有对话</p>'; return; }
      const day = 86400000, now = new Date(); now.setHours(0, 0, 0, 0);
      const groups = [['今天', c => c.at >= now.getTime()], ['近 7 天', c => c.at >= now.getTime() - 6 * day], ['更早', () => true]];
      const seen = new Set();
      let html = '', n = 0;
      for (const [label, test] of groups) {
        const items = convs.filter(c => !seen.has(c.id) && test(c));
        if (!items.length) continue;
        items.forEach(c => seen.add(c.id));
        html += `<p class="conv-group">${label}</p>` + items.map(c => `
          <div class="conv ${current && c.id === current.id ? 'active' : ''}" data-id="${c.id}" data-css="--i:${Math.min(n++, 14)}">
            <span>${esc(c.title)}</span><button class="del" data-del="${c.id}" aria-label="删除">${icon.trash}</button>
          </div>`).join('');
      }
      list.innerHTML = html;
      list.onclick = e => {
        const del = e.target.closest('[data-del]');
        if (del) {
          convs = convs.filter(c => c.id !== del.dataset.del);
          if (current && current.id === del.dataset.del) current = convs[0] || null;
          saveConvs(); renderConvList(); renderMessages(); return;
        }
        const item = e.target.closest('.conv');
        if (item) {
          current = convs.find(c => c.id === item.dataset.id);
          if (current && models.includes(current.model)) sel.value = current.model;
          renderConvList(); renderMessages(); closeSide();
        }
      };
    }

    let animateFrom = Infinity;   // 只给新出现的消息加进入动画
    function msgHtml(m, i) {
      const enter = i >= animateFrom ? ' enter' : '';
      if (m.role === 'user') return `<div class="msg user${enter}"><div class="bubble">${esc(m.content).replace(/\n/g, '<br>')}</div></div>`;
      const done = m.content && !(streaming && i === current.messages.length - 1);
      return `<div class="msg bot${m.error ? ' error' : ''}${enter}">${mark('msg-mark')}
        <div class="bot-body"><div class="bubble md">${m.content ? window.renderMarkdown(m.content) : wavebars}</div>
        ${done && !m.error ? `<div class="msg-actions"><button class="icon-btn" data-copymsg="${i}" aria-label="复制">${icon.copy}</button></div>` : ''}</div></div>`;
    }

    function renderMessages() {
      const box = $('#messages');
      const main = box.closest('.chat-main');
      const empty = !current || !current.messages.length;
      main.classList.toggle('is-empty', empty);
      if (empty) {
        const hints = HINTS.filter(h => !h.image || imageOn());
        box.innerHTML = `<div class="empty">${mark('hero-mark')}
          <h1 class="serif greet">${reveal(`${greeting()}，\n今天想聊点什么？`)}</h1>
          <p class="muted lead">Claude、GPT 和更多模型，一个账号就能用</p>
          <div class="hints">${hints.map((h, i) => `<button type="button" class="hint" data-css="--i:${i}" data-hint="${i}">${icon[h.icon]}<span>${h.text}</span>${icon.chev}</button>`).join('')}</div></div>`;
        box.onclickHints = hints;
        return;
      }
      box.innerHTML = current.messages.map(msgHtml).join('');
      animateFrom = Infinity;
      box.scrollTop = box.scrollHeight;
    }

    $('#messages').addEventListener('click', e => {
      const hint = e.target.closest('[data-hint]');
      if (hint) {
        const h = $('#messages').onclickHints[+hint.dataset.hint];
        if (h.image) { sessionStorage.setItem('xs_img_prefill', h.image); return go('#/image'); }
        input.value = h.text; autosize(); input.focus(); return;
      }
      const cm = e.target.closest('[data-copymsg]');
      if (cm) {
        const m = current.messages[+cm.dataset.copymsg];
        navigator.clipboard?.writeText(m.content).then(() => toast('已复制'), () => toast('复制失败', 'err'));
        return;
      }
      const b = e.target.closest('[data-copy]');
      if (!b) return;
      const code = b.closest('.codeblock').querySelector('code').textContent;
      navigator.clipboard?.writeText(code).then(() => toast('已复制'), () => toast('复制失败', 'err'));
    });

    const input = $('#input');
    const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; };
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) {
        e.preventDefault(); $('#composer').requestSubmit();
      }
    });

    $('#composer').addEventListener('submit', async e => {
      e.preventDefault();
      if (streaming) { streaming.abort(); return; }
      const text = input.value.trim();
      if (!text) return;
      if (!me) {
        sessionStorage.setItem('xs_pending', text);
        return openAuth('register', '注册后就能收到回复，刚才的问题会自动发送。');
      }
      if (!sel.value) return toast('暂无可用模型', 'warn');
      if (!current) newConv();
      current.model = sel.value;
      current.messages.push({ role: 'user', content: text });
      if (current.title === '新对话') current.title = text.slice(0, 24);
      const reply = { role: 'assistant', content: '' };
      animateFrom = current.messages.length - 1;
      current.messages.push(reply);
      current.at = Date.now();
      input.value = ''; autosize();
      saveConvs(); renderConvList();
      streaming = new AbortController();
      renderMessages();
      await streamReply(current, reply, streaming);
    });

    async function streamReply(conv, reply, ctrl) {
      const btn = $('#sendBtn');
      btn.innerHTML = icon.stop; btn.classList.add('stop'); btn.setAttribute('aria-label', '停止生成');
      $('#streamline').classList.add('flowing');
      const box = $('#messages');
      const node = () => box.lastElementChild && box.lastElementChild.querySelector('.bubble');
      let pending = false;
      const paint = () => {
        if (pending) return; pending = true;
        requestAnimationFrame(() => {
          pending = false;
          const n = node(); if (!n || conv !== current) return;
          const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
          n.innerHTML = window.renderMarkdown(reply.content);
          if (nearBottom) box.scrollTop = box.scrollHeight;
        });
      };
      try {
        const history = conv.messages.filter(m => m !== reply && !m.error).slice(-40).map(m => ({ role: m.role, content: m.content }));
        const res = await fetch(`${API}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ model: conv.model, messages: history, stream: true }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = `请求失败 (${res.status})`;
          try { msg = (await res.json()).error || msg; } catch { /* 空 */ }
          if (res.status === 401) logout(true);
          throw Object.assign(new Error(msg), { status: res.status });
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const j = JSON.parse(data);
              const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
              if (d && d.content) { reply.content += d.content; paint(); }
              if (j.error) throw new Error(j.error.message || '生成出错');
            } catch (err) { if (err.message && !(err instanceof SyntaxError)) throw err; }
          }
        }
        if (!reply.content) reply.content = '（模型没有返回内容）';
      } catch (err) {
        if (err.name === 'AbortError') {
          if (!reply.content) reply.content = '（已停止）';
        } else {
          reply.error = true;
          reply.content = (reply.content ? reply.content + '\n\n' : '') + `${err.message}` + (err.status === 402 ? '\n\n[去充值](#/recharge)' : '');
          if (err.status === 402) toast('余额不足，请先充值', 'warn');
        }
      } finally {
        streaming = null;
        saveConvs();
        if ($('#streamline')) $('#streamline').classList.remove('flowing');
        if (conv === current && $('#sendBtn')) {
          renderMessages();
          const b = $('#sendBtn'); b.innerHTML = icon.up; b.classList.remove('stop'); b.setAttribute('aria-label', '发送');
        }
        refreshBalance();
      }
    }

    renderConvList();
    renderMessages();

    // 游客注册 / 登录前输入的问题，登录后自动发出
    const pending = me && sessionStorage.getItem('xs_pending');
    if (pending) {
      sessionStorage.removeItem('xs_pending');
      input.value = pending; autosize();
      setTimeout(() => $('#composer') && $('#composer').requestSubmit(), 250);
    }
  }

  async function refreshBalance() {
    if (!token) return;
    try {
      me = await api('GET', '/me'); cnyPerUsd = me.cny_per_usd || cnyPerUsd;
      const el = $('#sideBal'); if (el) el.textContent = `余额 ${yuan(me.balance_usd)}`;
    } catch { /* 忽略 */ }
  }

  // 让 Markdown 里的站内链接（#/recharge）正常跳转，外链用新窗口
  app.addEventListener('click', e => {
    const a = e.target.closest('.md a');
    if (a && a.getAttribute('href') && a.getAttribute('href').startsWith('#')) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  // ───────── 生图 ─────────
  const imgKey = () => `xs_imgs_${me ? me.user.id : 0}`;
  let imgModels = [];
  let imgBusy = false;
  const RATIOS = [['1024x1024', '方图 1:1', 16, 16], ['1024x1536', '竖图 2:3', 13, 19], ['1536x1024', '横图 3:2', 19, 13]];

  async function viewImage() {
    if (!imageOn()) return pageShell('AI 生图', '<section class="card"><p>生图功能暂未开放，请联系客服。</p></section>');
    const note = appCfg.image.price_note;
    app.innerHTML = `
      <div class="page image-page">
        <header class="page-head">
          <a class="icon-btn" href="#/chat" aria-label="返回对话">${icon.back}</a>
          <nav class="seg" aria-label="功能切换"><a href="#/chat">对话</a><a href="#/image" aria-current="page">生图</a></nav>
          ${accountBtn()}
        </header>
        <main class="page-body">
          <div id="imgResults" class="img-results"></div>
          <form class="card img-form" id="imgForm">
            <label class="field bare">描述画面<textarea id="imgPrompt" rows="3" maxlength="4000" placeholder="例如：雨夜的东京街头，霓虹倒映在积水里，电影感"></textarea></label>
            <div class="hair"></div>
            <div class="img-opts">
              <div class="ratios" role="radiogroup" aria-label="画面比例">${RATIOS.map(([v, n, w, h], i) => `<button type="button" class="ratio ${i === 0 ? 'on' : ''}" role="radio" aria-checked="${i === 0}" aria-label="${n}" data-s="${v}"><span data-css="width:${w}px;height:${h}px"></span></button>`).join('')}</div>
              <label class="model-pill small"><span class="sr">生图模型</span><select id="imgModel"><option value="">加载中…</option></select>${icon.down}</label>
            </div>
            <button class="btn dark block lg" id="imgGo" type="submit">${icon.spark}生成图片</button>
            <p class="muted tiny center">${note ? esc(note) + '，' : ''}按张计费，从余额扣除${me ? `（余额 ${yuan(me.balance_usd)}）` : ''}</p>
          </form>
        </main>
      </div>`;

    const sel = $('#imgModel');
    if (me) { try { if (!imgModels.length) imgModels = (await api('GET', '/image/models')).models; } catch (e) { toast(e.message, 'err'); } }
    if (!$('#imgModel')) return; // 已离开页面
    sel.innerHTML = !me ? '<option value="">登录后选择模型</option>'
      : imgModels.length ? imgModels.map(m => `<option>${esc(m)}</option>`).join('') : '<option value="">暂无可用模型</option>';
    const saved = store.get('xs_img_model', '');
    if (imgModels.includes(saved)) sel.value = saved;
    sel.onchange = () => store.set('xs_img_model', sel.value);

    const ratioBox = $('.ratios');
    ratioBox.addEventListener('click', e => {
      const b = e.target.closest('.ratio'); if (!b) return;
      ratioBox.querySelectorAll('.ratio').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    });

    let items = store.get(imgKey(), []);
    let timer = null;
    const renderResults = () => {
      const box = $('#imgResults'); if (!box) return;
      box.innerHTML = items.map((it, i) => it.pending ? `
        <figure class="img-card pending">
          ${tide('img-tide')}
          <figcaption><div><b>正在生成</b><small>${esc(it.prompt)}</small></div><span class="secs" id="imgSecs">0 秒</span></figcaption>
          <div class="bar"><i id="imgBar"></i></div>
        </figure>` : it.error ? `
        <figure class="img-card failed"><p>${esc(it.error)}${/余额不足/.test(it.error) ? ' <a href="#/recharge">去充值</a>' : ''}</p>
          <button class="icon-btn" data-del="${i}" aria-label="删除">${icon.trash}</button></figure>` : `
        <figure class="img-card">
          <img src="${it.src}" alt="${esc(it.prompt)}">
          <figcaption><span>${esc(it.prompt)}</span><a class="btn ghost sm" href="${it.src}" download="xingshu-${it.at}.png">保存</a><button class="icon-btn" data-del="${i}" aria-label="删除">${icon.trash}</button></figcaption>
        </figure>`).join('') + (items.some(x => x.src) ? '<p class="muted tiny center">手机上也可以长按图片保存到相册</p>' : '');
    };
    const persist = () => {
      // 图片很大，只在本机保留最近 6 张
      const keep = items.filter(x => x.src).slice(0, 6);
      for (const n of [6, 3, 1, 0]) {
        try { localStorage.setItem(imgKey(), JSON.stringify(keep.slice(0, n))); break; } catch { /* 存不下就少存几张 */ }
      }
    };
    $('#imgResults').addEventListener('click', e => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      items.splice(+d.dataset.del, 1); persist(); renderResults();
    });
    renderResults();
    const prefill = sessionStorage.getItem('xs_img_prefill') || (me && sessionStorage.getItem('xs_img_pending'));
    if (prefill) { sessionStorage.removeItem('xs_img_prefill'); if (me) sessionStorage.removeItem('xs_img_pending'); $('#imgPrompt').value = prefill; }

    $('#imgForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (imgBusy) return toast('上一张还在生成，请稍等', 'warn');
      const prompt = $('#imgPrompt').value.trim();
      if (!prompt) return toast('请先描述画面', 'warn');
      if (!me) { sessionStorage.setItem('xs_img_pending', prompt); return openAuth('register', '注册后就能生成图片。'); }
      if (!sel.value) return toast('暂无可用模型', 'warn');
      const size = $('.ratio.on').dataset.s;
      const it = { prompt, pending: true, at: Date.now() };
      items.unshift(it); renderResults();
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      imgBusy = true; $('#imgGo').disabled = true;
      // 进度条：按 40 秒预估缓慢逼近，返回后补满
      const t0 = Date.now();
      clearInterval(timer);
      timer = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        const secs = $('#imgSecs'), bar = $('#imgBar');
        if (secs) secs.textContent = `${Math.floor(s)} 秒`;
        if (bar) bar.style.width = `${(1 - Math.exp(-s / 22)) * 92}%`;
      }, 250);
      try {
        const r = await api('POST', '/image', { model: sel.value, prompt, size });
        it.src = r.images[0];
      } catch (err) {
        it.error = err.message;
        if (/余额不足/.test(err.message)) toast('余额不足，请先充值', 'warn');
      } finally {
        clearInterval(timer);
        delete it.pending; imgBusy = false;
        persist(); renderResults();
        const b = $('#imgGo'); if (b) b.disabled = false;
        refreshBalance();
      }
    });
  }

  // ───────── 我的 ─────────
  function pageShell(title, body, back = '#/chat') {
    app.innerHTML = `
      <div class="page">
        <header class="page-head"><a class="icon-btn" href="${back}" aria-label="返回">${icon.back}</a><h1>${title}</h1><span></span></header>
        <main class="page-body">${body}</main>
      </div>`;
  }

  async function viewAccount() {
    await refreshBalance();
    pageShell('我的', `
      <section class="balance">
        ${tide('bal-tide')}
        <p class="muted">账户余额</p>
        <p class="big"><span class="cur">¥</span><span id="bigBal">0.00</span></p>
        <a class="btn primary pill" href="#/recharge">充值</a>
      </section>
      <nav class="card list" aria-label="账户">
        <a href="#/usage">${icon.chart}<span>使用记录</span>${icon.chev}</a>
        <a href="#/orders">${icon.card}<span>充值记录</span>${icon.chev}</a>
        <a href="#/password">${icon.lock}<span>修改密码</span>${icon.chev}</a>
      </nav>
      <div class="kv"><span class="muted">登录账号</span><span>${esc(me.user.account)}</span></div>
      <div class="grow"></div>
      <button class="btn block quiet danger" id="logout">退出登录</button>
      <button class="btn block quiet" id="logoutAll">退出所有设备</button>`);
    countUp($('#bigBal'), me.balance_usd == null ? null : me.balance_usd * cnyPerUsd, v => (v == null ? '--' : v.toFixed(2)));
    $('#logout').onclick = () => logout();
    $('#logoutAll').onclick = async () => {
      if (!confirm('确定要让所有设备上的登录都失效吗？')) return;
      try { await api('POST', '/auth/logout-all', {}); } catch { /* 忽略 */ }
      logout();
    };
  }

  async function viewRecharge() {
    let cfg;
    try { cfg = (await api('GET', '/config')).recharge; } catch (e) { return toast(e.message, 'err'); }
    cnyPerUsd = cfg.cny_per_usd || cnyPerUsd;
    if (!cfg.enabled) return pageShell('充值', '<section class="card"><p>充值暂未开放，请联系客服。</p></section>', '#/account');
    const names = { alipay: '支付宝', wxpay: '微信支付', qqpay: 'QQ 钱包' };
    pageShell('充值', `
      <section class="card">
        <p class="label">选择金额</p>
        <div class="amounts" id="amounts">${cfg.amounts.map((a, i) => `<button type="button" class="amount ${i === 1 ? 'on' : ''}" data-a="${a}">¥${a}</button>`).join('')}</div>
        <label class="field">其他金额<input id="customAmt" type="number" inputmode="decimal" min="${cfg.min}" max="${cfg.max}" placeholder="${cfg.min} - ${cfg.max}"></label>
      </section>
      <section class="card">
        <p class="label">支付方式</p>
        <div class="methods" id="methods">${cfg.methods.map((m, i) => `<button type="button" class="method ${i === 0 ? 'on' : ''}" data-m="${m}">${names[m] || m}</button>`).join('')}</div>
      </section>
      <button class="btn dark block lg" id="payBtn">立即支付</button>
      <p class="muted tiny center" id="payStatus"></p>`, '#/account');

    const pickOne = (box, cls) => box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (cls === 'amount') $('#customAmt').value = '';
    });
    pickOne($('#amounts'), 'amount'); pickOne($('#methods'), 'method');
    $('#customAmt').addEventListener('input', () => $('#amounts').querySelectorAll('button').forEach(x => x.classList.remove('on')));

    $('#payBtn').onclick = async () => {
      const custom = $('#customAmt').value;
      const amount = Number(custom || ($('#amounts .on') && $('#amounts .on').dataset.a));
      const method = $('#methods .on') && $('#methods .on').dataset.m;
      if (!amount) return toast('请选择金额', 'warn');
      const btn = $('#payBtn'); btn.disabled = true;
      try {
        const o = await api('POST', '/recharge', { amount, method });
        const w = window.open(o.pay_url, '_blank');
        if (!w) location.href = o.pay_url;
        $('#payStatus').textContent = '已打开支付页面，付款完成后回到这里，会自动到账…';
        pollOrder(o.order_no);
      } catch (e) { toast(e.message, 'err'); } finally { btn.disabled = false; }
    };
  }

  function pollOrder(no) {
    clearInterval(pollOrder.t);
    const started = Date.now();
    pollOrder.t = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000 || !location.hash.startsWith('#/recharge')) return clearInterval(pollOrder.t);
      try {
        const o = await api('GET', `/recharge/${no}`);
        if (o.status === 'credited') {
          clearInterval(pollOrder.t);
          toast(`充值成功 ¥${o.amount_cny}`, 'ok');
          go('#/account');
        } else if (o.status === 'paid') {
          const s = $('#payStatus'); if (s) s.textContent = '已付款，正在到账…';
        }
      } catch { /* 下次再试 */ }
    }, 3000);
  }

  async function viewUsage(page = 1) {
    pageShell('使用记录', `<p class="muted center pad">${wavebars}</p>`, '#/account');
    try {
      const r = await api('GET', `/usage?page=${page}`);
      const rows = r.items.map((i, n) => `
        <div class="usage-row" data-css="--i:${n}">
          <div><b>${esc(i.model)}</b><small>${new Date(i.time).toLocaleString()}</small></div>
          <div class="right"><b>-¥${(i.cost_usd * cnyPerUsd).toFixed(4)}</b><small>${i.input_tokens} / ${i.output_tokens} tokens</small></div>
        </div>`).join('');
      $('.page-body').innerHTML = `<section class="card list">${rows || '<p class="muted center pad">还没有使用记录</p>'}</section>
        <div class="pager">${page > 1 ? `<button class="btn ghost" data-p="${page - 1}">上一页</button>` : ''}${page < r.pages ? `<button class="btn ghost" data-p="${page + 1}">下一页</button>` : ''}</div>`;
      $('.pager').onclick = e => { const b = e.target.closest('[data-p]'); if (b) viewUsage(+b.dataset.p); };
    } catch (e) { toast(e.message, 'err'); }
  }

  async function viewOrders() {
    pageShell('充值记录', `<p class="muted center pad">${wavebars}</p>`, '#/account');
    const st = { pending: '待支付', paid: '到账中', credited: '已到账' };
    try {
      const r = await api('GET', '/recharge/orders');
      $('.page-body').innerHTML = `<section class="card list">${r.items.map((o, n) => `
        <div class="usage-row" data-css="--i:${n}"><div><b>¥${esc(o.amount_cny)}</b><small>${new Date(o.created_at).toLocaleString()}</small></div>
        <div class="right"><span class="tag ${o.status}">${st[o.status] || o.status}</span></div></div>`).join('') || '<p class="muted center pad">还没有充值记录</p>'}</section>`;
    } catch (e) { toast(e.message, 'err'); }
  }

  function viewPassword() {
    pageShell('修改密码', `
      <form class="card form" id="pwForm">
        <label class="field">原密码<input name="old" type="password" autocomplete="current-password" required></label>
        <label class="field">新密码<input name="np" type="password" autocomplete="new-password" minlength="8" placeholder="至少 8 位" required></label>
        <button class="btn dark block lg" type="submit">保存新密码</button>
      </form>`, '#/account');
    $('#pwForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      if (f.np.value.length < 8) return toast('新密码至少 8 位', 'warn');
      try {
        const r = await api('POST', '/auth/password', { old_password: f.old.value, new_password: f.np.value });
        token = r.token; store.set('xs_token', token);
        toast('新密码已保存，其他设备需要重新登录', 'ok'); go('#/account');
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  // ───────── 路由 ─────────
  async function render() {
    const h = location.hash || '#/chat';
    if (!appCfg) { try { appCfg = await api('GET', '/config'); } catch { /* 下次再取 */ } }
    if (!token) {
      // 游客：对话、生图页面都能看，发送时再登录
      if (h === '#/register') return viewAuth('register');
      if (h === '#/login') return viewAuth('login');
      if (h.startsWith('#/image')) return viewImage();
      if (/^#\/(account|recharge|usage|orders|password)/.test(h)) return go('#/login');
      return viewChat();
    }
    if (!me) {
      try { me = await api('GET', '/me'); cnyPerUsd = me.cny_per_usd || cnyPerUsd; } catch (e) { if (!token) return; toast(e.message, 'err'); return; }
    }
    if (h.startsWith('#/image')) return viewImage();
    if (h.startsWith('#/account')) return viewAccount();
    if (h.startsWith('#/recharge')) return viewRecharge();
    if (h.startsWith('#/usage')) return viewUsage();
    if (h.startsWith('#/orders')) return viewOrders();
    if (h.startsWith('#/password')) return viewPassword();
    if (h === '#/login' || h === '#/register') return go('#/chat');
    return viewChat();
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token && location.hash.startsWith('#/account')) viewAccount(); });
  render();
})();
