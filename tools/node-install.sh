#!/usr/bin/env bash
# 在「新节点服务器」上运行（由 xboard-add-node.sh 生成整行命令，复制粘贴即可）：
# 自动装 Docker → 启动 xboard-node → 等节点起来 → 按需给每个用户限速。
# 用法：bash node-install.sh 面板地址 通讯密钥 节点ID [内核=xray] [限速Mbps=0 不限]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "请用 root 运行（先 sudo -i）"; exit 1; }
API_HOST="${1:?缺少面板地址}"; API_KEY="${2:?缺少通讯密钥}"; NODE_ID="${3:?缺少节点ID}"
KERNEL="${4:-xray}"; LIMIT="${5:-0}"
case "$NODE_ID" in ''|*[!0-9]*) echo "节点ID 必须是数字"; exit 1;; esac

if ! command -v docker >/dev/null; then
  echo "== 安装 Docker（约 1～2 分钟）"
  if ! curl -fsSL -m 60 https://get.docker.com -o /root/get-docker.sh; then
    echo "连不上 get.docker.com，改用系统软件源安装"
    apt-get -qq update >/dev/null && DEBIAN_FRONTEND=noninteractive apt-get -y -qq install docker.io >/dev/null
  else
    sh /root/get-docker.sh >/dev/null 2>&1
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  command -v docker >/dev/null || { echo "Docker 安装失败，这台服务器可能连不上外网（检查安全组的出站规则）"; exit 1; }
fi

echo "== 启动节点 #$NODE_ID"
docker rm -f xboard-node >/dev/null 2>&1 || true
docker run -d --name xboard-node --restart always --network host \
  -e apiHost="$API_HOST" -e apiKey="$API_KEY" -e nodeID="$NODE_ID" -e kernel="$KERNEL" \
  ghcr.io/cedar2025/xboard-node:latest -c /etc/xboard-node/config.yml >/dev/null

PORT=""
for i in $(seq 1 30); do
  sleep 2
  PORT="$(docker logs xboard-node 2>&1 | sed -n 's/.*\[[a-z0-9]*:\([0-9][0-9]*\)\] started.*/\1/p' | tail -1)"
  [ -n "$PORT" ] && break
done
if [ -z "$PORT" ]; then
  echo "节点 60 秒内没启动成功，最近日志："
  docker logs xboard-node --tail 20
  exit 1
fi
USERS="$(docker logs xboard-node 2>&1 | sed -n 's/.*started, \([0-9]*\) users.*/\1/p' | tail -1)"
echo "节点已启动：端口 $PORT，${USERS:-?} 个用户"

if [ "$LIMIT" != "0" ]; then
  for u in https://raw.githubusercontent.com/use3099/AI/main/tools/node-speed-limit.sh \
           https://cdn.jsdelivr.net/gh/use3099/AI@main/tools/node-speed-limit.sh; do
    curl -fsSL -m 30 "$u" -o /root/node-speed-limit.sh && break
  done
  [ -s /root/node-speed-limit.sh ] || { echo "下载限速脚本失败（连不上 GitHub）"; exit 1; }
  bash /root/node-speed-limit.sh "$LIMIT" "$PORT"
fi

echo
echo "全部完成。最后一步：去云服务商的安全组 / 防火墙放行 TCP $PORT 端口（来源 0.0.0.0/0）。"
