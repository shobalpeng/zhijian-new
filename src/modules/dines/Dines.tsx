import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useCollection } from '@/hooks/use-collection';
import { ImageCarousel } from '@/components/common/image-carousel';
import { EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { COLLECTION_ID, formatDate, formatMoney, imageUrls } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Dine {
  id: string;
  restaurant: string;
  date: string;
  people?: string;
  people_count?: number;
  dishes?: string;
  cost?: number;
  rating?: number;
  comment?: string;
  images?: string[];
  creator?: string;
}

/** 聚餐统计：口径与 V1 一致——基于**全量**记录（不随搜索变化） */
function useDineStats(records: Dine[]) {
  return useMemo(() => {
    const total = Math.round(records.reduce((s, d) => s + (d.cost ?? 0), 0) * 100) / 100;
    const freq = new Map<string, number>();
    for (const d of records) {
      const name = (d.restaurant || '').trim();
      if (!name) continue;
      freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    return { total, count: records.length, top };
  }, [records]);
}

function DineStatsCard({ records }: { records: Dine[] }) {
  const stats = useDineStats(records);
  if (stats.count === 0) return null;

  return (
    <Card className="rounded-2xl py-2.5">
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">🍽️ 聚餐统计</p>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-muted p-2">
            <p className="text-lg font-bold tabular-nums text-primary">{stats.count}</p>
            <p className="text-xs text-muted-foreground">聚餐次数</p>
          </div>
          <div className="rounded-xl bg-muted p-2">
            <p className="text-lg font-bold tabular-nums text-primary">{formatMoney(stats.total)}</p>
            <p className="text-xs text-muted-foreground">总花费</p>
          </div>
        </div>

        {stats.top.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">🏆 最常去：</span>
            {stats.top.map((r, i) => (
              <span
                key={r.name}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {i === 0 && '👑 '}
                {r.name}
                <span className="opacity-60">{r.count}次</span>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DinesPage() {
  const list = useCollection<Dine>('dines', { sort: '-date' });

  const [search, setSearch] = useState('');

  const keyword = search.trim().toLowerCase();
  /** 搜索口径与 V1 一致：匹配「餐厅」或「参与人」 */
  const filtered = useMemo(() => {
    if (!keyword) return list.records;
    // 搜索走全量数据，否则已加载之外的记录搜不到
    const source = list.allRecords.length ? list.allRecords : list.records;
    return source.filter((d) =>
      `${d.restaurant ?? ''} ${d.people ?? ''}`.toLowerCase().includes(keyword),
    );
  }, [list.records, list.allRecords, keyword]);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="聚餐"
        subtitle={
          keyword
            ? `共 ${filtered.length} 次（筛选自 ${list.allRecords.length} 次）`
            : `共 ${list.allRecords.length} 次`
        }
        action={
          <Button asChild className="rounded-xl">
            <Link to="/dines/new">新增</Link>
          </Button>
        }
      />

      {/* 搜索：匹配餐厅或参与人 */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索餐厅或参与人..."
          className="pl-9"
          aria-label="搜索聚餐"
        />
      </div>

      {list.error ? (
        <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
          加载失败：{list.error}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-xl"
            onClick={() => void list.reload()}
          >
            重试
          </Button>
        </div>
      ) : list.loading && list.records.length === 0 ? (
        <LoadingText />
      ) : filtered.length === 0 ? (
        <EmptyState
          text={
            keyword
              ? `没有找到「${search.trim()}」相关的聚餐，换个关键词试试`
              : '还没有聚餐记录，记一次吧'
          }
        />
      ) : (
        <>
          <DineStatsCard records={list.allRecords} />

          <div>
            {filtered.map((d, index) => {
              const urls = imageUrls(COLLECTION_ID.dines, d.id, d.images, '600x0');
              const perPerson =
                d.cost && d.people_count && d.people_count > 0 ? d.cost / d.people_count : null;
              const isLast = index === filtered.length - 1;

              return (
                <div key={d.id} className="flex gap-3">
                  {/* 时间线轴 */}
                  <div className="flex shrink-0 flex-col items-center">
                    <div className="mt-1.5 h-3 w-3 rounded-full bg-primary" />
                    {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" />}
                  </div>

                  <Link
                    to={`/dines/${d.id}`}
                    className={cn('min-w-0 flex-1 overflow-hidden rounded-2xl', !isLast && 'mb-4')}
                  >
                    <Card className="min-w-0 overflow-hidden rounded-2xl">
                    <CardContent className="space-y-3 pt-4">
                      <ImageCarousel urls={urls} alt={d.restaurant} />

                      {/* 文字区 */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-medium">{d.restaurant}</p>
                          {(d.rating ?? 0) > 0 && (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-amber-500">
                              <StarSolidIcon className="h-3.5 w-3.5" />
                              {d.rating}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(d.date)}</span>
                          {d.people && (
                            <Badge variant="secondary" className="rounded-full">
                              {d.people}
                            </Badge>
                          )}
                          {d.people_count ? <span>{d.people_count} 人</span> : null}
                          {d.cost ? (
                            <span className="tabular-nums">
                              {formatMoney(d.cost)}
                              {perPerson
                                ? ` · 人均 ${formatMoney(Math.round(perPerson * 10) / 10)}`
                                : ''}
                            </span>
                          ) : null}
                        </div>

                        {d.dishes && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            菜品：{d.dishes}
                          </p>
                        )}
                        {d.comment && (
                          <p className="line-clamp-3 text-sm text-muted-foreground">{d.comment}</p>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>

          <LoadMoreButton
            hasMore={list.hasMore}
            remaining={list.remaining}
            loading={list.loadingMore}
            onClick={() => void list.loadMore()}
          />
        </>
      )}
    </div>
  );
}
