// 所有配置都从环境变量读取（部署时写在 .env 里，绝不提交到仓库）
const env = process.env;

function required(name) {
  const v = (env[name] || '').trim();
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

function num(name, def) {
  const v = env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`环境变量 ${name} 不是数字: ${v}`);
  return n;
}

function list(name, def) {
  const v = (env[name] || '').trim();
  if (!v) return def;
  return v.split(',').map(s => s.trim()).filter(Boolean);
}

const config = {
  port: num('PORT', 8787),
  basePath: (env.BASE_PATH ?? '/app').replace(/\/+$/, ''),   // 对外路径前缀
  publicUrl: required('PUBLIC_URL').replace(/\/+$/, ''),     // 例如 https://lanren666666.online
  dataDir: env.DATA_DIR || './data',

  jwtSecret: required('BFF_JWT_SECRET'),
  dataSecret: required('BFF_DATA_SECRET'),                   // 加密数据库里保存的 sub2api key
  tokenDays: num('TOKEN_DAYS', 30),

  sub2api: {
    url: required('SUB2API_URL').replace(/\/+$/, ''),        // 内网地址，例如 http://sub2api:8080
    adminKey: required('SUB2API_ADMIN_KEY'),                 // sub2api 后台 → 系统设置 → Admin API Key
    groupId: env.SUB2API_GROUP_ID ? Number(env.SUB2API_GROUP_ID) : null,
    signupBalance: num('SIGNUP_BALANCE_USD', 0),             // 新用户赠送额度（美元）
    concurrency: num('USER_CONCURRENCY', 0),                 // 0 = 用 sub2api 默认值
  },

  epay: {
    url: (env.EPAY_URL || '').replace(/\/+$/, ''),           // 易支付接口地址，例如 https://pay.example.com
    pid: env.EPAY_PID || '',
    key: env.EPAY_KEY || '',
    methods: list('EPAY_METHODS', ['alipay', 'wxpay']),
  },

  cnyPerUsd: num('CNY_PER_USD', 7.2),                        // 充值 1 美元额度需要多少人民币
  rechargeAmounts: list('RECHARGE_AMOUNTS', ['10', '30', '50', '100', '200']).map(Number),
  rechargeMin: num('RECHARGE_MIN', 5),
  rechargeMax: num('RECHARGE_MAX', 2000),

  allowedModels: list('ALLOWED_MODELS', []),                 // 留空 = sub2api 分组里有什么就给什么
  chatPerMinute: num('CHAT_PER_MINUTE', 30),

  // 生图：单独一个 sub2api 分组（勾选「允许当前分组生图」），每个用户另开一个只在这个分组里的 Key
  image: {
    groupId: env.SUB2API_IMAGE_GROUP_ID ? Number(env.SUB2API_IMAGE_GROUP_ID) : null,
    models: list('IMAGE_MODELS', []),                        // 留空 = 生图分组里有什么就给什么
    priceNote: (env.IMAGE_PRICE_NOTE || '').trim(),          // App 里显示的价格说明，例如「每张约 ¥0.05」
    perMinute: num('IMAGE_PER_MINUTE', 6),
  },
  trustProxy: (env.TRUST_PROXY || 'true') === 'true',
};

config.epay.enabled = !!(config.epay.url && config.epay.pid && config.epay.key);

module.exports = config;
