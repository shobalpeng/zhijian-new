# 织间 zhijian —— NAS（Docker）部署指南

一个容器同时跑 **前端静态站点 + PocketBase**，对外只暴露一个端口，NAS 上最省事。

```
                    ┌──────────────── 容器 zhijian ────────────────┐
 浏览器 ──:8099 ──▶ │ nginx :80                                   │
                    │   /          → 前端静态文件（SPA）          │
                    │   /api/      → PocketBase :8090（仅内部）   │
                    │   /_/        → PocketBase 管理后台          │
                    └──────────────┬─────────────────────────────┘
                                   │
                          /pb/pb_data（挂载到宿主机）
                          数据库 + 上传的图片
```

---

## 一、前置条件

| 项目 | 要求 |
|---|---|
| NAS | 支持 Docker（群晖 Container Manager / 威联通 Container Station / fnOS / Unraid 等） |
| 架构 | x86_64 或 arm64 均可（构建时自动选对应的 PocketBase 二进制） |
| 端口 | 选一个空闲端口，例如 `8099`（不要用 80，NAS 自己的反代通常占了） |
| 网络 | **构建时**需要访问 4 个外部源（见下表）；运行期完全不需要外网 |

### 构建时的网络需求（`docker compose up -d --build` 这一步）

| 拉取的东西 | 来源 | 国内是否通常可用 | 不通时怎么办 |
|---|---|---|---|
| `node:20-alpine`、`nginx:stable-alpine` 基础镜像（**只需这 2 个**） | Docker Hub | 慢/被限流，或加速器返回 **401** | 跑 `sh deploy/pull-images.sh`（见下） |
| npm 依赖（`npm ci`） | npm registry（默认已指向 **npmmirror**） | 一般可用 | 换回 `https://registry.npmjs.org` |
| Alpine 的 `tzdata`/`python3` | dl-cdn.alpinelinux.org | 一般可用 | 删掉 Dockerfile 里那行 `apk add`（时区退化为 UTC，建表改在宿主机跑） |
| ~~PocketBase 二进制~~ | ~~GitHub Releases~~ | — | ✅ **已用离线文件解决，见下** |

> **只有「运行期」不需要外网**：装好之后，PocketBase、前端、图片都在你自己的 NAS 上跑，不依赖任何外部服务。

### ⚠️ 先拉基础镜像：应对镜像加速器 401

如果构建时报：

```
failed to resolve source metadata for docker.io/library/alpine:3.20: ...
https://docker.fnnas.com/... → 401 Unauthorized
```

说明 NAS 的镜像加速器（这里是 `docker.fnnas.com`）拒绝了请求。**在 NAS 上先跑一次**：

```bash
cd /volume1/docker/zhijian
sh deploy/pull-images.sh
```

脚本会依次尝试 `docker.m.daocloud.io` → `mirror.ccs.tencentyun.com` → `hub-mirror.c.163.com` → `docker.1ms.run` → `docker.nju.edu.cn`，
把能拉下来的镜像**打回官方 tag**（`docker tag`），这样 Dockerfile 里的 `FROM node:20-alpine` 会直接命中本地镜像，构建时不再联网。

也可以手动执行（等价）：

```bash
docker pull docker.m.daocloud.io/library/node:20-alpine
docker pull docker.m.daocloud.io/library/nginx:stable-alpine
docker tag docker.m.daocloud.io/library/node:20-alpine node:20-alpine
docker tag docker.m.daocloud.io/library/nginx:stable-alpine nginx:stable-alpine
```

> 为什么只要 2 个镜像：Dockerfile 已把原来独立的 `alpine:3.20` 阶段合并进 `node:20-alpine`
> （它本身就是 alpine 系，能直接 cp/chmod），不再需要单独拉 alpine。


### 离线包（解决 GitHub 拉不动）—— 已经帮你备好了

`deploy/offline/` 目录里**已经放好两个架构的 PocketBase 二进制**（v0.40.6，静态编译，alpine 可直接跑）：

```
deploy/offline/
├── pocketbase-linux-amd64    32 MB   x86_64 NAS（群晖/威联通多数型号）
├── pocketbase-linux-arm64    31 MB   ARM NAS（部分国产 NAS / 树莓派）
├── prepare-offline.sh / .ps1         一键重新生成的脚本
└── npm-cache/                         预留：npm 离线缓存（当前为空）
```

Dockerfile 会自动按构建架构挑对应的那份，**检测到就直接用，全程不访问 GitHub**（连 `curl`/`unzip` 都不会装）。构建日志里会看到：

