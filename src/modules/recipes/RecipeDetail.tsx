import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { CoverImage } from '@/components/common/list-parts';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_ID, formatDate } from '@/lib/format';

interface Recipe {
  id: string;
  title: string;
  ingredients?: string;
  steps?: string;
  cook_count?: number;
  avg_rating?: number;
  last_cooked_at?: string;
  cover_image?: string;
}

/** 菜谱详情：展示用料、做法与烹饪统计，可编辑或删除 */
export function RecipeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('recipes').getOne<Recipe>(id, { $autoCancel: false });
        if (alive) setRecord(rec);
      } catch {
        toast.error('找不到这个菜谱');
        navigate('/recipes', { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const remove = async () => {
    try {
      await pb.collection('recipes').delete(id);
      toast.success('已删除');
      navigate('/recipes', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const avg = record?.avg_rating ?? 0;

  return (
    <DetailShell
      title={record?.title ?? '菜谱'}
      loading={loading}
      hasRecord={!!record}
      editTo={`/recipes/${id}/edit`}
      onDelete={remove}
      deleteTitle="删除这个菜谱？"
    >
      {record?.cover_image && (
        <CoverImage
          collectionId={COLLECTION_ID.recipes}
          recordId={record.id}
          file={record.cover_image}
          className="max-h-64 w-full"
        />
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          {(record?.cook_count ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>做过 {record?.cook_count} 次</span>
              {avg > 0 && (
                <span className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((n) =>
                    n <= avg ? (
                      <StarSolidIcon key={n} className="h-4 w-4 text-amber-400" />
                    ) : (
                      <StarIcon key={n} className="h-4 w-4 text-muted-foreground/30" />
                    ),
                  )}
                  <span className="ml-1 text-muted-foreground">{avg} 分</span>
                </span>
              )}
              {record?.last_cooked_at && (
                <span className="text-muted-foreground">
                  最近 {formatDate(record.last_cooked_at)}
                </span>
              )}
            </div>
          )}

          {record?.ingredients && (
            <DetailRow label="用料">
              <p className="whitespace-pre-wrap">{record.ingredients}</p>
            </DetailRow>
          )}

          {record?.steps && (
            <DetailRow label="做法">
              <p className="whitespace-pre-wrap">{record.steps}</p>
            </DetailRow>
          )}
        </CardContent>
      </Card>
    </DetailShell>
  );
}
