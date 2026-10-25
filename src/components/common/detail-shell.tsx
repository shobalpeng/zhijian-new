import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LoadingText } from '@/components/common/list-parts';

/**
 * 详情页通用外壳：顶部「← 返回 + 标题」、内容区、底部「编辑 / 删除」。
 *
 * 各业务模块只需提供内容（children）与删除动作，交互统一。
 */
export function DetailShell({
  title,
  loading,
  hasRecord,
  editTo,
  onDelete,
  deleteTitle,
  deleteDescription,
  emptyText = '记录不存在',
  children,
}: {
  title: string;
  loading: boolean;
  /** 记录是否取到（取不到时整页渲染空提示） */
  hasRecord: boolean;
  /** 编辑按钮跳转的地址 */
  editTo: string;
  onDelete: () => void | Promise<void>;
  deleteTitle: string;
  deleteDescription?: string;
  emptyText?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  if (loading) return <LoadingText />;
  if (!hasRecord) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label="返回"
          onClick={() => navigate(-1)}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
      </header>

      {children}

      <div className="flex gap-3">
        <Button className="flex-1 rounded-xl" onClick={() => navigate(editTo)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          编辑
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-1 rounded-xl text-destructive">
              <TrashIcon className="mr-2 h-4 w-4" />
              删除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteDescription ?? '删除后无法恢复。'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl" onClick={() => void onDelete()}>
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** 详情页里的一组「标签 + 内容」 */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}
