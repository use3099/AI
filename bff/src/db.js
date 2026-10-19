// 本地数据库（SQLite，Node 内置，无需额外依赖）：只存 App 账号、订单，以及加密后的 sub2api key
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new DatabaseSync(path.join(config.dataDir, 'bff.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account     TEXT NOT NULL UNIQUE,          -- 邮箱或手机号（小写）
  pass_hash   TEXT NOT NULL,
  s2_user_id  INTEGER,                       -- sub2api 里的用户 ID
  s2_email    TEXT,
  s2_key_enc  TEXT,                          -- 加密后的 sub2api API Key，永不下发给客户端
  token_ver   INTEGER NOT NULL DEFAULT 1,    -- 改密码 / 退出所有设备时 +1，旧登录全部失效
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  no           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  amount_cny   TEXT NOT NULL,                -- 两位小数字符串，例如 "30.00"
  credit_usd   REAL NOT NULL,
  method       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending → paid → credited
  trade_no     TEXT,
  last_error   TEXT,
  created_at   INTEGER NOT NULL,
  paid_at      INTEGER,
  credited_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);

// 升级：生图专用 Key（老数据库没有这一列就补上）
const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!cols.includes('s2_img_key_enc')) db.exec('ALTER TABLE users ADD COLUMN s2_img_key_enc TEXT');

if (!cols.includes('invite_code')) db.exec('ALTER TABLE users ADD COLUMN invite_code TEXT');
if (!cols.includes('inviter_id')) db.exec('ALTER TABLE users ADD COLUMN inviter_id INTEGER');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite ON users(invite_code)');
db.exec('CREATE INDEX IF NOT EXISTS idx_users_inviter ON users(inviter_id)');
const ocols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
if (!ocols.includes('package_id')) db.exec('ALTER TABLE orders ADD COLUMN package_id TEXT');
if (!ocols.includes('kind')) db.exec("ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'balance'");
if (!ocols.includes('sub_plan')) db.exec('ALTER TABLE orders ADD COLUMN sub_plan TEXT');
if (!ocols.includes('sub_group_id')) db.exec('ALTER TABLE orders ADD COLUMN sub_group_id INTEGER');
if (!ocols.includes('sub_days')) db.exec('ALTER TABLE orders ADD COLUMN sub_days INTEGER');
// 包月套餐专用 Key：每个用户每个订阅分组一个（套餐期内聊天用它，用完/到期回到余额 Key）
db.exec(`CREATE TABLE IF NOT EXISTS sub_keys (
  user_id   INTEGER NOT NULL,
  group_id  INTEGER NOT NULL,
  key_enc   TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id)
)`);
if (!ocols.includes('bonus_usd')) db.exec('ALTER TABLE orders ADD COLUMN bonus_usd REAL NOT NULL DEFAULT 0');

// 邀请奖励：每笔被邀请人的充值订单最多奖励一次（order_no 唯一）
db.exec(`
CREATE TABLE IF NOT EXISTS referral_rewards (
  order_no    TEXT PRIMARY KEY,
  inviter_id  INTEGER NOT NULL,
  invitee_id  INTEGER NOT NULL,
  amount_usd  REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending → credited
  last_error  TEXT,
  created_at  INTEGER NOT NULL,
  credited_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ref_inviter ON referral_rewards(inviter_id);
`);

// 推广佣金（现金，USDT）：每笔被邀请人的充值订单最多一条（order_no 唯一）
db.exec(`
CREATE TABLE IF NOT EXISTS commissions (
  order_no    TEXT PRIMARY KEY,
  inviter_id  INTEGER NOT NULL,
  invitee_id  INTEGER NOT NULL,
  paid_cny    REAL NOT NULL,
  rate        REAL NOT NULL,
  first       INTEGER NOT NULL DEFAULT 0,
  amount_usdt REAL NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comm_inviter ON commissions(inviter_id);
CREATE TABLE IF NOT EXISTS withdrawals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount_usdt REAL NOT NULL,
  address     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending → paid / rejected
  note        TEXT,
  created_at  INTEGER NOT NULL,
  handled_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_wd_user ON withdrawals(user_id);
`);

module.exports = db;
