# 织间

> 两个人的生活记录本 —— 一起把日子过成值得回看的故事。

情侣 / 家庭共同使用的记录应用。分「任务」「心愿」这类需要互相确认的互动项，也分「聚餐」「菜谱」「漫游」「旅行」「纪念日」这类一起沉淀的生活档案，中间用一套「心动积分」把两个人的参与串起来。

移动端优先，单人也能用（未配对时是个人记录模式）。

---

## ✨ 功能

| 模块 | 说明 |
| :--- | :--- |
| **任务** | 互相派活 → 提交 → 对方确认，确认后自动发放积分 |
| **心愿** | 同任务的双角色互动项，想法、约定都能记下来 |
| **聚餐** | 餐厅、菜品、花费、评分、同行人，附带统计（次数、总花费、最常去） |
| **菜谱** | 菜谱收藏 + 烹饪记录，做过几次一目了然 |
| **漫游** | 地图足迹，记录去过的地方与瞬间 |
| **旅行** | 目的地清单 + 每程花费统计 |
| **纪念日** | 纪念日倒计时、在一起的天数 |
| **物品** | 物品与日均成本 |
| **待办** | 分为「两个人的」和「我自己的」两栏 |
| **心动积分** | 完成互动项累积积分，双方都有各自的余额 |
| **配对** | 邀请码绑定伴侣，绑定后数据互相可见 |

其他细节：

- 首页聚合待办角标、纪念日倒计时、最近动态
- 明暗主题 + 5 套配色（蓝 / 粉 / 绿 / 红 / 灰），服务端保存偏好
- 农历支持（纪念日按农历提醒）
- 图片上传后自动生成多档缩略图，列表页加载小图、点开看原图
- 移动端底部导航 + 桌面端自适应

---

## 🛠 技术栈

| 领域 | 技术方案 |
| :--- | :--- |
| **后端 / 认证 / 存储** | PocketBase v0.40（Go 单文件，业务逻辑写在 `pb_hooks/*.pb.js`） |
| **前端框架** | React 19 + TypeScript |
| **构建工具** | Vite 7 |
| **UI 组件** | shadcn/ui（@base-ui/react） |
| **样式** | Tailwind CSS v4（CSS 变量驱动主题） |
| **路由** | React Router v7 |
| **图标** | Heroicons React |
| **其他** | date-fns、lunar-javascript（农历）、recharts、leaflet、sonner |

**为什么用 PocketBase**：一个可执行文件就是数据库 + 文件存储 + REST API + 认证，NAS 上一个容器就能跑起来；业务逻辑用它的 JSVM 钩子写，状态机、积分发放这类关键逻辑放在服务端，绕不开并发问题。

---

## 🚀 本地开发

### 1. 准备 PocketBase

把对应平台的 PocketBase 可执行文件放进 `.pocketbase/`：

- Windows：`.pocketbase/pocketbase.exe`
- macOS / Linux：`.pocketbase/pocketbase`

下载地址：<https://github.com/pocketbase/pocketbase/releases>（项目使用 v0.40.6）

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发环境

```bash
npm run dev
```

一条命令同时拉起 PocketBase（:8090）和 Vite（:5173），日志混在一个窗口里。

Vite 默认监听所有网卡，**手机连同一个 WiFi 也能直接调试**：

```
http://<你的局域网IP>:5173/
```

### 4. 初始化数据库

首次启动会自动创建超级管理员 `admin@zhijian.app`（初始密码见 `scripts/apply_collections.py` 里的 `ADMIN_PASSWORD`）。

把集合结构同步进数据库：

```bash
python scripts/apply_collections.py http://127.0.0.1:8090
```

### 5. 配对

用超级管理员在 `http://127.0.0.1:8090/_/` 里能看到全部数据。普通用户在「我的 → 绑定伴侣」用邀请码绑定后，就能共享生活记录。

### 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 同时启动 PocketBase + Vite |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint |
| `python scripts/apply_collections.py <url>` | 同步集合结构（幂等） |
| `python scripts/warm_thumbs.py <url>` | 预生成图片缩略图（首次访问会慢时跑一次） |

---

## 🐳 部署（Docker）

一个容器同时提供前端静态文件与 PocketBase：

```
浏览器 ──:8099──▶ nginx :80  ┬─ /       前端（SPA）
                            ├─ /api/   → PocketBase :8090（仅容器内）
                            └─ /_/     → PocketBase 管理后台
                                   └─ data/pb_data（卷，数据库 + 上传的图片）
```

### 用 GitHub Actions 出镜像（推荐）

仓库已配置 `.github/workflows/docker-image.yml`：打 tag 即自动构建 **amd64 + arm64** 双架构镜像并推送到 `ghcr.io`。

```bash
git tag v1.0.0 && git push origin main v1.0.0
```

NAS 上：

```bash
docker login ghcr.io -u <GitHub用户名> -p <PAT>   # PAT 需 read:packages
docker pull ghcr.io/<用户名>/zhijian:v1.0.0
docker compose up -d
```

### 完整文档

- [`deploy/README.md`](deploy/README.md) —— NAS 部署全流程、构建时的网络依赖、拷贝清单、常见问题
- [`deploy/GITHUB-ACTIONS.md`](deploy/GITHUB-ACTIONS.md) —— 镜像构建与自动部署到 NAS
- [`deploy/IMAGE-SHIP.md`](deploy/IMAGE-SHIP.md) —— 另一条镜像交付路线（`docker save` / `buildx`）

---

## 📁 目录结构

```text
zhijianV1.1/
├── pb_hooks/               # PocketBase 业务钩子（JSVM）
│   ├── tasks.pb.js         #   任务/心愿状态机 + 积分发放
│   ├── wishes.pb.js
│   ├── points.pb.js        #   积分余额汇总
│   ├── pair.pb.js          #   配对 / 解绑
│   ├── recipes.pb.js       #   烹饪统计
│   └── users.pb.js         #   注册即建 user_settings
├── src/
│   ├── modules/            # 业务模块（每个模块自带迁移、路由、菜单）
│   │   ├── tasks/  wishes/  dines/  recipes/
│   │   ├── wanders/  travel/  anniversaries/
│   │   ├── items/  todos/  points/
│   │   ├── home/            #   首页聚合
│   │   ├── pair/            #   配对页
│   │   └── me/              #   我的（外观 / 伴侣 / 账号安全）
│   ├── components/
│   │   ├── common/          # 通用组件（表单页、图片、列表件…）
│   │   ├── interactive/     # 任务 / 心愿共用的互动项组件
│   │   ├── layout/          # AppShell + BottomNav
│   │   └── ui/              # shadcn/ui 组件
│   ├── hooks/               # 数据 hooks（余额、待确认数、最近动态…）
│   └── lib/                # 工具库（pocketbase、格式化、农历）
├── scripts/                 # 维护脚本（建表、预热缩略图、验证）
├── deploy/                  # 部署文档与脚本
├── Dockerfile               # 单容器镜像（nginx + PocketBase）
├── docker-compose.yml       # NAS 部署用（只含 image，不构建）
├── docker-compose.build.yml # 本机构建用（只含 build）
├── nginx.conf               # 静态托管 + 反向代理
└── .github/workflows/       # 镜像构建流水线
```

**数据存放**：全部业务数据在 `data/pb_data`（数据库 + `storage/` 里的图片）。备份、迁移只需要这一个目录。

---

## 📄 致谢

本项目基于 [pocket-stack](https://github.com/citywill/pocket-stack) 脚手架搭建，遵循其 MIT 许可证（见 [LICENSE](./LICENSE)）。
