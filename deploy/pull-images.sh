#!/bin/sh
# 在 NAS 上预拉取构建所需的基础镜像，并打回「官方名」，让 Dockerfile 的 FROM 直接命中本地镜像
#
#   cd /volume1/docker/zhijian
#   sh deploy/pull-images.sh
#
# 背景：部分 NAS 的镜像加速器（如 docker.fnnas.com）会返回 401，导致
#   failed to resolve source metadata for docker.io/library/alpine:3.20
# 解决办法：从能用的镜像站直接拉，再打回官方 tag，构建时就不再联网。
#
# 需要的基础镜像只有两个（Dockerfile 已把 pocketbase 阶段合并进 node 阶段）：
#   node:20-alpine、nginx:stable-alpine

set -eu

IMAGES="node:20-alpine nginx:stable-alpine"

# 依次尝试的镜像站（都是 Docker Hub 的公共代理）
MIRRORS="
docker.m.daocloud.io/library
mirror.ccs.tencentyun.com/library
hub-mirror.c.163.com/library
docker.1ms.run/library
docker.nju.edu.cn/library
"

echo "== NAS 架构: $(uname -m) （x86_64 / aarch64 都已备好对应的 PocketBase 离线包）=="
echo ""
echo "== 检查本机已有的镜像 =="
for img in $IMAGES; do
  if docker image inspect "$img" >/dev/null 2>&1; then
    echo "  ✓ $img 本地已存在"
  fi
done

fail=0
for img in $IMAGES; do
  if docker image inspect "$img" >/dev/null 2>&1; then
    continue
  fi

  echo ""
  echo "== 拉取 $img =="
  ok=0
  for m in $MIRRORS; do
    full="${m}/${img}"
    printf "   尝试 %-45s " "$full"
    if docker pull "$full" >/dev/null 2>&1; then
      echo "成功"
      docker tag "$full" "$img"
      echo "   ✓ 已打回官方 tag: $img"
      ok=1
      break
    else
      echo "失败"
    fi
  done

  if [ "$ok" -eq 0 ]; then
    echo "   ✗ $img 所有镜像站都拉不动"
    echo "     试试：在 NAS 面板里换成其它镜像加速器，或用 docker save/load 离线导入"
    fail=1
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "全部镜像就绪，现在可以构建："
  echo "  docker compose up -d --build"
else
  echo "部分镜像缺失，请先解决上面的拉取问题。" >&2
  exit 1
fi
