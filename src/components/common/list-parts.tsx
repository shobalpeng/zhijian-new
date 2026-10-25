import type { ReactNode } from 'react';
import { fileUrl } from '@/lib/format';
import { ZoomableImage } from '@/components/common/zoomable-image';

/** 内容模块共用的列表骨架零件：页头 / 空态 / 图片墙 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

export function LoadingText() {
  return <p className="text-sm text-muted-foreground">加载中…</p>;
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

  const urls = list.map((f) => fileUrl(collectionId, recordId, f));

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
      src={fileUrl(collectionId, recordId, file)}
      className={`rounded-xl object-cover ${className}`}
    />
  );
}
