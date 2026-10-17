#!/usr/bin/env bash
# 在「节点服务器」上运行：让这台节点的出口走 Cloudflare WARP，用来解锁 Netflix / Disney+ / ChatGPT 等。
# 只影响这一台，面板和其他节点不动；限速照常有效。
# 用法：bash node-unlock.sh        开启
#       bash node-unlock.sh off    关闭（恢复直连）
# 说明：节点不嗅探域名（App 发来的是 IP），没法只让流媒体走 WARP，所以这台的全部出站都走 WARP。
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "请用 root 运行（先 sudo -i）"; exit 1; }
docker inspect xboard-node >/dev/null 2>&1 || { echo "这台还没装节点（找不到 xboard-node 容器），先运行节点安装命令"; exit 1; }

CFG_DIR=/etc/xboard-node
WARP=/etc/xs-warp.json
mkdir -p "$CFG_DIR"

# 用原来容器的参数重新创建容器（挂载配置目录）
recreate() {
  local envs img
  envs="$(docker inspect xboard-node --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(apiHost|apiKey|nodeID|kernel|API_HOST|API_KEY|NODE_ID|KERNEL_TYPE)=' || true)"
  img="$(docker inspect xboard-node --format '{{.Config.Image}}')"
  local args=()
  while IFS= read -r e; do [ -n "$e" ] && args+=(-e "$e"); done <<< "$envs"
  docker rm -f xboard-node >/dev/null
  docker run -d --name xboard-node --restart always --network host -v "$CFG_DIR:$CFG_DIR" "${args[@]}" \
    "$img" -c "$CFG_DIR/config.yml" >/dev/null
  for i in $(seq 1 30); do
    sleep 2
    if docker logs xboard-node 2>&1 | grep -q '\] started'; then return 0; fi
    if docker logs xboard-node 2>&1 | grep -qi 'failed to load config\|invalid config'; then break; fi
  done
  echo "节点没能正常启动，最近日志："; docker logs xboard-node --tail 20; return 1
}

if [ "${1:-}" = "off" ]; then
  : > "$CFG_DIR/config.yml"
  recreate
  echo "已关闭 WARP，这台节点恢复直连"
  exit 0
fi

# 1) 注册一个免费 WARP 账号（只注册一次，保存在 $WARP）
if [ ! -s "$WARP" ]; then
  echo "== 注册 Cloudflare WARP"
  command -v wg >/dev/null || { apt-get -qq update >/dev/null; DEBIAN_FRONTEND=noninteractive apt-get -y -qq install wireguard-tools >/dev/null; }
  PRIV="$(wg genkey)"; PUB="$(printf '%s' "$PRIV" | wg pubkey)"
  RESP="$(curl -fsS -m 30 -X POST 'https://api.cloudflareclient.com/v0a2158/reg' \
    -H 'User-Agent: okhttp/3.12.1' -H 'CF-Client-Version: a-6.10-2158' -H 'Content-Type: application/json' \
    -d "{\"key\":\"$PUB\",\"install_id\":\"\",\"fcm_token\":\"\",\"tos\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",\"model\":\"PC\",\"serial_number\":\"\",\"locale\":\"en_US\"}")" \
    || { echo "注册 WARP 失败（连不上 Cloudflare）"; exit 1; }
  PRIV="$PRIV" RESP="$RESP" python3 - "$WARP" <<'PY'
import base64, json, os, sys
r = json.loads(os.environ["RESP"])
c = r.get("config") or r.get("result", {}).get("config")
peer = c["peers"][0]
a = c["interface"]["addresses"]
res = list(base64.b64decode(c.get("client_id", "AAAA")))[:3]
json.dump({"private_key": os.environ["PRIV"], "public_key": peer["public_key"],
           "v4": a["v4"], "v6": a["v6"], "reserved": res}, open(sys.argv[1], "w"))
PY
  chmod 600 "$WARP"
fi

# 2) 写节点配置：加一个 WARP 出站，全部流量走它（内网地址照旧拦截）
python3 - "$WARP" "$CFG_DIR/config.yml" <<'PY'
import json, sys
w = json.load(open(sys.argv[1]))
cfg = {"kernel": {
  "custom_outbound": [{
    "tag": "warp", "protocol": "wireguard",
    "settings": {
      "secretKey": w["private_key"],
      "address": [w["v4"] + "/32", w["v6"] + "/128"],
      "peers": [{"publicKey": w["public_key"], "endpoint": "162.159.192.1:2408", "keepAlive": 25}],
      "reserved": w["reserved"], "mtu": 1280, "domainStrategy": "ForceIPv4v6"}}],
  "custom_route": [
    {"type": "field", "outboundTag": "block",
     "ip": ["10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7", "fe80::/10"]},
    {"type": "field", "network": "tcp,udp", "outboundTag": "warp"}]}}
open(sys.argv[2], "w").write(json.dumps(cfg, indent=2))  # JSON 也是合法 YAML
PY

echo "== 重启节点"
recreate
echo "已开启：这台节点的出口改走 Cloudflare WARP（限速照常有效）"
echo "关闭：curl -fsSL https://cdn.jsdelivr.net/gh/use3099/AI@main/tools/node-unlock.sh | bash -s -- off"
