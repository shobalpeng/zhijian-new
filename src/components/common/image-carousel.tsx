import { useEffect, useRef, useState } from 'react';
import { ImageViewer } from '@/components/common/image-viewer';

/**
 * 多图轮播：支持手指/鼠标拖动切换、圆点指示、点击放大。
 *
 * 循环策略：多图时在首尾各插入一张「克隆帧」（[末, ...原, 首]），
 * 滑到克隆帧后（transitionend）关闭动画瞬时跳回真实帧，形成无缝循环。
 * 单图时退化为静止展示，不做循环。
 */
export function ImageCarousel({
  urls,
  className = 'max-h-64',
  alt = '',
}: {
  urls: string[];
  className?: string;
  alt?: string;
}) {
  const n = urls.length;
  const loop = n > 1;
  /** 渲染用的帧序列：循环时首尾带克隆帧 */
  const slides = loop ? [urls[n - 1], ...urls, urls[0]] : urls;

  /** 当前帧在 slides 中的位置（循环时取值范围 0..n+1） */
  const [pos, setPos] = useState(loop ? 1 : 0);
  const [withTransition, setWithTransition] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const hasDragged = useRef(false);
  const draggingRef = useRef(false);

  // 图片数量变化时回到第一张真实帧
  useEffect(() => {
    setWithTransition(false);
    setPos(loop ? 1 : 0);
  }, [n, loop]);

  // 关闭动画的这次渲染结束后再恢复动画（双 rAF 保证浏览器已经绘制过）
  useEffect(() => {
    if (withTransition) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setWithTransition(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [withTransition]);

  // 触摸滑动需要 passive:false 才能 preventDefault，只能手动绑定
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const diff = touch.clientX - startX.current;
      if (Math.abs(diff) > 10) {
        hasDragged.current = true;
        e.preventDefault();
      }
      setOffsetX(diff);
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  const beginDrag = (clientX: number) => {
    if (!loop) return;
    startX.current = clientX;
    hasDragged.current = false;
    draggingRef.current = true;
    setDragging(true);
  };

  const moveDrag = (clientX: number) => {
    if (!draggingRef.current) return;
    const diff = clientX - startX.current;
    if (Math.abs(diff) > 10) hasDragged.current = true;
    setOffsetX(diff);
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const width = containerRef.current?.offsetWidth ?? 1;
    if (hasDragged.current && Math.abs(offsetX) > width * 0.2) {
      // 不限边界：滑动方向决定前后，越界由克隆帧 + transitionend 兜住
      setWithTransition(true);
      setPos((p) => Math.max(0, Math.min(n + 1, p + (offsetX < 0 ? 1 : -1))));
    }
    setOffsetX(0);
  };

  /** 滑到克隆帧后瞬时跳回对应的真实帧，形成无缝循环 */
  const handleTransitionEnd = () => {
    if (!loop) return;
    if (pos === 0) {
      setWithTransition(false);
      setPos(n);
    } else if (pos === n + 1) {
      setWithTransition(false);
      setPos(1);
    }
  };

  if (n === 0) return null;

  /** 圆点/大图对应的真实索引 */
  const activeIndex = loop ? (pos - 1 + n) % n : pos;

  const translateX = dragging
    ? -(pos * 100) + (offsetX / (containerRef.current?.offsetWidth ?? 1)) * 100
    : -(pos * 100);

  const goTo = (realIndex: number) => {
    setWithTransition(true);
    setPos(loop ? realIndex + 1 : realIndex);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="relative touch-pan-y select-none overflow-hidden"
        data-carousel-index={activeIndex}
        data-carousel-total={n}
        onTouchStart={(e) => beginDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        onMouseDown={(e) => beginDrag(e.clientX)}
        onMouseMove={(e) => moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(${translateX}%)`,
            transition: dragging || !withTransition ? 'none' : 'transform 300ms ease-out',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((url, i) => (
            <button
              key={`${i}-${url}`}
              type="button"
              tabIndex={-1}
              aria-label="查看大图"
              className="w-full shrink-0 cursor-zoom-in bg-muted focus:outline-none"
              onClick={() => {
                if (hasDragged.current) {
                  hasDragged.current = false;
                  return;
                }
                setViewerIndex(loop ? (i - 1 + n) % n : i);
              }}
            >
              <img
                src={url}
                alt={alt}
                draggable={false}
                className={`w-full object-cover ${className}`}
              />
            </button>
          ))}
        </div>
      </div>

      {loop && (
        <div className="flex justify-center gap-1.5 py-2">
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 张`}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex
                  ? 'w-5 bg-primary'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <ImageViewer
          urls={urls}
          index={viewerIndex}
          onChangeIndex={(i) => {
            setViewerIndex(i);
            goTo(i);
          }}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
