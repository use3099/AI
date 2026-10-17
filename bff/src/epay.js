// 易支付（彩虹易支付通用协议）：MD5 签名 = md5(参数按键名排序，去掉 sign / sign_type / 空值，拼成 a=1&b=2，再直接接上商户密钥)
const crypto = require('crypto');
const config = require('./config');

function sign(params) {
  const str = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('md5').update(str + config.epay.key, 'utf8').digest('hex');
}

function verify(params) {
  if (!params || typeof params.sign !== 'string') return false;
  const expected = Buffer.from(sign(params));
  const given = Buffer.from(params.sign.toLowerCase());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// 生成跳转到收银台的地址（App 用系统浏览器打开）
function payUrl({ orderNo, amount, method, name }) {
  const base = config.publicUrl + config.basePath;
  const params = {
    pid: config.epay.pid,
    type: method,
    out_trade_no: orderNo,
    notify_url: `${base}/pay/notify`,
    return_url: `${base}/pay/return?no=${encodeURIComponent(orderNo)}`,
    name,
    money: amount,
  };
  params.sign = sign(params);
  params.sign_type = 'MD5';
  return `${config.epay.url}/submit.php?${new URLSearchParams(params).toString()}`;
}

module.exports = { sign, verify, payUrl };
