import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { InboxIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { fileUrl } from '@/lib/format';
import { ZoomableImage } from '@/components/common/zoomable-image';
import { Button } from '@/components/ui/button';

/** 内容模块共用的列表骨架零件：页头 / 空态 / 图片墙 / 加载更多 */

/** 大标题收缩阈值：滚过这个距离后页头变薄（约等于展开态页头的高度） */
const COLLAPSE_AT = 56;

/**
 * 列表页页头：吸顶 + iOS 式大标题收缩。
 *
 * - `-mx-4 px-4` 把背景撑满整宽（AppShell 的 main 有 px-4），内容位置不变
 * - 展开态：24px 大标题 + 副标题，半透明毛玻璃
 * - 收缩态：16px 标题、副标题折叠、页头变薄、背景变实
 *
 * 只做「两态切换」不做连续跟随：滚动时每帧改字号会重排掉帧，
 * 而 transform:scale 会让中文发虚。两态只 setState 两次，零性能负担。
 * 标题保持左对齐而非居中 —— 页头有 action 插槽（放按钮），居中会打架。
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // 返回原值时不触发重渲染，所以每帧调用也不会有额外开销
        setCollapsed((prev) => {
          const next = window.scrollY > COLLAPSE_AT;
          return prev === next ? prev : next;
        });
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 backdrop-blur-md',
        'transition-[background-color,padding,border-color] duration-200',
        collapsed
          ? /* 收缩后才出现 hairline —— iOS 导航栏也是这样：在顶部时不画线，
               滚动后内容从下面滑过，才需要一条分隔线把导航栏和内容分开 */
            'border-border bg-background py-2'
          : 'border-transparent bg-background/95 pb-2.5 pt-2',
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            'font-semibold tracking-tight transition-[font-size] duration-200',
            collapsed ? 'text-base' : 'text-2xl',
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              'overflow-hidden text-sm text-muted-foreground transition-all duration-200',
              collapsed ? 'max-h-0 opacity-0' : 'max-h-6 opacity-100',
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/**
 * 空态：图标 + 主文案 + 可选提示。
 * 页面底色改成 iOS 分组灰之后再挂 `bg-muted` 会糊成一片，所以不铺背景块，
 * 直接居中放大图标 —— 这也正是 iOS 列表空态的做法。
 */
export function EmptyState({
  text,
  hint,
  icon: Icon = InboxIcon,
}: {
  text: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/**
 * 加载态：骨架条替代「加载中…」文字。
 * 保留下 sr-only 文案给读屏器，视觉上用 pulse 占位，避免每次进页面都闪一下空白。
 */
export function LoadingText({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <span className="sr-only">加载中…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}

/** 列表底部的「加载更多」按钮：没有下一页时自动隐藏 */
export function LoadMoreButton({
  hasMore,
  loading,
  remaining,
  onClick,
}: {
  hasMore: boolean;
  loading?: boolean;
  /** 还剩多少条没加载出来（显示在按钮上） */
  remaining?: number;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-3">
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? '加载中…' : remaining ? `加载更多（剩余 ${remaining} 条）` : '加载更多'}
      </Button>
    </div>
  );
}

export function ImageWall({
  collectionId,
  recordId,
  files,
  className = 'h-32',
}: {
  collectionId: string;
  recordId: string;
  files: string[] | string | undefined | null;
  className?: string;
}) {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  if (list.length === 0) return null;

  const urls = list.map((f) => fileUrl(collectionId, recordId, f, '600x0'));

  return (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((url, i) => (
        <ZoomableImage
          key={url}
          src={url}
          urls={urls}
          index={i}
          className={`w-full rounded-xl object-cover ${className}`}
        />
      ))}
    </div>
  );
}

export function CoverImage({
  collectionId,
  recordId,
  file,
  className = 'h-32 w-full',
}: {
  collectionId: string;
  recordId: string;
  file?: string | null;
  className?: string;
}) {
  if (!file) return null;
  return (
    <ZoomableImage
      src={fileUrl(collectionId, recordId, file, '600x0')}
      className={`rounded-xl object-cover ${className}`}
    />
  );
}
