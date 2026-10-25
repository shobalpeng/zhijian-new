# 用 GitHub Actions 构建镜像 → 部署到 NAS

**你本机不需要装 Docker**，一条 git push 就完成构建。

```
git push  →  GitHub Actions 构建（amd64 + arm64）→  推到 ghcr.io  →  NAS 上 docker pull + up -d
```

---

## 一、准备（一次性）

### 1. 把项目推到 GitHub 私有仓库

```bash
cd E:/SourceCode/workbuddy/zhijian2/zhijianV1.1
git init
git add .
git commit -m "feat: 织间 zhijian v1.0"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 仓库里的 `.gitignore` 已经排除了 `deploy/offline/` 的二进制（63MB）和所有运行期数据 —— 这些**不会**进仓库。
> 仓库里需要包含：`src/`、`public/`、`pb_hooks/`、`pb_data` 无关、`deploy/`、`Dockerfile`、两个 compose、`package*.json`。

### 2. 确认 Actions 权限

仓库 → **Settings → Actions → General → Workflow permissions** → 选 **Read and write permissions**。
（workflow 里已声明 `packages: write`，但仓库级设置如果限制成只读会挡住推送镜像。）

### 3. 触发构建

**方式一：手动**

仓库 → **Actions** → 左侧选 **Build Docker image** → 右上 **Run workflow** → 填 tag（默认 `latest`）→ Run。

**方式二：打标签（推荐，配合自动部署）**

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 二、NAS 上拉取并运行

构建完成后，镜像在 `ghcr.io/<你的用户名>/zhijian:<tag>`。

### 私有包需要先登录

```bash
# 在 NAS 上
docker login ghcr.io -u <你的GitHub用户名> -p <你的PAT>
```

PAT 在 GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → 勾 `read:packages`（以及 `write:packages`，如果要 push）→ 复制那串 token。

> 嫌麻烦可以把包改成公开：GitHub 仓库 → Packages → 你的包 → Package settings → Change visibility → Public。之后 pull 就不用登录。

### 拉取 + 启动

```bash
cd /volume1/docker/zhijian

# 1) 代码（compose 等）—— 用打包脚本给的 app 包，或直接 git clone
tar -xzf zhijian-app.tar.gz -C /volume1/docker/zhijian

# 2) 数据（数据库 + 图片，275MB）—— 只需第一次
mkdir -p data
tar -xzf pb_data.tar.gz -C data        # 得到 data/pb_data

# 3) 拉镜像并启动
docker pull ghcr.io/<你的用户名>/zhijian:latest
docker compose up -d
docker compose ps
docker compose logs -f zhijian
```

浏览器打开 `http://<NAS内网IP>:8099`。

> **架构不用管**：镜像同时包含 `linux/amd64` 和 `linux/arm64`，NAS 上 `docker pull` 会自动选匹配的。

---

## 三、可选：构建完自动部署到 NAS

配置好后，`git push origin v1.0.0` 会自动：构建 → 推镜像 → SSH 到 NAS → pull → 重启。

### 1. 生成 SSH 密钥对（在能 SSH 到 NAS 的机器上）

```bash
ssh-keygen -t ed25519 -C "github-actions-nas" -f ~/.ssh/nas_deploy
cat ~/.ssh/nas_deploy.pub        # 复制公钥，加到 NAS 的 ~/.ssh/authorized_keys
cat ~/.ssh/nas_deploy            # 复制私钥全文 → 存进 GitHub Secret
```

### 2. 仓库 → Settings → Secrets and variables → Actions → New repository secret

| Secret 名 | 内容 |
|---|---|
| `NAS_SSH_HOST` | NAS 的 IP 或域名，如 `192.168.1.10` |
| `NAS_SSH_USER` | SSH 用户名，如 `admin` |
| `NAS_SSH_KEY` | 上面那条私钥的**全文**（含 `-----BEGIN OPENSSH PRIVATE KEY-----`） |
| `NAS_APP_DIR` | 应用目录，如 `/volume1/docker/zhijian` |
| `GHCR_TOKEN` | GitHub PAT（权限 `read:packages`） |

### 3. 触发

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Actions 跑完，NAS 上的容器就更新好了。

---

## 四、常见问题

| 现象 | 原因 / 解决 |
|---|---|
| Actions 卡在拉基础镜像 | GitHub 官方 runner 访问 Docker Hub 正常；若失败可改用镜像站前缀（改 workflow 的 FROM） |
| 构建失败在 `npm ci` | 官方 runner 用 registry.npmjs.org 很快；若你换成了自建 runner，改 build-args 里的 `NPM_REGISTRY=https://registry.npmmirror.com` |
| 构建失败在下载 PocketBase | Actions 能访问 GitHub Releases，Dockerfile 会自动走下载分支（`deploy/offline/` 不在仓库里属正常） |
| `docker pull` 报 unauthorized | 没登录 ghcr.io → `docker login ghcr.io`；或把包设为 Public |
| `exec format error` | 不会发生：镜像含 amd64 + arm64 两种架构，Docker 自动选 |
| NAS 上 `docker compose up` 开始构建 | 用了带 `build:` 的 compose → NAS 用 `docker-compose.yml`（无 build 段），别用 `docker-compose.build.yml` |
| 镜像里没有数据 | 正常：数据在 `data/pb_data` 卷里，必须单独放 |
| 想同时推 Docker Hub | 在 workflow 加一个 login-action（`registry: docker.io`，用 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` secret）+ 多一个 tag |

---

## 五、以后怎么更新

```bash
# 改完代码
git add . && git commit -m "..."
git tag v1.0.1 && git push origin main v1.0.1
```

Actions 自动构建 → 推镜像 → （若配了自动部署）NAS 自动更新。

只推代码不部署的话，在 NAS 上：

```bash
cd /volume1/docker/zhijian
docker pull ghcr.io/<你的用户名>/zhijian:v1.0.1
docker compose up -d
```
