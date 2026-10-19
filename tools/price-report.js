// 价格表：sub2api 里每个分组、每个模型实际怎么扣费（只读，不改任何东西）
// 在台湾服务器运行：cd /opt/ai-relay && docker compose exec -T -w /srv/bff bff node - < price-report.js
const config = require('./src/config');
const s2 = require('./src/sub2api');
const db = require('./src/db');
const { decrypt } = require('./src/crypto');

const RATE = config.cnyPerUsd;
const perM = v => (v == null ? null : Number(v) < 0.01 ? Number(v) * 1e6 : Number(v)); // 每 token → 每百万 token
const usd = v => (v == null ? '-' : '$' + (+v.toFixed(4)));
const cny = v => (v == null ? '-' : '¥' + (+(v * RATE).toFixed(3)));

async function modelsOf(g) {
  // 优先用星枢里已经有的这个分组的 Key 去问真实可用的模型
  let key = null;
  if (Number(config.sub2api.groupId) === Number(g.id)) {
    const r = db.prepare("SELECT s2_key_enc FROM users WHERE s2_key_enc IS NOT NULL ORDER BY id DESC LIMIT 1").get();
    if (r) key = decrypt(r.s2_key_enc);
  } else if (Number(config.image.groupId) === Number(g.id)) {
    const r = db.prepare("SELECT s2_img_key_enc FROM users WHERE s2_img_key_enc IS NOT NULL ORDER BY id DESC LIMIT 1").get();
    if (r) key = decrypt(r.s2_img_key_enc);
  } else {
    const r = db.prepare('SELECT key_enc FROM sub_keys WHERE group_id = ? LIMIT 1').get(g.id);
    if (r) key = decrypt(r.key_enc);
  }
  if (key) {
    try {
      const r = await s2.gateway('GET', '/models', key, undefined, AbortSignal.timeout(15000));
      if (r.ok) return { src: '实际可用', list: ((await r.json()).data || []).map(m => m.id) };
    } catch { /* 退回候选列表 */ }
  }
  try {
    const d = await fetch(`${config.sub2api.url}/api/v1/admin/groups/${g.id}/model-allowlist-candidates`, { headers: { 'x-api-key': config.sub2api.adminKey } }).then(r => r.json());
    return { src: '账号候选（可能比实际多）', list: (d.data && d.data.models) || [] };
  } catch { return { src: '读不到', list: [] }; }
}

(async () => {
  const all = await s2.allGroups();
  const groups = (Array.isArray(all) ? all : all.items || []).filter(g => g.status !== 'inactive' && g.status !== 'disabled');
  const priceCache = new Map();
  const base = async m => {
    if (!priceCache.has(m)) priceCache.set(m, await s2.modelPricing(m).catch(() => ({ found: false })));
    return priceCache.get(m);
  };
  console.log(`汇率：1 美元 = ${RATE} 元（CNY_PER_USD）。价格单位：每 100 万 tokens。「一次对话」按 输入 2000 + 输出 800 tokens 估算。\n`);
  for (let g of groups) {
    try { g = { ...g, ...(await s2.getGroup(g.id)) }; } catch { /* 用列表里的 */ }
    const mult = Number(g.rate_multiplier) > 0 ? Number(g.rate_multiplier) : 1;
    const tags = [];
    if (Number(config.sub2api.groupId) === Number(g.id)) tags.push('星枢聊天默认分组（余额）');
    if (Number(config.image.groupId) === Number(g.id)) tags.push('星枢生图分组');
    if (g.subscription_type === 'subscription') {
      const lim = [g.daily_limit_usd != null && `每天 $${g.daily_limit_usd}`, g.weekly_limit_usd != null && `每周 $${g.weekly_limit_usd}`, g.monthly_limit_usd != null && `每月 $${g.monthly_limit_usd}`].filter(Boolean).join(' / ');
      tags.push(`订阅（配额 ${lim || '不限'}）`);
    }
    console.log(`━━━━ 分组 #${g.id} ${g.name}  平台 ${g.platform}  倍率 x${mult}${tags.length ? '  · ' + tags.join(' · ') : ''}`);
    const { src, list } = await modelsOf(g);
    if (!list.length) { console.log('  （没有模型）\n'); continue; }
    console.log(`  模型来源：${src}`);
    console.log('  模型 | 输入 | 输出 | 缓存读 | 一次对话约');
    const custom = Array.isArray(g.model_pricing) ? g.model_pricing : [];
    for (const m of [...new Set(list)].sort()) {
      const c = custom.find(x => Array.isArray(x.models) && x.models.includes(m));
      let inp, out, cr = null, note = '';
      if (c && (c.input_price != null || c.output_price != null)) {
        inp = perM(c.input_price); out = perM(c.output_price); note = '（分组自定价）';
      } else {
        const p = await base(m);
        if (!p || !p.found) { console.log(`  ${m} | 没有默认定价 | | |`); continue; }
        inp = p.input_price * 1e6 * mult; out = p.output_price * 1e6 * mult;
        cr = p.cache_read_price != null ? p.cache_read_price * 1e6 * mult : null;
      }
      const once = ((inp || 0) * 2000 + (out || 0) * 800) / 1e6;
      console.log(`  ${m}${note} | ${usd(inp)} ${cny(inp)} | ${usd(out)} ${cny(out)} | ${usd(cr)} | ${cny(once)}`);
    }
    console.log('');
  }
  process.exit(0);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
