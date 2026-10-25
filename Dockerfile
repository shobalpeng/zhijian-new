# ============================================================
# 织间 zhijian —— 单容器镜像（前端静态 + PocketBase + 反向代理）
#
# 构建：docker build -t zhijian:1.0 .
# 运行：docker run -d --name zhijian -p 8099:80 -v ./data/pb_data:/pb/pb_data zhijian:1.0
#
# 依赖的基础镜像只有两个（node:20-alpine、nginx:stable-alpine）：
#   拉不动时用 deploy/pull-images.sh 预拉取并打回官方 tag 即可。
# ============================================================

# ---------- 1. 构建前端 + 准备 PocketBase 二进制 ----------
FROM node:20-alpine AS build
WORKDIR /app

# npm 源可换（国内可指向淘宝源：https://registry.npmmirror.com）
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY}

# 离线 npm 缓存（可选）：deploy/offline/npm-cache/_cacache 存在时用它，npm 完全不联网；
# 不存在则走上面的 npm 源
COPY deploy/offline/npm-cache/ /tmp/offline-npm/

# 先装依赖，利用镜像层缓存
COPY package.json package-lock.json ./
RUN set -eux; \
    if [ -d /tmp/offline-npm/_cacache ]; then \
      echo ">> 使用离线 npm 缓存"; \
      npm config set cache /tmp/offline-npm; \
      npm ci --offline; \
    else \
      echo ">> 无离线 npm 缓存，改为联网安装"; \
      npm ci; \
    fi

COPY . .

# 留空 = 前端用同域地址（推荐，无需知道最终域名）
# 只有需要跨域调用 PocketBase 时才填，例如 https://pb.example.com
ARG VITE_POCKETBASE_URL=""
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

RUN npm run build

# ---- 取 PocketBase 可执行文件：优先用离线文件，没有才联网下载 ----
ARG PB_VERSION=0.40.6
ARG TARGETARCH

# deploy/offline 里若已有对应架构的二进制则完全离线；否则回退到联网下载
COPY deploy/offline/ /tmp/offline/

RUN set -eux; \
    mkdir -p /pb; \
    case "$TARGETARCH" in \
      amd64)  PB_ARCH=amd64  ;; \
      arm64)  PB_ARCH=arm64  ;; \
      armv7)  PB_ARCH=armv7  ;; \
      *) echo "不支持的架构: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    if [ -f "/tmp/offline/pocketbase-linux-${PB_ARCH}" ]; then \
      echo ">> 使用离线 PocketBase 二进制: ${PB_ARCH}"; \
      cp "/tmp/offline/pocketbase-linux-${PB_ARCH}" /pb/pocketbase; \
    else \
      echo ">> 离线文件不存在，改为从 GitHub Releases 下载"; \
      apk add --no-cache curl unzip; \
      curl -fsSL -o /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"; \
      unzip -q /tmp/pb.zip -d /pb; \
    fi; \
    chmod +x /pb/pocketbase; \
    /pb/pocketbase --version


# ---------- 2. 运行时 ----------
FROM nginx:stable-alpine

ARG PB_VERSION=0.40.6
LABEL org.opencontainers.image.title="zhijian" \
      org.opencontainers.image.description="织间 · 情侣生活记录（Vite SPA + PocketBase）" \
      org.opencontainers.image.version="1.0"

# tzdata：让容器内时间是东八区；python3：仅「全新部署建表」时用得到
# 如果 NAS 连不上 Alpine 源，可删掉这一行（时区会退化成 UTC，建表脚本改在宿主机执行）
RUN apk add --no-cache tzdata python3
ENV TZ=Asia/Shanghai

# PocketBase 可执行文件 + 钩子（业务逻辑：状态机 / 积分 / 配对 / 菜谱统计）
COPY --from=build /pb/pocketbase /usr/local/bin/pocketbase
COPY pb_hooks /pb/pb_hooks

# 管理脚本（全新部署时在容器内建表用）
COPY scripts /app/scripts

# 集合迁移文件（容器内 apply_collections.py 需要，用 ZJ_MIGRATIONS_GLOB 指定位置）
COPY src/modules/*/migrations /app/migrations
ENV ZJ_MIGRATIONS_GLOB=/app/migrations/*.json

# 前端静态文件
COPY --from=build /app/dist /usr/share/nginx/html

# nginx 配置：静态站点 + 反代 /api 与 /_/ 到 PocketBase
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN mkdir -p /pb/pb_data

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/health || exit 1

# PocketBase 只监听容器内部（127.0.0.1），对外仅暴露 nginx 的 80 端口
CMD ["/bin/sh", "-c", "/usr/local/bin/pocketbase serve --http=127.0.0.1:8090 --dir=/pb/pb_data --hooksDir=/pb/pb_hooks & exec nginx -g 'daemon off;'"]
