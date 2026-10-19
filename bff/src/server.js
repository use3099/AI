// 星枢 API · App 后端（BFF）
// App 只和这里通信；sub2api 在内网，客户永远看不到它，也拿不到真实的 API Key。
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const db = require('./db');
const s2 = require('./sub2api');
const epay = require('./epay');
const { hashPassword, verifyPassword, signJwt, verifyJwt, encrypt, decrypt, randomString } = require('./crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ───────── 小工具 ─────────
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, data, headers = {}) {
  if (res.headersSent) return;
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'content-type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '请求内容太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req, limit) {
  const text = await readBody(req, limit);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, '请求格式错误'); }
}

function clientIp(req) {
  if (config.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

// 固定窗口限流（单进程内存，够用）
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  if (b.count > max) throw new HttpError(429, '操作太频繁，请稍后再试');
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60000).unref();

// 去掉上游报错里可能出现的内部信息，避免客户看到后端实现
function cleanMessage(msg) {
  return String(msg || '').replace(/sub2api/gi, '服务').replace(/https?:\/\/[^\s"']+/g, '').slice(0, 300);
}

const money = n => (Math.round(n * 100) / 100).toFixed(2);

// ───────── 账号 ─────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{6,15}$/;

function normalizeAccount(raw) {
  const a = String(raw || '').trim().toLowerCase().replace(/[\s-]/g, '');
  if (EMAIL_RE.test(a) && a.length <= 120) return a;
  if (PHONE_RE.test(a)) return a;
  throw new HttpError(400, '请输入正确的邮箱或手机号');
}

function auth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const p = verifyJwt(token);
  if (!p) throw new HttpError(401, '请先登录');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(p.uid);
  if (!user || user.token_ver !== p.tv) throw new HttpError(401, '登录已失效，请重新登录');
  if (user.status !== 'active') throw new HttpError(403, '账号已被停用，请联系客服');
  return user;
}

const issueToken = u => signJwt({ uid: u.id, tv: u.token_ver });
const publicUser = u => ({ id: u.id, account: u.account, created_at: u.created_at });

// 给 App 账号在 sub2api 里开一个对应用户 + API Key（只存服务器，不给客户端）
async function provision(user) {
  if (user.s2_user_id && user.s2_key_enc) return user;
  const password = randomString(32);
  let s2UserId = user.s2_user_id;
  let s2Email = user.s2_email;
  if (!s2UserId) {
    s2Email = `xs${user.id}-${randomString(6).toLowerCase()}@bff.invalid`;
    const created = await s2.createUser({
      email: s2Email,
      password,
      username: `xs${user.id}`,
      notes: `星枢 App 用户 #${user.id}`,
    });
    s2UserId = created.id;
  } else {
    // 用户已建但 key 没建成：重置密码后再登录建 key
    await s2.setPassword(s2UserId, password);
  }
  db.prepare('UPDATE users SET s2_user_id = ?, s2_email = ? WHERE id = ?').run(s2UserId, s2Email, user.id);
  const jwt = await s2.login(s2Email, password);
  const key = await s2.createKey(jwt, 'app');
  db.prepare('UPDATE users SET s2_key_enc = ? WHERE id = ?').run(encrypt(key), user.id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
}

function userKey(user) {
  if (!user.s2_key_enc) throw new HttpError(503, '账号还在初始化，请稍后重试');
  return decrypt(user.s2_key_enc);
}

// 生图 Key：第一次用生图时才开（只在生图分组里，和聊天分开计价）
const imgKeyJobs = new Map();
async function imageKey(user) {
  if (!config.image.groupId) throw new HttpError(503, '生图功能暂未开放');
  if (user.s2_img_key_enc) return decrypt(user.s2_img_key_enc);
  if (!user.s2_user_id) throw new HttpError(503, '账号还在初始化，请稍后重试');
  if (!imgKeyJobs.has(user.id)) {
    const job = (async () => {
      const password = randomString(32);
      await s2.setPassword(user.s2_user_id, password);
      const jwt = await s2.login(user.s2_email, password);
      const key = await s2.createKey(jwt, 'app-image', config.image.groupId);
      db.prepare('UPDATE users SET s2_img_key_enc = ? WHERE id = ?').run(encrypt(key), user.id);
      return key;
    })().finally(() => imgKeyJobs.delete(user.id));
    imgKeyJobs.set(user.id, job);
  }
  try {
    return await imgKeyJobs.get(user.id);
  } catch (e) {
    log('开通生图失败', user.id, e.message);
    throw new HttpError(503, '生图功能开通失败，请稍后再试');
  }
}

// 上游返回非 2xx 时，转成给客户看的错误
async function upstreamError(upstream, tag) {
  const text = await upstream.text().catch(() => '');
  let msg = '';
  try { const j = JSON.parse(text); msg = j.error?.message || j.message || ''; } catch { msg = text; }
  // sub2api 余额不足：403 INSUFFICIENT_BALANCE "Insufficient account balance"（middleware/api_key_auth.go）
  if (upstream.status === 402 || /insufficient|余额不足/i.test(msg + ' ' + text)) {
    return new HttpError(402, '余额不足，请先充值');
  }
  if (upstream.status === 429) return new HttpError(429, '当前使用人数较多，请稍后再试');
  log(`${tag} 上游错误`, upstream.status, msg.slice(0, 200));
  return new HttpError(upstream.status >= 500 ? 502 : upstream.status, cleanMessage(msg) || '请求失败');
}

// ───────── 充值到账（支付成功 → 给 sub2api 加余额） ─────────
async function creditOrder(no) {
  const order = db.prepare('SELECT * FROM orders WHERE no = ?').get(no);
  if (!order || order.status !== 'paid') return;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
  try {
    if (!user || !user.s2_user_id) throw new Error('用户未开通');
    await s2.addBalance(user.s2_user_id, order.credit_usd, `App 充值 ¥${order.amount_cny} 订单 ${order.no}`, `bff-order-${order.no}`);
    db.prepare("UPDATE orders SET status = 'credited', credited_at = ?, last_error = NULL WHERE no = ? AND status = 'paid'").run(Date.now(), no);
    log('充值到账', no, `user=${order.user_id}`, `+$${order.credit_usd}`);
  } catch (e) {
    db.prepare('UPDATE orders SET last_error = ? WHERE no = ?').run(String(e.message).slice(0, 500), no);
    log('充值到账失败，稍后重试', no, e.message);
    return;
  }
  // 推广佣金（现金，USDT）：好友首次充值按 REFERRAL_FIRST_PERCENT%，之后每次按 REFERRAL_RENEW_PERCENT%，以实付金额计算
  if (user.inviter_id) {
    const n = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status = 'credited'").get(user.id).n;
    const first = n <= 1;
    const rate = first ? config.referral.firstPercent : config.referral.renewPercent;
    const amount = Math.round(Number(order.amount_cny) / config.cnyPerUsd * rate / 100 * 1e6) / 1e6;
    if (rate > 0 && amount > 0) {
      const r = db.prepare('INSERT OR IGNORE INTO commissions (order_no, inviter_id, invitee_id, paid_cny, rate, first, amount_usdt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(order.no, user.inviter_id, user.id, Number(order.amount_cny), rate, first ? 1 : 0, amount, Date.now());
      if (r.changes) log('推广佣金', order.no, `inviter=${user.inviter_id}`, `${first ? '首充' : '续费'} ${rate}%`, `+${amount} USDT`);
    }
  }
}

// ───────── 推广佣金 / 提现 ─────────
const round2 = v => Math.round(v * 100) / 100;
function commissionSummary(userId) {
  const earned = db.prepare('SELECT COALESCE(SUM(amount_usdt), 0) AS s FROM commissions WHERE inviter_id = ?').get(userId).s;
  const paidOut = db.prepare("SELECT COALESCE(SUM(amount_usdt), 0) AS s FROM withdrawals WHERE user_id = ? AND status = 'paid'").get(userId).s;
  const pending = db.prepare("SELECT COALESCE(SUM(amount_usdt), 0) AS s FROM withdrawals WHERE user_id = ? AND status = 'pending'").get(userId).s;
  return { earned, paidOut, pending, available: Math.max(0, Math.floor((earned - paidOut - pending) * 100) / 100) };
}

async function tgSend(text) {
  if (!config.tg.token || !config.tg.chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${config.tg.token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: config.tg.chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { log('TG 通知失败', e.message); }
}

// 管理员处理提现的链接：每笔单独签名，链接泄露也只能操作那一笔
const wdSig = (id, act) => crypto.createHmac('sha256', config.jwtSecret).update(`wd:${id}:${act}`).digest('hex').slice(0, 32);
const wdLink = (id, act) => `${config.publicUrl}${config.basePath}/api/admin/withdraw?id=${id}&act=${act}&sig=${wdSig(id, act)}`;

async function payReward(no) {
  const r = db.prepare("SELECT * FROM referral_rewards WHERE order_no = ? AND status = 'pending'").get(no);
  if (!r) return;
  const inviter = db.prepare('SELECT * FROM users WHERE id = ?').get(r.inviter_id);
  try {
    if (!inviter || !inviter.s2_user_id) throw new Error('邀请人未开通');
    await s2.addBalance(inviter.s2_user_id, r.amount_usd, `邀请奖励：好友 #${r.invitee_id} 充值 ${no}`, `bff-ref-${no}`);
    db.prepare("UPDATE referral_rewards SET status = 'credited', credited_at = ?, last_error = NULL WHERE order_no = ?").run(Date.now(), no);
    log('邀请奖励到账', no, `inviter=${r.inviter_id}`, `+$${r.amount_usd}`);
  } catch (e) {
    db.prepare('UPDATE referral_rewards SET last_error = ? WHERE order_no = ?').run(String(e.message).slice(0, 500), no);
    log('邀请奖励到账失败，稍后重试', no, e.message);
  }
}

// 邀请码：6 位，去掉容易看错的字符
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function inviteCode(user) {
  if (user.invite_code) return user.invite_code;
  for (let i = 0; i < 20; i++) {
    const code = Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
    try {
      db.prepare('UPDATE users SET invite_code = ? WHERE id = ? AND invite_code IS NULL').run(code, user.id);
      return db.prepare('SELECT invite_code FROM users WHERE id = ?').get(user.id).invite_code;
    } catch { /* 撞码了，重来 */ }
  }
  throw new HttpError(500, '生成邀请码失败');
}

// 每分钟重试一次 12 小时内付款但还没到账的订单（Idempotency-Key 保证不会重复加钱）
setInterval(() => {
  const rows = db.prepare("SELECT no FROM orders WHERE status = 'paid' AND paid_at > ?").all(Date.now() - 12 * 3600 * 1000);
  for (const r of rows) creditOrder(r.no);
  const refs = db.prepare("SELECT order_no FROM referral_rewards WHERE status = 'pending' AND created_at > ?").all(Date.now() - 7 * 86400 * 1000);
  for (const r of refs) payReward(r.order_no);
}, 60000).unref();

// ───────── 路由 ─────────
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

route('GET', '/api/health', async () => ({ ok: true }));

route('GET', '/api/config', async () => ({
  recharge: {
    enabled: config.epay.enabled,
    methods: config.epay.methods,
    amounts: config.rechargeAmounts,
    min: config.rechargeMin,
    max: config.rechargeMax,
    cny_per_usd: config.cnyPerUsd,
    packages: config.packages,
  },
  referral: { first_percent: config.referral.firstPercent, renew_percent: config.referral.renewPercent, invitee_bonus: config.referral.inviteeBonus, withdraw_min: config.referral.withdrawMin },
  image: { enabled: !!config.image.groupId, price_note: config.image.priceNote, sizes: IMAGE_SIZES },
}));

route('POST', '/api/auth/register', async (req) => {
  rateLimit('reg:' + clientIp(req), 5, 3600 * 1000);
  const body = await readJson(req);
  const account = normalizeAccount(body.account);
  const password = String(body.password || '');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, '密码至少 8 位');
  if (db.prepare('SELECT 1 FROM users WHERE account = ?').get(account)) throw new HttpError(409, '该账号已注册，请直接登录');

  const code = String(body.invite || '').trim().toUpperCase().slice(0, 16);
  const inviter = code ? db.prepare("SELECT id FROM users WHERE invite_code = ? AND status = 'active'").get(code) : null;
  const info = db.prepare('INSERT INTO users (account, pass_hash, inviter_id, created_at) VALUES (?, ?, ?, ?)')
    .run(account, hashPassword(password), inviter ? inviter.id : null, Date.now());
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  try {
    user = await provision(user);
  } catch (e) {
    log('开通失败', account, e.message);
    // 回滚：本地账号删掉，sub2api 里建了一半的用户也删掉
    const half = db.prepare('SELECT s2_user_id FROM users WHERE id = ?').get(user.id);
    if (half && half.s2_user_id) s2.deleteUser(half.s2_user_id).catch(() => {});
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    throw new HttpError(503, '注册失败，服务暂时不可用，请稍后再试');
  }
  log('新用户', account, `id=${user.id}`);
  return { token: issueToken(user), user: publicUser(user) };
});

route('POST', '/api/auth/login', async (req) => {
  const ip = clientIp(req);
  rateLimit('login:' + ip, 20, 10 * 60 * 1000);
  const body = await readJson(req);
  const account = normalizeAccount(body.account);
  rateLimit('login-acct:' + account, 10, 10 * 60 * 1000);
  let user = db.prepare('SELECT * FROM users WHERE account = ?').get(account);
  if (!user || !verifyPassword(String(body.password || ''), user.pass_hash)) throw new HttpError(401, '账号或密码错误');
  if (user.status !== 'active') throw new HttpError(403, '账号已被停用，请联系客服');
  if (!user.s2_key_enc) {
    try { user = await provision(user); } catch (e) { log('补开通失败', account, e.message); }
  }
  return { token: issueToken(user), user: publicUser(user) };
});

route('POST', '/api/auth/password', async (req) => {
  const user = auth(req);
  const body = await readJson(req);
  if (!verifyPassword(String(body.old_password || ''), user.pass_hash)) throw new HttpError(400, '原密码不正确');
  const np = String(body.new_password || '');
  if (np.length < 8 || np.length > 128) throw new HttpError(400, '新密码至少 8 位');
  db.prepare('UPDATE users SET pass_hash = ?, token_ver = token_ver + 1 WHERE id = ?').run(hashPassword(np), user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return { token: issueToken(fresh) };
});

route('POST', '/api/auth/logout-all', async (req) => {
  const user = auth(req);
  db.prepare('UPDATE users SET token_ver = token_ver + 1 WHERE id = ?').run(user.id);
  return { ok: true };
});

route('GET', '/api/me', async (req) => {
  const user = auth(req);
  let balance = null;
  if (user.s2_user_id) {
    try { balance = Number((await s2.getUser(user.s2_user_id)).balance); } catch (e) { log('查余额失败', e.message); }
  }
  return { user: publicUser(user), balance_usd: balance, cny_per_usd: config.cnyPerUsd };
});

let modelsCache = { at: 0, list: [] };
// 游客也能看到模型列表（像 ChatGPT 一样先看界面，发消息时再注册）
function anyUserKey() {
  const row = db.prepare("SELECT s2_key_enc FROM users WHERE s2_key_enc IS NOT NULL AND status = 'active' ORDER BY id DESC LIMIT 1").get();
  return row ? decrypt(row.s2_key_enc) : null;
}
route('GET', '/api/models', async (req) => ({ models: await listModels(req.headers.authorization ? auth(req) : null) }));
async function listModels(user) {
  if (Date.now() - modelsCache.at < 5 * 60 * 1000 && modelsCache.list.length) return modelsCache.list;
  const key = user ? userKey(user) : anyUserKey();
  if (!key) return config.allowedModels;
  const r = await s2.gateway('GET', '/models', key, undefined, AbortSignal.timeout(15000));
  if (!r.ok) throw new HttpError(502, '获取模型列表失败');
  const j = await r.json();
  let ids = (j.data || []).map(m => m.id).filter(Boolean);
  if (config.allowedModels.length) ids = ids.filter(id => config.allowedModels.includes(id));
  ids = [...new Set(ids)].sort();
  modelsCache = { at: Date.now(), list: ids };
  return ids;
}

const CHAT_FIELDS = ['model', 'messages', 'temperature', 'top_p', 'max_tokens', 'max_completion_tokens', 'stream', 'reasoning_effort'];

route('POST', '/api/chat', async (req, res) => {
  const user = auth(req);
  rateLimit('chat:' + user.id, config.chatPerMinute, 60 * 1000);
  const raw = await readJson(req, 4 * 1024 * 1024);
  const body = {};
  for (const k of CHAT_FIELDS) if (raw[k] !== undefined) body[k] = raw[k];
  if (typeof body.model !== 'string' || !body.model) throw new HttpError(400, '请选择模型');
  if (config.allowedModels.length && !config.allowedModels.includes(body.model)) throw new HttpError(400, '该模型暂不可用');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 400) throw new HttpError(400, '消息格式错误');
  for (const m of body.messages) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role)) throw new HttpError(400, '消息格式错误');
  }
  if (body.stream === undefined) body.stream = true;
  if (body.stream) body.stream_options = { include_usage: true };

  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });

  let upstream;
  try {
    upstream = await s2.gateway('POST', '/chat/completions', userKey(user), body, ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    log('chat 上游连接失败', e.message);
    throw new HttpError(502, '服务暂时不可用，请稍后再试');
  }

  if (!upstream.ok) throw await upstreamError(upstream, 'chat');

  res.writeHead(200, {
    'content-type': upstream.headers.get('content-type') || (body.stream ? 'text/event-stream' : 'application/json'),
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    connection: 'keep-alive',
  });
  try {
    for await (const chunk of upstream.body) {
      if (!res.write(chunk)) await new Promise(r => res.once('drain', r));
    }
  } catch (e) {
    if (!ctrl.signal.aborted) log('chat 流中断', e.message);
  }
  res.end();
  return undefined; // 已自行响应
}, { raw: true });

// ───────── 生图 ─────────
let imageModelsCache = { at: 0, list: [] };
route('GET', '/api/image/models', async (req) => {
  const user = auth(req);
  if (config.image.models.length) { await imageKey(user); return { models: config.image.models }; }
  if (Date.now() - imageModelsCache.at < 5 * 60 * 1000 && imageModelsCache.list.length) return { models: imageModelsCache.list };
  const r = await s2.gateway('GET', '/models', await imageKey(user), undefined, AbortSignal.timeout(15000));
  if (!r.ok) throw new HttpError(502, '获取生图模型失败');
  const j = await r.json();
  const ids = [...new Set((j.data || []).map(m => m.id).filter(Boolean))].sort();
  imageModelsCache = { at: Date.now(), list: ids };
  return { models: ids };
});

const IMAGE_SIZES = ['1024x1024', '1024x1536', '1536x1024', 'auto'];

// 上游有时返回图片网址：由服务器下载后转成 data URL，App 里不出现上游地址
async function toDataUrl(src) {
  if (!/^https:\/\//i.test(src)) throw new Error('图片地址无效');
  const r = await fetch(src, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`下载图片失败 ${r.status}`);
  const type = (r.headers.get('content-type') || 'image/png').split(';')[0];
  if (!type.startsWith('image/')) throw new Error('不是图片');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) throw new Error('图片太大');
  return `data:${type};base64,${buf.toString('base64')}`;
}

route('POST', '/api/image', async (req, res) => {
  const user = auth(req);
  rateLimit('image:' + user.id, config.image.perMinute, 60 * 1000);
  const raw = await readJson(req, 64 * 1024);
  const prompt = String(raw.prompt || '').trim();
  if (!prompt) throw new HttpError(400, '请描述你想生成的图片');
  if (prompt.length > 4000) throw new HttpError(400, '描述太长了，请精简到 4000 字以内');
  const model = String(raw.model || '');
  if (!model) throw new HttpError(400, '请选择生图模型');
  if (config.image.models.length && !config.image.models.includes(model)) throw new HttpError(400, '该模型暂不可用');
  const size = IMAGE_SIZES.includes(raw.size) ? raw.size : '1024x1024';
  const key = await imageKey(user);

  const ctrl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
  const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000);
  let upstream;
  try {
    upstream = await s2.gateway('POST', '/images/generations', key, { model, prompt, size, n: 1 }, ctrl.signal);
  } catch (e) {
    clearTimeout(timer);
    log('image 上游连接失败', e.message);
    throw new HttpError(502, ctrl.signal.aborted ? '生成超时，请稍后再试' : '服务暂时不可用，请稍后再试');
  }
  try {
    if (!upstream.ok) throw await upstreamError(upstream, 'image');
    const j = await upstream.json();
    const images = [];
    for (const d of j.data || []) {
      if (d.b64_json) images.push(`data:image/png;base64,${d.b64_json}`);
      else if (d.url) images.push(await toDataUrl(d.url));
    }
    if (!images.length) throw new HttpError(502, '模型没有返回图片，请换个描述再试');
    return { images, revised_prompt: (j.data && j.data[0] && j.data[0].revised_prompt) || undefined };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    log('image 处理失败', e.message);
    throw new HttpError(502, '生成失败，请稍后再试');
  } finally {
    clearTimeout(timer);
  }
});

