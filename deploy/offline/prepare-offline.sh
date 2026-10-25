#!/bin/sh
# 准备「完全离线」构建所需的全部文件（Linux / macOS / NAS 上都能跑）
#
#   cd deploy/offline && sh prepare-offline.sh
#
# 产出：
#   pocketbase-linux-amd64   PocketBase v0.40.6 (x86_64)
#   pocketbase-linux-arm64   PocketBase v0.40.6 (arm64)
#   npm-cache/               npm 依赖缓存（npm ci --offline 可用）
#
# 准备完成后，Docker 构建全程不联网（基础镜像仍需首次拉取）。

set -eu

PB_VERSION="${PB_VERSION:-0.40.6}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> 准备 PocketBase v${PB_VERSION}"
for arch in amd64 arm64; do
  target="pocketbase-linux-${arch}"
  if [ -f "$target" ]; then
    echo "    已存在，跳过: $target"
    continue
  fi
  zip="pocketbase_${PB_VERSION}_linux_${arch}.zip"
  echo "    下载 $zip"
  curl -fsSL -o "$zip" \
    "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${arch}.zip"
  tmp="tmp_${arch}"
  rm -rf "$tmp"; mkdir -p "$tmp"
  unzip -q "$zip" -d "$tmp"
  cp "$tmp/pocketbase" "$target"
  chmod +x "$target"
  rm -rf "$tmp" "$zip"
  echo "    完成: $target ($(du -h "$target" | cut -f1))"
done

echo "==> 准备 npm 离线缓存（项目根目录执行）"
cd "$DIR/../.."
if [ -d deploy/offline/npm-cache/_cacache ]; then
  echo "    已存在，跳过"
else
  npm ci --cache ./deploy/offline/npm-cache --no-audit --no-fund
  echo "    完成: $(du -sh deploy/offline/npm-cache | cut -f1)"
fi

echo
echo "全部就绪。把 deploy/offline 整个目录拷到 NAS 后执行："
echo "  docker compose up -d --build"
