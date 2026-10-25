import { useState } from 'react';
import { ImageViewer } from '@/components/common/image-viewer';

/**
 * 可点击放大的图片。
 *
 * - 单图：`<ZoomableImage src=... />`，点击全屏查看
 * - 多图中的一张：传 `urls` + `index`，全屏后可左右切换
 * - 可以安全地放在 `<Link>` 内部（点击会阻止导航，只看大图）
 */
export function ZoomableImage({
  src,
  alt = '',
  className = '',
  wrapperClassName = '',
  urls,
  index = 0,
}: {
  src: string;
  alt?: string;
  /** 作用在 <img> 上 */
  className?: string;
  /** 作用在外层可点击容器上 */
  wrapperClassName?: string;
  /** 多图场景的完整图片列表（不含则只能看当前这一张） */
  urls?: string[];
  /** 当前图在 urls 中的下标 */
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(index);

  if (!src) return null;

  const list = urls && urls.length > 0 ? urls : [src];

  const openViewer = () => {
    setViewerIndex(Math.min(Math.max(index, 0), list.length - 1));
    setOpen(true);
  };

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label="查看大图"
        className={`block cursor-zoom-in ${wrapperClassName}`}
        onClick={(e) => {
          // 在 Link 内部时不触发跳转
          e.preventDefault();
          e.stopPropagation();
          openViewer();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openViewer();
          }
        }}
      >
        <img src={src} alt={alt} draggable={false} className={className} />
      </span>

      {open && (
        <ImageViewer
          urls={list}
          index={viewerIndex}
          onChangeIndex={setViewerIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
