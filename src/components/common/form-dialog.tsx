import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * 内容模块共用的「配置化表单弹窗」。
 *
 * V1 里 recipes/wanders/dines/items 等页面各自手写了一遍表单与列表骨架（大量重复）；
 * 这里把字段声明成数据，一个组件覆盖所有内容模块的新建/编辑。
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'rating'
  | 'image'
  | 'images'
  | 'switch';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  min?: number;
  max?: number;
  /** 新建时的默认值（如 status 默认 active） */
  defaultValue?: string;
}

function StarRating({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} 分`}
          onClick={() => onChange(n === value ? 0 : n)}
          className="rounded p-0.5"
        >
          {n <= value ? (
            <StarSolidIcon className="h-6 w-6 text-amber-400" />
          ) : (
            <StarIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}

function initialValues(fields: FieldDef[], initial?: Record<string, unknown> | null) {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const raw = initial?.[f.name];
    if (f.type === 'switch') {
      values[f.name] = raw === true || raw === 'true' ? 'true' : 'false';
    } else if ((raw === undefined || raw === null || raw === '') && f.defaultValue !== undefined) {
      values[f.name] = f.defaultValue;
    } else if (raw === undefined || raw === null) {
      values[f.name] = '';
    } else if (f.type === 'date') {
      values[f.name] = String(raw).slice(0, 10);
    } else {
      values[f.name] = String(raw);
    }
  }
  return values;
}

export interface FormDialogProps {
  title: string;
  description?: string;
  fields: FieldDef[];
  /** 编辑时传入已有记录；文件字段留空表示保留原文件 */
  initial?: Record<string, unknown> | null;
  onSubmit: (data: FormData) => Promise<unknown>;
  trigger?: React.ReactNode;
  triggerLabel?: string;
  submitLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FormDialog({
  title,
  description,
  fields,
  initial,
  onSubmit,
  trigger,
  triggerLabel,
  submitLabel = '保存',
  open: controlledOpen,
  onOpenChange,
}: FormDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    setUncontrolledOpen(v);
  };

  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initialValues(fields, initial));
      setFiles({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const setValue = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    const fd = new FormData();

    for (const f of fields) {
      if (f.type === 'image' || f.type === 'images') {
        const list = files[f.name] ?? [];
        if (f.type === 'images') {
          list.forEach((file) => fd.append(f.name, file));
        } else if (list[0]) {
          fd.append(f.name, list[0]);
        }
        continue;
      }

      const raw = (values[f.name] ?? '').trim();

      if (f.type === 'switch') {
        fd.append(f.name, values[f.name] === 'true' ? 'true' : 'false');
        continue;
      }

      if (f.type === 'number' || f.type === 'rating') {
        if (raw === '') {
          // number 字段 required 时传 0 会被判为 blank，空值直接不提交
          if (f.required) {
            toast.error(`请填写${f.label}`);
            return;
          }
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          toast.error(`${f.label}需为数字`);
          return;
        }
        if (f.min !== undefined && n < f.min) {
          toast.error(`${f.label}不能小于 ${f.min}`);
          return;
        }
        if (f.max !== undefined && n > f.max) {
          toast.error(`${f.label}不能大于 ${f.max}`);
          return;
        }
        fd.append(f.name, String(n));
        continue;
      }

      if (raw === '') {
        if (f.required) {
          toast.error(`请填写${f.label}`);
          return;
        }
        continue;
      }

      fd.append(f.name, raw);
    }

    setBusy(true);
    try {
      await onSubmit(fd);
      toast.success('已保存');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 不用 DialogTrigger：受控（?new=1）时 Trigger 无法改写 open，统一走 setOpen */}
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : triggerLabel ? (
        <Button className="rounded-xl" onClick={() => setOpen(true)}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {triggerLabel}
        </Button>
      ) : null}

      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/* Radix 要求 DialogContent 必须有 description，否则控制台会警告。
              没传 description 时用 sr-only 的占位文案兜底（只给读屏器听，不显示）。 */}
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-2">
              {f.type === 'switch' ? (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
                  <Switch
                    id={`f-${f.name}`}
                    checked={values[f.name] === 'true'}
                    onCheckedChange={(v) => setValue(f.name, v ? 'true' : 'false')}
                  />
                </div>
              ) : (
                <>
                  <Label htmlFor={`f-${f.name}`}>
                    {f.label}
                    {f.required && <span className="ml-0.5 text-destructive">*</span>}
                  </Label>

                  {f.type === 'text' && (
                    <Input
                      id={`f-${f.name}`}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValue(f.name, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}

                  {f.type === 'textarea' && (
                    <Textarea
                      id={`f-${f.name}`}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValue(f.name, e.target.value)}
                      rows={f.rows ?? 3}
                      placeholder={f.placeholder}
                    />
                  )}

                  {f.type === 'number' && (
                    <Input
                      id={`f-${f.name}`}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValue(f.name, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}

                  {f.type === 'date' && (
                    <Input
                      id={`f-${f.name}`}
                      type="date"
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValue(f.name, e.target.value)}
                    />
                  )}

                  {f.type === 'select' && (
                    <Select
                      value={values[f.name] ?? ''}
                      onValueChange={(v) => setValue(f.name, v)}
                    >
                      <SelectTrigger id={`f-${f.name}`} className="rounded-xl">
                        <SelectValue placeholder={f.placeholder ?? '请选择'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {f.type === 'rating' && (
                    <StarRating
                      value={Number(values[f.name] ?? 0)}
                      onChange={(v) => setValue(f.name, v ? String(v) : '')}
                      max={f.max ?? 5}
                    />
                  )}

                  {(f.type === 'image' || f.type === 'images') && (
                    <Input
                      id={`f-${f.name}`}
                      type="file"
                      accept="image/*"
                      multiple={f.type === 'images'}
                      onChange={(e) =>
                        setFiles((prev) => ({
                          ...prev,
                          [f.name]: Array.from(e.target.files ?? []),
                        }))
                      }
                    />
                  )}
                </>
              )}

              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            className={cn('rounded-xl')}
            disabled={busy}
            onClick={() => void submit()}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
