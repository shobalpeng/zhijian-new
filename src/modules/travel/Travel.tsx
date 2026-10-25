import { useMemo, useState, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BanknotesIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { useCollection } from '@/hooks/use-collection';
import { ExpenseForm, type ExpenseFormValue } from '@/components/common/expense-form';
import { CoverImage, EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
import { ExpenseGroupList, ExpenseSummary } from '@/components/common/travel-expenses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLLECTION_ID, formatDate, formatMoney, today } from '@/lib/format';

interface Destination {
  id: string;
  name: string;
  cover_image?: string;
  tagline?: string;
  status: 'wishlist' | 'visited';
  city?: string;
  lat?: number;
  lng?: number;
  places_to_visit?: string;
  itinerary_draft?: string;
  budget_estimate?: number;
  notes?: string;
  visited_at?: string;
  creator?: string;
}

interface Expense {
  id: string;
  destination: string;
  category: string;
  amount: number;
  payer: 'me' | 'partner';
  note?: string;
}

/**
 * 足迹地图按需加载：leaflet 体积不小（约 +170KB gzip），
 * 只有切到「地图」tab 时才下载，首屏不受影响。
 */
const TravelMap = lazy(() =>
  import('@/components/common/travel-map').then((m) => ({ default: m.TravelMap })),
);

const CATEGORY_LABEL: Record<string, string> = {
  transport: '交通',
  accommodation: '住宿',
  dining: '餐饮',
  tickets: '门票',
  shopping: '购物',
  other: '其他',
};

export function TravelPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dests = useCollection<Destination>('destinations', { sort: '-created_at' });
  const expenses = useCollection<Expense>('expenses', { sort: '-created_at' });

  const [active, setActive] = useState<Destination | null>(null);
  const [search, setSearch] = useState('');

  const keyword = search.trim().toLowerCase();
  /** 搜索口径与 V1 一致：匹配「目的地名」或「城市」 */
  const filtered = useMemo(() => {
    if (!keyword) return dests.records;
    // 搜索走全量数据，否则已加载之外的记录搜不到
    const source = dests.allRecords.length ? dests.allRecords : dests.records;
    return source.filter((d) =>
      `${d.name ?? ''} ${d.city ?? ''}`.toLowerCase().includes(keyword),
    );
  }, [dests.records, dests.allRecords, keyword]);

  const expensesByDest = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses.allRecords) {
      const list = map.get(e.destination) ?? [];
      list.push(e);
      map.set(e.destination, list);
    }
    return map;
  }, [expenses.allRecords]);

  /**
   * 「添加花费」表单的展开状态。
   * 两处入口（详情弹窗 / 花费汇总 tab）各自独立，用 key 区分。
   */
  const [expenseFormKey, setExpenseFormKey] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);

  /**
   * 写入一笔花费。
   *
   * payer 在数据库里以「目的地创建者」为参照（me = 创建者付）。
   * 表单里是相对当前用户的「我/Ta」，所以非创建者填写时要互换，否则结算方向会反。
   */
  const createExpense = async (value: ExpenseFormValue) => {
    const target = dests.allRecords.find((d) => d.id === value.destination);
    if (!target) {
      toast.error('没有选择目的地');
      return;
    }

    let payer = value.payer;
    if (target.creator !== user?.id) {
      payer = payer === 'me' ? 'partner' : 'me';
    }

    setExpenseSaving(true);
    try {
      await expenses.create({
        destination: target.id,
        category: value.category,
        amount: value.amount,
        payer,
        note: value.note,
      });
      toast.success('已记录');
      setExpenseFormKey(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加失败');
    } finally {
      setExpenseSaving(false);
    }
  };

  const removeExpense = async (id: string) => {
    try {
      await expenses.remove(id);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const remove = async (d: Destination) => {
    try {
      await dests.remove(d.id);
      setActive(null);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const markVisited = async (d: Destination) => {
    try {
      // 用本地日期，避免 toISOString() 的 UTC 偏移导致日期差一天
      await dests.update(d.id, { status: 'visited', visited_at: today() });
      setActive(null);
      toast.success('已标记为去过');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const visitedDests = dests.allRecords.filter((d) => d.status === 'visited');

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="旅游"
        subtitle={
          keyword
            ? `共 ${filtered.length} 个目的地（筛选自 ${dests.allRecords.length} 个）`
            : `共 ${dests.allRecords.length} 个目的地`
        }
        action={
          <Button asChild className="rounded-xl">
            <Link to="/travel/new">新增</Link>
          </Button>
        }
      />

      {/* 搜索：匹配目的地名或城市 */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索目的地或城市..."
          className="pl-9"
          aria-label="搜索目的地"
        />
      </div>

      {dests.loading && dests.records.length === 0 ? (
        <LoadingText />
      ) : (
        <Tabs defaultValue="wishlist">
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="wishlist" className="rounded-lg">
              想去 {dests.allRecords.filter((d) => d.status === 'wishlist').length}
            </TabsTrigger>
            <TabsTrigger value="visited" className="rounded-lg">
              去过 {visitedDests.length}
            </TabsTrigger>
            <TabsTrigger value="map" className="rounded-lg">
              地图
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg">
              花费
            </TabsTrigger>
          </TabsList>

          {(['wishlist', 'visited'] as const).map((status) => {
            const rows = filtered.filter((d) => d.status === status);
            return (
              <TabsContent key={status} value={status} className="space-y-3 pt-2">
                {rows.length === 0 ? (
                  <EmptyState
                    text={
                      keyword
                        ? status === 'wishlist'
                          ? '没有找到匹配的目的地'
                          : '没有找到匹配的目的地'
                        : status === 'wishlist'
                          ? '还没有想去的地方'
                          : '还没有去过的地方'
                    }
                  />
                ) : (
                  rows.map((d) => {
                    const list = expensesByDest.get(d.id) ?? [];
                    const total = list.reduce((s, e) => s + (e.amount || 0), 0);
                    return (
                      <Card
                        key={d.id}
                        className="cursor-pointer rounded-2xl"
                        onClick={() => setActive(d)}
                      >
                        <CardContent className="space-y-3 pt-4">
                          <CoverImage
                            collectionId={COLLECTION_ID.destinations}
                            recordId={d.id}
                            file={d.cover_image}
                            className="h-32 w-full"
                          />
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{d.name}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                {d.city && (
                                  <>
                                    <MapPinIcon className="h-3.5 w-3.5" />
                                    {d.city}
                                  </>
                                )}
                                {d.visited_at && ` · ${formatDate(d.visited_at)}`}
                              </p>
                              {d.tagline && (
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.tagline}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {total > 0 && (
                                <p className="flex items-center gap-1 text-sm font-semibold text-primary">
                                  <BanknotesIcon className="h-4 w-4" />
                                  {formatMoney(total)}
                                </p>
                              )}
                              {d.budget_estimate ? (
                                <p className="text-xs text-muted-foreground">预算 {formatMoney(d.budget_estimate)}</p>
                              ) : null}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>
            );
          })}

          <TabsContent value="map" className="space-y-4 pt-2">
            <Suspense fallback={<LoadingText />}>
              <TravelMap
                destinations={dests.allRecords}
                onSelect={(id) => {
                  const hit = dests.allRecords.find((d) => d.id === id);
                  if (hit) setActive(hit);
                }}
              />
            </Suspense>

            {/* 地图下方补「已去过的目的地」列表（对齐 V1） */}
            {visitedDests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">已去过的目的地</h3>
                <div className="grid grid-cols-2 gap-2">
                  {visitedDests.map((d) => (
                    <Card
                      key={d.id}
                      className="cursor-pointer rounded-2xl"
                      onClick={() => setActive(d)}
                    >
                      <CardContent className="space-y-2 p-3">
                        <CoverImage
                          collectionId={COLLECTION_ID.destinations}
                          recordId={d.id}
                          file={d.cover_image}
                          className="h-24 w-full"
                        />
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        {d.city && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPinIcon className="h-3 w-3" />
                            {d.city}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 花费汇总（对齐 V1 的 ExpenseSummary + ExpenseList） */}
          <TabsContent value="expenses" className="space-y-3 pt-2">
            {/* 添加花费：内联表单（同 V1，一次填完）。
                空状态时也要有入口，否则一条花费都记不进来。 */}
            {expenseFormKey === 'global' ? (
              <ExpenseForm
                destinations={dests.allRecords}
                onSubmit={createExpense}
                onCancel={() => setExpenseFormKey(null)}
                submitting={expenseSaving}
                submitLabel="记录"
              />
            ) : (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setExpenseFormKey('global')}
              >
                <PlusIcon className="mr-1 h-4 w-4" />
                添加花费
              </Button>
            )}

            {expenses.allRecords.length === 0 ? (
              <EmptyState text="还没有花费记录" />
            ) : (
              <>
                <ExpenseSummary
                  expenses={expenses.allRecords}
                  destinations={dests.allRecords}
                  currentUserId={user?.id}
                />

                <ExpenseGroupList
                  expenses={expenses.allRecords}
                  destinations={dests.allRecords}
                  currentUserId={user?.id}
                  onRemove={(id) => void removeExpense(id)}
                />
              </>
            )}
          </TabsContent>
        </Tabs>

      )}

      {/* 详情 + 花费 */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
          {active && (
            <DestinationDetail
              dest={active}
              expenses={expensesByDest.get(active.id) ?? []}
              isCreator={active.creator === user?.id}
              onEdit={() => {
                setActive(null);
                navigate(`/travel/${active.id}/edit`);
              }}
              onDelete={() => void remove(active)}
              onMarkVisited={() => void markVisited(active)}
              onAddExpense={() => setExpenseFormKey('detail')}
              onRemoveExpense={removeExpense}
              expenseForm={
                expenseFormKey === 'detail' ? (
                  <ExpenseForm
                    destinations={dests.allRecords}
                    fixedDestinationId={active.id}
                    onSubmit={createExpense}
                    onCancel={() => setExpenseFormKey(null)}
                    submitting={expenseSaving}
                    submitLabel="记录"
                  />
                ) : null
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <LoadMoreButton
        hasMore={dests.hasMore}
        remaining={dests.remaining}
        loading={dests.loadingMore}
        onClick={() => void dests.loadMore()}
      />
    </div>
  );
}

function DestinationDetail({
  dest,
  expenses,
  isCreator,
  onEdit,
  onDelete,
  onMarkVisited,
  onAddExpense,
  onRemoveExpense,
  expenseForm,
}: {
  dest: Destination;
  expenses: Expense[];
  isCreator: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMarkVisited: () => void;
  onAddExpense: () => void;
  onRemoveExpense: (id: string) => void;
  /** 展开的「添加花费」内联表单（null = 未展开） */
  expenseForm?: React.ReactNode;
}) {
  // payer 字段以「目的地创建者」为参照：me = 创建者付，partner = 对方付。
  // 当前查看者不是创建者时，视角要对调。
  const creatorPaid = expenses
    .filter((e) => e.payer === 'me')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const partnerPaid = expenses
    .filter((e) => e.payer === 'partner')
    .reduce((s, e) => s + (e.amount || 0), 0);

  const myTotal = isCreator ? creatorPaid : partnerPaid;
  const partnerTotal = isCreator ? partnerPaid : creatorPaid;
  const total = myTotal + partnerTotal;
  const diff = Math.abs(myTotal - partnerTotal);
  // 【修 V1 的 bug】V1 里 myTotal > partnerTotal 时文案显示「Ta多付了」，方向反了
  const who = myTotal > partnerTotal ? '我' : 'Ta';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="truncate">{dest.name}</span>
          <Badge
            variant="secondary"
            className={
              dest.status === 'visited'
                ? 'shrink-0 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'shrink-0 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400'
            }
          >
            {dest.status === 'visited' ? '已去过' : '想去'}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {dest.city || '目的地'}
          {dest.visited_at && ` · ${formatDate(dest.visited_at)} 去过`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        {dest.cover_image && (
          <CoverImage
            collectionId={COLLECTION_ID.destinations}
            recordId={dest.id}
            file={dest.cover_image}
            className="h-48 w-full"
          />
        )}

        {dest.tagline && (
          <p className="text-sm text-muted-foreground">{dest.tagline}</p>
        )}

        {dest.budget_estimate ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
            <BanknotesIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">预算估算：</span>
            <span className="text-lg font-bold tabular-nums text-primary">
              {formatMoney(dest.budget_estimate)}
            </span>
          </div>
        ) : null}

        {dest.places_to_visit && (
          <div>
            <p className="text-xs text-muted-foreground">想去的地方</p>
            <p className="whitespace-pre-wrap text-sm">{dest.places_to_visit}</p>
          </div>
        )}
        {dest.itinerary_draft && (
          <div>
            <p className="text-xs text-muted-foreground">行程草稿</p>
            <p className="whitespace-pre-wrap text-sm">{dest.itinerary_draft}</p>
          </div>
        )}
        {dest.notes && (
          <div>
            <p className="text-xs text-muted-foreground">备注</p>
            <p className="whitespace-pre-wrap text-sm">{dest.notes}</p>
          </div>
        )}

        <div className="rounded-xl bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">花费</p>
            {!expenseForm && (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={onAddExpense}>
                <PlusIcon className="mr-1 h-4 w-4" />
                记一笔
              </Button>
            )}
          </div>

          {/* 展开的「添加花费」内联表单 */}
          {expenseForm && <div className="mt-3">{expenseForm}</div>}

          {expenses.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">还没有记录花费</p>
          ) : (
            <>
              <div className="mt-2 space-y-1">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-xs">
                        {CATEGORY_LABEL[e.category] ?? e.category}
                      </Badge>
                      <span className="truncate text-muted-foreground">{e.note || '—'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums">{formatMoney(e.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {(e.payer === 'me') === isCreator ? '我' : 'Ta'}
                      </span>                      <button
                        type="button"
                        aria-label="删除"
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveExpense(e.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">合计</span>
                  <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">我 / Ta</span>
                  <span className="tabular-nums">
                    {formatMoney(myTotal)} / {formatMoney(partnerTotal)}
                  </span>
                </div>
                {diff > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {who}多付了 {formatMoney(diff)}，结算时对方转 {formatMoney(diff / 2)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" className="rounded-xl text-destructive" onClick={onDelete}>
          删除
        </Button>
        {dest.status === 'wishlist' && (
          <Button variant="outline" className="rounded-xl" onClick={onMarkVisited}>
            标记为去过
          </Button>
        )}
        <Button className="rounded-xl" onClick={onEdit}>
          <PencilIcon className="mr-1 h-4 w-4" />
          编辑
        </Button>
      </DialogFooter>
    </>
  );
}