route('GET', '/api/usage', async (req, res, url) => {
  const user = auth(req);
  if (!user.s2_user_id) return { items: [], total: 0 };
  const page = Math.max(1, Math.min(500, parseInt(url.searchParams.get('page'), 10) || 1));
  const data = await s2.listUsage(user.s2_user_id, page, 20);
  const items = (data.items || []).map(i => ({
    time: i.created_at,
    model: i.model,
    input_tokens: i.input_tokens,
    output_tokens: i.output_tokens,
    cost_usd: Number(i.actual_cost ?? i.total_cost ?? 0),
  }));
  return { items, total: data.total || 0, page, pages: data.pages || 1 };
});

// 这笔充值能多送多少（百分比）：套餐赠送 + 被邀请用户首充赠送
function rechargeBonus(user, pkg) {
  let pct = pkg ? pkg.bonus : 0;
  if (user.inviter_id && config.referral.inviteeBonus > 0) {
    const paidBefore = db.prepare("SELECT 1 FROM orders WHERE user_id = ? AND status IN ('paid', 'credited') LIMIT 1").get(user.id);
    if (!paidBefore) pct += config.referral.inviteeBonus;
  }
  return pct;
}

route('GET', '/api/recharge/bonus', async (req) => {
  const user = auth(req);
  const first = user.inviter_id && config.referral.inviteeBonus > 0 &&
    !db.prepare("SELECT 1 FROM orders WHERE user_id = ? AND status IN ('paid', 'credited') LIMIT 1").get(user.id);
  return { first_bonus: first ? config.referral.inviteeBonus : 0 };
});

