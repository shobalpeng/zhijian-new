import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { ImageCarousel } from '@/components/common/image-carousel';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_ID, formatDate, imageUrls } from '@/lib/format';

interface Wander {
  id: string;
  location: string;
  date: string;
  mood?: string;
  images?: string[];
}

/** 漫游详情：展示照片、地点与心情，可编辑或删除 */
export function WanderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Wander | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('wanders').getOne<Wander>(id, { $autoCancel: false });
        if (alive) setRecord(rec);
      } catch {
        toast.error('找不到这条漫游');
        navigate('/wanders', { replace: true });
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
      await pb.collection('wanders').delete(id);
      toast.success('已删除');
      navigate('/wanders', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <DetailShell
      title={record?.location ?? '漫游'}
      loading={loading}
      hasRecord={!!record}
      editTo={`/wanders/${id}/edit`}
      onDelete={remove}
      deleteTitle="删除这条漫游记录？"
    >
      <ImageCarousel
        urls={imageUrls(COLLECTION_ID.wanders, record?.id ?? '', record?.images, '900x0')}
        alt={record?.location ?? ''}
        className="max-h-80"
      />

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          <DetailRow label="日期">{formatDate(record?.date)}</DetailRow>
          {record?.mood && <DetailRow label="心情">{record.mood}</DetailRow>}
        </CardContent>
      </Card>
    </DetailShell>
  );
}
