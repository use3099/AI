// 易支付（彩虹易支付通用协议）：MD5 签名 = md5(参数按键名排序，去掉 sign / sign_type / 空值，拼成 a=1&b=2，再直接接上商户密钥)
// 可以配第二个商户（EPAY2_*）：两个商户交替收款；回调按商户号找对应的密钥验签。
const crypto = require('crypto');
const config = require('./config');

function merchants() {
  const list = [{ url: config.epay.url, pid: String(config.epay.pid), key: config.epay.key }];
  if (config.epay.url2 && config.epay.pid2 && String(config.epay.key2).length >= 8) {
    list.push({ url: config.epay.url2, pid: String(config.epay.pid2), key: config.epay.key2 });
  }
  return list;
}

function sign(params, key = config.epay.key) {
  const str = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(str + key, 'utf8').digest('hex');
}

// 验签：按回调里的商户号找商户，用它的密钥验。成功返回该商户，失败返回 null
function verify(params) {
  if (!params || typeof params.sign !== 'string') return null;
  const m = merchants().find(x => x.pid && x.pid === String(params.pid || ''));
  if (!m || String(m.key).length < 8) return null;
  const expected = Buffer.from(sign(params, m.key));
  const given = Buffer.from(params.sign.toLowerCase());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? m : null;
}

// 交替选商户（重启后从头开始，影响不大）
let rr = 0;
function pick() {
  const list = merchants();
  return list[(rr++) % list.length];
}

// 生成跳转到收银台的地址（App 用系统浏览器打开）
function payUrl({ orderNo, amount, method, name }) {
  const m = pick();
  const base = config.publicUrl + config.basePath;
  const params = {
    pid: m.pid,
    type: method,
    out_trade_no: orderNo,
    notify_url: `${base}/pay/notify`,
    return_url: `${base}/pay/return?no=${encodeURIComponent(orderNo)}`,
    name,
    money: amount,
  };
  params.sign = sign(params, m.key);
  params.sign_type = 'MD5';
  return `${m.url}/submit.php?${new URLSearchParams(params).toString()}`;
}

module.exports = { sign, verify, payUrl, merchants };
