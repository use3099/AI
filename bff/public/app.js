// 星枢 API App：只和本域名下的 BFF（./api/*）通信
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
    go('#/login');
  }

  const go = h => { if (location.hash !== h) location.hash = h; else render(); };
  const yuan = usd => (usd == null ? '--' : '¥' + (usd * cnyPerUsd).toFixed(2));

  const icon = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9.5" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5L20 18"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0a2 2 0 0 1-2-2z"/></svg>',
  };
  const imageOn = () => !!(appCfg && appCfg.image && appCfg.image.enabled);
  const logo = '<img class="logo" src="icon.svg" alt="">';

  // ── 潮汐波纹：三层正弦波，宽度是画面的两倍，向左平移一半即可无缝循环 ──
  function wavePath(amp, period, base, phase) {
    const W = 2880, H = 180;
    let d = `M0 ${H} L0 ${base}`;
    for (let x = 0; x <= W; x += 24) d += ` L${x} ${(base + amp * Math.sin((x / period) * Math.PI * 2 + phase)).toFixed(1)}`;
    return d + ` L${W} ${H} Z`;
  }
  const WAVES = [[18, 720, 70, 0], [14, 480, 92, 1.4], [10, 360, 112, 2.6]]
    .map(([a, p, b, ph], i) => `<svg class="w${i + 1}" viewBox="0 0 2880 180" preserveAspectRatio="none" aria-hidden="true"><path d="${wavePath(a, p, b, ph)}"/></svg>`).join('');
  const tide = (cls = '') => `<div class="tide ${cls}" aria-hidden="true">${WAVES}</div>`;
  const wavebars = '<span class="wavebars" aria-label="正在生成"><i></i><i></i><i></i><i></i><i></i></span>';
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 按下时的涟漪
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.btn, .send, .amount, .method, .icon-btn');
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
    const start = performance.now(), dur = 900;
    const step = now => {
      const t = Math.min(1, (now - start) / dur), k = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(to * k);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ───────── 登录 / 注册 ─────────
  function viewAuth(mode) {
    const isReg = mode === 'register';
    app.innerHTML = `
      <main class="auth">
        ${tide()}
        <div class="auth-card">
          <div class="brand">${logo}<div><h1>星枢 API</h1><p>聊天、写作、生成图片，一个账号就够</p></div></div>
          <form id="authForm" novalidate>
            <label>邮箱或手机号<input name="account" autocomplete="username" inputmode="email" required></label>
            <label>密码<input name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="8" required></label>
            ${isReg ? '<label>确认密码<input name="password2" type="password" autocomplete="new-password" required></label>' : ''}
            <button class="btn primary block" type="submit">${isReg ? '注册并登录' : '登录'}</button>
          </form>
          <p class="switch">${isReg ? '已有账号？<a href="#/login">去登录</a>' : '还没有账号？<a href="#/register">注册一个</a>'}</p>
        </div>
      </main>`;
    $('#authForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const btn = $('button[type=submit]', f);
      const account = f.account.value.trim();
      const password = f.password.value;
      if (!account || !password) return toast('请填写账号和密码', 'warn');
      if (isReg && password.length < 8) return toast('密码至少 8 位', 'warn');
      if (isReg && password !== f.password2.value) return toast('两次密码不一致', 'warn');
      btn.disabled = true; btn.textContent = '请稍候…';
      try {
        const r = await api('POST', `/auth/${isReg ? 'register' : 'login'}`, { account, password });
        token = r.token; store.set('xs_token', token);
        go('#/chat');
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false; btn.textContent = isReg ? '注册并登录' : '登录';
      }
    });
  }

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

  async function viewChat() {
    convs = store.get(convKey(), []);
    if (!current || !convs.find(c => c.id === current.id)) current = convs[0] || null;
    app.innerHTML = `
      <div class="chat-layout">
        <aside class="sidebar" id="sidebar">
          <div class="side-head">${logo}<strong>星枢 API</strong></div>
          <div class="side-nav" style="${imageOn() ? '' : 'grid-template-columns:1fr'}">
            <button class="btn primary" id="newChat">${icon.plus}新对话</button>
            ${imageOn() ? `<a class="btn" href="#/image">${icon.image}AI 生图</a>` : ''}
          </div>
          <nav class="conv-list" id="convList"></nav>
          <a class="side-account" href="#/account">${icon.user}<span><b>${esc(me.user.account)}</b><small id="sideBal">余额 ${yuan(me.balance_usd)}</small></span></a>
        </aside>
        <div class="scrim" id="scrim"></div>
        <section class="chat-main">
          <header class="chat-head">
            <button class="icon-btn only-mobile" id="openSide" aria-label="对话列表">${icon.menu}</button>
            <select id="modelSel" aria-label="选择模型"></select>
            ${imageOn() ? `<a class="icon-btn" href="#/image" aria-label="AI 生图">${icon.image}</a>` : ''}
            <a class="icon-btn" href="#/account" aria-label="我的">${icon.user}</a>
          </header>
          <div class="tideline" id="tideline"></div>
          ${tide('chat-tide')}
          <div class="messages" id="messages"></div>
          <form class="composer" id="composer">
            <textarea id="input" rows="1" placeholder="输入消息…" enterkeyhint="send"></textarea>
            <button class="send" id="sendBtn" type="submit" aria-label="发送">${icon.send}</button>
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
    sel.innerHTML = models.length ? models.map(m => `<option>${esc(m)}</option>`).join('') : '<option value="">暂无可用模型</option>';
    const pick = (current && current.model) || store.get('xs_model', models[0] || '');
    if (models.includes(pick)) sel.value = pick;
    sel.onchange = () => { store.set('xs_model', sel.value); if (current) { current.model = sel.value; saveConvs(); } };

    function renderConvList() {
      const list = $('#convList');
      list.innerHTML = convs.length ? convs.map((c, i) => `
        <div class="conv ${current && c.id === current.id ? 'active' : ''}" data-id="${c.id}" style="--i:${Math.min(i, 12)}">
          <span>${esc(c.title)}</span><button class="del" data-del="${c.id}" aria-label="删除">${icon.trash}</button>
        </div>`).join('') : '<p class="muted small pad">还没有对话</p>';
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
      const cls = (m.error ? 'msg bot error' : 'msg bot') + enter;
      return `<div class="${cls}"><div class="bubble md">${m.content ? window.renderMarkdown(m.content) : wavebars}</div></div>`;
    }

    const HINTS = ['帮我写一封请假邮件', '用三句话解释量子计算', '把这段话翻译成英文', '给我的小店起 5 个名字'];

    function renderMessages() {
      const box = $('#messages');
      const main = box.closest('.chat-main');
      const empty = !current || !current.messages.length;
      main.classList.toggle('is-empty', empty);
      if (empty) {
        box.innerHTML = `<div class="empty">${logo}<h2>今天想聊点什么？</h2><p class="muted">选好上方的模型，直接输入问题即可。</p>
          <div class="hints">${HINTS.map((h, i) => `<button type="button" class="hint" style="--i:${i}">${h}</button>`).join('')}</div></div>`;
        return;
      }
      box.innerHTML = current.messages.map(msgHtml).join('');
      animateFrom = Infinity;
      box.scrollTop = box.scrollHeight;
    }

    $('#messages').addEventListener('click', e => {
      const hint = e.target.closest('.hint');
      if (hint) { input.value = hint.textContent; autosize(); input.focus(); return; }
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
      saveConvs(); renderConvList(); renderMessages();
      await streamReply(current, reply);
    });

    async function streamReply(conv, reply) {
      const ctrl = new AbortController();
      streaming = ctrl;
      const btn = $('#sendBtn');
      btn.innerHTML = icon.stop; btn.classList.add('stop'); btn.setAttribute('aria-label', '停止');
      $('#tideline').classList.add('flowing');
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
          reply.content = (reply.content ? reply.content + '\n\n' : '') + `⚠️ ${err.message}` + (err.status === 402 ? '\n\n[去充值](#/recharge)' : '');
          if (err.status === 402) toast('余额不足，请先充值', 'warn');
        }
      } finally {
        streaming = null;
        saveConvs();
        if ($('#tideline')) $('#tideline').classList.remove('flowing');
        if (conv === current && $('#sendBtn')) {
          renderMessages();
          const b = $('#sendBtn'); b.innerHTML = icon.send; b.classList.remove('stop'); b.setAttribute('aria-label', '发送');
        }
        refreshBalance();
      }
    }

    renderConvList();
    renderMessages();
  }

  async function refreshBalance() {
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

  async function viewImage() {
    if (!imageOn()) return pageShell('AI 生图', '<section class="card"><p>生图功能暂未开放，请联系客服。</p></section>');
    const sizes = { '1024x1024': '方图 1:1', '1024x1536': '竖图 2:3', '1536x1024': '横图 3:2' };
    const note = appCfg.image.price_note;
    pageShell('AI 生图', `
      <section class="card">
        <label>模型<select id="imgModel"><option value="">加载中…</option></select></label>
        <p class="muted small">尺寸</p>
        <div class="amounts" id="imgSize">${Object.entries(sizes).map(([v, n], i) => `<button type="button" class="amount ${i === 0 ? 'on' : ''}" data-s="${v}">${n}</button>`).join('')}</div>
        <label class="custom">描述你想要的画面<textarea id="imgPrompt" rows="4" maxlength="4000" placeholder="例如：雨夜的东京街头，霓虹灯倒映在积水里，电影感"></textarea></label>
        <button class="btn primary block" id="imgGo">${icon.image}生成图片</button>
        <p class="muted small center">${note ? esc(note) + ' · ' : ''}按张计费，从余额扣除 · 余额 ${yuan(me.balance_usd)}</p>
      </section>
      <div id="imgResults" class="img-results"></div>`);

    const sel = $('#imgModel');
    try { if (!imgModels.length) imgModels = (await api('GET', '/image/models')).models; } catch (e) { toast(e.message, 'err'); }
    if (!$('#imgModel')) return; // 已离开页面
    sel.innerHTML = imgModels.length ? imgModels.map(m => `<option>${esc(m)}</option>`).join('') : '<option value="">暂无可用模型</option>';
    const saved = store.get('xs_img_model', '');
    if (imgModels.includes(saved)) sel.value = saved;
    sel.onchange = () => store.set('xs_img_model', sel.value);

    const sizeBox = $('#imgSize');
    sizeBox.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      sizeBox.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });

    let items = store.get(imgKey(), []);
    const renderResults = () => {
      const box = $('#imgResults'); if (!box) return;
      box.innerHTML = items.map((it, i) => `
        <figure class="card img-card">
          ${it.pending ? `<div class="img-wait">${tide()}${wavebars}<small>正在生成，通常需要 10-60 秒…</small></div>`
            : it.error ? `<div class="img-wait error"><small>⚠️ ${esc(it.error)}${/余额不足/.test(it.error) ? ' <a href="#/recharge">去充值</a>' : ''}</small></div>`
            : `<img src="${it.src}" alt="${esc(it.prompt)}">`}
          <figcaption><span>${esc(it.prompt)}</span>${it.src ? `<a class="btn ghost" href="${it.src}" download="xingshu-${it.at}.png">保存</a>` : ''}<button class="icon-btn" data-del="${i}" aria-label="删除">${icon.trash}</button></figcaption>
        </figure>`).join('') + (items.some(x => x.src) ? '<p class="muted small center">手机上也可以长按图片保存到相册</p>' : '');
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

    $('#imgGo').onclick = async () => {
      if (imgBusy) return toast('上一张还在生成，请稍等', 'warn');
      const prompt = $('#imgPrompt').value.trim();
      if (!prompt) return toast('请先描述画面', 'warn');
      if (!sel.value) return toast('暂无可用模型', 'warn');
      const size = $('#imgSize .on').dataset.s;
      const it = { prompt, pending: true, at: Date.now() };
      items.unshift(it); renderResults();
      imgBusy = true; $('#imgGo').disabled = true;
      try {
        const r = await api('POST', '/image', { model: sel.value, prompt, size });
        it.src = r.images[0];
      } catch (e) {
        it.error = e.message;
        if (/余额不足/.test(e.message)) toast('余额不足，请先充值', 'warn');
      } finally {
        delete it.pending; imgBusy = false;
        persist(); renderResults();
        const b = $('#imgGo'); if (b) b.disabled = false;
        refreshBalance();
      }
    };
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
      <section class="card balance-card">
        ${tide()}
        <p class="muted">账户余额</p>
        <p class="big" id="bigBal">${yuan(0)}</p>
        <a class="btn primary" href="#/recharge">充值</a>
      </section>
      <section class="card list">
        <a href="#/usage">使用记录<span>›</span></a>
        <a href="#/orders">充值记录<span>›</span></a>
        <a href="#/password">修改密码<span>›</span></a>
      </section>
      <section class="card list">
        <div class="row"><span class="muted">账号</span><span>${esc(me.user.account)}</span></div>
      </section>
      <button class="btn block ghost danger" id="logout">退出登录</button>
      <button class="btn block ghost" id="logoutAll">退出所有设备</button>`);
    countUp($('#bigBal'), me.balance_usd, v => yuan(v));
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
        <p class="muted">选择金额</p>
        <div class="amounts" id="amounts">${cfg.amounts.map((a, i) => `<button type="button" class="amount ${i === 1 ? 'on' : ''}" data-a="${a}">¥${a}</button>`).join('')}</div>
        <label class="custom">其他金额<input id="customAmt" type="number" inputmode="decimal" min="${cfg.min}" max="${cfg.max}" placeholder="${cfg.min} - ${cfg.max}"></label>
      </section>
      <section class="card">
        <p class="muted">支付方式</p>
        <div class="methods" id="methods">${cfg.methods.map((m, i) => `<button type="button" class="method ${i === 0 ? 'on' : ''}" data-m="${m}">${names[m] || m}</button>`).join('')}</div>
      </section>
      <button class="btn primary block" id="payBtn">立即支付</button>
      <p class="muted small center" id="payStatus"></p>`, '#/account');

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
    pageShell('使用记录', '<p class="muted center pad">加载中…</p>', '#/account');
    try {
      const r = await api('GET', `/usage?page=${page}`);
      const rows = r.items.map((i, n) => `
        <div class="usage-row" style="--i:${n}">
          <div><b>${esc(i.model)}</b><small>${new Date(i.time).toLocaleString()}</small></div>
          <div class="right"><b>-¥${(i.cost_usd * cnyPerUsd).toFixed(4)}</b><small>${i.input_tokens} / ${i.output_tokens} tokens</small></div>
        </div>`).join('');
      $('.page-body').innerHTML = `<section class="card list">${rows || '<p class="muted center pad">暂无记录</p>'}</section>
        <div class="pager">${page > 1 ? `<button class="btn ghost" data-p="${page - 1}">上一页</button>` : ''}${page < r.pages ? `<button class="btn ghost" data-p="${page + 1}">下一页</button>` : ''}</div>`;
      $('.pager').onclick = e => { const b = e.target.closest('[data-p]'); if (b) viewUsage(+b.dataset.p); };
    } catch (e) { toast(e.message, 'err'); }
  }

  async function viewOrders() {
    pageShell('充值记录', '<p class="muted center pad">加载中…</p>', '#/account');
    const st = { pending: '待支付', paid: '到账中', credited: '已到账' };
    try {
      const r = await api('GET', '/recharge/orders');
      $('.page-body').innerHTML = `<section class="card list">${r.items.map(o => `
        <div class="usage-row"><div><b>¥${esc(o.amount_cny)}</b><small>${new Date(o.created_at).toLocaleString()}</small></div>
        <div class="right"><span class="tag ${o.status}">${st[o.status] || o.status}</span></div></div>`).join('') || '<p class="muted center pad">暂无记录</p>'}</section>`;
    } catch (e) { toast(e.message, 'err'); }
  }

  function viewPassword() {
    pageShell('修改密码', `
      <form class="card form" id="pwForm">
        <label>原密码<input name="old" type="password" autocomplete="current-password" required></label>
        <label>新密码<input name="np" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="btn primary block" type="submit">保存</button>
      </form>`, '#/account');
    $('#pwForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      if (f.np.value.length < 8) return toast('新密码至少 8 位', 'warn');
      try {
        const r = await api('POST', '/auth/password', { old_password: f.old.value, new_password: f.np.value });
        token = r.token; store.set('xs_token', token);
        toast('密码已修改，其他设备需要重新登录', 'ok'); go('#/account');
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  // ───────── 路由 ─────────
  async function render() {
    const h = location.hash || '#/chat';
    if (!token) {
      if (h === '#/register') return viewAuth('register');
      return viewAuth('login');
    }
    if (!me) {
      try { me = await api('GET', '/me'); cnyPerUsd = me.cny_per_usd || cnyPerUsd; } catch (e) { if (!token) return; toast(e.message, 'err'); return; }
    }
    if (!appCfg) { try { appCfg = await api('GET', '/config'); } catch { /* 下次再取 */ } }
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
