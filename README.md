# AI 中转站（基于 new-api）

后端直接用开源的 [new-api](https://github.com/QuantumNous/new-api) 管账户、计费、充值和转发；这个仓库提供：

| 目录 | 内容 |
| --- | --- |
| `web/` | 给用户用的网页前台：首页、注册登录、总览、API 密钥、充值（支付宝/微信，走易支付）、账单、模型价格、邀请、签到。简体 / 繁體 / English，深浅色，手机电脑都适配。纯静态文件，不用编译。 |
| `deploy/` | 一键部署：new-api + PostgreSQL + Redis + Caddy（自动 HTTPS）。 |
| `app/` | App 外壳：Android、iOS（Capacitor），Windows、macOS（Electron）。App 里直接打开你的网站，所以**网站一更新，所有 App 立刻同步**，不用重新发版。 |
| `.github/workflows/` | 在 GitHub 上自动打包 4 个平台的安装包。 |

## 一、部署网站（服务器上操作）

1. 准备一台海外 Linux 服务器（Ubuntu / Debian，1 核 2G 起）。
2. 把两个域名解析到服务器 IP：主域名（如 `api.example.com`）和后台域名（如 `admin.example.com`）。Cloudflare 先用灰色云朵（仅 DNS）。
3. 把 `dist/install.sh` 传到服务器，运行：
   ```bash
   bash install.sh
   ```
   按提示输入两个域名，等几分钟就好了。
4. 打开 `https://后台域名`：
   - 第一次会让你创建管理员账号
   - **系统设置 → 服务器地址** 填 `https://主域名`
   - **支付设置** 填易支付的接口地址、商户 ID、密钥，确认合规条款（不确认的话充值、兑换码都不能用）
   - **渠道** 里添加上游模型的 Key
   - **运营设置 → 额度显示** 可以选按美元或人民币显示

以后改了网页，重新生成 `install.sh` 后在服务器上运行 `bash install.sh update`，数据和 `config.js` 都会保留。

## 二、改品牌

只改 `web/config.js`：品牌名、口号、客服链接、App 下载地址、首页展示的模型。

## 三、打包 App

1. 仓库 **Settings → Secrets and variables → Actions → Variables** 新建：
   - `SITE_URL` = `https://主域名`（必填）
   - `APP_NAME` = App 名字
   - `APP_ID` = 包名，例如 `com.xingshu.api`（定了以后别改，否则用户要卸载重装）
2. **Actions → 构建 App → Run workflow**，填版本号。大约 15 分钟后在 **Releases** 里能下载：
   - `app.apk` — 安卓
   - `app.ipa` — 苹果（未签名，用全能签等工具自签）
   - `app-setup.exe` — Windows
   - `app.dmg` — macOS（未签名，首次打开需右键 → 打开）
3. 把这 4 个文件放到服务器 `/opt/ai-relay/web/download/` 里，网站的「下载 App」页面就能直接下载。

安卓签名证书已存在仓库 Secrets 里（`ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD`），请另外备份一份；换了证书，用户就没法覆盖升级。

## 本地预览网页

`web/` 是纯静态文件，但需要 new-api 后端同域名才能登录，建议直接部署后在线看。
