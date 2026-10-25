import type { ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BellAlertIcon,
  BookOpenIcon,
  CakeIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  HeartIcon,
  MapIcon,
  PaperAirplaneIcon,
  QueueListIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { useBalance } from '@/hooks/use-balance';
import { usePendingCount } from '@/hooks/use-pending-count';
import { useAnniversarySummary } from '@/hooks/use-anniversary-summary';
import { useRecentActivity } from '@/hooks/use-recent-activity';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { relativeTime } from '@/lib/format';

/** 待处理角标：图标右上角的小圆点数字 */
function QuickBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-card">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** 生活记录模块入口（底部导航只放 3 个，其余从这里进） */
const QUICK_LINKS: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** 有值的模块会在图标上显示「待我处理」角标 */
  badgeKey?: 'tasks' | 'wishes';
}[] = [
  { to: '/tasks', label: '任务', icon: CheckCircleIcon, badgeKey: 'tasks' as const },
  { to: '/wishes', label: '心愿', icon: HeartIcon, badgeKey: 'wishes' as const },
  { to: '/recipes', label: '菜谱', icon: BookOpenIcon },
  { to: '/anniversaries', label: '纪念日', icon: CalendarDaysIcon },
  { to: '/travel', label: '旅游', icon: PaperAirplaneIcon },
  { to: '/wanders', label: '漫游', icon: MapIcon },
  { to: '/dines', label: '聚餐', icon: CakeIcon },
  { to: '/items', label: '日均成本', icon: CalculatorIcon },
  { to: '/todos', label: '待办', icon: QueueListIcon },
];

function displayName(user: { name?: string; username?: string } | null) {
  return user?.name || user?.username || '未命名';
}

