import PocketBase from 'pocketbase';

/**
 * 后端地址解析：
 *
 * - 默认走**同域**（window.location.origin）：Docker 部署时由同一个 nginx 同时提供
 *   前端静态文件和 PocketBase（/api 反代），这样不需要在构建期注入任何地址，
 *   换域名也不用重新构建镜像。
 * - 需要跨域部署时，用 `VITE_POCKETBASE_URL` 覆盖（注意 Vite 只暴露 VITE_ 前缀的变量，
 *   模板里写的 `POCKETBASE_URL` 实际一直读不到）。
 */
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || window.location.origin;

export const pb = new PocketBase(pbUrl);
