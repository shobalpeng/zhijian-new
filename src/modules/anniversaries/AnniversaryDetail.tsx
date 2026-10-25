import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

interface Anniversary {
  id: string;
  name: string;
  date: string;
  note?: string;
  is_lunar?: boolean;
  is_together?: boolean;
}

/** 纪念日详情：展示日期、农历标记与备注，可编辑或删除 */
export function AnniversaryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Anniversary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('anniversaries').getOne<Anniversary>(id, {
          $autoCancel: false,
        });
        if (alive) setRecord(rec);
      } catch {
        toast.error('找不到这个纪念日');
        navigate('/anniversaries', { replace: true });
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
      await pb.collection('anniversaries').delete(id);
      toast.success('已删除');
      navigate('/anniversaries', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <DetailShell
      title={record?.name ?? '纪念日'}
      loading={loading}
      hasRecord={!!record}
      editTo={`/anniversaries/${id}/edit`}
      onDelete={remove}
      deleteTitle="删除这个纪念日？"
    >
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{formatDate(record?.date)}</span>
            {record?.is_lunar && (
              <Badge variant="secondary" className="rounded-full">
                农历
              </Badge>
            )}
            {record?.is_together && (
              <Badge variant="default" className="rounded-full">
                在一起
              </Badge>
            )}
          </div>

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
