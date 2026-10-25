import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { LoadingText } from '@/components/common/list-parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl, formatMoney, today } from '@/lib/format';

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

/** 味道评分：可点选，再点同一颗取消（与 V1 RatingPicker 一致） */
function RatingStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} 星`}
          onClick={() => onChange(value === star ? 0 : star)}
          onMouseEnter={() => setHover(star)}
          className="p-0.5 transition-colors"
        >
          {star <= display ? (
            <StarSolidIcon className="h-7 w-7 text-amber-400" />
          ) : (
            <StarIcon className="h-7 w-7 text-muted-foreground/30" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * 记录 / 编辑聚餐（对齐 V1 的独立整页表单）：
 * 餐厅名、日期、照片（虚线框多图）、参与人、菜品、总价/人数/人均一行、味道评分、点评、底部整宽按钮。
 *
 * 路由：/dines/new（新建）与 /dines/:id/edit（编辑）共用。
 */
export function DineFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState('');
  const [date, setDate] = useState(today());
  const [people, setPeople] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [dishes, setDishes] = useState('');
  const [cost, setCost] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  /** 已有图片的**文件名**：编辑提交时要一并回传，否则 PocketBase 会删掉未提交的原图 */
  const [existingFiles, setExistingFiles] = useState<string[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  // 编辑态：读取原记录回填
  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('dines').getOne<Dine>(id, { $autoCancel: false });
        setRestaurant(rec.restaurant ?? '');
        setDate(rec.date?.slice(0, 10) || today());
        setPeople(rec.people ?? '');
        setPeopleCount(rec.people_count != null ? String(rec.people_count) : '');
        setDishes(rec.dishes ?? '');
        setCost(rec.cost != null ? String(rec.cost) : '');
        setRating(rec.rating ?? 0);
        setComment(rec.comment ?? '');
        setExistingFiles(Array.isArray(rec.images) ? rec.images : []);
      } catch {
        toast.error('找不到这条记录');
        navigate('/dines', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const perPerson =
    cost && peopleCount && Number(cost) > 0 && Number(peopleCount) > 0
      ? Number(cost) / Number(peopleCount)
      : null;

  const submit = async () => {
    if (!restaurant.trim() || !date) {
      toast.error('请填写餐厅和日期');
      return;
    }
    // number 输入框在 type=number 下仍可能被输入 e/符号，先做有限性校验
    const costNum = cost.trim() ? Number(cost) : null;
    if (costNum !== null && (!Number.isFinite(costNum) || costNum < 0)) {
      toast.error('总价需为不小于 0 的数字');
      return;
    }
    const countNum = peopleCount.trim() ? Number(peopleCount) : null;
    if (countNum !== null && (!Number.isFinite(countNum) || countNum < 1)) {
      toast.error('人数需为不小于 1 的数字');
      return;
    }
    const ratingNum = rating > 0 ? rating : null;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('restaurant', restaurant.trim());
      fd.append('date', date);
      if (people.trim()) fd.append('people', people.trim());
      if (countNum !== null) fd.append('people_count', String(countNum));
      if (dishes.trim()) fd.append('dishes', dishes.trim());
      if (costNum !== null) fd.append('cost', String(costNum));
      if (ratingNum !== null) fd.append('rating', String(ratingNum));
      if (comment.trim()) fd.append('comment', comment.trim());

      // ⚠️ PocketBase 的多文件字段是「整体替换」语义：只传新文件会删掉原图。
      // 编辑时先把要保留的原文件名回传，再追加新选择的文件。
      if (isEdit) {
        existingFiles.forEach((name) => fd.append('images', name));
      }
      files.forEach((f) => fd.append('images', f));

      if (isEdit) {
        await pb.collection('dines').update(id!, fd);
        toast.success('已保存');
        navigate(`/dines/${id}`, { replace: true });
      } else {
        if (user?.id) fd.append('creator', user.id);
        await pb.collection('dines').create(fd);
        toast.success('已记录');
        navigate('/dines', { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 pb-4 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label="返回"
          onClick={() => navigate(-1)}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {isEdit ? '编辑聚餐' : '记录聚餐'}
        </h1>
      </header>

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="dine-restaurant">餐厅名 *</Label>
          <Input
            id="dine-restaurant"
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
            placeholder="如：海底捞"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dine-date">聚餐日期 *</Label>
          <Input
            id="dine-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>照片</Label>
          <ImageUploadField
            files={files}
            onChange={setFiles}
            existingImages={existingFiles.map((name) => ({
              name,
              url: fileUrl(COLLECTION_ID.dines, id!, name, '600x0'),
            }))}
            onRemoveExisting={(name) =>
              setExistingFiles((prev) => prev.filter((n) => n !== name))
            }
            max={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dine-people">参与人</Label>
          <Input
            id="dine-people"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="如：和Ta、小李"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dine-dishes">菜品</Label>
          <Input
            id="dine-dishes"
            value={dishes}
            onChange={(e) => setDishes(e.target.value)}
            placeholder="如：烤鸭、酸菜鱼"
          />
        </div>

        {/* 总价 / 人数 / 人均 一行三列（人均自动算） */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <span className="shrink-0 text-sm font-medium">总价</span>
            <Input
              id="dine-cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0"
              className="h-7 w-16 text-xs"
            />
            <span className="text-xs text-muted-foreground">元</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="shrink-0 text-sm font-medium">人数</span>
            <Input
              id="dine-count"
              type="number"
              inputMode="numeric"
              min="1"
              value={peopleCount}
              onChange={(e) => setPeopleCount(e.target.value)}
              placeholder="0"
              className="h-7 w-16 text-xs"
            />
            <span className="text-xs text-muted-foreground">人</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="shrink-0 text-sm font-medium">人均</span>
            <span className="text-sm font-medium tabular-nums text-primary">
              {perPerson ? `${formatMoney(Math.round(perPerson * 10) / 10)}元` : '—'}
            </span>
          </span>
        </div>

        <div className="space-y-2">
          <Label>味道评分</Label>
          <RatingStars value={rating} onChange={setRating} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dine-comment">点评</Label>
          <Textarea
            id="dine-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="如：涮毛肚绝了"
            rows={3}
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting || !restaurant.trim() || !date}
            className="w-full rounded-xl"
          >
            {submitting ? '保存中…' : isEdit ? '保存修改' : '记录聚餐'}
          </Button>
        </div>
      </form>
    </div>
  );
}
