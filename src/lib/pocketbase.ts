import PocketBase from 'pocketbase';

/**
 * 后端地址解析：
 *
 * - 默认走**同域**（window.location.origin）：Docker 部署时由同一个 nginx 同时提供
 *   前端静态文件和 PocketBase（/api 反代），这样不需要在构建期注入任何地址，
 *   换域名也不用重新构建镜像。
 * - 需要跨域部署时，用 `VITE_POCKETBASE_URL` 覆盖（注意 Vite 只暴露 VITE_ 前缀的变量，
 *   模板里写的 `POCKETBASE_URL` 实际一直读不到）。
 *
 * ⚠️ 这里额外做了净化：构建脚本 / 流水线里很容易把空值写成带引号的 `""`，
 * 那样它会变成真值字符串，前端就会拿它当地址拼出 `/login/""/api/...` 这类废路径
 * （表现是页面能打开、但所有接口都 404/405）。
 * 所以统一去掉首尾引号与空白，判空后回退到同域。
 */
const rawUrl = String(import.meta.env.VITE_POCKETBASE_URL ?? '')
  .trim()
  .replace(/^["']|["']$/g, '')
  .trim();

const pbUrl = rawUrl || window.location.origin;

export const pb = new PocketBase(pbUrl);
