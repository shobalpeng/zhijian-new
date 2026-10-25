import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { CoverImage } from '@/components/common/list-parts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { COLLECTION_ID, formatDate, formatMoney } from '@/lib/format';

interface Item {
  id: string;
  name: string;
  date: string;
  price: number;
  category: string;
  status: string;
  retired_date?: string;
  image?: string;
  note?: string;
}

/** 物品详情：展示购入信息、状态与备注，可编辑或删除 */
export function ItemDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('items').getOne<Item>(id, { $autoCancel: false });
        if (alive) setRecord(rec);
      } catch {
        toast.error('找不到这件物品');
        navigate('/items', { replace: true });
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
      await pb.collection('items').delete(id);
      toast.success('已删除');
      navigate('/items', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <DetailShell
      title={record?.name ?? '物品'}
      loading={loading}
      hasRecord={!!record}
      editTo={`/items/${id}/edit`}
      onDelete={remove}
      deleteTitle="删除这件物品？"
    >
      {record?.image && (
        <CoverImage
          collectionId={COLLECTION_ID.items}
          recordId={record.id}
          file={record.image}
          className="max-h-64 w-full"
        />
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="rounded-full">
              {record?.category}
            </Badge>
            <Badge
              variant={record?.status === 'active' ? 'default' : 'secondary'}
              className="rounded-full"
            >
              {record?.status === 'active' ? '在用' : '已退役'}
            </Badge>
            <span className="text-muted-foreground">{formatDate(record?.date)}</span>
          </div>

          <DetailRow label="价格">
            <span className="font-medium tabular-nums">{formatMoney(record?.price ?? 0)}</span>
          </DetailRow>

          {record?.retired_date && (
            <DetailRow label="退役日期">{formatDate(record.retired_date)}</DetailRow>
          )}

          {record?.note && (
            <DetailRow label="备注">
              <p className="whitespace-pre-wrap">{record.note}</p>
            </DetailRow>
          )}
        </CardContent>
      </Card>
    </DetailShell>
  );
}
