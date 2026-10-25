import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoomableImage } from '@/components/common/zoomable-image';
import { useInteractiveItems } from '@/hooks/use-interactive-items';
import { COLLECTION_ID, fileUrl, formatDateTimeShort } from '@/lib/format';
import { KIND_CONFIG, STATUS_META } from './config';
import type { InteractiveItem, InteractiveKind, TaskStatus } from '@/lib/types';

function ItemImage({ item, kind }: { item: InteractiveItem; kind: InteractiveKind }) {
  if (!item.image) return null;
  return (
    <ZoomableImage
      src={fileUrl(COLLECTION_ID[kind], item.id, item.image, '600x0')}
      alt={item.title}
      className="h-32 w-full rounded-xl object-cover"
    />
  );
}

/** 卡片上的时间信息：发布 / 提交 / 完成 */
function ItemTimes({ item }: { item: InteractiveItem }) {
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p className="truncate">
        {item.creatorName || '我'} 发起 · {formatDateTimeShort(item.created_at)} 发布
      </p>
      {item.submitted_at && (
        <p className="text-[11px] text-muted-foreground/80">
          {formatDateTimeShort(item.submitted_at)} 已提交
          {item.confirmed_at && ` · ${formatDateTimeShort(item.confirmed_at)} 已完成`}
        </p>
      )}
      {!item.submitted_at && item.confirmed_at && (
        <p className="text-[11px] text-muted-foreground/80">
          {formatDateTimeShort(item.confirmed_at)} 已完成
        </p>
      )}
    </div>
  );
}

/** 列表分栏：全部 + 三个状态（顺序即展示顺序） */
type TabValue = 'all' | TaskStatus;
const TAB_VALUES: TabValue[] = ['all', 'pending', 'submitted', 'confirmed'];
const TAB_LABELS: Record<TabValue, string> = {
  all: '全部',
  pending: '待完成',
  submitted: '待确认',
  confirmed: '已完成',
};

type Actions = Pick<ReturnType<typeof useInteractiveItems>, 'submit' | 'confirm' | 'remove'>;

function ItemCard({
  item,
  kind,
  meId,
  actions,
}: {
  item: InteractiveItem;
  kind: InteractiveKind;
  meId: string;
  actions: Actions;
}) {
  const [busy, setBusy] = useState(false);
  const cfg = KIND_CONFIG[kind];
  const meta = STATUS_META[item.status];

  const isCreator = item.creator === meId;
  const isCounterpart = item.counterpart === meId;

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const detailPath = `/${kind}/${item.id}`;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 pt-4">
        {/* 可点击区域：整块进详情 */}
        <Link to={detailPath} className="block space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge className={`rounded-full ${meta.className}`}>{meta.label}</Badge>
              <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                <SparklesIcon className="h-4 w-4" />
                {item.points}
              </span>
            </div>
          </div>

          <ItemImage item={item} kind={kind} />

          <div className="flex items-end justify-between gap-2">
            <ItemTimes item={item} />
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground/60">
              详情
              <ChevronRightIcon className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* 操作区（与详情入口分开，避免点按钮误跳转） */}
        {((item.status === 'pending' && isCounterpart) ||
          (item.status === 'submitted' && isCreator) ||
          (item.status === 'pending' && isCreator) ||
          (item.status === 'submitted' && isCounterpart)) && (
          <div className="flex items-center justify-end gap-2 border-t pt-2.5">
            {item.status === 'pending' && isCounterpart && (
              <Button
                size="sm"
                className="rounded-xl"
                disabled={busy}
                onClick={() => void run(() => actions.submit(item.id), '已提交，等待确认')}
              >
                <CheckCircleIcon className="mr-1 h-4 w-4" />
                {cfg.submitLabel}
              </Button>
            )}

            {item.status === 'submitted' && isCreator && (
              <Button
                size="sm"
                className="rounded-xl"
                disabled={busy}
                onClick={() => void run(() => actions.confirm(item.id), '已确认，积分已结算')}
              >
                <CheckCircleIcon className="mr-1 h-4 w-4" />
                {cfg.confirmLabel}
              </Button>
            )}

            {item.status === 'submitted' && isCounterpart && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="h-4 w-4" />
                {cfg.waitForCreator}
              </span>
            )}

            {item.status === 'pending' && isCreator && (
              <>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ClockIcon className="h-4 w-4" />
                  {cfg.waitForCounterpart}
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                >
                  <Link to={`/${kind}/${item.id}/edit`} aria-label="编辑">
                    <PencilIcon className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  aria-label="删除"
                  disabled={busy}
                  onClick={() => void run(() => actions.remove(item.id), '已删除')}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** tasks / wishes 共用的列表页：状态分组 + 新建入口（独立整页表单）+ 提交/确认 + 详情入口 */
export function InteractiveBoard({ kind }: { kind: InteractiveKind }) {
  const { items, loading, meId, submit, confirm, remove } = useInteractiveItems(kind);
  const cfg = KIND_CONFIG[kind];
  const actions = { submit, confirm, remove };

  /**
   * 当前 tab 存 URL（?tab=submitted|confirmed|all），这样从详情页返回能回到原来那一栏，
   * 刷新/分享也能保持。切 tab 用 replace，不污染前进后退历史。
   * 「待完成」是默认栏，省略参数（地址最干净）。
   */
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const activeTab: TabValue = TAB_VALUES.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : 'pending';

  const changeTab = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'pending') next.delete('tab');
    else next.set('tab', value);
    setParams(next, { replace: true });
  };

  const groups: Record<TabValue, InteractiveItem[]> = {
    all: items,
    pending: items.filter((i) => i.status === 'pending'),
    submitted: items.filter((i) => i.status === 'submitted'),
    confirmed: items.filter((i) => i.status === 'confirmed'),
  };

  const emptyText: Record<TabValue, string> = {
    all: cfg.emptyText,
    ...cfg.emptyByStatus,
  };

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{cfg.title}</h1>
          <p className="text-sm text-muted-foreground">共 {items.length} 条</p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to={`/${kind}/new`}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {cfg.createLabel}
          </Link>
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="grid w-full grid-cols-4 rounded-xl">
          {TAB_VALUES.map((value) => (
            <TabsTrigger key={value} value={value} className="rounded-lg px-1 text-xs">
              {TAB_LABELS[value]} {groups[value].length}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_VALUES.map((value) => (
          <TabsContent key={value} value={value} className="space-y-3 pt-2">
            {loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : groups[value].length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyText[value]}</p>
            ) : (
              groups[value].map((item) => (
                <ItemCard key={item.id} item={item} kind={kind} meId={meId} actions={actions} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
