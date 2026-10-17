#!/usr/bin/env bash
# AI 中转站一键部署脚本（new-api 后端 + 用户前台 + sub2api 内网网关 + App 后端 BFF + 自动 HTTPS）
# 用法：  bash install.sh            首次安装
#         bash install.sh update     更新网页 / App 后端，拉取最新镜像，数据不动
#         bash install.sh key        （重新）生成 sub2api 管理密钥给 App 后端用
#         bash install.sh panel [子域名]   开启 sub2api 后台公网入口（带暗号，默认 sub.主域名）
#         bash install.sh panel-off  关闭公网入口
set -euo pipefail

APP_DIR=/opt/ai-relay
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!!${NC} $*"; }
die()  { echo -e "${RED}xx${NC} $*"; exit 1; }

[ "$(id -u)" = 0 ] || die "请用 root 运行：sudo bash install.sh"

extract_payload() {
  local line
  line=$(awk '/^__PAYLOAD_BELOW__$/{print NR+1; exit}' "$0")
  [ -n "$line" ] || die "安装包不完整（缺少内置文件），请重新下载 install.sh"
  mkdir -p "$APP_DIR"
  tail -n +"$line" "$0" | base64 -d | tar -xz -C "$APP_DIR"
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    say "安装 Docker…"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi
  docker compose version >/dev/null 2>&1 || die "docker compose 不可用，请升级 Docker"
}

# 生成随机密码（不用管道，避免 pipefail 下 SIGPIPE 导致脚本静默退出）
rand() { local s; s=$(LC_ALL=C tr -dc 'A-Za-z0-9' < <(head -c 2048 /dev/urandom)); printf '%s' "${s:0:${1:-32}}"; }
hexrand() { od -An -tx1 -N"${1:-32}" /dev/urandom | tr -d ' \n'; }

# .env 里没有这一项才写入（已有的密钥绝不覆盖，否则已保存的数据会解不开）
setenv() { grep -q "^$1=" "$APP_DIR/.env" 2>/dev/null || echo "$1=$2" >>"$APP_DIR/.env"; }

# sub2api（内网 AI 网关）+ BFF（App 后端）：首次安装和 update 都会走这里
ensure_app_stack() {
  cd "$APP_DIR"
  setenv SUB2API_ADMIN_EMAIL "admin@xingshu.local"
  setenv SUB2API_ADMIN_PASSWORD "$(rand 24)"
  setenv SUB2API_JWT_SECRET "$(rand 48)"
  setenv SUB2API_TOTP_KEY "$(hexrand 32)"
  setenv SUB2API_ADMIN_KEY ""
  setenv SUB2API_GROUP_ID ""
  setenv SUB2API_IMAGE_GROUP_ID ""
  setenv BFF_JWT_SECRET "$(rand 48)"
  setenv BFF_DATA_SECRET "$(rand 48)"
  setenv SIGNUP_BALANCE_USD "0"
  setenv CNY_PER_USD "7.2"
  setenv EPAY_URL ""
  setenv EPAY_PID ""
  setenv EPAY_KEY ""
  chmod 600 .env
  mkdir -p data/bff && chown -R 1000:1000 data/bff   # BFF 容器以 node(1000) 用户运行
  write_panel_site                                     # 已开启的 sub2api 后台入口保持不变

  docker compose up -d postgres redis
  for _ in $(seq 1 40); do docker compose exec -T postgres pg_isready -U newapi >/dev/null 2>&1 && break; sleep 2; done
  if ! docker compose exec -T postgres psql -U newapi -d newapi -tAc "SELECT 1 FROM pg_database WHERE datname='sub2api'" | grep -q 1; then
    say "创建 sub2api 数据库…"
    docker compose exec -T postgres createdb -U newapi sub2api
  fi

  say "构建并启动全部服务（第一次要下载镜像，约 2-5 分钟）…"
  docker compose up -d --build --remove-orphans

  gen_admin_key
}

