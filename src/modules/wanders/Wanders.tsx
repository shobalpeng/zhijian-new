import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MapIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
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
  const navigate = useNavigate();
  const list = useCollection<Wander>('wanders', { sort: '-date' });

  const remove = async (w: Wander) => {
    try {
      await list.remove(w.id);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

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
            <Card key={w.id} className="rounded-2xl">
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MapIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.location}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(w.date)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl text-muted-foreground"
                      aria-label="编辑"
                      onClick={() => navigate(`/wanders/${w.id}/edit`)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl text-muted-foreground"
                      onClick={() => void remove(w)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {w.mood && <p className="text-sm text-muted-foreground">{w.mood}</p>}

                <ImageCarousel
                  urls={imageUrls(COLLECTION_ID.wanders, w.id, w.images, '600x0')}
                  alt={w.location}
                />
              </CardContent>
            </Card>
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
