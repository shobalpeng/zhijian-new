import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * 独立整页表单骨架（对齐 V1 的 /xxx/create 页）：
 * 顶部「← 返回 + 标题」，中间竖排字段（gap-5），底部整宽提交按钮。
 *
 * 各模块的新建/编辑页共用它，避免每个模块重复写一遍页头与提交按钮。
 */
export function FormPage({
  title,
  children,
  onSubmit,
  submitLabel,
  disabled,
  submitting,
  submittingLabel = '保存中…',
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
  submitting?: boolean;
  submittingLabel?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 pb-4 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label="返回"
          onClick={() => navigate(-1)}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </header>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {/* iOS 表单：字段装在白色卡片里。页面底是浅灰，输入框的灰填充
            只有在白卡上才有层次；直接放灰底上会和背景糊成一片。 */}
        <div className="space-y-5 rounded-2xl bg-card p-4">{children}</div>

        {/* 主操作按钮用 44px（iOS 触控下限），默认的 h-9 在整页表单里偏矮 */}
        <Button type="submit" disabled={submitting || disabled} className="h-11 w-full rounded-xl">
          {submitting ? submittingLabel : submitLabel}
        </Button>
      </form>
    </div>
  );
}

/** 字段容器：label + 控件，统一间距 */
export function Field({ label, htmlFor, hint, children }: {
  label: ReactNode;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
