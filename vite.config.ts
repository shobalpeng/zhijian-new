import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  /**
   * 后端代理：前端统一用同域（window.location.origin）访问 PocketBase。
   * - dev     ：Vite dev server 代理到本地 PocketBase
   * - preview ：预览生产构建，行为与生产（容器内 nginx）一致
   * - 生产    ：容器内 nginx 反代 /api、/_/ 到 PocketBase
   */
  const proxy = {
    // 大模型接口（仅模板 demo 页用到，业务不用）
    '/api/llm': {
      target: env.VITE_LLM_URL ? new URL(env.VITE_LLM_URL).origin + new URL(env.VITE_LLM_URL).pathname.replace(/\/chat\/completions$/, '') : 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/llm/, ''),
      configure: (proxy: any, _options: any) => {
        proxy.on('proxyReq', (proxyReq: any, _req: any, _res: any) => {
          if (env.LLM_API_KEY) {
            proxyReq.setHeader('Authorization', `Bearer ${env.LLM_API_KEY}`);
          }
        });
      }
    },
    '/api': {
      target: env.POCKETBASE_URL || 'http://127.0.0.1:8090',
      changeOrigin: true,
      // realtime 订阅是 SSE，长连接不要被代理掐断
      timeout: 0,
      proxyTimeout: 0,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: { proxy },
    preview: { proxy },
  }
})
