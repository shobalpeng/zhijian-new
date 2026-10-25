import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { SingleImageField } from '@/components/common/single-image-field';
import { LoadingText } from '@/components/common/list-parts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl, today } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORIES = ['电子', '家居', '户外', '服饰', '其他'];

const STATUS_OPTIONS = [
  { key: 'active', label: '服役中' },
  { key: 'retired', label: '已退役' },
] as const;

interface Item {
  id: string;
  name: string;
  date: string;
  price: number;
  category?: string;
  status?: string;
  retired_date?: string;
  image?: string;
  note?: string;
}

/** 添加 / 编辑物品（对齐 V1 的 /items/create：分类 chips + 状态切换） */
export function ItemFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'active' | 'retired'>('active');
  const [note, setNote] = useState('');
  /** 已退役时的退役日期（新建时用今天，编辑时沿用原值） */
  const [retiredDate, setRetiredDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [clearImage, setClearImage] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('items').getOne<Item>(id, { $autoCancel: false });
        setName(rec.name ?? '');
        setDate(rec.date?.slice(0, 10) || today());
        setPrice(rec.price != null ? String(rec.price) : '');
        setCategory(rec.category ?? '');
        setStatus(rec.status === 'retired' ? 'retired' : 'active');
        setRetiredDate(rec.retired_date?.slice(0, 10) ?? '');
        setNote(rec.note ?? '');
        if (rec.image) setExistingImage(fileUrl(COLLECTION_ID.items, rec.id, rec.image, '600x0'));
      } catch {
        toast.error('找不到这个物品');
        navigate('/items', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!name.trim() || !price.trim()) {
      toast.error('请填写物品名和价格');
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('价格需为不小于 0 的数字');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('date', date);
      fd.append('price', String(priceNum));
      fd.append('category', category || '其他');
      fd.append('status', status);
      // 退役日期不能沿用「购买日期」（曾导致日均成本算成 1 天）
      if (status === 'retired') {
        fd.append('retired_date', retiredDate || today());
      } else {
        fd.append('retired_date', '');
      }
      fd.append('note', note.trim());
      if (file) fd.append('image', file);
      else if (clearImage) fd.append('image', '');

      if (isEdit) {
        await pb.collection('items').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('creator', user.id);
        await pb.collection('items').create(fd);
        toast.success('已添加');
      }
      navigate('/items', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? '编辑物品' : '添加物品'}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : '添加物品'}
      disabled={!name.trim() || !price.trim()}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '添加中…'}
    >
      <Field label="物品名 *" htmlFor="item-name">
        <Input
          id="item-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：iPhone 17 Pro"
        />
      </Field>

      <Field label="购买日期 *" htmlFor="item-date">
        <Input id="item-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label="价格（元）*" htmlFor="item-price">
        <Input
          id="item-price"
          type="number"
          min={0}
          // step=0.01：允许小数价格（默认 step=1 时浏览器原生校验会拦下 1774.88）
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="9000 或 1774.88"
        />
      </Field>

      <div className="space-y-2">
        <Label>分类</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? '' : c)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                category === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>状态</Label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setStatus(o.key)}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                status === o.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'retired' && (
        <Field label="退役日期" htmlFor="item-retired">
          <Input
            id="item-retired"
            type="date"
            value={retiredDate || today()}
            onChange={(e) => setRetiredDate(e.target.value)}
          />
        </Field>
      )}

      <Field label="照片（可选）">
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

      <Field label="备注（可选）" htmlFor="item-note">
        <Textarea
          id="item-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </Field>
    </FormPage>
  );
}
