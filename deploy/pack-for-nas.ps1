# 一键打包「拷到 NAS」所需的全部文件（Windows PowerShell）
#
#   cd deploy
#   powershell -ExecutionPolicy Bypass -File pack-for-nas.ps1
#
# 产出（默认在项目根的 dist-nas/ 下）：
#   zhijian-app.tar.gz    应用代码 + Dockerfile + 离线包（不含 node_modules/dist/数据）
#   pb_data.tar.gz         数据库 + 上传的图片（需先停掉 PocketBase 再打包）
#
# 把这两个包拷到 NAS 解压即可：
#   tar -xzf zhijian-app.tar.gz -C /volume1/docker/zhijian
#   tar -xzf pb_data.tar.gz -C /volume1/docker/zhijian/data && mv /volume1/docker/zhijian/data/pb_data /volume1/docker/zhijian/data/pb_data_tmp && mv ... 
#   （见 README「拷贝清单」一节的正确解包顺序）

param(
  [string]$OutDir = "",
  [switch]$Force,        # PocketBase 正在运行也继续打包（不推荐）
  [switch]$SkipImages    # 只打包数据库，不含 storage/ 里的图片（体积从 ~274MB 降到 ~1MB）
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root
if (-not $OutDir) { $OutDir = Join-Path $root "dist-nas" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ---- 1. 安全检查：PocketBase 运行中拷 SQLite 可能不一致 ----
$running = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
if ($running -and -not $Force) {
  Write-Host "⚠️  检测到 PocketBase 正在运行（8090 端口）。" -ForegroundColor Yellow
  Write-Host "    运行中拷 SQLite 可能拿到不一致的数据，请先停掉再打包。" -ForegroundColor Yellow
  Write-Host "    停止命令：Stop-Process -Name pocketbase -Force" -ForegroundColor DarkGray
  Write-Host "    确实要继续请加 -Force" -ForegroundColor DarkGray
  exit 1
}

# ---- 2. 打包应用 ----
$appFiles = @(
  "Dockerfile", "docker-compose.yml", "docker-compose.build.yml", "nginx.conf", ".dockerignore",
  "package.json", "package-lock.json",
  "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json",
  "vite.config.ts", "index.html", "components.json", "eslint.config.js"
)
$appDirs = @("src", "public", "pb_hooks", "scripts", "deploy")

$appTar = Join-Path $OutDir "zhijian-app.tar.gz"
Write-Host "==> 打包应用文件" -ForegroundColor Cyan
& tar -czf $appTar @appFiles @appDirs
if ($LASTEXITCODE -ne 0) { throw "tar 打包失败" }

# ---- 3. 打包数据 ----
$pbSrc = Join-Path $root ".pocketbase\pb_data"
$pbTar = Join-Path $OutDir "pb_data.tar.gz"
if (Test-Path $pbSrc) {
  if ($SkipImages) {
    Write-Host "==> 打包数据库（不含图片）" -ForegroundColor Cyan
    $tmp = Join-Path $env:TEMP ("zj_pb_" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    Copy-Item (Join-Path $pbSrc "data.db") $tmp -Force
    & tar -czf $pbTar -C $tmp "data.db"
    Remove-Item $tmp -Recurse -Force
  } else {
    Write-Host "==> 打包数据目录 (.pocketbase/pb_data，含图片)" -ForegroundColor Cyan
    & tar -czf $pbTar -C (Join-Path $root ".pocketbase") "pb_data"
  }
  if ($LASTEXITCODE -ne 0) { throw "tar 打包数据失败" }
} else {
  Write-Warning "找不到 .pocketbase\pb_data，跳过数据打包"
}

# ---- 4. 汇总 ----
Write-Host ""
Write-Host "打包完成：" -ForegroundColor Green
Get-ChildItem $OutDir -File | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0,-22} {1} MB" -f $_.Name, $mb) -ForegroundColor Green
}
Write-Host ""
Write-Host "NAS 上解包（以 /volume1/docker/zhijian 为例）：" -ForegroundColor Cyan
Write-Host "  mkdir -p /volume1/docker/zhijian/data"
Write-Host "  tar -xzf zhijian-app.tar.gz -C /volume1/docker/zhijian"
Write-Host "  tar -xzf pb_data.tar.gz  -C /volume1/docker/zhijian/data   # 得到 data/pb_data"
Write-Host "  cd /volume1/docker/zhijian"
Write-Host ""
Write-Host "方式一（镜像交付，推荐）：在有 Docker 的机器上 build + save，NAS 上 load 后直接启动" -ForegroundColor Cyan
Write-Host "  docker compose up -d          # 注意：不要加 --build"
Write-Host ""
Write-Host "方式二（NAS 上直接构建）：" -ForegroundColor Cyan
Write-Host "  sh deploy/pull-images.sh"
Write-Host "  docker compose -f docker-compose.build.yml up -d --build" -ForegroundColor Cyan
