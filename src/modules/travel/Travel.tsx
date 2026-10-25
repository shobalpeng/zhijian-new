import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { BanknotesIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useCollection } from '@/hooks/use-collection';

import { CoverImage, EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COLLECTION_ID, formatDate, formatMoney } from '@/lib/format';

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

export function TravelPage() {
  const dests = useCollection<Destination>('destinations', { sort: '-created_at' });
  const expenses = useCollection<Expense>('expenses', { sort: '-created_at' });

  const expensesByDest = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses.allRecords) {
      const list = map.get(e.destination) ?? [];
      list.push(e);
      map.set(e.destination, list);
    }
    return map;
  }, [expenses.allRecords]);

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="旅游"
        subtitle={`共 ${dests.records.length} 个目的地`}
        action={
          <Button asChild className="rounded-xl">
            <Link to="/travel/new">新增</Link>
          </Button>
        }
      />

      {dests.loading && dests.records.length === 0 ? (
        <LoadingText />
      ) : (
        <Tabs defaultValue="wishlist">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="wishlist" className="rounded-lg">
              想去 {dests.allRecords.filter((d) => d.status === 'wishlist').length}
            </TabsTrigger>
            <TabsTrigger value="visited" className="rounded-lg">
              去过 {dests.allRecords.filter((d) => d.status === 'visited').length}
            </TabsTrigger>
          </TabsList>

          {(['wishlist', 'visited'] as const).map((status) => {
            const rows = dests.records.filter((d) => d.status === status);
            return (
              <TabsContent key={status} value={status} className="space-y-3 pt-2">
                {rows.length === 0 ? (
                  <EmptyState text={status === 'wishlist' ? '还没有想去的地方' : '还没有去过的地方'} />
                ) : (
                  rows.map((d) => {
                    const list = expensesByDest.get(d.id) ?? [];
                    const total = list.reduce((s, e) => s + (e.amount || 0), 0);
                    return (
                      <Link key={d.id} to={`/travel/${d.id}`} className="block">
                      <Card className="cursor-pointer rounded-2xl">
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
                      </Link>
                    );
                  })
                )}
              </TabsContent>
            );
          })}
        </Tabs>

      )}

      {/* 详情 + 花费 */}
        <LoadMoreButton
          hasMore={dests.hasMore}
          remaining={dests.remaining}
          loading={dests.loadingMore}
          onClick={() => void dests.loadMore()}
        />
    </div>
  );
}