/** 积分卡：我 / Ta + 在一起天数（对齐 V1 PointsOverview） */
function PointsCard({
  myPoints,
  partnerPoints,
  togetherDays,
}: {
  myPoints: number;
  partnerPoints: number;
  togetherDays: number | null;
}) {
  return (
    <Card className="rounded-2xl py-2.5">
      <CardContent>
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground">我</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{myPoints}</span>
            <span className="text-xs text-muted-foreground">积分</span>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-sm text-muted-foreground">Ta</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{partnerPoints}</span>
            <span className="text-xs text-muted-foreground">积分</span>
          </div>
        </div>

        {togetherDays !== null && (
          <p className="mt-1.5 border-t pt-1.5 text-center text-xs font-medium text-primary">
            💕 和Ta在一起已经 {togetherDays} 天
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 待处理卡（对齐 V1 PendingCard：四类合计 + 文字摘要） */
function PendingCard({
  pending,
  onOpen,
}: {
  pending: ReturnType<typeof usePendingCount>;
  onOpen: () => void;
}) {
  const parts: string[] = [];
  if (pending.pendingTasks > 0) parts.push(`${pending.pendingTasks}个任务待完成`);
  if (pending.submittedTasks > 0) parts.push(`${pending.submittedTasks}个任务待确认`);
  if (pending.pendingWishes > 0) parts.push(`${pending.pendingWishes}个心愿待实现`);
  if (pending.submittedWishes > 0) parts.push(`${pending.submittedWishes}个心愿待确认`);

  return (
    <Card className="rounded-2xl py-4">
      <CardContent>
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex items-center gap-2">
            <BellAlertIcon className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">待处理</span>
            {pending.total > 0 && (
              <span className="flex h-5 min-w-[22px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                {pending.total > 99 ? '99+' : pending.total}
              </span>
            )}
          </div>
          <p className="ml-6 mt-1.5 text-xs text-muted-foreground">
            {parts.length > 0 ? parts.join(' · ') : '暂无待处理事项'}
          </p>
        </button>
      </CardContent>
    </Card>
  );
}

/** 最近动态卡（对齐 V1 ActivityTimeline：纪念日倒计时 + 最近确认的任务/心愿） */
function RecentCard({
  upcoming,
}: {
  upcoming: { name: string; daysUntil: number } | null;
}) {
  const activities = useRecentActivity(2);

  return (
    <Card className="rounded-2xl py-4">
      <CardContent className="space-y-2.5">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">最近动态</span>
        </div>

        {upcoming && (
          <div className="flex items-start gap-3 border-b pb-2">
            <CalendarDaysIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <p className="text-xs leading-relaxed">
              <span className="text-muted-foreground">距离下一次{upcoming.name}还剩</span>
              <span className="font-bold text-primary">
                {' '}
                {upcoming.daysUntil === 0 ? '0天，就是今天！' : `${upcoming.daysUntil}天`}
              </span>
            </p>
          </div>
        )}

        {activities.length > 0 && (
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={`${a.type}-${a.id}`} className="flex items-start gap-3">
                {a.type === 'task' ? (
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <HeartIcon className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed">
                    <span className="text-muted-foreground">
                      {a.type === 'task' ? '任务' : '心愿'}「{a.title}」已确认
                    </span>
                    <span className="font-bold text-emerald-600">
                      {a.type === 'task' ? ` +${a.points}` : ` -${a.points}`}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">{relativeTime(a.time)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!upcoming && activities.length === 0 && (
          <p className="text-xs text-muted-foreground">暂无动态</p>
        )}
      </CardContent>
    </Card>
  );
}

export function Home() {
  const { user, partner } = useAuth();
  const balance = useBalance();
  const pending = usePendingCount();
  const { togetherDays, upcoming } = useAnniversarySummary();
  const navigate = useNavigate();

  const copyCode = async () => {
    if (!user?.invite_code) return;
    try {
      await navigator.clipboard.writeText(user.invite_code);
      toast.success('邀请码已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  /** 待处理卡点击：优先去「待我确认」的列表 */
  const openPending = () => {
    if (pending.submittedTasks > 0) return navigate('/tasks');
    if (pending.submittedWishes > 0) return navigate('/wishes');
    if (pending.pendingTasks > 0) return navigate('/tasks');
    if (pending.pendingWishes > 0) return navigate('/wishes');
    navigate('/tasks');
  };

  /** 九宫格角标：任务/心愿 = 待我完成 + 待我确认（都算「我待处理」） */
  const badges: Record<'tasks' | 'wishes', number> = {
    tasks: pending.pendingTasks + pending.submittedTasks,
    wishes: pending.pendingWishes + pending.submittedWishes,
  };

  return (
    <div className="space-y-2.5 pb-2">
      <header className="pt-1">
        <h1 className="text-xl font-semibold tracking-tight">织间</h1>
        <p className="text-sm text-muted-foreground">你好，{displayName(user)}</p>
      </header>

      {partner ? (
        <PointsCard
          myPoints={balance?.me ?? 0}
          partnerPoints={balance?.partner ?? 0}
          togetherDays={togetherDays}
        />
      ) : (
        /* 未配对：邀请码卡片（配对入口） */
        <Card className="rounded-2xl py-3">
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">我的邀请码</p>
                <p className="font-mono text-lg tracking-widest text-primary">
                  {user?.invite_code || '—'}
                </p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={copyCode}>
                复制
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">把邀请码给对方，绑定后就能一起记录生活。</p>
            <Button asChild className="w-full rounded-xl">
              <Link to="/pair">
                <UserPlusIcon className="mr-2 h-4 w-4" />
                绑定伴侣
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <PendingCard pending={pending} onOpen={openPending} />

      <RecentCard upcoming={upcoming} />

      {/* 生活记录入口 */}
      <Card className="rounded-2xl py-2.5">
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_LINKS.map((link) => {
              const count = link.badgeKey ? badges[link.badgeKey] : 0;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-label={count > 0 ? `${link.label}，${count}项待处理` : link.label}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-muted/40 p-1 transition-colors hover:bg-muted"
                >
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <link.icon className="h-4 w-4 text-primary" />
                    <QuickBadge count={count} />
                  </span>
                  <span className="text-xs font-medium">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
