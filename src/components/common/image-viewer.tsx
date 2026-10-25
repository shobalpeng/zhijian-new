import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { originalUrl } from '@/lib/format';

/**
 * 图片全屏查看器：左右箭头切换、键盘 ←/→ 切换、Esc 关闭、
 * 触摸左右滑动切换，点击背景关闭。
 *
 * 传入的 urls 可能是缩略图（列表/轮播用的小图），这里统一还原成**原图**，
 * 保证放大后清晰。
 */
export function ImageViewer({
  urls,
  index,
  onChangeIndex,
  onClose,
}: {
  urls: string[];
  index: number;
  onChangeIndex: (i: number) => void;
  onClose: () => void;
}) {
  const touchStartX = useRef<number | null>(null);

  /** 全屏查看始终用原图 */
  const fullUrls = useMemo(() => urls.map(originalUrl), [urls]);

  const prev = () => onChangeIndex(index > 0 ? index - 1 : urls.length - 1);
  const next = () => onChangeIndex(index < urls.length - 1 ? index + 1 : 0);

  // 键盘操作 + 打开时锁定页面滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, urls.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const end = e.changedTouches[0]?.clientX ?? start;
        const diff = end - start;
        if (Math.abs(diff) < 50) return;
        if (diff > 0) prev();
        else next();
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="关闭"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/30 p-2 text-white/90 hover:bg-white/10"
        onClick={onClose}
      >
        <XMarkIcon className="h-6 w-6" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张"
            className="absolute left-2 z-10 rounded-full bg-black/30 p-2 text-white/90 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            <ChevronLeftIcon className="h-7 w-7" />
          </button>
          <button
            type="button"
            aria-label="下一张"
            className="absolute right-2 z-10 rounded-full bg-black/30 p-2 text-white/90 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            <ChevronRightIcon className="h-7 w-7" />
          </button>
        </>
      )}

      <img
        src={fullUrls[index]}
        alt=""
        className="max-h-[85vh] max-w-[92vw] object-contain"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      />

      {urls.length > 1 && (
        <span className="absolute bottom-6 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
          {index + 1} / {urls.length}
        </span>
      )}
    </div>
  );
}