# 生成 sub2api 的 Admin API Key，写进 .env 给 BFF 用。
# 也可以单独运行：bash install.sh key
gen_admin_key() {
  cd "$APP_DIR"
  # shellcheck disable=SC1091
  . ./.env
  if [ -n "${SUB2API_ADMIN_KEY:-}" ] && [ "${SUB2API_ADMIN_KEY}" != "not-set" ] && [ "${1:-}" != "force" ]; then
    say "sub2api 管理密钥已存在"
    return 0
  fi
  say "等待 sub2api 就绪，生成管理密钥…"
  local key="" ok="" errf
  errf=$(mktemp)
  for _ in $(seq 1 60); do
    if docker compose exec -T bff wget -q -O - http://sub2api:8080/health >/dev/null 2>&1; then ok=1; break; fi
    sleep 3
  done
  if [ -z "$ok" ]; then
    warn "sub2api 没有启动成功，最近的日志："
    docker compose logs --tail=30 sub2api || true
    rm -f "$errf"; return 0
  fi
  key=$(docker compose exec -T -e E="$SUB2API_ADMIN_EMAIL" -e P="$SUB2API_ADMIN_PASSWORD" bff node -e '
    (async () => {
      const u = "http://sub2api:8080/api/v1";
      const j = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return { status: r.status, body: t.slice(0, 300) }; } };
      const l = await fetch(u + "/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.E, password: process.env.P }) }).then(j);
      const t = l && l.data && l.data.access_token;
      if (!t) { console.error("LOGIN " + JSON.stringify(l)); process.exit(1); }
      const k = await fetch(u + "/admin/settings/admin-api-key/regenerate", { method: "POST", headers: { authorization: "Bearer " + t } }).then(j);
      if (!k || !k.data || !k.data.key) { console.error("KEY " + JSON.stringify(k)); process.exit(1); }
      process.stdout.write(k.data.key);
    })().catch(e => { console.error("NET " + e.message); process.exit(1); });' 2>"$errf") || key=""
  if [ -n "$key" ]; then
    sed -i "s|^SUB2API_ADMIN_KEY=.*|SUB2API_ADMIN_KEY=$key|" .env
    docker compose up -d bff
    say "管理密钥已生成并写入 .env ✅"
  elif grep -q "ADMIN_COMPLIANCE_ACK_REQUIRED" "$errf"; then
    warn "sub2api 要求管理员先在后台阅读并确认《合规说明》，确认后才能生成管理密钥。"
    warn "请按下面「sub2api 后台」的方法登录后台，确认合规说明，然后在服务器上运行：  bash install.sh key"
  else
    warn "没能自动生成 sub2api 管理密钥，原因：$(head -c 300 "$errf")"
    warn "可以登录 sub2api 后台 → 系统设置 → Admin API Key 手动生成，填到 $APP_DIR/.env 的 SUB2API_ADMIN_KEY=，再运行 docker compose up -d bff"
  fi
  rm -f "$errf"
}

# sub2api 后台公网入口：独立子域名 + 暗号 Cookie。
# 不带暗号访问一律 404，看不到 sub2api 的任何页面（包括登录/注册页）。
# 用法：bash install.sh panel [子域名]
write_panel_site() {
  cd "$APP_DIR"
  # shellcheck disable=SC1091
  . ./.env
  mkdir -p caddy-sites
  if [ -z "${SUB2API_DOMAIN:-}" ] || [ -z "${SUB2API_PANEL_TOKEN:-}" ]; then
    rm -f caddy-sites/sub2api.caddy
    return 0
  fi
  cat >caddy-sites/sub2api.caddy <<SITE
# 由 install.sh 生成，请勿手改（重新运行 bash install.sh panel 会覆盖）
$SUB2API_DOMAIN {
	encode zstd gzip
	route {
		# 打开 https://$SUB2API_DOMAIN/?k=暗号 → 写入 30 天的 Cookie
		@setkey query k=$SUB2API_PANEL_TOKEN
		header @setkey Set-Cookie "xs_panel=$SUB2API_PANEL_TOKEN; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax"
		redir @setkey / 302

		# 没有暗号 Cookie：直接 404
		@nokey not header_regexp Cookie "(^|; *)xs_panel=$SUB2API_PANEL_TOKEN(;|\$)"
		respond @nokey "Not Found" 404

		reverse_proxy sub2api:8080 {
			flush_interval -1
		}
	}
}
SITE
}

