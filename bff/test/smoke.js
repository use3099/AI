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
    if ((m = u.pathname.match(/^\/api\/v1\/admin\/users\/(\d+)$/)) && req.method === 'PUT') {
      const user = state.users.get(+m[1]); if (body.password) user.password = body.password;
      return json(200, ok(user));
    }
    if ((m = u.pathname.match(/^\/api\/v1\/admin\/groups\/(\d+)$/))) {
      return json(200, ok(+m[1] === 3 ? { id: 3, rate_multiplier: 1, image_price_1k: 0.01 } : { id: +m[1], rate_multiplier: 1.5, model_pricing: [{ models: ['claude-y'], input_price: 0.000002, output_price: 0.00001 }] }));
    }
    if (u.pathname === '/api/v1/admin/channels/model-pricing') {
      const model = u.searchParams.get('model');
      return json(200, ok(model === 'gpt-x' ? { found: true, input_price: 0.000001, output_price: 0.000004 } : { found: false }));
    }
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
    state.keys.set(key, { uid, group: body.group_id || null });
    return json(200, ok({ id: 1, key, name: body.name, group_id: body.group_id }));
  }
  if (u.pathname.startsWith('/v1/')) {
    const key = String(req.headers.authorization).replace('Bearer ', '');
    const k = state.keys.get(key);
    if (!k) return json(401, JSON.stringify({ error: { message: 'invalid api key' } }));
    const uid = k.uid;
    if (u.pathname === '/v1/models') {
      const data = k.group === 3 ? [{ id: 'gpt-image-x' }] : [{ id: 'gpt-x' }, { id: 'claude-y' }];
      return json(200, JSON.stringify({ object: 'list', data }));
    }
    if (u.pathname === '/v1/images/generations') {
      if (k.group !== 3) return json(403, JSON.stringify({ error: { message: 'image generation not allowed for this group' } }));
      if (state.users.get(uid).balance <= 0) return json(403, JSON.stringify({ error: { message: 'Insufficient balance' } }));
      state.lastImage = body;
      return json(200, JSON.stringify({ created: 1, data: [{ b64_json: Buffer.from('PNGDATA').toString('base64') }] }));
    }
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

function epaySign(params, key = EPAY_KEY) {
  const s = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '').sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('md5').update(s + key).digest('hex');
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
      SUB2API_URL: mockUrl, SUB2API_ADMIN_KEY: ADMIN_KEY, SUB2API_GROUP_ID: '2', SUB2API_IMAGE_GROUP_ID: '3', IMAGE_PRICE_NOTE: '每张约 ¥0.05',
      EPAY_URL: 'https://pay.example.test', EPAY_PID: '1001', EPAY_KEY, CNY_PER_USD: '7', WITHDRAW_MIN_USDT: '3', EPAY2_URL: 'https://pay2.example.test', EPAY2_PID: '2002', EPAY2_KEY: 'second-merchant-key',
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
    r = await api('GET', '/api/models');
    assert.equal(r.status, 200, '游客可以看模型列表');
    assert.ok(Array.isArray(r.body.models));
    assert.equal(JSON.stringify(r.body).includes('sk-'), false);
    r = await api('POST', '/api/chat', { model: 'gpt-x', messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(r.status, 401, '游客不能对话');
    r = await api('POST', '/api/image', { model: 'gpt-image-x', prompt: 'x' });
    assert.equal(r.status, 401, '游客不能生图');

    r = await api('GET', '/api/models', null, token);
    assert.deepEqual(r.body.models, ['claude-y', 'gpt-x']);

    r = await api('POST', '/api/chat', { model: 'gpt-x', messages: [{ role: 'user', content: 'hi' }] }, token);
    assert.equal(r.status, 402, '余额为 0 时应提示充值: ' + JSON.stringify(r.body));

    // 生图：配置里开放，余额为 0 时提示充值
    r = await api('GET', '/api/config');
    assert.equal(r.body.image.enabled, true);
    assert.equal(r.body.image.price_note, '每张约 ¥0.05');
    r = await api('GET', '/api/image/models', null, token);
    assert.deepEqual(r.body.models, ['gpt-image-x'], '生图模型来自生图分组: ' + JSON.stringify(r.body));
    r = await api('POST', '/api/image', { model: 'gpt-image-x', prompt: '一只猫' }, token);
    assert.equal(r.status, 402, '生图余额不足: ' + JSON.stringify(r.body));

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

    // 价格表（游客可看）：gpt-x 默认价 × 1.5 倍率；claude-y 用分组自定义价
    r = await api('GET', '/api/pricing');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const gx = r.body.models.find(x => x.model === 'gpt-x');
    assert.equal(gx.input, 10.5, '$1/M × 1.5 × 7 = ¥10.5: ' + JSON.stringify(gx));
    assert.equal(gx.output, 42);
    assert.equal(r.body.models.find(x => x.model === 'claude-y').input, 14);

    // 套餐 + 邀请
    r = await api('GET', '/api/config');
    assert.equal(r.body.recharge.packages.length, 4);
    assert.equal(r.body.referral.first_percent, 30);
    assert.equal(r.body.referral.renew_percent, 10);
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const code = r.body.code;
    assert.match(code, /^[A-Z2-9]{6}$/);
    assert.ok(r.body.link.endsWith('/app/?ref=' + code));
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.body.code, code, '邀请码固定不变');
    r = await api('POST', '/api/auth/register', { account: 'friend@example.com', password: 'password123', invite: code.toLowerCase() });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const ftoken = r.body.token;
    r = await api('GET', '/api/recharge/bonus', null, ftoken);
    assert.equal(r.body.first_bonus, 10);
    // 好友买「常用」套餐 ¥50（送 5%）+ 受邀首充再送 10% → ¥50/7 × 1.15
    r = await api('POST', '/api/recharge', { package: '2', method: 'wxpay' }, ftoken);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.amount_cny, '50.00');
    assert.equal(r.body.bonus_percent, 15);
    const fno = r.body.order_no;
    const fn = { pid: '1001', trade_no: 'T2', out_trade_no: fno, type: 'wxpay', name: 'x', money: '50.00', trade_status: 'TRADE_SUCCESS' };
    fn.sign = epaySign(fn); fn.sign_type = 'MD5';
    n = await fetch(base + '/pay/notify?' + new URLSearchParams(fn));
    assert.equal(await n.text(), 'success');
    r = await api('GET', '/api/me', null, ftoken);
    assert.ok(Math.abs(r.body.balance_usd - 50 / 7 * 1.15) < 1e-4, '好友到账含赠送: ' + r.body.balance_usd);
    r = await api('GET', '/api/me', null, token);
    assert.ok(Math.abs(r.body.balance_usd - 10) < 1e-4, '佣金是现金，不再加到邀请人余额: ' + r.body.balance_usd);
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.body.invited, 1); assert.equal(r.body.paid, 1);
    assert.equal(r.body.earned_usdt, 2.14, '首充 30%：50/7×0.3: ' + JSON.stringify(r.body));
    // 好友第二次充值 ¥100：续费 10%
    r = await api('POST', '/api/recharge', { package: '3', method: 'wxpay' }, ftoken);
    const fno2 = r.body.order_no;
    const fn2 = { pid: '1001', trade_no: 'T3', out_trade_no: fno2, type: 'wxpay', name: 'x', money: r.body.amount_cny, trade_status: 'TRADE_SUCCESS' };
    fn2.sign = epaySign(fn2); fn2.sign_type = 'MD5';
    assert.equal(await (await fetch(base + '/pay/notify?' + new URLSearchParams(fn2))).text(), 'success');
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.body.earned_usdt, 3.57, '续费 10%：+100/7×0.1: ' + JSON.stringify(r.body));
    assert.equal(r.body.available_usdt, 3.57);
    // 提现
    r = await api('POST', '/api/invite/withdraw', { address: 'abc' }, token);
    assert.equal(r.status, 400, '地址不对');
    const addr = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
    r = await api('POST', '/api/invite/withdraw', { address: addr }, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const wid = r.body.id;
    r = await api('POST', '/api/invite/withdraw', { address: addr }, token);
    assert.equal(r.status, 400, '同时只能一笔');
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.body.available_usdt, 0); assert.equal(r.body.pending_usdt, 3.57);
    const sig = act => crypto.createHmac('sha256', 'j'.repeat(48)).update(`wd:${wid}:${act}`).digest('hex').slice(0, 32);
    r = await api('GET', `/api/admin/withdraw?id=${wid}&act=paid&sig=${'0'.repeat(32)}`);
    assert.equal(r.status, 403, '签名不对');
    r = await api('GET', `/api/admin/withdraw?id=${wid}&act=paid&sig=${sig('paid')}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    r = await api('GET', '/api/invite', null, token);
    assert.equal(r.body.paid_out_usdt, 3.57); assert.equal(r.body.pending_usdt, 0); assert.equal(r.body.withdrawals[0].status, 'paid');
    r = await api('GET', '/api/recharge/bonus', null, ftoken);
    assert.equal(r.body.first_bonus, 0, '首充赠送只有一次');
    r = await api('POST', '/api/recharge', { package: '99', method: 'wxpay' }, ftoken);
    assert.equal(r.status, 400, '不存在的套餐');

    // 第二商户：下一单交替走商户 2，回调用商户 2 的密钥验签
    const ptoken = ftoken; // 注册接口每小时限 5 次，这里用已有的用户
    r = await api('POST', '/api/recharge', { amount: 10, method: 'alipay' }, ptoken);
    const q2 = Object.fromEntries(new URL(r.body.pay_url).searchParams);
    assert.ok(r.body.pay_url.startsWith('https://pay2.example.test/submit.php?'), '交替到第二商户: ' + r.body.pay_url);
    assert.equal(q2.pid, '2002'); assert.equal(q2.sign, epaySign(q2, 'second-merchant-key'));
    const n2 = { pid: '2002', trade_no: 'T9', out_trade_no: r.body.order_no, type: 'alipay', name: 'x', money: '10.00', trade_status: 'TRADE_SUCCESS' };
    const n2bad = { ...n2 }; n2bad.sign = epaySign(n2bad); n2bad.sign_type = 'MD5';
    assert.equal((await fetch(base + '/pay/notify?' + new URLSearchParams(n2bad))).status, 400, '商户 2 的单用商户 1 的密钥签名必须拒绝');
    n2.sign = epaySign(n2, 'second-merchant-key'); n2.sign_type = 'MD5';
    assert.equal(await (await fetch(base + '/pay/notify?' + new URLSearchParams(n2))).text(), 'success');
    r = await api('POST', '/api/recharge', { amount: 10, method: 'alipay' }, ptoken);
    assert.ok(r.body.pay_url.startsWith('https://pay.example.test/'), '再下一单回到第一商户');
    // 对话：流式转发
    const cr = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ model: 'gpt-x', messages: [{ role: 'user', content: 'hi' }] }) });
    assert.equal(cr.status, 200);
    assert.match(cr.headers.get('content-type'), /event-stream/);
    const sse = await cr.text();
    assert.ok(sse.includes('你好') && sse.includes('[DONE]'), sse);

    r = await api('GET', '/api/usage', null, token);
    assert.equal(r.body.items[0].model, 'gpt-x');

    // 生图成功：走生图分组的 Key，返回 data URL，响应里不含 key
    r = await api('POST', '/api/image', { model: 'gpt-image-x', prompt: '一只猫', size: '1536x1024' }, token);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.images[0].startsWith('data:image/png;base64,'));
    assert.equal(state.lastImage.size, '1536x1024');
    assert.equal(JSON.stringify(r.body).includes('sk-'), false);
    r = await api('POST', '/api/image', { model: 'gpt-image-x', prompt: '' }, token);
    assert.equal(r.status, 400, '空描述');
    // 聊天 Key 仍在聊天分组
    assert.ok([...state.keys.values()].some(k => k.group === 2), '聊天 Key 在分组 2');

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
