// 手动补单：易支付后台确认已经收到钱、但星枢没收到回调时用（只补 pending 的单，重复运行不会重复加钱）
// 用法：cd /opt/ai-relay && docker compose exec -T -w /srv/bff -e NO=订单号 bff node - < manual-credit.js
const db = require('./src/db');
const s2 = require('./src/sub2api');
(async () => {
  const no = String(process.env.NO || '').trim();
  const o = db.prepare('SELECT * FROM orders WHERE no = ?').get(no);
  if (!o) { console.log('没有这个订单：' + no); process.exit(1); }
  if (o.status === 'credited') { console.log('这单已经到账了，不用补'); process.exit(0); }
  if ((o.kind || 'balance') !== 'balance') { console.log('这是套餐订单，请发给我处理'); process.exit(1); }
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(o.user_id);
  db.prepare("UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, ?), trade_no = COALESCE(trade_no, 'manual') WHERE no = ? AND status = 'pending'").run(Date.now(), no);
  await s2.addBalance(u.s2_user_id, o.credit_usd, `App 充值 ¥${o.amount_cny} 订单 ${o.no}（手动补单）`, `bff-order-${o.no}`);
  db.prepare("UPDATE orders SET status = 'credited', credited_at = ?, last_error = NULL WHERE no = ?").run(Date.now(), no);
  console.log(`✅ 已补到账：${u.account} +¥${o.amount_cny}（$${o.credit_usd}）`);
  process.exit(0);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
