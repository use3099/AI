#!/usr/bin/env bash
# 把 docker-compose.yml、Caddyfile、web/ 和 bff/ 打进 install.sh，生成单文件安装包 dist/install.sh
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/dist/install.sh"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$ROOT/dist"
cp "$ROOT/deploy/docker-compose.yml" "$ROOT/deploy/Caddyfile" "$STAGE/"
cp -r "$ROOT/web" "$STAGE/web"
# App 后端（不带测试和本地数据）
mkdir -p "$STAGE/bff"
cp -r "$ROOT/bff/src" "$ROOT/bff/public" "$ROOT/bff/package.json" "$ROOT/bff/Dockerfile" "$ROOT/bff/.dockerignore" "$STAGE/bff/"
# App 安装包（如果已经构建好放在 dist/download 里）一起带上，供下载页使用
if [ -d "$ROOT/dist/download" ]; then cp -r "$ROOT/dist/download" "$STAGE/web/download"; fi
cp "$ROOT/deploy/install.sh" "$OUT"
tar -C "$STAGE" -cz . | base64 >>"$OUT"
chmod +x "$OUT"
echo "生成: $OUT ($(du -h "$OUT" | cut -f1))"
