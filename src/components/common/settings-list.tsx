import type { ComponentType, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 二级页头部：← 返回 + 标题（与整页表单的返回样式一致） */
export function SubPageHeader({ title, backTo }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center gap-2 pt-2">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl"
        aria-label="返回"
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Button>
      <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

export interface SettingsRowProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** 右侧辅助信息，如「浅色」「已绑定 马乃」 */
  value?: ReactNode;
  /** 跳转目标（与 onClick 二选一） */
  to?: string;
  onClick?: () => void;
  danger?: boolean;
  /** 是否显示右箭头（默认 true） */
  chevron?: boolean;
}

const ROW_CLASS =
  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50';

/** 单行设置项：图标 + 标签 + 右侧值 + › */
export function SettingsRow({
  icon: Icon,
  label,
  value,
  to,
  onClick,
  danger,
  chevron = true,
}: SettingsRowProps) {
  const inner = (
    <>
      <Icon className={cn('h-5 w-5 shrink-0', danger ? 'text-destructive' : 'text-muted-foreground')} />
      <span className={cn('flex-1 truncate text-sm', danger && 'text-destructive')}>{label}</span>
      {value !== undefined && value !== null && (
        <span className="max-w-[45%] truncate text-sm text-muted-foreground">{value}</span>
      )}
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
    </>
  );

  return (
    /* iOS 分隔线：从图标右侧开始缩进（16px 内边距 + 20px 图标 + 12px gap = 48px），
       而不是通栏横线 —— 这是 iOS 分组列表最显著的细节 */
    <li className="relative after:absolute after:bottom-0 after:left-12 after:right-0 after:h-px after:bg-border last:after:hidden">
      {to ? (
        <Link to={to} className={ROW_CLASS}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={ROW_CLASS}>
          {inner}
        </button>
      )}
    </li>
  );
}

/** 设置分组卡：一组 SettingsRow，行间自带分隔线 */
export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl py-0">
      {title && (
        <p className="px-4 pt-3 pb-1.5 text-[13px] font-medium text-muted-foreground">{title}</p>
      )}
      <CardContent className="p-0">
        <ul>{children}</ul>
      </CardContent>
    </Card>
  );
}
