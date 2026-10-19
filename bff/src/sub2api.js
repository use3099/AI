// sub2api 客户端。接口均按 sub2api 源码核对（backend/internal/server/routes/*.go）：
//   管理接口  /api/v1/admin/*   认证头 x-api-key: <Admin API Key>
//     POST /admin/users                  创建用户 {email,password,username,notes,balance,concurrency}
//     GET  /admin/users/:id              用户详情（含 balance，单位美元）
//     POST /admin/users/:id/balance      调整余额 {balance,operation:add|subtract|set,notes}，必须带 Idempotency-Key 头
//     DELETE /admin/users/:id            删除用户
//     GET  /admin/usage?user_id=         用量记录（分页）
//     GET  /admin/groups/all              全部分组
//     GET  /admin/users/:id/subscriptions 用户订阅
//     POST /admin/subscriptions/assign    分配订阅 {user_id,group_id,validity_days,notes}
//     POST /admin/subscriptions/:id/extend 续期 {days}，带 Idempotency-Key 头
//   用户接口  /api/v1/*  认证头 Authorization: Bearer <JWT>
//     POST /auth/login                   {email,password} → data.access_token
//     POST /keys                         创建 API Key {name,group_id} → data.key
//   网关      /v1/*      认证头 Authorization: Bearer <用户 API Key>
//     POST /v1/chat/completions  GET /v1/models
// sub2api 的统一返回格式：{ code: 0, message, data }
const config = require('./config');

class Sub2apiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function call(method, path, { body, headers = {}, timeoutMs = 20000 } = {}) {
  const res = await fetch(config.sub2api.url + path, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON */ }
  if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
    const msg = (json && (json.message || json.error?.message)) || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new Sub2apiError(`sub2api ${method} ${path} 失败: ${msg}`, res.status, json);
  }
  return json && 'data' in json ? json.data : json;
}

const admin = (method, path, opts = {}) =>
  call(method, '/api/v1/admin' + path, { ...opts, headers: { 'x-api-key': config.sub2api.adminKey, ...(opts.headers || {}) } });

module.exports = {
  Sub2apiError,

  createUser({ email, password, username, notes }) {
    const body = { email, password, username, notes };
    if (config.sub2api.signupBalance > 0) body.balance = config.sub2api.signupBalance;
    if (config.sub2api.concurrency > 0) body.concurrency = config.sub2api.concurrency;
    return admin('POST', '/users', { body });
  },

  // PUT /admin/users/:id  只改密码（用于补建 key 时重新登录）
  setPassword(id, password) {
    return admin('PUT', `/users/${id}`, { body: { password } });
  },

  deleteUser(id) {
    return admin('DELETE', `/users/${id}`);
  },

  getUser(id) {
    return admin('GET', `/users/${id}`);
  },

  // 加余额：用订单号做 Idempotency-Key，重复回调 / 重试都不会重复加钱
  addBalance(id, amountUsd, notes, idempotencyKey) {
    return admin('POST', `/users/${id}/balance`, {
      body: { balance: amountUsd, operation: 'add', notes },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  getGroup(id) {
    return admin('GET', `/groups/${id}`);
  },

  // 模型默认单价（美元 / token），找不到返回 { found:false }
  modelPricing(model) {
    return admin('GET', `/channels/model-pricing?model=${encodeURIComponent(model)}`);
  },

  // 全部分组（用来按名字找包月套餐的分组 ID）
  allGroups() {
    return admin('GET', '/groups/all');
  },

  // 用户的订阅列表（含 status / expires_at / 用量 / notes）
  listUserSubs(id) {
    return admin('GET', `/users/${id}/subscriptions`);
  },

  // 分配订阅：没有就新建；有但已过期就重新开通 validity_days 天
  assignSub(userId, groupId, days, notes) {
    return admin('POST', '/subscriptions/assign', { body: { user_id: userId, group_id: groupId, validity_days: days, notes } });
  },

  // 订阅续期 days 天：Idempotency-Key 保证重试不会重复加天数
  extendSub(subId, days, idempotencyKey) {
    return admin('POST', `/subscriptions/${subId}/extend`, { body: { days }, headers: { 'Idempotency-Key': idempotencyKey } });
  },

  listUsage(id, page = 1, pageSize = 20) {
    return admin('GET', `/usage?user_id=${id}&page=${page}&page_size=${pageSize}`);
  },

  async login(email, password) {
    const data = await call('POST', '/api/v1/auth/login', { body: { email, password } });
    if (!data || !data.access_token) throw new Sub2apiError('sub2api 登录未返回 access_token（检查是否开启了验证码或两步验证）', 500, data);
    return data.access_token;
  },

  async createKey(jwt, name, groupId = config.sub2api.groupId) {
    const body = { name };
    if (groupId) body.group_id = groupId;
    const data = await call('POST', '/api/v1/keys', { body, headers: { authorization: `Bearer ${jwt}` } });
    if (!data || !data.key) throw new Sub2apiError('sub2api 创建 Key 未返回 key', 500, data);
    return data.key;
  },

  // 网关请求：直接返回 fetch 的 Response，交给调用方做流式转发
  gateway(method, path, apiKey, body, signal) {
    return fetch(config.sub2api.url + '/v1' + path, {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: body && body.stream ? 'text/event-stream' : 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  },
};