// 邀请好友
route('GET', '/api/invite', async (req) => {
  const user = auth(req);
  const code = inviteCode(user);
  const invited = db.prepare('SELECT COUNT(*) AS n FROM users WHERE inviter_id = ?').get(user.id).n;
  const paid = db.prepare('SELECT COUNT(DISTINCT invitee_id) AS n FROM commissions WHERE inviter_id = ?').get(user.id).n;
  const sum = commissionSummary(user.id);
  const withdrawals = db.prepare('SELECT id, amount_usdt, address, status, created_at, handled_at FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(user.id);
  const recent = db.prepare('SELECT invitee_id, paid_cny, rate, first, amount_usdt, created_at FROM commissions WHERE inviter_id = ? ORDER BY created_at DESC LIMIT 20').all(user.id);
  return {
    code,
    link: `${config.publicUrl}${config.basePath}/?ref=${code}`,
    first_percent: config.referral.firstPercent,
    renew_percent: config.referral.renewPercent,
    invitee_bonus: config.referral.inviteeBonus,
    withdraw_min: config.referral.withdrawMin,
    invited, paid,
    earned_usdt: round2(sum.earned),
    available_usdt: sum.available,
    pending_usdt: round2(sum.pending),
    paid_out_usdt: round2(sum.paidOut),
    withdrawals, recent,
  };
});

// 申请提现：把可提现的佣金全部提到 TRC20 地址；同一时间只能有一笔在处理
route('POST', '/api/invite/withdraw', async (req) => {
  const user = auth(req);
  rateLimit('wd:' + user.id, 5, 3600 * 1000);
  const body = await readJson(req);
  const address = String(body.address || '').trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) throw new HttpError(400, '请填写正确的 USDT-TRC20 地址（T 开头，34 位）');
  if (db.prepare("SELECT 1 FROM withdrawals WHERE user_id = ? AND status = 'pending'").get(user.id)) throw new HttpError(400, '你有一笔提现正在处理，处理完再申请');
  const sum = commissionSummary(user.id);
  if (sum.available < config.referral.withdrawMin) throw new HttpError(400, `满 ${config.referral.withdrawMin} USDT 才能提现，当前可提 ${sum.available} USDT`);
  const id = db.prepare('INSERT INTO withdrawals (user_id, amount_usdt, address, created_at) VALUES (?, ?, ?, ?)').run(user.id, sum.available, address, Date.now()).lastInsertRowid;
  log('提现申请', `#${id}`, `user=${user.id}`, `${sum.available} USDT`, address);
  await tgSend(`💸💸💸 <b>星枢 有人申请提现</b>\n\n金额：<b>${sum.available} USDT</b>（TRC20）\n地址：<code>${address}</code>\n用户：${user.account}（#${user.id}）\n累计佣金：${round2(sum.earned)} USDT，已提：${round2(sum.paidOut)} USDT\n\n打完款后点：<a href="${wdLink(id, 'paid')}">✅ 已打款</a>\n不打款点：<a href="${wdLink(id, 'reject')}">❌ 驳回</a>`);
  return { ok: true, id, amount_usdt: sum.available };
});