setup_panel() {
  cd "$APP_DIR"
  # shellcheck disable=SC1091
  . ./.env
  local domain="${1:-${SUB2API_DOMAIN:-sub.${DOMAIN#*.}}}"
  # 根域名（如 example.com）时 ${DOMAIN#*.} 会变成 com，改用 sub.根域名
  if [ "$(echo "$DOMAIN" | tr -cd '.' | wc -c)" -lt 2 ] && [ -z "${1:-}" ] && [ -z "${SUB2API_DOMAIN:-}" ]; then domain="sub.$DOMAIN"; fi
  setenv SUB2API_DOMAIN "$domain"
  sed -i "s|^SUB2API_DOMAIN=.*|SUB2API_DOMAIN=$domain|" .env
  setenv SUB2API_PANEL_TOKEN "$(rand 32)"
  write_panel_site
  # shellcheck disable=SC1091
  . ./.env
  docker compose up -d caddy
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || docker compose restart caddy
  echo
  echo "================ sub2api 后台公网入口 ✅ ================"
  echo " 1) Cloudflare → DNS：添加 A 记录  ${domain%%.*}  →  本服务器 IP，橙色云朵（已代理）"
  if [ "${HTTPS_PORT:-443}" != 443 ]; then
    echo " 2) Cloudflare → 规则 → Origin Rules：在之前那条转发规则的主机名里加上 $domain"
    echo "    （目标端口同样改写为 $HTTPS_PORT）"
  fi
  echo
  echo " 以后用这个链接打开后台（相当于密码，不要发给别人）："
  echo "   https://$domain/?k=$SUB2API_PANEL_TOKEN"
  echo " 打开一次后浏览器会记住 30 天；不带暗号访问一律显示 404。"
  echo " 后台账号: $SUB2API_ADMIN_EMAIL   密码: grep SUB2API_ADMIN_PASSWORD $APP_DIR/.env"
  echo " 进后台后：确认合规说明 → 系统设置里关闭用户注册 → 回服务器运行 bash install.sh key"
  echo " 想关掉公网入口：把 .env 里 SUB2API_DOMAIN= 清空，再运行 bash install.sh panel-off"
  echo "========================================================"
}

print_app_notes() {
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
  echo
  echo " ───── App 后端（BFF）+ sub2api ─────"
  echo " App 地址:      https://$DOMAIN/app/   （App 安装包打开的就是这个页面）"
  echo " sub2api 后台:  不对外开放。在你自己电脑上运行："
  echo "     ssh -L 8080:127.0.0.1:8080 root@本服务器IP"
  echo "   然后浏览器打开 http://127.0.0.1:8080"
  echo "   账号: $SUB2API_ADMIN_EMAIL"
  echo "   密码: 运行  grep SUB2API_ADMIN_PASSWORD $APP_DIR/.env  查看"
  echo " 在 sub2api 后台：添加上游账号/渠道 → 建好分组（记下分组 ID）"
  echo " 然后编辑 $APP_DIR/.env 填写："
  echo "   SUB2API_GROUP_ID=聊天分组ID   SUB2API_IMAGE_GROUP_ID=生图分组ID（不填 = App 里不显示生图）"
  echo "   EPAY_URL= / EPAY_PID= / EPAY_KEY=（易支付）  CNY_PER_USD=汇率"
  echo " 改完运行：cd $APP_DIR && docker compose up -d bff"
}

if [ "${1:-}" = "panel" ]; then
  [ -f "$APP_DIR/.env" ] || die "还没安装过，请先直接运行 bash install.sh"
  setup_panel "${2:-}"
  exit 0
fi

