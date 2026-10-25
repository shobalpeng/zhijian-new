import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDaysIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCollection } from '@/hooks/use-collection';
import { EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { daysSince, nextOccurrence } from '@/lib/lunar';
import { today } from '@/lib/format';

interface Anniversary {
  id: string;
  name: string;
  date: string;
  note?: string;
  is_lunar?: boolean;
  is_together?: boolean;
  user?: string;
}

export function AnniversariesPage() {
  const navigate = useNavigate();
  const list = useCollection<Anniversary>('anniversaries', { sort: '-created_at' });

  const sorted = useMemo(() => {
    return [...list.records].sort((a, b) => {
      const da = nextOccurrence(a.date, a.is_lunar).daysUntil;
      const db = nextOccurrence(b.date, b.is_lunar).daysUntil;
      return da - db;
    });
  }, [list.records]);

  const remove = async (a: Anniversary) => {
    try {
      await list.remove(a.id);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="纪念日"
        subtitle={`共 ${list.records.length} 个`}
        action={
          <Button asChild className="rounded-xl">
            <Link to="/anniversaries/new">新增</Link>
          </Button>
        }
      />

      {list.loading && list.records.length === 0 ? (
        <LoadingText />
      ) : list.records.length === 0 ? (
        <EmptyState text="还没有纪念日，新增一个吧" />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const occ = nextOccurrence(a.date, a.is_lunar);
            const isToday = occ.daysUntil === 0;

            return (
              <Card key={a.id} className="rounded-2xl">
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDaysIcon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{a.name}</p>
                      {a.is_lunar && (
                        <Badge variant="secondary" className="rounded-full text-xs">
                          农历
                        </Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.date.slice(0, 10)}
                      {a.is_lunar && ` · 今年公历 ${occ.solarDate}`}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className={`rounded-full ${isToday ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {isToday ? '就是今天' : `还有 ${occ.daysUntil} 天`}
                      </Badge>
                      {a.is_together ? (
                        <span className="text-xs text-muted-foreground">
                          在一起 {daysSince(a.date, a.is_lunar)} 天
                        </span>
                      ) : (
                        occ.years > 0 && (
                          <span className="text-xs text-muted-foreground">第 {occ.years} 周年</span>
                        )
                      )}
                    </div>

                    {a.note && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.note}</p>}
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl text-muted-foreground"
                      aria-label="编辑"
                      onClick={() => navigate(`/anniversaries/${a.id}/edit`)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl text-muted-foreground"
                      onClick={() => void remove(a)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      )}

      <p className="pt-1 text-center text-xs text-muted-foreground">今天是 {today()}</p>
        <LoadMoreButton
          hasMore={list.hasMore}
          remaining={list.remaining}
          loading={list.loadingMore}
          onClick={() => void list.loadMore()}
        />
    </div>
  );
}