// 管理员：点 TG 里的链接标记「已打款 / 驳回」（驳回后金额退回可提现）
route('GET', '/api/admin/withdraw', async (req) => {
  const u = new URL(req.url, 'http://x');
  const id = Number(u.searchParams.get('id')), act = u.searchParams.get('act'), sig = u.searchParams.get('sig') || '';
  if (!id || !['paid', 'reject'].includes(act) || sig.length !== 32 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(wdSig(id, act)))) throw new HttpError(403, '链接无效');
  const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
  if (!w) throw new HttpError(404, '没有这笔提现');
  if (w.status !== 'pending') return { ok: true, message: `这笔提现之前已经处理过了（${w.status === 'paid' ? '已打款' : '已驳回'}）` };
  db.prepare('UPDATE withdrawals SET status = ?, handled_at = ? WHERE id = ? AND status = ?').run(act === 'paid' ? 'paid' : 'rejected', Date.now(), id, 'pending');
  log('提现处理', `#${id}`, act);
  return { ok: true, message: act === 'paid' ? `已标记为「已打款」：${w.amount_usdt} USDT → ${w.address}` : `已驳回，${w.amount_usdt} USDT 退回用户的可提现余额` };
});

// 价格表：sub2api 的模型默认单价 × 分组倍率（分组里单独定了价就用分组的），换算成「元 / 百万 tokens」
let pricingCache = { at: 0, data: null };
const perM = v => (v == null ? null : Number(v) < 0.01 ? Number(v) * 1e6 : Number(v)); // 兼容按 token 和按百万 token 两种写法
async function buildPricing() {
  const models = await listModels(null);
  const rate = cny => (cny == null ? null : Math.round(cny * config.cnyPerUsd * 100) / 100);
  let group = null;
  if (config.sub2api.groupId) { try { group = await s2.getGroup(config.sub2api.groupId); } catch (e) { log('读分组倍率失败', e.message); } }
  const mult = group && Number(group.rate_multiplier) > 0 ? Number(group.rate_multiplier) : 1;
  const custom = (group && Array.isArray(group.model_pricing) ? group.model_pricing : []);
  const rows = await Promise.all(models.map(async m => {
    const c = custom.find(x => Array.isArray(x.models) && x.models.includes(m));
    if (c && (c.input_price != null || c.output_price != null || c.per_request_price != null)) {
      return { model: m, input: rate(perM(c.input_price)), output: rate(perM(c.output_price)), per_request: c.per_request_price != null ? rate(Number(c.per_request_price)) : null };
    }
    try {
      const p = await s2.modelPricing(m);
      if (!p || !p.found) return { model: m, input: null, output: null };
      return { model: m, input: rate(p.input_price * 1e6 * mult), output: rate(p.output_price * 1e6 * mult) };
    } catch { return { model: m, input: null, output: null }; }
  }));
  let image = null;
  if (config.image.groupId) {
    image = { note: config.image.priceNote || '' };
    if (!image.note) {
      try {
        const g = await s2.getGroup(config.image.groupId);
        const m = g.image_rate_independent && Number(g.image_rate_multiplier) > 0 ? Number(g.image_rate_multiplier) : (Number(g.rate_multiplier) > 0 ? Number(g.rate_multiplier) : 1);
        if (g.image_price_1k != null) image.per_image = rate(Number(g.image_price_1k) * m);
      } catch (e) { log('读生图分组失败', e.message); }
    }
  }
  return { unit: '元 / 百万 tokens', models: rows, image, cny_per_usd: config.cnyPerUsd };
}
route('GET', '/api/pricing', async () => {
  if (pricingCache.data && Date.now() - pricingCache.at < 30 * 60 * 1000) return pricingCache.data;
  const data = await buildPricing();
  if (data.models.length) pricingCache = { at: Date.now(), data };
  return data;
});

