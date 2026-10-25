import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { FormPage, Field } from '@/components/common/form-page';
import { SingleImageField } from '@/components/common/single-image-field';
import { LoadingText } from '@/components/common/list-parts';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COLLECTION_ID, fileUrl } from '@/lib/format';

interface Recipe {
  id: string;
  title: string;
  cover_image?: string;
  ingredients?: string;
  steps?: string;
}

/** 添加 / 编辑菜谱（对齐 V1 的 /recipes/create） */
export function RecipeFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState('');
  const [clearImage, setClearImage] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const rec = await pb.collection('recipes').getOne<Recipe>(id, { $autoCancel: false });
        setTitle(rec.title ?? '');
        setIngredients(rec.ingredients ?? '');
        setSteps(rec.steps ?? '');
        if (rec.cover_image) {
          setExistingImage(fileUrl(COLLECTION_ID.recipes, rec.id, rec.cover_image));
        }
      } catch {
        toast.error('找不到这个菜谱');
        navigate('/recipes', { replace: true });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error('请输入菜名');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('ingredients', ingredients.trim());
      fd.append('steps', steps.trim());
      if (file) fd.append('cover_image', file);
      else if (clearImage) fd.append('cover_image', '');

      if (isEdit) {
        await pb.collection('recipes').update(id!, fd);
        toast.success('已保存');
      } else {
        if (user?.id) fd.append('creator', user.id);
        await pb.collection('recipes').create(fd);
        toast.success('已添加');
      }
      navigate('/recipes', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingText />;

  return (
    <FormPage
      title={isEdit ? '编辑菜谱' : '添加菜谱'}
      onSubmit={submit}
      submitLabel={isEdit ? '保存修改' : '添加菜谱'}
      disabled={!title.trim()}
      submitting={submitting}
      submittingLabel={isEdit ? '保存中…' : '添加中…'}
    >
      <Field label="菜名 *" htmlFor="recipe-title">
        <Input
          id="recipe-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="如：可乐鸡翅"
        />
      </Field>

      <Field label="封面图片（可选）">
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

      <Field label="食材清单" htmlFor="recipe-ingredients">
        <Textarea
          id="recipe-ingredients"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          placeholder={'主料：\n调料：'}
          rows={4}
        />
      </Field>

      <Field label="烹饪步骤" htmlFor="recipe-steps">
        <Textarea
          id="recipe-steps"
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={'1. \n2. \n3. '}
          rows={5}
        />
      </Field>
    </FormPage>
  );
}
