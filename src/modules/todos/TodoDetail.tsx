import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckIcon } from '@heroicons/react/24/outline';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Todo {
  id: string;
  content: string;
  done?: boolean;
  archived?: boolean;
  area?: string;
}

/** 待办详情：展示内容与状态，可标记完成、编辑或删除 */
export function TodoDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('todos').getOne<Todo>(id, { $autoCancel: false });
        if (alive) setRecord(rec);
      } catch {
        toast.error('找不到这条待办');
        navigate('/todos', { replace: true });
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
      await pb.collection('todos').delete(id);
      toast.success('已删除');
      navigate('/todos', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const toggleDone = async () => {
    try {
      const next = !record?.done;
      await pb.collection('todos').update(id, { done: next });
      setRecord((r) => (r ? { ...r, done: next } : r));
      toast.success(next ? '已完成' : '已标记为未完成');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <DetailShell
      title="待办"
      loading={loading}
      hasRecord={!!record}
      editTo={`/todos/${id}/edit`}
      onDelete={remove}
      deleteTitle="删除这条待办？"
    >
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="rounded-full">
              {record?.area === 'together' ? '两个人的' : '我自己的'}
            </Badge>
            {record?.done && (
              <Badge variant="default" className="rounded-full">
                已完成
              </Badge>
            )}
            {record?.archived && (
              <Badge variant="secondary" className="rounded-full">
                已归档
              </Badge>
            )}
          </div>

          <DetailRow label="内容">
            <p className="whitespace-pre-wrap">{record?.content}</p>
          </DetailRow>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full rounded-xl"
        onClick={() => void toggleDone()}
      >
        <CheckIcon className="mr-2 h-4 w-4" />
        {record?.done ? '标记为未完成' : '标记为已完成'}
      </Button>
    </DetailShell>
  );
}
