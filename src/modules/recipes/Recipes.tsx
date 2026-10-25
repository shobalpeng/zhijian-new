import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PencilIcon, SparklesIcon, TrashIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { useCollection } from '@/hooks/use-collection';
import { CoverImage, EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
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
import { COLLECTION_ID, daysBetween, formatDate, today } from '@/lib/format';

interface Recipe {
  id: string;
  title: string;
  cover_image?: string;
  ingredients?: string;
  steps?: string;
  cook_count?: number;
  avg_rating?: number;
  last_cooked_at?: string;
  creator?: string;
  created_at?: string;
}

interface CookHistory {
  id: string;
  recipe: string;
  user: string;
  rating?: number;
  created_at?: string;
  expand?: { user?: { name?: string; username?: string } };
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) =>
        n <= value ? (
          <StarSolidIcon key={n} className="h-4 w-4 text-amber-400" />
        ) : (
          <StarIcon key={n} className="h-4 w-4 text-muted-foreground/40" />
        ),
      )}
    </span>
  );
}

function CookRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-label={`${n} 分`} onClick={() => onChange(n)} className="rounded p-0.5">
          {n <= value ? (
            <StarSolidIcon className="h-8 w-8 text-amber-400" />
          ) : (
            <StarIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}

export function RecipesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const recipes = useCollection<Recipe>('recipes', { sort: '-created_at' });
  const cooks = useCollection<CookHistory>('cook_history', {
    sort: '-created_at',
    expand: 'user',
  });

  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);

  const cooksByRecipe = useMemo(() => {
    const map = new Map<string, CookHistory[]>();
    for (const c of cooks.records) {
      const list = map.get(c.recipe) ?? [];
      list.push(c);
      map.set(c.recipe, list);
    }
    return map;
  }, [cooks.records]);

  const submitCook = async () => {
    if (!cooking || !user?.id) return;
    setBusy(true);
    try {
      await cooks.create({ recipe: cooking.id, user: user.id, rating });
      toast.success('记下啦，统计已更新');
      setCooking(null);
      setRating(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '记录失败');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Recipe) => {
    try {
      await recipes.remove(r.id);
      toast.success('已删除');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="菜谱"
        subtitle={`共 ${recipes.records.length} 道菜`}
        action={
          <Button asChild className="rounded-xl">
            <Link to="/recipes/new">新增</Link>
          </Button>
        }
      />

      {recipes.loading && recipes.records.length === 0 ? (
        <LoadingText />
      ) : recipes.records.length === 0 ? (
        <EmptyState text="还没有菜谱，新增一道吧" />
      ) : (
        <div className="space-y-3">
          {recipes.records.map((r) => {
            const history = cooksByRecipe.get(r.id) ?? [];
            const lastDays = r.last_cooked_at
              ? daysBetween(formatDate(r.last_cooked_at), today())
              : null;

            return (
              <Card key={r.id} className="rounded-2xl">
                <CardContent className="space-y-3 pt-4">
                  <CoverImage
                    collectionId={COLLECTION_ID.recipes}
                    recordId={r.id}
                    file={r.cover_image}
                    className="h-36 w-full"
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>做过 {r.cook_count ?? 0} 次</span>
                        {(r.avg_rating ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Stars value={r.avg_rating ?? 0} />
                            {r.avg_rating}
                          </span>
                        )}
                        {lastDays !== null && <span>{lastDays === 0 ? '今天做过' : `${lastDays} 天前做过`}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-xl text-muted-foreground"
                        aria-label="编辑"
                        onClick={() => navigate(`/recipes/${r.id}/edit`)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-xl text-muted-foreground"
                        onClick={() => void remove(r)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {r.ingredients && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">食材：{r.ingredients}</p>
                  )}

                  {history.length > 0 && (
                    <div className="space-y-1 rounded-xl bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">最近记录</p>
                      {history.slice(0, 3).map((h) => (
                        <div key={h.id} className="flex items-center justify-between text-xs">
                          <span>
                            {h.expand?.user?.name || h.expand?.user?.username || '有人'}
                            {' · '}
                            {formatDate(h.created_at)}
                          </span>
                          {(h.rating ?? 0) > 0 && <Stars value={h.rating ?? 0} />}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled={!user?.id}
                    onClick={() => {
                      setCooking(r);
                      setRating(0);
                    }}
                  >
                    <SparklesIcon className="mr-1 h-4 w-4" />
                    我做过了
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      )}

      {/* 做菜评分 */}
      <Dialog open={!!cooking} onOpenChange={(v) => !v && setCooking(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>给「{cooking?.title}」打个分</DialogTitle>
            <DialogDescription>记录后会自动更新做过次数、平均分与最近一次</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <CookRating value={rating} onChange={setRating} />
        <LoadMoreButton
          hasMore={recipes.hasMore}
          loading={recipes.loadingMore}
          onClick={() => void recipes.loadMore()}
        />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setCooking(null)}>
              取消
            </Button>
            <Button
              className="rounded-xl"
              disabled={busy || rating === 0}
              onClick={() => void submitCook()}
            >
              记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