```
>> 使用离线 PocketBase 二进制: amd64
```

> 这两个文件体积 63 MB，已加入 `.gitignore` 不入库；换机器时用 `prepare-offline` 脚本重新生成即可（脚本会从 GitHub 下载并解压成上面的文件名）。
>
> 只带其中一个架构也行，把不需要的那个删掉即可，构建时按架构取。

### 完全离线（NAS 完全不能出网）

在有网的电脑上构建好镜像，再搬过去：

```bash
# 有网的电脑（有 Docker 即可，架构需与 NAS 一致）
docker build -t zhijian:1.0 .
docker save zhijian:1.0 -o zhijian-1.0.tar

# 传到 NAS 后
docker load -i zhijian-1.0.tar
docker compose up -d      # 注意用 up 而不是 up --build
```

> 跨架构时本机构建不了（例如此处是 Windows），请用对应架构的机器或 `docker buildx` 远程构建。

---

## 二、准备数据目录

数据全在 `pb_data` 这一个目录里（数据库 + 上传的图片），**备份/迁移都只备份它**。

### 方式 A：迁移你现在的数据（推荐）

在**开发机**上先把 PocketBase 停掉（否则 SQLite 的 WAL 文件可能不一致），再整个目录拷走：

```powershell
# Windows（开发机）：先停 PocketBase
Stop-Process -Name pocketbase -Force -ErrorAction SilentlyContinue

# 打包 .pocketbase/pb_data（含 data.db / storage / wal）
Compress-Archive -Path "E:\SourceCode\workbuddy\zhijian2\zhijianV1.1\.pocketbase\pb_data\*" `
                  -DestinationPath "E:\SourceCode\workbuddy\zhijian2\pb_data.zip" -Force
```

把 `pb_data.zip` 上传到 NAS，解压到项目目录下的 `data/pb_data`：

```
zhijianV1.1/
└── data/
    └── pb_data/
        ├── data.db          ← 数据库
        ├── auxiliary.db
        └── storage/         ← 上传的图片
```

> 建议先备份一份 `data.db.bak_before_clear_20261024_213446`（清零积分那次）以防万一。

### 方式 B：全新空库

什么都不拷，直接用方式 B 启动，然后在下面「六、新建部署（无旧数据）」里建表。

---

## 三、拷贝清单（到底要拷什么）

### 方式 A：用打包脚本（推荐，一步到位）

在**开发机**的项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\pack-for-nas.ps1
```

> 脚本会先检查 PocketBase 是否在运行——**运行中拷 SQLite 可能拿到不一致的数据**，
> 它会提示你先停掉（`Stop-Process -Name pocketbase -Force`），停完再跑一次即可。
> 只想带数据库不要图片（图片 319MB）：加 `-SkipImages`。

产出在项目根的 `dist-nas/`：

| 包 | 体积 | 内容 |
|---|---|---|
| `zhijian-app.tar.gz` | **23 MB** | 应用代码 + Dockerfile + 离线 PocketBase 二进制（压缩后 63MB → 23MB） |
| `pb_data.tar.gz` | **274 MB** | 数据库 `data.db`（348KB）+ `storage/` 里的 164 张图片（319MB） |

拷到 NAS 后解包并启动：

```bash
mkdir -p /volume1/docker/zhijian/data
tar -xzf zhijian-app.tar.gz -C /volume1/docker/zhijian
tar -xzf pb_data.tar.gz  -C /volume1/docker/zhijian/data   # 解出 data/pb_data
cd /volume1/docker/zhijian
docker compose up -d --build
```

### 方式 B：手动拷（清单）

**必须拷的**（放到 NAS 的 `/volume1/docker/zhijian/`）：

| 路径 | 说明 |
|---|---|
| `Dockerfile` | 镜像构建 |
| `docker-compose.yml` | 编排（含端口与数据卷） |
| `nginx.conf` | 静态托管 + 反代 |
| `.dockerignore` | 构建上下文排除规则（**隐藏文件，别漏**） |
| `package.json`、`package-lock.json` | 依赖清单（`npm ci` 靠它） |
| `tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json` | TS 配置 |
| `vite.config.ts` | 构建配置（含 /api 代理） |
| `index.html` | 入口 HTML |
| `components.json` | shadcn 组件配置 |
| `src/` | ★ 全部前端源码 |
| `public/` | 静态资源 |
| `pb_hooks/` | ★ **PocketBase 业务钩子**（状态机/积分/配对），少了功能会失效 |
| `scripts/` | 管理脚本（全新部署建表用 `apply_collections.py`） |
| `deploy/` | 含 `offline/` 的两个 PocketBase 二进制（63MB）+ `pull-images.sh`（预拉基础镜像）+ `pack-for-nas.ps1`（打包脚本）+ 本文档 |

