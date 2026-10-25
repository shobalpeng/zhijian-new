# 准备「完全离线」构建所需的全部文件（Windows PowerShell）
#
#   cd deploy\offline
#   powershell -ExecutionPolicy Bypass -File prepare-offline.ps1
#
# 产出：
#   pocketbase-linux-amd64   PocketBase v0.40.6 (x86_64)
#   pocketbase-linux-arm64   PocketBase v0.40.6 (arm64)
#   npm-cache\               npm 依赖缓存（npm ci --offline 可用）
#
# 准备完成后，Docker 构建全程不联网（基础镜像仍需首次拉取）。

param(
  [string]$PbVersion = "0.40.6"
)

$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

Write-Host "==> 准备 PocketBase v$PbVersion" -ForegroundColor Cyan
foreach ($arch in @("amd64", "arm64")) {
  $target = "pocketbase-linux-$arch"
  if (Test-Path $target) {
    Write-Host "    已存在，跳过: $target" -ForegroundColor DarkGray
    continue
  }
  $zip = "pocketbase_${PbVersion}_linux_${arch}.zip"
  Write-Host "    下载 $zip"
  Invoke-WebRequest -Uri "https://github.com/pocketbase/pocketbase/releases/download/v$PbVersion/pocketbase_${PbVersion}_linux_${arch}.zip" -OutFile $zip -UseBasicParsing
  $tmp = "tmp_$arch"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $bin = Get-ChildItem $tmp -File | Where-Object { $_.Name -eq "pocketbase" } | Select-Object -First 1
  if (-not $bin) { throw "压缩包里没找到 pocketbase 可执行文件 ($arch)" }
  Copy-Item $bin.FullName $target -Force
  Remove-Item $tmp -Recurse -Force
  Remove-Item $zip -Force
  $mb = [math]::Round((Get-Item $target).Length / 1MB, 1)
  Write-Host "    完成: $target ($mb MB)" -ForegroundColor Green
}

Write-Host "==> 准备 npm 离线缓存（项目根目录执行）" -ForegroundColor Cyan
Set-Location (Join-Path $dir "..\..")
if (Test-Path "deploy\offline\npm-cache\_cacache") {
  Write-Host "    已存在，跳过" -ForegroundColor DarkGray
} else {
  npm ci --cache ./deploy/offline/npm-cache --no-audit --no-fund
  Write-Host "    完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "全部就绪。把 deploy\offline 整个目录拷到 NAS 后执行： docker compose up -d --build" -ForegroundColor Cyan
