#!/usr/bin/env bash
# 在 Xboard 面板服务器上运行：以现有节点为模板复制出一个新节点，并打印新服务器要运行的安装命令。
# 用法：bash xboard-add-node.sh "节点名称" 新服务器IP [限速Mbps，默认不限] [模板节点ID，默认 7]
# 例如：curl -fsSL https://raw.githubusercontent.com/use3099/AI/main/tools/xboard-add-node.sh | bash -s -- "南美 圣保罗 01" 15.228.74.80 20
# 不改动任何现有节点；通讯密钥从模板节点的容器里读取，不写在脚本里。
set -euo pipefail

NAME="${1:?缺少节点名称}"
HOST="${2:?缺少新服务器 IP}"
LIMIT="${3:-0}"
TEMPLATE="${4:-7}"
PANEL="$(docker ps --format '{{.Names}}' | grep -E '^xboard-xboard' | head -1)"
[ -n "$PANEL" ] || { echo "这台不是面板服务器（找不到 Xboard 容器）。请在面板服务器上运行。"; exit 1; }

# 从模板节点的容器里取面板地址和通讯密钥
NODE_CT="$(docker ps --format '{{.Names}}' | grep -E "^xboard-node-${TEMPLATE}$" | head -1 || true)"
[ -n "$NODE_CT" ] || NODE_CT="$(docker ps --format '{{.Names}} {{.Image}}' | awk '/xboard-node/{print $1; exit}')"
ENVS="$(docker inspect "$NODE_CT" --format '{{range .Config.Env}}{{println .}}{{end}}')"
API_HOST="$(printf '%s\n' "$ENVS" | sed -n 's/^apiHost=//p')"
API_KEY="$(printf '%s\n' "$ENVS" | sed -n 's/^apiKey=//p')"
KERNEL="$(printf '%s\n' "$ENVS" | sed -n 's/^kernel=//p')"; KERNEL="${KERNEL:-xray}"
[ -n "$API_HOST" ] && [ -n "$API_KEY" ] || { echo "没能从节点容器 $NODE_CT 读到 apiHost / apiKey"; exit 1; }

OUT="$(docker exec -i -e XN_NAME="$NAME" -e XN_HOST="$HOST" -e XN_LIMIT="$LIMIT" -e XN_TPL="$TEMPLATE" "$PANEL" php artisan tinker <<'PHP'
$t = \Schema::hasTable('v2_server') ? 'v2_server' : 'v2_server_vless';
$name = getenv('XN_NAME'); $host = getenv('XN_HOST'); $limit = (int) getenv('XN_LIMIT'); $tpl = (int) getenv('XN_TPL');
$old = \DB::table($t)->where('name', $name)->first();
if ($old) { echo "XN_ID=" . $old->id . "\nXN_LIMIT=existing\n"; } else {
  $r = (array) \DB::table($t)->where('id', $tpl)->first();
  if (!$r) { echo "XN_ERR=找不到模板节点 $tpl\n"; } else {
    unset($r['id']);
    $r['name'] = $name; $r['host'] = $host;
    foreach (['machine_id', 'parent_id'] as $c) if (array_key_exists($c, $r)) $r[$c] = null;
    $lim = 'none';
    if ($limit > 0 && array_key_exists('speed_limit', $r)) { $r['speed_limit'] = $limit; $lim = 'set'; }
    elseif ($limit > 0) { $lim = 'nofield'; }
    foreach (['created_at', 'updated_at'] as $c) if (array_key_exists($c, $r)) $r[$c] = is_numeric($r[$c]) ? time() : now();
    if (array_key_exists('code', $r) && $r['code']) $r['code'] = $r['code'] . '-' . substr(md5($name), 0, 6);
    echo "XN_ID=" . \DB::table($t)->insertGetId($r) . "\nXN_LIMIT=$lim\n";
  }
}
PHP
)"
ERR="$(printf '%s\n' "$OUT" | sed -n 's/.*XN_ERR=//p')"
[ -z "$ERR" ] || { echo "$ERR"; exit 1; }
ID="$(printf '%s\n' "$OUT" | sed -n 's/.*XN_ID=\([0-9]*\).*/\1/p' | head -1)"
LIM="$(printf '%s\n' "$OUT" | sed -n 's/.*XN_LIMIT=\([a-z]*\).*/\1/p' | head -1)"
[ -n "$ID" ] || { echo "创建节点失败，面板返回："; printf '%s\n' "$OUT" | tail -20; exit 1; }

echo
echo "节点「$NAME」已就绪，节点 ID：$ID"
case "$LIM" in
  set) echo "限速：${LIMIT} Mbps" ;;
  nofield) echo "限速：这个 Xboard 版本的节点没有限速项，需要在套餐里设置" ;;
  existing) echo "（之前已经建过同名节点，沿用它）" ;;
esac
echo
echo "======== 复制下面这一整行，到新服务器（$HOST）上用 root 运行 ========"
echo "docker rm -f xboard-node 2>/dev/null; docker run -d --name xboard-node --restart always --network host -e apiHost=$API_HOST -e apiKey='$API_KEY' -e nodeID=$ID -e kernel=$KERNEL ghcr.io/cedar2025/xboard-node:latest -c /etc/xboard-node/config.yml && sleep 8 && docker logs xboard-node --tail 20"