**另外要拷的数据**：

| 从本机 | 到 NAS | 说明 |
|---|---|---|
| `.pocketbase/pb_data/` | `data/pb_data/` | 数据库 + 上传的图片（**先停 PocketBase 再拷**） |

**不用拷的**：

| 东西 | 原因 |
|---|---|
| `node_modules/` | 镜像构建时 `npm ci` 现场装 |
| `dist/` | 镜像构建时现场 build |
| `.pocketbase/`、`pb_data/` | 运行期数据，按上面的表单独拷 |
| `.env` | 含密钥，且被 `.dockerignore` 排除 |
| `docs/`、`AGENTS.md`、根 `README.md` | 文档，不影响运行 |
| `.tmp*`、`*.log`、`dist-nas/` | 临时文件 |

---

## 四、构建与启动

> **三种模式**，取决于你想在哪构建：
>
> | 模式 | 在哪构建 | 命令 | 适合 |
> |---|---|---|---|
> | **⭐ 模式 C. GitHub Actions** | GitHub 云端 | `git push` 或手动触发 workflow | **你本机没 Docker；NAS 也没网络** |
> | **模式 A. 镜像交付** | 在你有 Docker 的机器上 | 构建 → `docker save` → NAS `docker load` → `up -d` | NAS 不想装构建环境 |
> | **模式 B. NAS 上直接构建** | 在 NAS 上 | `docker compose -f docker-compose.build.yml up -d --build` | NAS 能访问 Docker Hub、npm 源 |
>
> **模式 C 的完整步骤见 [`deploy/GITHUB-ACTIONS.md`](./GITHUB-ACTIONS.md)**（最省事，强烈推荐）。
> 模式 A 的细节见 [`deploy/IMAGE-SHIP.md`](./IMAGE-SHIP.md)。

### 模式 C：GitHub Actions 构建（推荐，无需本机装 Docker）

```bash
git add . && git commit -m "..."
git tag v1.0.0 && git push origin main v1.0.0
```

Actions 自动构建 amd64 + arm64 双架构镜像 → 推到 `ghcr.io` → NAS 上：

```bash
docker login ghcr.io -u <GitHub用户名> -p <PAT>   # 私有包需要
cd /volume1/docker/zhijian
docker pull ghcr.io/<你的用户名>/zhijian:v1.0.0
docker compose up -d
```

### 模式 B：在 NAS 上直接构建

```bash
cd /volume1/docker/zhijian

# ① 先拉基础镜像（镜像加速器 401 时必做，见上文）
sh deploy/pull-images.sh

# ② 构建并启动（用 build 版 compose）
docker compose -f docker-compose.build.yml up -d --build

# 看状态
docker compose ps
docker compose logs -f zhijian
```

也可以用 NAS 的图形界面：

- **群晖 Container Manager**：项目 → 新增 → 选择 `docker-compose.yml` → 构建
- **威联通 Container Station**：应用程序 → 容器 → 新增 → 使用编排文件

端口在 `docker-compose.yml` 里改：

```yaml
ports:
  - "8099:80"    # 左边是宿主机端口，随便换成你不冲突的
```

---

## 五、验证

浏览器打开 `http://<NAS内网IP>:8099`

| 检查 | 期望 |
|---|---|
| 首页 | 正常渲染，显示「织间」 |
| 登录 | 用 `怦怦` / `马乃` 之一能登录（数据已迁移的话） |
| 管理后台 | `http://<NAS内网IP>:8099/_/` 能打开并登录 |
| 图片 | 聚餐列表里的照片能显示（说明 `storage/` 挂载正确） |
| 实时同步 | 在后台改一条记录，前端页面会自动刷新（SSE 反代正常） |

---

## 六、新建部署（无旧数据）

1. `docker-compose.yml` 里填上超级管理员账号（**仅首次、数据目录为空时生效**）：

   ```yaml
   environment:
     PB_ADMIN_EMAIL: "admin@zhijian.app"
     PB_ADMIN_PASSWORD: "换成你自己的强密码"
   ```

2. 启动后容器内建表（脚本已打进镜像）：

   ```bash
   docker compose exec zhijian python3 /app/scripts/apply_collections.py http://127.0.0.1:8090
   ```

