import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArchiveBoxIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCollection } from '@/hooks/use-collection';
import { CoverImage, EmptyState, LoadingText, PageHeader } from '@/components/common/list-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLLECTION_ID, formatDate, formatMoney, today } from '@/lib/format';

interface Item {
  id: string;
  name: string;
  date: string;
  price: number;
  category: string;
  status: 'active' | 'retired';
  retired_date?: string;
  image?: string;
  note?: string;
  creator?: string;
}

const CATEGORY_BAR: Record<string, string> = {
  电子: 'border-l-blue-500',
  家居: 'border-l-amber-500',
  户外: 'border-l-emerald-500',
  服饰: 'border-l-pink-500',
  其他: 'border-l-muted-foreground/30',
};

/** 日均成本 = 价格 / 持有天数（退役后按退役日期截止） */
function dailyCost(item: Item): { days: number; perDay: number } {
  const start = item.date?.slice(0, 10) ?? today();
  const end =
    item.status === 'retired' && item.retired_date && item.retired_date > start
      ? item.retired_date.slice(0, 10)
      : today();
  // 已用天数按自然日向下取整（与 V1 口径一致）
  const days = Math.max(1, Math.floor((Date.parse(end) - Date.parse(start)) / 86400000));
  return { days, perDay: (item.price || 0) / days };
}

export function ItemsPage() {
  const navigate = useNavigate();
  const list = useCollection<Item>('items', { sort: '-date' });

  const remove = async (it: Item) => {
    try {
      await list.remove(it.id);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const retire = async (it: Item) => {
    try {
      await list.update(it.id, { status: 'retired', retired_date: today() });
      toast.success('已退役');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const totalPerDay = list.records
    .filter((i) => i.status === 'active')
    .reduce((s, i) => s + dailyCost(i).perDay, 0);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="日均成本"
        subtitle={`共 ${list.records.length} 件 · 在用合计 ${formatMoney(Math.round(totalPerDay * 100) / 100)}/天`}
        action={
          <Button asChild className="rounded-xl">
            <Link to="/items/new">新增</Link>
          </Button>
        }
      />

      {list.loading && list.records.length === 0 ? (
        <LoadingText />
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="active" className="rounded-lg">
              在用 {list.records.filter((i) => i.status === 'active').length}
            </TabsTrigger>
            <TabsTrigger value="retired" className="rounded-lg">
              已退役 {list.records.filter((i) => i.status === 'retired').length}
            </TabsTrigger>
          </TabsList>

          {(['active', 'retired'] as const).map((status) => {
            const rows = list.records.filter((i) => i.status === status);
            return (
              <TabsContent key={status} value={status} className="space-y-3 pt-2">
                {rows.length === 0 ? (
                  <EmptyState text={status === 'active' ? '还没有在用的物品' : '还没有退役的物品'} />
                ) : (
                  rows.map((it) => {
                    const { days, perDay } = dailyCost(it);
                    return (
                      <Card
                        key={it.id}
                        className={`rounded-2xl border-l-4 ${CATEGORY_BAR[it.category] ?? CATEGORY_BAR['其他']}`}
                      >
                        <CardContent className="flex items-start gap-3 pt-4">
                          <CoverImage
                            collectionId={COLLECTION_ID.items}
                            recordId={it.id}
                            file={it.image}
                            className="h-16 w-16 shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{it.name}</p>
                              <Badge variant="secondary" className="shrink-0 rounded-full text-xs">
                                {it.category}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(it.date)} · 已用 {days} 天 · {formatMoney(it.price)}
                            </p>
                            {it.note && (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{it.note}</p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-lg font-semibold tabular-nums text-primary">
                              {`¥${perDay.toFixed(2)}`}
                            </span>
                            <span className="text-xs text-muted-foreground">/天</span>
                            <div className="mt-1 flex items-center gap-1">
                              {it.status === 'active' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-xl text-muted-foreground"
                                  aria-label="标记退役"
                                  onClick={() => void retire(it)}
                                >
                                  <ArchiveBoxIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-xl text-muted-foreground"
                                aria-label="编辑"
                                onClick={() => navigate(`/items/${it.id}/edit`)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-xl text-muted-foreground"
                                onClick={() => void remove(it)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
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
        </Tabs>
      )}

    </div>
  );
}
