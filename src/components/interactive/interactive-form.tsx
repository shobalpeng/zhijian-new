import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { SingleImageField } from '@/components/common/single-image-field';
import { LoadingText } from '@/components/common/list-parts';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl } from '@/lib/format';
import type { InteractiveKind } from '@/lib/types';

interface KindCopy {
  newTitle: string;
  editTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  descPlaceholder: string;
  pointsPlaceholder: string;
  submitLabel: string;
}

const COPY: Record<InteractiveKind, KindCopy> = {
  tasks: {
    newTitle: '发布任务',
    editTitle: '编辑任务',
    titleLabel: '任务标题',
    titlePlaceholder: '例如：打扫房间',
    descPlaceholder: '详细说明任务要求...',
    pointsPlaceholder: '完成任务可获得积分',
    submitLabel: '发布任务',
  },
  wishes: {
    newTitle: '发布心愿',
    editTitle: '编辑心愿',
    titleLabel: '心愿标题',
    titlePlaceholder: '例如：一起去看电影',
    descPlaceholder: '详细描述你的心愿...',
    pointsPlaceholder: '实现心愿需要多少积分',
    submitLabel: '发布心愿',
  },
};

const IMAGE_COLLECTION: Record<InteractiveKind, string> = {
  tasks: COLLECTION_ID.tasks,
  wishes: COLLECTION_ID.wishes,
};

/**
 * 任务 / 心愿 的新建与编辑页（对齐 V1 的 /tasks/create、/wishes/create）。
 * 归属（creator / assignee / fulfiller）由服务端钩子决定，前端不传也不允许改。
 */
export function InteractiveFormPage({ kind }: { kind: InteractiveKind }) {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const copy = COPY[kind];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [clearImage, setClearImage] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection(kind).getOne(id, { $autoCancel: false });
        setTitle(rec.title ?? '');
        setDescription(rec.description ?? '');
        setPoints(rec.points != null ? String(rec.points) : '');
        if (rec.image) setExistingImage(fileUrl(IMAGE_COLLECTION[kind], rec.id, rec.image, '600x0'));
        if (rec.status && rec.status !== 'pending') {
          toast.error('只有待完成状态可以编辑');
          navigate(`/${kind}`, { replace: true });
        }
      } catch {
        toast.error('找不到这条记录');
        navigate(`/${kind}`, { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error(`请填写${copy.titleLabel}`);
      return;
    }
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts < 1) {
      toast.error('积分需为不小于 1 的数字');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('points', String(pts));
      if (file) fd.append('image', file);
      else if (clearImage) fd.append('image', '');

      if (isEdit) {
        await pb.collection(kind).update(id!, fd);
        toast.success('已保存');
      } else {
        await pb.collection(kind).create(fd);
        toast.success('已发布');
      }
      navigate(`/${kind}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? copy.editTitle : copy.newTitle}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : copy.submitLabel}
      disabled={!title.trim() || !points}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '发布中…'}
    >
      <Field label={copy.titleLabel} htmlFor="if-title">
        <Input
          id="if-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={copy.titlePlaceholder}
        />
      </Field>

      <Field label={`${copy.titleLabel.replace('标题', '')}描述（可选）`} htmlFor="if-desc">
        <Textarea
          id="if-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={copy.descPlaceholder}
          rows={4}
        />
      </Field>

      <Field label="图片（可选）">
        <SingleImageField
          file={file}
          onChange={setFile}
          existingUrl={clearImage ? '' : existingImage}
          onClearExisting={() => {
            setExistingImage('');
            setClearImage(true);
          }}
        />
      </Field>

      <Field label="积分" htmlFor="if-points">
        <Input
          id="if-points"
          type="number"
          min={1}
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder={copy.pointsPlaceholder}
        />
      </Field>
    </FormPage>
  );
}
