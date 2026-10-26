import { useEffect, useRef, useState } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { ZoomableImage } from '@/components/common/zoomable-image';

/**
 * 单图上传（对齐 V1 ImageUpload）：未选时显示虚线上传框，选后显示大图预览 + 移除。
 * 编辑态可传入 existingUrl 回显已有图片，点「移除」会通知父组件清空服务端文件。
 */
export function SingleImageField({
  file,
  onChange,
  existingUrl,
  onClearExisting,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string;
  /** 编辑态：移除已有图片（父组件提交时传空字符串） */
  onClearExisting?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // 同 ImageUploadField：URL 在 effect 里创建/回收，避免 StrictMode 下预览被提前 revoke
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const url = preview || existingUrl || '';

  if (url) {
    return (
      <div className="relative overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <ZoomableImage src={url} className="h-48 w-full object-cover" />
        <button
          type="button"
          onClick={() => {
            if (file) onChange(null);
            else onClearExisting?.();
          }}
          className="absolute right-2 top-2 z-10 rounded-full bg-card/85 px-2.5 py-1 text-xs text-muted-foreground shadow-sm"
        >
          移除
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="添加图片"
        onClick={() => inputRef.current?.click()}
        className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30"
      >
        <PhotoIcon className="h-7 w-7" />
        <span className="text-xs">添加图片</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </>
  );
}
