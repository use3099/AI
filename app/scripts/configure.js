// 根据环境变量生成 App 配置：SITE_URL（必填，例如 https://api.example.com）、APP_NAME、APP_ID、APP_VERSION
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(siteUrl)) {
  console.error('SITE_URL 必须是 https:// 开头的网站地址');
  process.exit(1);
}
const appName = process.env.APP_NAME || '星枢 API';
const appId = process.env.APP_ID || 'com.xingshu.api';
const version = process.env.APP_VERSION || '1.0.0';
const host = new URL(siteUrl).host;
// App 打开的是 BFF 提供的 App 界面（只对接 BFF，不对接 sub2api / new-api）
const appPath = '/' + (process.env.APP_PATH || 'app/').replace(/^\/+/, '');
const appUrl = siteUrl + appPath;

const cap = {
  appId,
  appName,
  webDir: 'www',
  server: {
    url: appUrl,
    hostname: host,
    androidScheme: 'https',
    errorPath: 'offline.html',
    allowNavigation: [host]
  },
  android: { allowMixedContent: false },
  ios: { contentInset: 'never', scrollEnabled: true },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#F2F5F9', showSpinner: false },
    StatusBar: { overlaysWebView: false }
  }
};
fs.writeFileSync(path.join(root, 'capacitor.config.json'), JSON.stringify(cap, null, 2));
fs.writeFileSync(path.join(root, 'site.json'), JSON.stringify({ siteUrl: appUrl, appName }, null, 2));

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
pkg.build.appId = appId;
pkg.build.productName = appName;
pkg.build.nsis.shortcutName = appName;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// 离线页里写入网站地址，方便“重试”
const offline = path.join(root, 'www', 'offline.html');
fs.writeFileSync(offline, fs.readFileSync(offline, 'utf8').replace(/__SITE_URL__/g, appUrl).replace(/__APP_NAME__/g, appName));
console.log(`配置完成：${appName} (${appId}) v${version} → ${appUrl}`);
