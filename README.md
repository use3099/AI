# 星枢 API（AI 中转站：new-api 网站 + sub2api 内网网关 + App 后端）

后端直接用开源的 [new-api](https://github.com/QuantumNous/new-api) 管账户、计费、充值和转发；这个仓库提供：

| 目录 | 内容 |
| --- | --- |
| `web/` | 给用户用的网页前台：首页、注册登录、总览、API 密钥、充值（支付宝/微信，走易支付）、账单、模型价格、邀请、签到。简体 / 繁體 / English，深浅色，手机电脑都适配。纯静态文件，不用编译。 |
| `deploy/` | 一键部署：new-api + PostgreSQL + Redis + Caddy（自动 HTTPS）。 |
| `bff/` | App 后端：注册登录、充值、对话转发，App 只和它通信；sub2api 只在内网。也包含 App 的聊天界面（`bff/public/`）。 |
| `app/` | App 外壳：Android、iOS（Capacitor），Windows、macOS（Electron）。App 打开 `https://主域名/app/`（BFF 提供的界面），所以**界面一更新，所有 App 立刻同步**，不用重新发版。 |
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

## 一·五、App 后端（BFF）+ sub2api

App 不再直接打开网站，而是打开 `https://主域名/app/`，这个页面和接口都由 `bff/` 提供：

```
App ──> BFF（/app/，注册登录、充值、对话）──> sub2api（只在内网）──> 上游 AI
```

- **sub2api 不对外开放**：Caddy 不转发它，外网访问不到它的后台和登录页。它只在 Docker 内网里，后台端口只绑本机 `127.0.0.1:8080`。
- 客户注册时，BFF 用 sub2api 的 Admin API Key 自动给他开一个 sub2api 用户和 API Key。**Key 加密存在服务器上，永远不发给 App**。
- 充值走易支付：付款回调 → BFF 校验签名和金额 → 调 sub2api 给这个用户加余额（订单号做幂等键，重复回调不会重复加钱）。
- 客户在 App 里只能：登录、聊天、看余额、充值、看使用记录。

### 管理 sub2api（只有你自己能进）

在你自己的电脑上：
```bash
ssh -L 8080:127.0.0.1:8080 root@服务器IP
```
然后浏览器打开 `http://127.0.0.1:8080`，账号是 `.env` 里的 `SUB2API_ADMIN_EMAIL` / `SUB2API_ADMIN_PASSWORD`。

在 sub2api 后台：
1. 添加上游账号（你中转站里开的 API Key / 订阅账号）
2. 建分组，把账号放进去，设好倍率，记下**分组 ID**
3. **系统设置里不要开启登录验证码、不要开启后台模式**（BFF 要用接口给客户建 Key）

### 服务器上的配置（`/opt/ai-relay/.env`）

| 变量 | 说明 |
| --- | --- |
| `SUB2API_ADMIN_KEY` | 安装脚本会自动生成；失败时去 sub2api 后台 → 系统设置 → Admin API Key 手动生成填进来 |
| `SUB2API_GROUP_ID` | 客户的 Key 放进哪个分组（**要在客户注册之前填好**） |
| `SIGNUP_BALANCE_USD` | 新用户赠送额度（美元），默认 0 |
| `EPAY_URL` / `EPAY_PID` / `EPAY_KEY` | 易支付接口地址、商户 ID、密钥；不填则 App 里充值关闭 |
| `CNY_PER_USD` | 充值汇率：多少人民币换 1 美元额度，默认 7.2 |
| `RECHARGE_AMOUNTS` | 充值档位，默认 `10,30,50,100,200` |
| `ALLOWED_MODELS` | 只给客户显示这些模型（逗号分隔），留空 = 分组里有什么给什么 |
| `SUB2API_IMAGE_GROUP_ID` | 生图分组 ID（sub2api 里勾选了「允许当前分组生图」的分组）。填了 App 里才出现「AI 生图」；每个用户第一次生图时会自动在这个分组再开一个 Key，聊天和生图分开计价 |
| `IMAGE_MODELS` | 只给客户显示这些生图模型（逗号分隔），留空 = 生图分组里有什么给什么 |
| `IMAGE_PRICE_NOTE` | 生图页面显示的价格说明，例如 `每张约 ¥0.05`（实际扣费以 sub2api 生图分组的单张价格为准） |

改完运行 `cd /opt/ai-relay && docker compose up -d bff`。

易支付后台的**回调地址**不用配，BFF 下单时自动带上 `https://主域名/app/pay/notify`。

### 本地测试 BFF

```bash
cd bff && node test/smoke.js          # 用模拟的 sub2api 跑完注册、充值回调、对话流式转发
SERVE=18555 node test/smoke.js        # 只启动，浏览器打开 http://127.0.0.1:18555/app/ 看界面
```

## 二、改品牌

只改 `web/config.js`：品牌名、口号、客服链接、App 下载地址、首页展示的模型。

## 三、打包 App

1. 仓库 **Settings → Secrets and variables → Actions → Variables** 新建：
   - `SITE_URL` = `https://主域名`（必填）
   - `APP_NAME`、`APP_ID` 不用设，默认就是「星枢 API」和 `com.xingshu.api`（包名定了以后别改，否则用户要卸载重装）
2. **Actions → 构建 App → Run workflow**，填版本号。大约 15 分钟后在 **Releases** 里能下载：
   - `app.apk` — 安卓
   - `app.ipa` — 苹果（未签名，用全能签等工具自签）
   - `app-setup.exe` — Windows
   - `app.dmg` — macOS（未签名，首次打开需右键 → 打开）
3. 把这 4 个文件放到服务器 `/opt/ai-relay/web/download/` 里，网站的「下载 App」页面就能直接下载。

安卓签名证书已存在仓库 Secrets 里（`ANDROID_KEYSTORE_B64` / `ANDROID_KEYSTORE_PASSWORD`），请另外备份一份；换了证书，用户就没法覆盖升级。

## 本地预览网页

`web/` 是纯静态文件，但需要 new-api 后端同域名才能登录，建议直接部署后在线看。
