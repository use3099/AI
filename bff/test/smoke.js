// 冒烟测试：起一个模拟的 sub2api（按真实接口格式返回），再起 BFF，把主要流程走一遍。
// 用法：node test/smoke.js
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const ADMIN_KEY = 'admin-test-key';
const EPAY_KEY = 'epay-test-key';
const state = { users: new Map(), nextId: 100, keys: new Map(), idem: new Set(), calls: [] };
const ok = data => JSON.stringify({ code: 0, message: 'success', data });

// ── 模拟 sub2api ──
const mock = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const u = new URL(req.url, 'http://x');
  state.calls.push(`${req.method} ${u.pathname}`);
  const json = (s, d) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(d); };

  if (u.pathname.startsWith('/api/v1/admin/')) {
    if (req.headers['x-api-key'] !== ADMIN_KEY) return json(401, JSON.stringify({ code: 401, message: 'unauthorized' }));
    let m;
    if (req.method === 'POST' && u.pathname === '/api/v1/admin/users') {
      const id = state.nextId++;
      state.users.set(id, { id, email: body.email, password: body.password, balance: body.balance || 0 });
      return json(200, ok({ id, email: body.email, balance: body.balance || 0 }));
    }
    if ((m = u.pathname.match(/^\/api\/v1\/admin\/users\/(\d+)\/balance$/)) && req.method === 'POST') {
      const k = req.headers['idempotency-key'];
      if (!k) return json(400, JSON.stringify({ code: 400, message: 'idempotency key is required' }));
      const user = state.users.get(+m[1]);
      if (!state.idem.has(k)) { state.idem.add(k); user.balance += body.balance; }
      return json(200, ok(user));
    }
    if ((m = u.pathname.match(/^\/api\/v1\/admin\/users\/(\d+)$/)) && req.method === 'GET') return json(200, ok(state.users.get(+m[1])));
    if (u.pathname === '/api/v1/admin/usage') {
      return json(200, ok({ items: [{ created_at: '2026-10-17T06:00:00Z', model: 'gpt-x', input_tokens: 10, output_tokens: 20, actual_cost: 0.001 }], total: 1, page: 1, page_size: 20, pages: 1 }));
    }
  }
  if (u.pathname === '/api/v1/auth/login') {
    const user = [...state.users.values()].find(x => x.email === body.email && x.password === body.password);
    if (!user) return json(401, JSON.stringify({ code: 401, message: 'invalid credentials' }));
    return json(200, ok({ access_token: 'jwt-' + user.id, token_type: 'Bearer' }));
  }
  if (u.pathname === '/api/v1/keys' && req.method === 'POST') {
    const uid = +String(req.headers.authorization).replace('Bearer jwt-', '');
    const key = 'sk-' + crypto.randomBytes(8).toString('hex');
    state.keys.set(key, uid);
    return json(200, ok({ id: 1, key, name: body.name }));
  }
  if (u.pathname.startsWith('/v1/')) {
    const key = String(req.headers.authorization).replace('Bearer ', '');
    const uid = state.keys.get(key);
    if (!uid) return json(401, JSON.stringify({ error: { message: 'invalid api key' } }));
    if (u.pathname === '/v1/models') return json(200, JSON.stringify({ object: 'list', data: [{ id: 'gpt-x' }, { id: 'claude-y' }] }));
    if (u.pathname === '/v1/chat/completions') {
      if (state.users.get(uid).balance <= 0) return json(403, JSON.stringify({ error: { message: 'Insufficient balance' } }));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"！"}}]}\n\n');
      return res.end('data: [DONE]\n\n');
    }
  }
  json(404, JSON.stringify({ code: 404, message: 'not found ' + u.pathname }));
});

function epaySign(params) {
  const s = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '').sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('md5').update(s + EPAY_KEY).digest('hex');
}

