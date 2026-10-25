# 把织间送到 NAS：两种镜像交付方案

目标：**NAS 上不装任何构建依赖**，只执行 `docker load`（或 `docker pull`）+ `docker compose up -d` 就能跑。

> 已把 compose 拆成两个文件，NAS 上的 `docker-compose.yml` **不含 build 段**，所以不会在 NAS 上误触发构建：
>
> | 文件 | 用途 | 在哪用 |
> |---|---|---|
> | `docker-compose.yml` | 只有 `image:`，纯启动 | **NAS** |
> | `docker-compose.build.yml` | 只有 `build:`，负责构建 | 有 Docker 的机器 |

---

## 第 0 步：先确认 NAS 架构（决定后面所有步骤）

在 NAS 上执行：

```bash
uname -m
```

| 输出 | 架构 | 镜像必须是 |
|---|---|---|
| `x86_64` | amd64 | `linux/amd64` |
| `aarch64` | arm64 | `linux/arm64` |

**镜像不能跨架构运行**，架构不对会直接报 `exec format error`。

---

## 路线 A：构建 → 导出 tar → NAS load

不需要任何仓库账号，最直接。

### A1. 在有 Docker 的机器上构建

Windows 装 Docker Desktop（https://docs.docker.com/desktop/install/windows-install/）即可，Linux/macOS 装普通 Docker。

```bash
cd <源码目录>            # 就是 zhijianV1.1 这一层
docker build -t zhijian:1.0 .
```

> 构建机也要能访问：Docker Hub（或用 `sh deploy/pull-images.sh` 预拉）、npm 源、Alpine 源。
> `deploy/offline/` 里的 PocketBase 二进制已随源码带上，**这一步不需要 GitHub**。

### A2. 导出镜像（压缩后体积小一半）

```bash
# gzip 版（推荐，NAS 上 gunzip -c 就能读）
docker save zhijian:1.0 | gzip > zhijian-1.0.tar.gz

# 想要更小可以用 zstd（NAS 上需有 zstd 命令）
docker save zhijian:1.0 | zstd -T0 -19 > zhijian-1.0.tar.zst
```

### A3. 传到 NAS 并加载

```bash
# 把 zhijian-1.0.tar.gz 传到 NAS，比如 /volume1/docker/
cd /volume1/docker
gunzip -c zhijian-1.0.tar.gz | docker load
# 或： docker load -i zhijian-1.0.tar.gz

docker images | grep zhijian      # 应看到 zhijian:1.0
```

### A4. 放代码与数据并启动

```bash
cd /volume1/docker/zhijian        # 源码目录（就是 zip/tar 解出来的那份）

mkdir -p data
tar -xzf pb_data.tar.gz -C data   # 得到 data/pb_data（数据库 + 图片）

docker compose up -d              # 注意：没有 --build，直接用已加载的镜像
docker compose ps
docker compose logs -f zhijian
```

浏览器打开 `http://<NAS内网IP>:8099`。

### A5. 以后更新

```bash
# 1. 在构建机重新构建 + 导出
docker build -t zhijian:1.1 . && docker save zhijian:1.1 | gzip > zhijian-1.1.tar.gz

# 2. 传到 NAS，替换旧镜像
cd /volume1/docker
gunzip -c zhijian-1.1.tar.gz | docker load
docker image rm zhijian:1.0        # 清理旧镜像（可选）

# 3. NAS 上更新代码（自动清理已删除的旧文件，避免残留）
cd /volume1/docker/zhijian
sh deploy/update.sh zhijian-app.tar.gz

# 4. 重启
docker compose up -d
```

---

## 路线 B：推到镜像仓库，NAS 真正 pull

需要有个仓库（Docker Hub / 阿里云 ACR / 腾讯云 TCR / 私有 registry 都行）。

### B1. 构建多架构镜像并推送

```bash
cd <源码目录>
docker buildx create --use --name zhijian-builder     # 首次
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t <你的账号>/zhijian:1.0 \
  --push .
```

> 多架构需要 buildx（Docker Desktop 自带；Linux 上需 `docker buildx install`）。
> 构建机上只要有 qemu 模拟器就能同时出两种架构。

### B2. NAS 上 pull 并启动

```bash
cd /volume1/docker/zhijian
docker pull <你的账号>/zhijian:1.0

mkdir -p data && tar -xzf pb_data.tar.gz -C data
docker compose up -d
```

> 如果 NAS 配了 `docker.fnnas.com` 这类加速器，拉自己的仓库镜像不受影响（加速器只代理 Docker Hub）。

---

## 体积参考

| 项 | 大小 |
|---|---|
| 最终镜像（多阶段，只含 nginx + PocketBase + 前端产物） | 约 100～150 MB |
| `docker save` 的 tar（未压缩，含所有中间层） | 约 200～300 MB |
| gzip 之后 | 约 100～150 MB |
| zstd -19 之后 | 约 80～120 MB |
| 数据包（数据库 348KB + 164 张图 319MB，单独传） | 275 MB |

> 删掉脚手架 demo（examples）后，前端产物瘦了 33%（2,854KB → 1,906KB），镜像也跟着小了一圈。

---

## 镜像里有什么、没有什么

| | 在镜像里 | 不在镜像里 |
|---|---|---|
| 前端静态文件 | ✅ `dist/` | |
| PocketBase 可执行文件 | ✅ | |
| 业务钩子 `pb_hooks/` | ✅ | |
| nginx 配置 | ✅ | |
| **数据库与上传的图片** | ❌ | 在 `data/pb_data`（卷） |
| 账号密码、superuser | ❌ | 在数据库里 |

所以**数据必须单独拷**，这也是为什么每次都要带 `pb_data.tar.gz`。

---

## 常见问题

| 现象 | 原因 / 解决 |
|---|---|
| `exec format error` | 架构不匹配 → 重新用对的架构构建（`uname -m` 确认） |
| `docker compose up` 开始构建 | 用了带 `build:` 段的 compose → NAS 上用 `docker-compose.yml`（无 build 段），别用 `docker-compose.build.yml` |
| `no such image` | 没 `docker load` / 没 `docker pull` → 先加载镜像再 up |
| 页面能开但数据全空 | `data/pb_data` 没挂对 → 检查 `docker compose ps` 里的卷映射 |
| 端口冲突 | 改 `docker-compose.yml` 里 `published` 的数字 |
| 构建时拉基础镜像 401 | NAS 加速器问题 → 见 README「构建时的网络需求」；若用路线 A，构建在你自己机器上做，NAS 完全不需要拉镜像 |
