import { useEffect, useRef, useState } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ZoomableImage } from '@/components/common/zoomable-image';

/**
 * 多图上传（V1 MultiImageUpload 的新版）：三列网格 + 虚线方框，选中即本地预览。
 * 与 V1 的差别：不走「先上传再存 URL」，而是把 File 留着随表单一次 multipart 提交，
 * 避免出现「上传成功但表单没提交」的孤儿文件。
 */
export function ImageUploadField({
  files,
  onChange,
  existingImages = [],
  onRemoveExisting,
  max = 9,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** 编辑态：服务端已有的图片（name 用于提交时保留，url 用于展示） */
  existingImages?: { name: string; url: string }[];
  /** 删除已有图片（父组件从待提交列表里移除该文件名） */
  onRemoveExisting?: (name: string) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // 预览 URL 在 effect 里创建：若用 useMemo + cleanup revoke，
  // React StrictMode 的「挂载→卸载→再挂载」会把 URL 提前回收，导致预览裂图。
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => next.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);

  const canAdd = existingImages.length + files.length < max;
  /** 大图查看时的完整图片序列：已有图 + 本次新选图 */
  const allUrls = [...existingImages.map((i) => i.url), ...previews.map((p) => p.url)];

  return (
    <div className="grid grid-cols-3 gap-2">
      {existingImages.map((img, i) => (
        <div
          key={img.name}
          className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
        >
          <ZoomableImage
            src={img.url}
            urls={allUrls}
            index={i}
            wrapperClassName="h-full"
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-card/85 px-1 text-[10px] text-muted-foreground">
            已有
          </span>
          {onRemoveExisting && (
            <button
              type="button"
              aria-label="删除这张已有照片"
              onClick={() => onRemoveExisting(img.name)}
              className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card/85 text-foreground shadow-sm"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {previews.map((p, i) => (
        <div
          key={p.url}
          className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
        >
          <ZoomableImage
            src={p.url}
            urls={allUrls}
            index={existingImages.length + i}
            wrapperClassName="h-full"
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            aria-label="移除这张"
            onClick={() => onChange(files.filter((_, idx) => idx !== i))}
            className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card/85 text-foreground shadow-sm"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          aria-label="添加照片"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <PhotoIcon className="h-7 w-7" />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
