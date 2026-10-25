import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { LoadingText } from '@/components/common/list-parts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Anniversary {
  id: string;
  name: string;
  date: string;
  note?: string;
  is_lunar?: boolean;
  is_together?: boolean;
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** 添加 / 编辑纪念日（对齐 V1 的 /anniversaries/create） */
export function AnniversaryFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [isLunar, setIsLunar] = useState(false);
  const [isTogether, setIsTogether] = useState(false);
  const [hasTogether, setHasTogether] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // 已经存在「在一起纪念日」时，不再显示这个开关（与 V1 一致）
  useEffect(() => {
    void (async () => {
      try {
        const res = await pb.collection('anniversaries').getList(1, 1, {
          filter: 'is_together = true',
          $autoCancel: false,
        });
        setHasTogether(res.totalItems > 0);
      } catch {
        /* 忽略 */
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('anniversaries').getOne<Anniversary>(id, {
          $autoCancel: false,
        });
        setName(rec.name ?? '');
        setDate(rec.date?.slice(0, 10) ?? '');
        setNote(rec.note ?? '');
        setIsLunar(!!rec.is_lunar);
        setIsTogether(!!rec.is_together);
      } catch {
        toast.error('找不到这个纪念日');
        navigate('/anniversaries', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!name.trim() || !date) {
      toast.error('请填写名称和日期');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('date', date);
      fd.append('note', note.trim());
      fd.append('is_lunar', isLunar ? 'true' : 'false');
      fd.append('is_together', isTogether ? 'true' : 'false');

      if (isEdit) {
        await pb.collection('anniversaries').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('user', user.id);
        await pb.collection('anniversaries').create(fd);
        toast.success('已添加');
      }
      navigate('/anniversaries', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? '编辑纪念日' : '添加纪念日'}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : '添加纪念日'}
      disabled={!name.trim() || !date}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '添加中…'}
    >
      <Field label="名称 *" htmlFor="anniv-name">
        <Input
          id="anniv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：Ta的生日"
        />
      </Field>

      <Field label="日期 *" htmlFor="anniv-date">
        <Input
          id="anniv-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <SwitchRow
        id="anniv-lunar"
        label="农历日期"
        hint="日期为农历，提醒按农历计算"
        checked={isLunar}
        onChange={setIsLunar}
      />

      <Field label="备注（可选）" htmlFor="anniv-note">
        <Textarea
          id="anniv-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </Field>

      {(!hasTogether || isTogether) && (
        <SwitchRow
          id="anniv-together"
          label="设为在一起纪念日"
          hint="首页将显示在一起的天数"
          checked={isTogether}
          onChange={setIsTogether}
        />
      )}
    </FormPage>
  );
}
