#!/usr/bin/env bash
# 在「节点服务器」上运行：给这台机器上的节点端口按用户（客户端 IP）限速，只影响这一台，不动面板和套餐。
# 用法：bash node-speed-limit.sh [限速Mbps，默认20] [节点端口，默认自动识别]
#       bash node-speed-limit.sh off     # 取消限速
# 开机自动生效（systemd）。上传、下载各自限速。
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "请用 root 运行（先 sudo -i）"; exit 1; }

UNIT=/etc/systemd/system/xs-speed-limit.service
RULES=/etc/xs-speed-limit.nft

if [ "${1:-}" = "off" ]; then
  systemctl disable --now xs-speed-limit 2>/dev/null || true
  nft delete table inet xslimit 2>/dev/null || true
  rm -f "$UNIT" "$RULES"; systemctl daemon-reload
  echo "已取消限速"; exit 0
fi

MBPS="${1:-20}"
PORT="${2:-}"
command -v nft >/dev/null || { apt-get -qq update >/dev/null; DEBIAN_FRONTEND=noninteractive apt-get -y -qq install nftables >/dev/null; }

if [ -z "$PORT" ]; then
  # 从 xboard-node 日志里找端口，比如 "[vless:2053] started"
  PORT="$(docker logs xboard-node 2>&1 | sed -n 's/.*\[[a-z0-9]*:\([0-9][0-9]*\)\] started.*/\1/p' | tail -1 || true)"
fi
[ -n "$PORT" ] || { echo "没识别到节点端口，请手动指定：bash node-speed-limit.sh $MBPS 端口"; exit 1; }

KB=$(( MBPS * 1000 / 8 ))      # Mbps -> kbytes/s
BURST=$(( KB * 2 ))

cat > "$RULES" <<EOF
table inet xslimit
delete table inet xslimit
table inet xslimit {
  set dl4 { type ipv4_addr; flags dynamic; timeout 2m; }
  set dl6 { type ipv6_addr; flags dynamic; timeout 2m; }
  set ul4 { type ipv4_addr; flags dynamic; timeout 2m; }
  set ul6 { type ipv6_addr; flags dynamic; timeout 2m; }
  chain out {
    type filter hook output priority 0; policy accept;
    tcp sport $PORT update @dl4 { ip daddr limit rate over $KB kbytes/second burst $BURST kbytes } drop
    tcp sport $PORT update @dl6 { ip6 daddr limit rate over $KB kbytes/second burst $BURST kbytes } drop
  }
  chain in {
    type filter hook input priority 0; policy accept;
    tcp dport $PORT update @ul4 { ip saddr limit rate over $KB kbytes/second burst $BURST kbytes } drop
    tcp dport $PORT update @ul6 { ip6 saddr limit rate over $KB kbytes/second burst $BURST kbytes } drop
  }
}
EOF
nft -f "$RULES"

cat > "$UNIT" <<EOF
[Unit]
Description=Per-user speed limit for node port $PORT
After=network-online.target docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f $RULES
ExecStop=/usr/sbin/nft delete table inet xslimit
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable xs-speed-limit >/dev/null 2>&1

echo "限速已生效：端口 $PORT，每个用户上传/下载各 ${MBPS} Mbps（只影响这台服务器，重启后自动生效）"
echo "取消：curl -fsSL https://raw.githubusercontent.com/use3099/AI/main/tools/node-speed-limit.sh | bash -s -- off"