async function main() {
  await new Promise(r => mock.listen(0, r));
  const mockUrl = `http://127.0.0.1:${mock.address().port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bff-test-'));
  const port = Number(process.env.SERVE) || 18000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'src', 'server.js')], {
    env: {
      ...process.env, PORT: String(port), PUBLIC_URL: 'https://example.test', DATA_DIR: dataDir,
      BFF_JWT_SECRET: 'j'.repeat(48), BFF_DATA_SECRET: 'd'.repeat(48),
      SUB2API_URL: mockUrl, SUB2API_ADMIN_KEY: ADMIN_KEY,
      EPAY_URL: 'https://pay.example.test', EPAY_PID: '1001', EPAY_KEY, CNY_PER_USD: '7',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const base = `http://127.0.0.1:${port}/app`;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/health'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

  const api = async (method, p, body, token) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { j = text; }
    return { status: r.status, body: j };
  };

  if (process.env.SERVE) { console.log('预览地址: ' + base + '/'); return; }  // 只启动不测试，给界面预览用
  try {
    let r = await api('POST', '/api/auth/register', { account: 'Test@Example.com', password: 'short' });
    assert.equal(r.status, 400, '短密码应被拒绝');

    r = await api('POST', '/api/auth/register', { account: 'Test@Example.com', password: 'password123' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const token = r.body.token;
    assert.ok(token);
    assert.equal(JSON.stringify(r.body).includes('sk-'), false, '注册响应不能含 sub2api key');

    r = await api('POST', '/api/auth/register', { account: 'test@example.com', password: 'password123' });
    assert.equal(r.status, 409, '重复注册');

    r = await api('POST', '/api/auth/login', { account: 'test@example.com', password: 'wrongpass1' });
    assert.equal(r.status, 401);
    r = await api('POST', '/api/auth/login', { account: 'test@example.com', password: 'password123' });
    assert.equal(r.status, 200);

    r = await api('GET', '/api/me', null, token);
    assert.equal(r.status, 200);
    assert.equal(r.body.balance_usd, 0);
    assert.equal(JSON.stringify(r.body).includes('sk-'), false, '/me 不能含 key');

    r = await api('GET', '/api/me');
    assert.equal(r.status, 401, '未登录访问');

    r = await api('GET', '/api/models', null, token);
    assert.deepEqual(r.body.models, ['claude-y', 'gpt-x']);

    r = await api('POST', '/api/chat', { model: 'gpt-x', messages: [{ role: 'user', content: 'hi' }] }, token);
    assert.equal(r.status, 402, '余额为 0 时应提示充值: ' + JSON.stringify(r.body));

    // 充值：下单 → 模拟易支付回调 → 余额到账
    r = await api('POST', '/api/recharge', { amount: 70, method: 'alipay' }, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const { order_no, pay_url } = r.body;
    assert.ok(pay_url.startsWith('https://pay.example.test/submit.php?'));
    const q = Object.fromEntries(new URL(pay_url).searchParams);
    assert.equal(q.sign, epaySign(q), '下单签名正确');

    const notify = { pid: '1001', trade_no: 'T1', out_trade_no: order_no, type: 'alipay', name: 'x', money: '70.00', trade_status: 'TRADE_SUCCESS' };
    const bad = { ...notify, sign: 'deadbeef', sign_type: 'MD5' };
    let n = await fetch(base + '/pay/notify?' + new URLSearchParams(bad));
    assert.equal(n.status, 400, '错误签名必须拒绝');
    const wrongMoney = { ...notify, money: '0.01' }; wrongMoney.sign = epaySign(wrongMoney); wrongMoney.sign_type = 'MD5';
    n = await fetch(base + '/pay/notify?' + new URLSearchParams(wrongMoney));
    assert.equal(n.status, 400, '金额不符必须拒绝');

    notify.sign = epaySign(notify); notify.sign_type = 'MD5';
    n = await fetch(base + '/pay/notify?' + new URLSearchParams(notify));
    assert.equal(await n.text(), 'success');
    n = await fetch(base + '/pay/notify?' + new URLSearchParams(notify)); // 重复回调
    assert.equal(await n.text(), 'success');

    r = await api('GET', '/api/me', null, token);
    assert.equal(r.body.balance_usd, 10, '¥70 / 7 = $10，且重复回调不重复加钱');
    r = await api('GET', `/api/recharge/${order_no}`, null, token);
    assert.equal(r.body.status, 'credited');

    // 对话：流式转发
    const cr = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ model: 'gpt-x', messages: [{ role: 'user', content: 'hi' }] }) });
    assert.equal(cr.status, 200);
    assert.match(cr.headers.get('content-type'), /event-stream/);
    const sse = await cr.text();
    assert.ok(sse.includes('你好') && sse.includes('[DONE]'), sse);

    r = await api('GET', '/api/usage', null, token);
    assert.equal(r.body.items[0].model, 'gpt-x');

    // 另一个用户不能查看别人的订单
    const r2 = await api('POST', '/api/auth/register', { account: '+61400000000', password: 'password456' });
    r = await api('GET', `/api/recharge/${order_no}`, null, r2.body.token);
    assert.equal(r.status, 404);

    // 静态页面与 CSP
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.ok(page.headers.get('content-security-policy'));
    const trav = await fetch(base + '/..%2f..%2fsrc%2fconfig.js');
    assert.ok(!(await trav.text()).includes('BFF_JWT_SECRET'), '目录穿越');

    // 退出所有设备后旧 token 失效
    await api('POST', '/api/auth/logout-all', {}, token);
    r = await api('GET', '/api/me', null, token);
    assert.equal(r.status, 401);

    console.log('\n✅ 全部通过；调用过的 sub2api 接口:', [...new Set(state.calls)].join(', '));
  } finally {
    child.kill();
    mock.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error('❌', e); process.exit(1); });
