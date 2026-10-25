import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { pb } from '@/lib/pocketbase';
import { ImageCarousel } from '@/components/common/image-carousel';
import { LoadingText } from '@/components/common/list-parts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_ID, formatDate, formatMoney, imageUrls } from '@/lib/format';

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
}

/** 聚餐详情：从列表点进来，可编辑或删除 */
export function DineDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Dine | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const rec = await pb.collection('dines').getOne<Dine>(id, { $autoCancel: false });
      setRecord(rec);
    } catch {
      toast.error('找不到这条记录');
      navigate('/dines', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const remove = async () => {
    try {
      await pb.collection('dines').delete(id);
      toast.success('已删除');
      navigate('/dines', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) return <LoadingText />;
  if (!record) return null;

  const perPerson =
    record.cost && record.people_count && record.people_count > 0
      ? record.cost / record.people_count
      : null;

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label="返回"
          onClick={() => navigate(-1)}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-xl font-semibold tracking-tight">{record.restaurant}</h1>
      </header>

      <ImageCarousel
        urls={imageUrls(COLLECTION_ID.dines, record.id, record.images, '600x0')}
        alt={record.restaurant}
        className="max-h-80"
      />

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{formatDate(record.date)}</span>
            {record.people && (
              <Badge variant="secondary" className="rounded-full">
                {record.people}
              </Badge>
            )}
            {record.people_count ? (
              <span className="text-muted-foreground">{record.people_count} 人</span>
            ) : null}
          </div>

          {(record.rating ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => i + 1).map((n) =>
                n <= (record.rating ?? 0) ? (
                  <StarSolidIcon key={n} className="h-5 w-5 text-amber-400" />
                ) : (
                  <StarIcon key={n} className="h-5 w-5 text-muted-foreground/30" />
                ),
              )}
              <span className="ml-1 text-sm text-muted-foreground">{record.rating} 分</span>
            </div>
          )}

          {record.cost ? (
            <p className="text-sm">
              <span className="text-muted-foreground">花费 </span>
              <span className="font-medium tabular-nums">{formatMoney(record.cost)}</span>
              {perPerson && (
                <span className="ml-2 text-muted-foreground">
                  人均 {formatMoney(Math.round(perPerson * 10) / 10)}
                </span>
              )}
            </p>
          ) : null}

          {record.dishes && (
            <div>
              <p className="text-xs text-muted-foreground">菜品</p>
              <p className="whitespace-pre-wrap text-sm">{record.dishes}</p>
            </div>
          )}

          {record.comment && (
            <div>
              <p className="text-xs text-muted-foreground">点评</p>
              <p className="whitespace-pre-wrap text-sm">{record.comment}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          className="flex-1 rounded-xl"
          onClick={() => navigate(`/dines/${id}/edit`)}
        >
          <PencilIcon className="mr-2 h-4 w-4" />
          编辑
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="flex-1 rounded-xl text-destructive">
              <TrashIcon className="mr-2 h-4 w-4" />
              删除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>删除这条聚餐记录？</AlertDialogTitle>
              <AlertDialogDescription>删除后无法恢复。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl" onClick={() => void remove()}>
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}
