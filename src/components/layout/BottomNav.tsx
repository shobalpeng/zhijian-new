import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  CakeIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  HeartIcon,
  HomeIcon,
  MapIcon,
  PaperAirplaneIcon,
  PlusIcon,
  QueueListIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { usePendingCount } from '@/hooks/use-pending-count';

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -right-1.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground"
      aria-label={`${count} 项待确认`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * 新建面板的候选动作。
 * 默认跳 `模块?new=1`（页面内弹窗）；表单较长、需要整页填写的模块（聚餐）
 * 直接用独立路由 `newPath`，与 V1 的整页表单体验一致。
 */
const CREATE_ACTIONS: {
  label: string;
  icon: typeof HomeIcon;
  path: string;
  newPath?: string;
}[] = [
  { label: '任务', icon: CheckCircleIcon, path: '/tasks', newPath: '/tasks/new' },
  { label: '心愿', icon: HeartIcon, path: '/wishes', newPath: '/wishes/new' },
  { label: '菜谱', icon: BookOpenIcon, path: '/recipes', newPath: '/recipes/new' },
  { label: '纪念日', icon: CalendarDaysIcon, path: '/anniversaries', newPath: '/anniversaries/new' },
  { label: '目的地', icon: PaperAirplaneIcon, path: '/travel', newPath: '/travel/new' },
  { label: '漫游', icon: MapIcon, path: '/wanders', newPath: '/wanders/new' },
  { label: '聚餐', icon: CakeIcon, path: '/dines', newPath: '/dines/new' },
  { label: '物品', icon: CalculatorIcon, path: '/items', newPath: '/items/new' },
  { label: '待办', icon: QueueListIcon, path: '/todos' },
];

/**
 * 底部导航（与 V1 一致的三段式）：首页 / [+] / 我的。
 * 中间「+」：已在某个模块页时直接新建该模块，否则弹出新建面板。
 * 任务与心愿不再是 tab，「待你确认」的角标合并显示在首页上（入口在首页九宫格）。
 */
export function BottomNav() {
  const { confirmTotal } = usePendingCount();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const tabs = [
    { to: '/', label: '首页', icon: HomeIcon, badge: confirmTotal, end: true },
    { to: '/me', label: '我的', icon: UserIcon, badge: 0, end: false },
  ];

  /** 当前所在模块（用于「+」直接新建，省去一次选择） */
  const currentModule = CREATE_ACTIONS.find((a) => location.pathname.startsWith(a.path));

  const handlePlus = () => {
    if (currentModule) {
      navigate(currentModule.newPath ?? `${currentModule.path}?new=1`);
      return;
    }
    setOpen(true);
  };

  const handleAction = (path: string, newPath?: string) => {
    setOpen(false);
    navigate(newPath ?? `${path}?new=1`);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background" aria-label="主导航">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around">
          <NavTab tab={tabs[0]} />

          <button
            type="button"
            aria-label="新建"
            onClick={handlePlus}
            className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <PlusIcon className="h-5 w-5" />
            </span>
          </button>

          <NavTab tab={tabs[1]} />
        </div>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg gap-0 rounded-t-2xl border-none bg-transparent px-4 pb-6 shadow-none"
        >
          <div className="grid grid-cols-4 gap-3">
            {CREATE_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleAction(action.path, action.newPath)}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl bg-card transition-colors hover:bg-muted/50"
              >
                <action.icon className="h-7 w-7 text-primary" />
                <span className="text-xs text-muted-foreground">{action.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-2xl bg-card py-3 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            取消
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavTab({
  tab,
}: {
  tab: { to: string; label: string; icon: typeof HomeIcon; badge: number; end: boolean };
}) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        cn(
          'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      <span className="relative">
        <tab.icon className="h-6 w-6" />
        <Badge count={tab.badge} />
      </span>
      <span className="text-xs">{tab.label}</span>
    </NavLink>
  );
}
