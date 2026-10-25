import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { LoadingText } from '@/components/common/list-parts';
import { Textarea } from '@/components/ui/textarea';

interface Todo {
  id: string;
  content: string;
  done?: boolean;
  archived?: boolean;
  area?: string;
}

/** 编辑待办（待办原来只有列表，没有编辑页） */
export function TodoFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [content, setContent] = useState('');
  const [area, setArea] = useState<'together' | 'personal'>('together');
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('todos').getOne<Todo>(id, { $autoCancel: false });
        setContent(rec.content ?? '');
        setArea(rec.area === 'personal' ? 'personal' : 'together');
      } catch {
        toast.error('找不到这条待办');
        navigate('/todos', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!content.trim()) {
      toast.error('请输入待办内容');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('content', content.trim());
      fd.append('area', area);
      if (isEdit) {
        await pb.collection('todos').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('user', user.id);
        await pb.collection('todos').create(fd);
        toast.success('已添加');
      }
      navigate('/todos', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title="编辑待办"
      onSubmit={submit}
      submitLabel="保存修改"
      disabled={!content.trim()}
      submitting={submitting}
    >
      <Field label="内容 *" htmlFor="todo-content">
        <Textarea
          id="todo-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="要做的事"
          rows={3}
        />
      </Field>

      <Field label="归属" htmlFor="todo-area">
        <select
          id="todo-area"
          value={area}
          onChange={(e) => setArea(e.target.value as 'together' | 'personal')}
          className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="together">两个人的</option>
          <option value="personal">我自己的</option>
        </select>
      </Field>
    </FormPage>
  );
}
