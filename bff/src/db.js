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

module.exports = db;
