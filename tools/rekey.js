// 默认分组换了以后：给所有老用户在新分组里重新开聊天 Key（余额不变，只换 Key）
// 在台湾服务器运行：cd /opt/ai-relay && docker compose exec -T -w /srv/bff bff node - < rekey.js
const crypto = require('crypto');
const config = require('./src/config');
const s2 = require('./src/sub2api');
const db = require('./src/db');
const { encrypt } = require('./src/crypto');

(async () => {
  const gid = config.sub2api.groupId;
  if (!gid) { console.log('没有设置 SUB2API_GROUP_ID'); process.exit(1); }
  const users = db.prepare("SELECT * FROM users WHERE s2_user_id IS NOT NULL AND s2_email IS NOT NULL").all();
  let ok = 0, fail = 0;
  for (const u of users) {
    try {
      const pw = crypto.randomBytes(24).toString('base64url');
      await s2.setPassword(u.s2_user_id, pw);
      const jwt = await s2.login(u.s2_email, pw);
      const key = await s2.createKey(jwt, 'app', gid);
      db.prepare('UPDATE users SET s2_key_enc = ? WHERE id = ?').run(encrypt(key), u.id);
      ok++;
    } catch (e) { fail++; console.log(`失败：${u.account}：${e.message}`); }
  }
  console.log(`✅ 已换到分组 ${gid}：成功 ${ok} 个，失败 ${fail} 个`);
  process.exit(0);
})().catch(e => { console.error('出错：', e.message); process.exit(1); });
