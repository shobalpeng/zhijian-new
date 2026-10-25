import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pocketbase = path.join(root, ".pocketbase", "pocketbase.exe");

// 启动 PocketBase
// 钩子目录：仓库根 pb_hooks/（*.pb.js，使用全局函数 onXxx 注册；JSVM 仅识别 .pb.js 扩展名，
//   非 .js；且不支持 ESM import，仅 goja 的 ES5 + require）。该目录未被 .gitignore 忽略，纳入 git。
// 数据目录 .pocketbase/pb_data 已被 .gitignore 忽略（运行期生成，不入库）。
const hooksDir = path.join(root, "pb_hooks");
const pb = spawn(pocketbase, ["serve", "--dir", path.join(root, ".pocketbase", "pb_data"), "--hooksDir", hooksDir], {
  stdio: "inherit",
  cwd: root,
  shell: true,
});

// 启动 Vite
// --host：监听所有网卡，这样 127.0.0.1 / localhost / 局域网 IP（手机同 WiFi 调试）都能访问。
//   不加时 Vite 7 只绑 [::1]（IPv6），浏览器用 http://127.0.0.1:5173 会连不上。
const vite = spawn("npx", ["vite", "--host"], {
  stdio: "inherit",
  cwd: root,
  shell: true,
});

function cleanup() {
  pb.kill();
  vite.kill();
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
