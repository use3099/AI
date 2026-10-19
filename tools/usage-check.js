// 扣费检查：看最近的调用记录有没有正常扣钱（只读，不改任何东西）
// 在台湾服务器运行：cd /opt/ai-relay && docker compose exec -T -w /srv/bff bff node - < usage-check.js
const config = require('./src/config');
const db = require('./src/db');

const RATE = config.cnyPerUsd;
const adm = async p => {
  const j = await fetch(config.sub2api.url + '/api/v1/admin' + p, { headers: { 'x-api-key': config.sub2api.adminKey } }).then(r => r.json());
  if (j && typeof j.code === 'number' && j.code !== 0) throw new Error(j.message || 'sub2api 出错');
  return j && 'data' in j ? j.data : j;
};

(async () => {
  // 只看星枢 App 用户（BFF 里登记过的 sub2api 用户）
  const users = db.prepare('SELECT id, account, s2_user_id FROM users WHERE s2_user_id IS NOT NULL').all();
  const byS2 = new Map(users.map(u => [Number(u.s2_user_id), u]));
  let groups = [];
  try { const g = await adm('/groups/all'); groups = Array.isArray(g) ? g : g.items || []; } catch { /* 忽略 */ }
  const gname = id => (groups.find(g => Number(g.id) === Number(id)) || {}).name || (id == null ? '-' : '#' + id);

  const rows = [];
  for (const u of users) {
    try {
      const d = await adm(`/usage?user_id=${u.s2_user_id}&page=1&page_size=20`);
      for (const i of d.items || []) rows.push(i);
    } catch (e) { console.log(`读取用户 ${u.account} 的记录失败：${e.message}`); }
  }
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recent = rows.slice(0, 40);
  if (!recent.length) { console.log('还没有任何调用记录。先在星枢 App 里用几个不同模型各聊一句，再运行这个检查。'); process.exit(0); }

  console.log(`最近 ${recent.length} 次调用（汇率 1 美元 = ${RATE} 元）\n时间 | 用户 | 分组 | 扣费方式 | 模型 | 输入/输出 tokens | 扣费`);
  let zero = 0, total = 0;
  for (const i of recent) {
    const u = byS2.get(Number(i.user_id));
    const cost = Number(i.actual_cost ?? i.total_cost ?? 0);
    const toks = (i.input_tokens || 0) + (i.output_tokens || 0);
    const bad = toks > 0 && cost <= 0;
    if (bad) zero++;
    total += cost;
    const how = i.subscription_id ? '套餐额度' : '余额';
    console.log(`${new Date(i.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} | ${u ? u.account : i.user_id} | ${gname(i.group_id)} | ${how} | ${i.model} | ${i.input_tokens}/${i.output_tokens} | ¥${(cost * RATE).toFixed(4)}${bad ? '  ⚠️ 用了 tokens 却没扣钱' : ''}`);
  }
  console.log(`\n合计扣费 ¥${(total * RATE).toFixed(4)}`);
  console.log(zero ? `⚠️ 有 ${zero} 次调用没扣钱：这些模型在 sub2api 里没有定价，去后台补上价格再开卖` : '✅ 每次调用都正常扣费');
  process.exit(0);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