3. 建完表后去 `/_/` 后台改掉初始密码，并删掉这两个环境变量再重启。

---

## 七、域名 + HTTPS（推荐）

在 NAS 的反向代理里新增一条规则（群晖：登录面板 → 登录门户 → 高级 → 反向代理）：

| 项 | 值 |
|---|---|
| 源站协议 | HTTP |
| 源站主机名 / 端口 | `127.0.0.1` / `8099` |
| 目标协议 | HTTPS |
| 目标主机名 | 你的域名 |
| 目标端口 | `443` |
| 证书 | Let's Encrypt（群晖可自动申请） |

> 如果你的反代是 **nginx** 而不是 NAS 自带的，需要加这两项，否则实时订阅和图片上传会出问题：
> ```nginx
> proxy_buffering off;         # realtime(SSE) 必需
> client_max_body_size 40m;    # 图片上传
> proxy_read_timeout 3600s;
> ```

**必须用 HTTPS**：PocketBase 的认证依赖 Cookie 的 `Secure` 标记，HTTP 下登录态无法保持（浏览器会拒绝保存）。

---

## 八、日常运维

### 备份

```bash
# 1. 停服（保证 SQLite 一致）
docker compose stop

# 2. 打包数据目录
cd /volume1/docker/zhijian
tar czf ~/zhijian-backup-$(date +%Y%m%d).tar.gz data/pb_data

# 3. 启动
docker compose start
```

也可以直接备份整个 `data/pb_data` 目录（NAS 的快照/定时任务更省事）。

### 升级

```bash
git pull                # 或重新上传源码
docker compose up -d --build
```

数据在挂载卷里，升级镜像不会丢数据。

### 回滚

```bash
docker compose down
# 恢复备份到 data/pb_data
docker compose up -d
```

### 常用命令

```bash
docker compose logs -f zhijian        # 看日志（含 PocketBase 钩子报错）
docker compose exec zhijian pocketbase --help
docker compose exec zhijian ls -la /pb/pb_data
```

---

## 九、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| **`invalid containerPort: 80`** | compose 的 `ports` 写法被 NAS 的解析器误读。已把 `docker-compose.yml` 改成**长语法 + 纯数字**（`target: 80` / `published: 8099`）。若仍报错，直接用最简版本：<br>`ports:`<br>`  - "8099:80"`<br>（注意**必须带引号**：YAML 1.1 会把没引号的 `8099:80` 当成 60 进制数 `485980`） |
| **拉基础镜像报 401 Unauthorized** | NAS 的镜像加速器拒绝了请求 → 先跑 `sh deploy/pull-images.sh`（换镜像源拉取并打回官方 tag）。见「构建时的网络需求」一节 |
| 页面能开但数据全是空的 | `data/pb_data` 没挂对，或 `pb_data` 是从运行中的实例直接拷的（SQLite 不一致）→ 停服后重拷 |
| 图片显示 404 | `storage/` 没随 `pb_data` 一起拷过去 |
| 登录后立刻掉线 | 没走 HTTPS，Cookie 的 Secure 标记被浏览器拒绝 |
| 实时同步不刷新 | 反代开了缓冲 → `proxy_buffering off` |
| 任务/心愿的积分不对 | `pb_hooks/` 没进镜像 → 确认目录在，且容器内 `ls /pb/pb_hooks` 有 `.pb.js` 文件 |
| 改了密码后界面显示「未绑定」 | 旧版前端 bug（改密码会作废 token），已在新版修复：改密后自动重新登录 |
| 启动报 `unsupported arch` | NAS 是特殊架构（如 loong64），需自行下载对应 PocketBase 二进制替换 |
| 8080/8090 端口冲突 | 改 `docker-compose.yml` 里 `ports` 的左边端口号 |

---

## 十、与其他方案的取舍

| 方案 | 适用 | 缺点 |
|---|---|---|
| **单容器（本方案）** | 绝大多数 NAS | 无法单独扩缩 PocketBase |
| PocketBase 单独容器 + NAS 托管静态站 | 已有成熟静态站流程 | 配置分散，跨域要处理 |
| PocketBase 官方镜像 + 独立前端镜像 | 需要 K8s / 多环境 | 对家用 NAS 过重 |

> ⚠️ 注意：PocketBase 官方 `ghcr.io/muktihari/pocketbase` 镜像**不包含**本项目的业务钩子，用它必须把 `pb_hooks/` 挂进去，否则状态机与积分逻辑不会执行。
