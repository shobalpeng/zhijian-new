// 精确关闭「自己启动的无头 Chrome」
//
// 用法：node scripts/close-headless.mjs <debugPort> [<debugPort> ...]
//
// 只通过该调试端口的 CDP 发送 Browser.close，关闭的是这一个实例，
// 不会影响用户正在使用的浏览器。
//
// ⚠️ 禁止用 `Get-Process chrome | Stop-Process` / `taskkill /IM chrome.exe`
//    这类按进程名批量的方式清理——那会把用户自己的浏览器一起杀掉。

const ports = process.argv.slice(2);
if (ports.length === 0) {
  console.error('用法: node scripts/close-headless.mjs <debugPort> [...]');
  process.exit(1);
}

for (const port of ports) {
  let version;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    version = await res.json();
  } catch {
    console.log(`:${port} 没有可用的调试实例（已关闭或未启动）`);
    continue;
  }

  try {
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    // 给浏览器一点时间优雅退出
    await new Promise((r) => setTimeout(r, 800));
    ws.close();
    console.log(`:${port} 已关闭 (${version.Browser ?? 'headless'})`);
  } catch (err) {
    console.error(`:${port} 关闭失败:`, err instanceof Error ? err.message : err);
  }
}