if [ "${1:-}" = "panel-off" ]; then
  [ -f "$APP_DIR/.env" ] || die "还没安装过"
  sed -i "s|^SUB2API_DOMAIN=.*|SUB2API_DOMAIN=|" "$APP_DIR/.env"
  write_panel_site
  cd "$APP_DIR" && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || docker compose restart caddy
  say "sub2api 公网入口已关闭"
  exit 0
fi

if [ "${1:-}" = "key" ]; then
  [ -f "$APP_DIR/.env" ] || die "还没安装过，请先直接运行 bash install.sh"
  gen_admin_key "${2:-}"
  exit 0
fi

if [ "${1:-}" = "update" ]; then
  [ -f "$APP_DIR/.env" ] || die "还没安装过，请先直接运行 bash install.sh"
  say "更新前台网页…"
  # 服务器上改过的站点配置（品牌名、客服链接等）保留不覆盖
  [ -f "$APP_DIR/web/config.js" ] && cp "$APP_DIR/web/config.js" /tmp/ai-relay-config.js.bak
  [ -d "$APP_DIR/web/download" ] && mv "$APP_DIR/web/download" /tmp/ai-relay-download.bak
  # 只清空文件夹里的内容、不删文件夹本身：Caddy 容器挂载的是这个文件夹，删了重建会让它一直读到已删除的旧目录（首页 404）
  mkdir -p "$APP_DIR/web" && find "$APP_DIR/web" -mindepth 1 -delete
  extract_payload
  [ -f /tmp/ai-relay-config.js.bak ] && mv /tmp/ai-relay-config.js.bak "$APP_DIR/web/config.js"
  if [ -d /tmp/ai-relay-download.bak ] && [ ! -d "$APP_DIR/web/download" ]; then mv /tmp/ai-relay-download.bak "$APP_DIR/web/download"; fi
  cd "$APP_DIR"
  say "拉取最新镜像…"
  docker compose pull --ignore-buildable 2>/dev/null || docker compose pull --ignore-pull-failures || true
  ensure_app_stack
  docker compose restart caddy >/dev/null 2>&1 || true   # 保险：让 Caddy 重新读取网页文件和配置
  say "更新完成 ✅"
  print_app_notes
  exit 0
fi

echo
echo "========== AI 中转站一键部署 =========="
echo "开始前请先把两个域名解析到本服务器 IP："
echo "  1) 主域名（用户前台 + API 地址），例如 api.example.com"
echo "  2) 后台域名（只给你自己管理用），例如 admin.example.com"
echo "Cloudflare 用户：先用「仅 DNS」(灰色云朵)，证书签好后再改回橙色也可以。"
echo

read -rp "主域名: " DOMAIN
[ -n "$DOMAIN" ] || die "主域名不能为空"
# 根域名（如 example.com）默认后台用 admin.example.com；子域名（如 api.example.com）也用 admin.example.com
if [ "$(echo "$DOMAIN" | tr -cd '.' | wc -c)" -ge 2 ]; then DEF_ADMIN="admin.${DOMAIN#*.}"; else DEF_ADMIN="admin.$DOMAIN"; fi
read -rp "后台域名 [$DEF_ADMIN]: " ADMIN_DOMAIN
ADMIN_DOMAIN=${ADMIN_DOMAIN:-$DEF_ADMIN}

ensure_docker

if [ -f "$APP_DIR/.env" ]; then
  warn "检测到已有安装，保留原来的数据库密码和密钥，只更新域名。"
  # shellcheck disable=SC1091
  . "$APP_DIR/.env"
fi
# 端口检查：80 用来申请证书，必须空着；443 被占用（比如跑着节点）就改用 8443，再由 Cloudflare 转发
port_busy() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q . && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^relay-caddy$'; }
HTTP_PORT=80
if port_busy 80; then
  ss -ltnp "sport = :80" | tail -n +2
  die "80 端口被上面的程序占用了，申请 HTTPS 证书需要它，请先停掉或换端口再运行"
