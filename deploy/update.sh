#!/bin/sh
# NAS 端：更新应用代码（不动数据）
#
#   sh deploy/update.sh                 # 用当前目录下的 zhijian-app.tar.gz
#   sh deploy/update.sh /path/to/zhijian-app.tar.gz
#
# 为什么需要它：tar 解包**只覆盖同名文件，不会删除**旧版本里存在、
# 而新版本已经删掉的目录（比如脚手架 demo 的 src/modules/examples）。
# 那些残留文件会让构建失败（TS 编译到已删除的 demo 页面）。
# 所以这里先把「会被覆盖的代码目录」整体删掉再解包。
#
# 注意：只删代码目录（src / deploy / pb_hooks / scripts / public），
#       业务数据在 data/pb_data，不受影响。

set -eu

APP_TGZ="${1:-zhijian-app.tar.gz}"
DEST="${2:-.}"

cd "$DEST"

if [ ! -f "$APP_TGZ" ]; then
  echo "✗ 找不到 $APP_TGZ" >&2
  exit 1
fi

echo "==> 清理旧代码目录（数据目录不动）"
rm -rf src deploy pb_hooks scripts public

echo "==> 解包新版本：$APP_TGZ"
tar -xzf "$APP_TGZ" -C "$DEST"

echo "==> 自检"
missing=0
for f in Dockerfile docker-compose.yml nginx.conf package.json package-lock.json; do
  [ -f "$f" ] || { echo "    ✗ 缺少 $f"; missing=1; }
done
if [ -d src/modules/examples ]; then
  echo "    ✗ src/modules/examples 还在（不应存在）"; missing=1
fi
if ! ls deploy/offline/pocketbase-linux-* >/dev/null 2>&1; then
  echo "    ✗ deploy/offline 里没有 PocketBase 二进制（构建会尝试联网下载）"; missing=1
fi
[ "$missing" -eq 0 ] && echo "    ✓ 文件齐全"

echo ""
echo "完成。接着执行："
echo "  docker compose up -d --build"
