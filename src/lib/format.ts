import { pb } from '@/lib/pocketbase';

/** 集合 id 常量（拼文件 URL 需要，与 migrations/*.json 的 id 保持一致） */
export const COLLECTION_ID = {
  users: '_pb_users_auth_',
  tasks: 'zj_tasks',
  wishes: 'zj_wishes',
  recipes: 'zj_recipes',
  cook_history: 'zj_cook_history',
  anniversaries: 'zj_anniversaries',
  destinations: 'zj_destinations',
  expenses: 'zj_expenses',
  wanders: 'zj_wanders',
  dines: 'zj_dines',
  items: 'zj_items',
  todos: 'zj_todos',
  point_transactions: 'zj_point_transactions',
  user_settings: 'zj_user_settings',
} as const;

/**
 * 拼 PocketBase 文件 URL（record 只需 collectionId + id）
 *
 * @param thumb 缩略图尺寸，如 '600x0'（按宽 600 等比缩放）。
 *              需在 collection 的 file 字段上配置过同名 thumbs 才会生效，
 *              否则 PocketBase 会原样返回大图。省略则返回原图地址。
 */
export function fileUrl(
  collectionId: string,
  recordId: string,
  filename: string | undefined | null,
  thumb?: string,
) {
  if (!filename) return '';
  return pb.files.getURL({ collectionId, id: recordId } as never, filename, thumb ? { thumb } : undefined);
}

/** 多图字段（string[] | string）统一转成可用的 URL 数组 */
export function imageUrls(
  collectionId: string,
  recordId: string,
  files: string[] | string | undefined | null,
  thumb?: string,
): string[] {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  return list.map((f) => fileUrl(collectionId, recordId, f, thumb)).filter(Boolean);
}

/**
 * 去掉 URL 上的缩略图参数，还原成原图地址。
 * 列表/轮播用小图渲染，点开放大时再换回原图，保证全屏清晰。
 */
export function originalUrl(url: string): string {
  if (!url) return '';
  const [base, query] = url.split('?');
  if (!query) return base;
  const kept = query.split('&').filter((p) => p && !p.startsWith('thumb='));
  return kept.length ? `${base}?${kept.join('&')}` : base;
}

/** PocketBase date 字段形如 "2026-10-23 12:34:56.789Z"，取日期部分 */
export function toDateInput(value: string | undefined | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** 展示用日期：2026-10-23 */
export function formatDate(value: string | undefined | null): string {
  return toDateInput(value);
}

/**
 * 展示用日期时间（本地时区）：2026-10-23 18:05
 * PocketBase 的 date 形如 "2026-10-23 10:05:12.345Z"（UTC），这里转成本地时间。
 */
export function formatDateTime(value: string | undefined | null): string {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 紧凑日期时间（列表用）：10-23 18:05；跨年时补年份 2025-10-23 18:05 */
export function formatDateTimeShort(value: string | undefined | null): string {
  const full = formatDateTime(value);
  if (!full) return '';
  const year = String(new Date().getFullYear());
  return full.startsWith(year) ? full.slice(5) : full;
}

/** 今天（本地时区）YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 两个 YYYY-MM-DD 之间相差天数（b - a） */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00`);
  const tb = Date.parse(`${b}T00:00:00`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.floor((tb - ta) / 86400000);
}

/** 相对时间：刚刚 / N分钟前 / N小时前 / N天前 / 日期 */
export function relativeTime(value: string | undefined | null): string {
  if (!value) return '';
  const ts = Date.parse(value.replace(' ', 'T'));
  if (Number.isNaN(ts)) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return toDateInput(value);
}

/** 金额展示：整数优先，带千分位 */
export function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  if (Number.isInteger(v)) return `¥${v.toLocaleString('zh-CN')}`;
  return `¥${v.toFixed(2)}`;
}