// 充值
route('POST', '/api/recharge', async (req) => {
  const user = auth(req);
  if (!config.epay.enabled) throw new HttpError(503, '充值暂未开放');
  rateLimit('order:' + user.id, 10, 10 * 60 * 1000);
  const body = await readJson(req);
  const pkg = body.package ? config.packages.find(p => p.id === String(body.package)) : null;
  if (body.package && !pkg) throw new HttpError(400, '套餐不存在，请刷新后重试');
  const amount = pkg ? pkg.price : Number(body.amount);
  if (!pkg && (!Number.isFinite(amount) || amount < config.rechargeMin || amount > config.rechargeMax)) {
    throw new HttpError(400, `充值金额需在 ¥${config.rechargeMin} - ¥${config.rechargeMax} 之间`);
  }
  const method = String(body.method || '');
  if (!config.epay.methods.includes(method)) throw new HttpError(400, '不支持的支付方式');
  const amountStr = money(amount);
  const base = Number(amountStr) / config.cnyPerUsd;
  const bonusPct = rechargeBonus(user, pkg);
  const round6 = n => Math.round(n * 1e6) / 1e6;
  const bonus = round6(base * bonusPct / 100);
  const credit = round6(base + bonus);
  const no = `XS${Date.now()}${crypto.randomInt(1000, 9999)}`;
  db.prepare('INSERT INTO orders (no, user_id, amount_cny, credit_usd, bonus_usd, package_id, method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(no, user.id, amountStr, credit, bonus, pkg ? pkg.id : null, method, Date.now());
  return {
    order_no: no,
    amount_cny: amountStr,
    credit_usd: credit,
    bonus_percent: bonusPct,
    pay_url: epay.payUrl({ orderNo: no, amount: amountStr, method, name: `星枢 API 充值 ¥${amountStr}` }),
  };
});

route('GET', '/api/recharge/orders', async (req) => {
  const user = auth(req);
  const rows = db.prepare('SELECT no, amount_cny, credit_usd, bonus_usd, package_id, method, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(user.id);
  return { items: rows };
});

route('GET', /^\/api\/recharge\/(XS\d+)$/, async (req, res, url, m) => {
  const user = auth(req);
  const o = db.prepare('SELECT no, amount_cny, credit_usd, method, status, created_at FROM orders WHERE no = ? AND user_id = ?').get(m[1], user.id);
  if (!o) throw new HttpError(404, '订单不存在');
  return o;
});

// 易支付异步通知（GET 或 POST 都可能）
async function payNotify(req, res, url) {
  const params = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') {
    const text = await readBody(req, 64 * 1024);
    for (const [k, v] of new URLSearchParams(text)) params[k] = v;
  }
  if (!config.epay.enabled || !epay.verify(params)) {
    log('支付回调验签失败', params.out_trade_no);
    return send(res, 400, 'fail');
  }
  const order = db.prepare('SELECT * FROM orders WHERE no = ?').get(params.out_trade_no);
  if (!order) return send(res, 404, 'fail');
  if (params.trade_status !== 'TRADE_SUCCESS') return send(res, 200, 'success');
  if (money(Number(params.money)) !== order.amount_cny) {
    log('支付金额不符', order.no, params.money, order.amount_cny);
    return send(res, 400, 'fail');
  }
  const r = db.prepare("UPDATE orders SET status = 'paid', trade_no = ?, paid_at = ? WHERE no = ? AND status = 'pending'")
    .run(String(params.trade_no || ''), Date.now(), order.no);
  if (r.changes === 1) await creditOrder(order.no);
  return send(res, 200, 'success');
}
route('GET', '/pay/notify', payNotify, { raw: true });
route('POST', '/pay/notify', payNotify, { raw: true });

route('GET', '/pay/return', async (req, res) => {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>支付完成</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f4f5f8;color:#1c2333}div{text-align:center;padding:24px}h1{font-size:20px}p{color:#667}</style></head>
<body><div><h1>支付已提交</h1><p>请返回「星枢 API」App，余额会在几秒内到账。</p></div></body></html>`;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}, { raw: true });

// ───────── 静态页面（App 界面） ─────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

function serveStatic(req, res, p) {
  let rel = decodeURIComponent(p).replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'not found');
  let target = file;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(target);
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : ext.startsWith('.woff') ? 'public, max-age=604800' : 'public, max-age=300',
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  fs.createReadStream(target).pipe(res);
}

// ───────── HTTP 服务 ─────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = url.pathname;
  if (config.basePath) {
    if (p === config.basePath) { res.writeHead(301, { location: config.basePath + '/' }); return res.end(); }
    if (!p.startsWith(config.basePath + '/')) return send(res, 404, { error: 'not found' });
    p = p.slice(config.basePath.length);
  }
  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = typeof r.pattern === 'string' ? (r.pattern === p ? [p] : null) : p.match(r.pattern);
      if (!m) continue;
      const out = await r.handler(req, res, url, m);
      if (out !== undefined) send(res, 200, out);
      return;
    }
    if (p.startsWith('/api/') || p.startsWith('/pay/')) return send(res, 404, { error: '接口不存在' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
    return serveStatic(req, res, p);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    log('内部错误', req.method, p, e.stack || e.message);
    return send(res, 500, { error: '服务器开小差了，请稍后再试' });
  }
});

server.requestTimeout = 0;          // 长对话流式输出不超时
server.headersTimeout = 30000;
server.listen(config.port, () => log(`BFF 已启动 :${config.port}${config.basePath}/  → sub2api ${config.sub2api.url}`));

module.exports = server;