fi
HTTPS_PORT=${HTTPS_PORT:-443}
if [ "$HTTPS_PORT" = 443 ] && port_busy 443; then
  warn "443 端口已被占用（$(ss -ltnpH 'sport = :443' | grep -o '(("[^"]*' | head -1 | tr -d '(\"')），网站改用 8443 端口，不影响原来的程序"
  HTTPS_PORT=8443
  port_busy 8443 && die "8443 端口也被占用了，请告诉我们换一个端口"
fi

DB_PASSWORD=${DB_PASSWORD:-$(rand 24)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(rand 24)}
SESSION_SECRET=${SESSION_SECRET:-$(rand 48)}
CRYPTO_SECRET=${CRYPTO_SECRET:-$(rand 48)}

extract_payload

# 保留旧 .env 里 sub2api / BFF / 支付相关的配置和密钥
EXTRA_ENV=""
if [ -f "$APP_DIR/.env" ]; then
  EXTRA_ENV=$(grep -vE '^(DOMAIN|ADMIN_DOMAIN|DB_PASSWORD|REDIS_PASSWORD|SESSION_SECRET|CRYPTO_SECRET|TZ|HTTP_PORT|HTTPS_PORT)=' "$APP_DIR/.env" || true)
fi

cat >"$APP_DIR/.env" <<EOF
DOMAIN=$DOMAIN
ADMIN_DOMAIN=$ADMIN_DOMAIN
DB_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
SESSION_SECRET=$SESSION_SECRET
CRYPTO_SECRET=$CRYPTO_SECRET
TZ=Asia/Shanghai
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
EOF
if [ -n "$EXTRA_ENV" ]; then printf '%s\n' "$EXTRA_ENV" >>"$APP_DIR/.env"; fi
chmod 600 "$APP_DIR/.env"

# 防火墙放行 80/443（有 ufw 才处理）
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 80/tcp; ufw allow "$HTTPS_PORT"/tcp; ufw allow "$HTTPS_PORT"/udp
fi

ensure_app_stack

say "等待后端就绪…"
for _ in $(seq 1 60); do
  if docker compose exec -T new-api wget -q -O - http://localhost:3000/api/status 2>/dev/null | grep -q '"success"'; then
    ok=1; break
  fi
  sleep 3
done
[ "${ok:-}" = 1 ] || warn "后端还没响应，稍后用  cd $APP_DIR && docker compose logs new-api  查看"

echo
echo "================= 部署完成 ✅ ================="
echo " 用户前台 / API 地址:  https://$DOMAIN"
echo " 管理后台:            https://$ADMIN_DOMAIN"
echo
echo " 接下来在管理后台完成："
echo "  1. 第一次打开会让你创建 root 管理员账号"
echo "  2. 系统设置 → 服务器地址 填  https://$DOMAIN   (易支付回调要用)"
echo "  3. 支付设置 → 填易支付 商户ID / 密钥 / 接口地址，支付方式勾选 alipay、wxpay"
echo "  4. 渠道 → 添加上游 AI 渠道（OpenAI / Claude / Gemini 等的 Key）"
echo
if [ "$HTTPS_PORT" != 443 ]; then
  echo
  echo " ⚠️ 网站在 $HTTPS_PORT 端口。先用浏览器打开 https://$DOMAIN:$HTTPS_PORT 确认能打开，"
  echo "    然后在 Cloudflare 做转发，用户访问时就不用带端口号："
  echo "    1) DNS：$DOMAIN 和 $ADMIN_DOMAIN 两条记录改成橙色云朵（已代理）"
  echo "    2) SSL/TLS → 概述：加密模式选「完全(严格)」"
  echo "    3) 规则 → Origin Rules → 创建规则：主机名 等于 $DOMAIN 或 $ADMIN_DOMAIN，"
  echo "       目标端口 改写为 $HTTPS_PORT"
fi
print_app_notes
echo
echo " 配置文件和数据都在 $APP_DIR ，请定期备份 $APP_DIR/data 和 docker 卷 ai-relay_sub2api_data"
echo "==============================================="
exit 0
__PAYLOAD_BELOW__
