import { Link } from 'react-router-dom';
import { MapIcon } from '@heroicons/react/24/outline';
import { useCollection } from '@/hooks/use-collection';
import { EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
import { ImageCarousel } from '@/components/common/image-carousel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_ID, formatDate, imageUrls } from '@/lib/format';

interface Wander {
  id: string;
  location: string;
  date: string;
  images?: string[];
  mood?: string;
  creator?: string;
}

export function WandersPage() {
  const list = useCollection<Wander>('wanders', { sort: '-date' });

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="城市漫游"
        subtitle={`共 ${list.records.length} 次`}
        action={
          <Button asChild className="rounded-xl">
            <Link to="/wanders/new">新增</Link>
          </Button>
        }
      />

      {list.loading && list.records.length === 0 ? (
        <LoadingText />
      ) : list.records.length === 0 ? (
        <EmptyState text="还没有漫游记录，记一次吧" />
      ) : (
        <div className="space-y-3">
          {list.records.map((w) => (
            <Link key={w.id} to={`/wanders/${w.id}`} className="block">
              <Card className="rounded-2xl">
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MapIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.location}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(w.date)}</p>
                    </div>
                  </div>
                </div>

                {w.mood && <p className="text-sm text-muted-foreground">{w.mood}</p>}

                <ImageCarousel
                  urls={imageUrls(COLLECTION_ID.wanders, w.id, w.images, '600x0')}
                  alt={w.location}
                />
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>

      )}

        <LoadMoreButton
          hasMore={list.hasMore}
          remaining={list.remaining}
          loading={list.loadingMore}
          onClick={() => void list.loadMore()}
        />
    </div>
  );
}
