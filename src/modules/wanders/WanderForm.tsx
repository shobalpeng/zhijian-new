import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { LoadingText } from '@/components/common/list-parts';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl, today } from '@/lib/format';

interface Wander {
  id: string;
  location: string;
  date: string;
  mood?: string;
  images?: string[];
}

/** 记录 / 编辑漫游（对齐 V1 的 /wanders/create） */
export function WanderFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [location, setLocation] = useState('');
  const [date, setDate] = useState(today());
  const [mood, setMood] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  /** 已有图片文件名：编辑提交时必须回传，否则会被 PocketBase 整字段替换掉 */
  const [existingFiles, setExistingFiles] = useState<string[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('wanders').getOne<Wander>(id, { $autoCancel: false });
        setLocation(rec.location ?? '');
        setDate(rec.date?.slice(0, 10) || today());
        setMood(rec.mood ?? '');
        setExistingFiles(Array.isArray(rec.images) ? rec.images : []);
      } catch {
        toast.error('找不到这条记录');
        navigate('/wanders', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!location.trim() || !date) {
      toast.error('请填写地点和日期');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('location', location.trim());
      fd.append('date', date);
      fd.append('mood', mood.trim());
      // 多文件字段是整体替换语义：编辑时先回传保留的原图
      if (isEdit) {
        existingFiles.forEach((name) => fd.append('images', name));
      }
      files.forEach((f) => fd.append('images', f));

      if (isEdit) {
        await pb.collection('wanders').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('creator', user.id);
        await pb.collection('wanders').create(fd);
        toast.success('已记录');
      }
      navigate('/wanders', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? '编辑漫游' : '记录漫游'}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : '记录'}
      disabled={!location.trim() || !date}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '记录中…'}
    >
      <Field label="地点 *" htmlFor="wander-location">
        <Input
          id="wander-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="如：西湖"
        />
      </Field>

      <Field label="日期 *" htmlFor="wander-date">
        <Input
          id="wander-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <Field label="照片（可选）">
        <ImageUploadField
          files={files}
          onChange={setFiles}
          existingImages={existingFiles.map((name) => ({
            name,
            url: fileUrl(COLLECTION_ID.wanders, id!, name, '300x0'),
          }))}
          onRemoveExisting={(name) => setExistingFiles((prev) => prev.filter((n) => n !== name))}
          max={9}
        />
      </Field>

      <Field label="心情" htmlFor="wander-mood">
        <Textarea
          id="wander-mood"
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="今天天气真好"
          rows={3}
        />
      </Field>
    </FormPage>
  );
}
