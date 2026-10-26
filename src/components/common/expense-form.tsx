import { useState } from 'react';
import { toast } from 'sonner';
import {
  BanknotesIcon,
  BuildingOfficeIcon,
  EllipsisHorizontalIcon,
  MapPinIcon,
  ShoppingBagIcon,
  TicketIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * 「添加花费」表单（对齐 V1 的 ExpenseList / 详情页内联表单）。
 *
 * V1 是在页面里内联展开、一次填完（目的地 + 类别 + 金额 + 付款方 + 备注），
 * 且有默认值：类别「餐饮」、付款方「我」。这里保持同样的交互与默认值。
 */

export interface ExpenseDestinationOption {
  id: string;
  name: string;
  city?: string;
}

export const EXPENSE_CATEGORIES = [
  { value: 'transport', label: '交通', icon: TruckIcon },
  { value: 'accommodation', label: '住宿', icon: BuildingOfficeIcon },
  { value: 'dining', label: '餐饮', icon: BanknotesIcon },
  { value: 'tickets', label: '门票', icon: TicketIcon },
  { value: 'shopping', label: '购物', icon: ShoppingBagIcon },
  { value: 'other', label: '其他', icon: EllipsisHorizontalIcon },
] as const;

export interface ExpenseFormValue {
  destination: string;
  category: string;
  amount: number;
  payer: 'me' | 'partner';
  note: string;
}

export function ExpenseForm({
  destinations,
  /** 固定目的地（从详情页进入时锁定，不显示下拉） */
  fixedDestinationId,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = '添加',
}: {
  destinations: ExpenseDestinationOption[];
  fixedDestinationId?: string;
  onSubmit: (value: ExpenseFormValue) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [destination, setDestination] = useState(fixedDestinationId ?? '');
  const [category, setCategory] = useState<string>('dining');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!destination) {
      toast.error('请选择目的地');
      return;
    }
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n < 0) {
      toast.error('请填写金额');
      return;
    }

    await onSubmit({
      destination,
      category,
      amount: n,
      payer,
      note: note.trim(),
    });
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4">
      <p className="text-sm font-medium">添加花费</p>

      {/* 目的地：详情页进入时锁定，只读展示 */}
      {fixedDestinationId ? (
        <div className="space-y-2">
          <Label>目的地</Label>
          <p className="flex items-center gap-1 rounded-xl bg-muted/40 px-3 py-2 text-sm">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {destinations.find((d) => d.id === fixedDestinationId)?.name ?? '当前目的地'}
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="expense-dest">目的地</Label>
          <select
            id="expense-dest"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-xl border border-transparent bg-input/60 px-3.5 py-2.5 text-sm"
          >
            <option value="">选择目的地</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 类别：按钮组（同 V1） */}
      <div className="space-y-2">
        <Label>类别</Label>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                category === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="expense-amount">金额</Label>
          <Input
            id="expense-amount"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金额"
          />
        </div>
        <div className="w-24 space-y-2">
          <Label htmlFor="expense-payer">付款方</Label>
          <select
            id="expense-payer"
            value={payer}
            onChange={(e) => setPayer(e.target.value as 'me' | 'partner')}
            className="w-full rounded-xl border border-transparent bg-input/60 px-3.5 py-2.5 text-sm"
            aria-label="付款方"
          >
            <option value="me">我</option>
            <option value="partner">Ta</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-note">备注（可选）</Label>
        <Input
          id="expense-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
        />
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button className="flex-1 rounded-xl" onClick={() => void submit()} disabled={submitting}>
          {submitting ? '添加中…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}
