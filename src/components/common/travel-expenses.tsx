import { useMemo } from 'react';
import {
  BanknotesIcon,
  MapPinIcon,
  TicketIcon,
  TrashIcon,
  TruckIcon,
  BuildingOfficeIcon,
  ShoppingBagIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/format';

/**
 * 旅游模块的「花费」视图（对齐 V1 的 ExpenseSummary + ExpenseList）。
 *
 * 语义与 V1 一致：
 * - payer='me' 指的是**目的地创建者**付的钱；换个视角看就是「Ta 付」。
 * - 因此全局汇总时，要按每条花费所属目的地的 creator 来判断谁出的钱，
 *   不能简单地把 payer='me' 当成「我」。
 */

export interface TravelExpense {
  id: string;
  destination: string;
  category: string;
  amount: number;
  payer: 'me' | 'partner';
  note?: string;
}

/** 汇总与分组只需要目的地的 id / 名称 / 创建者 */
export interface ExpenseDestination {
  id: string;
  name: string;
  creator?: string;
}

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  transport: '交通',
  accommodation: '住宿',
  dining: '餐饮',
  tickets: '门票',
  shopping: '购物',
  other: '其他',
};

const CATEGORY_ICON: Record<string, typeof TruckIcon> = {
  transport: TruckIcon,
  accommodation: BuildingOfficeIcon,
  dining: BanknotesIcon,
  tickets: TicketIcon,
  shopping: ShoppingBagIcon,
  other: EllipsisHorizontalIcon,
};

/** 一笔花费在「当前查看者」视角下是谁付的 */
export interface ResolvedExpense {
  expense: TravelExpense;
  /** 当前查看者付的钱 */
  mine: number;
  /** 对方付的钱 */
  theirs: number;
  /** 当前查看者是不是这个目的地的创建者 */
  isCreator: boolean;
  /** 这笔钱是不是当前查看者付的（比金额更可靠，金额为 0 时也不会误判） */
  paidByMe: boolean;
}

/**
 * 把原始花费翻译成当前查看者视角。
 *
 * payer 字段以「目的地创建者」为参照，所以：
 * - 目的地是当前用户建的 → payer='me' 是我付的
 * - 目的地是对方建的     → payer='me' 是对方付的
 */
export function resolveExpenses(
  expenses: TravelExpense[],
  destinations: ExpenseDestination[],
  currentUserId?: string,
): ResolvedExpense[] {
  const creatorOf = new Map(destinations.map((d) => [d.id, d.creator]));
  return expenses.map((expense) => {
    const creator = creatorOf.get(expense.destination);
    const isCreator = !!currentUserId && creator === currentUserId;
    const amount = expense.amount || 0;
    // 我付的是「对方创建的目的地里 payer='partner' 的那些」或「我创建的里 payer='me' 的那些」
    const paidByMe = isCreator ? expense.payer === 'me' : expense.payer === 'partner';
    return {
      expense,
      mine: paidByMe ? amount : 0,
      theirs: paidByMe ? 0 : amount,
      isCreator,
      paidByMe,
    };
  });
}

/** 全局结算摘要（对齐 V1 的 ExpenseSummary） */
export function ExpenseSummary({
  expenses,
  destinations,
  currentUserId,
}: {
  expenses: TravelExpense[];
  destinations: ExpenseDestination[];
  currentUserId?: string;
}) {
  const { total, mine, theirs } = useMemo(() => {
    const resolved = resolveExpenses(expenses, destinations, currentUserId);
    return {
      total: resolved.reduce((s, r) => s + (r.expense.amount || 0), 0),
      mine: resolved.reduce((s, r) => s + r.mine, 0),
      theirs: resolved.reduce((s, r) => s + r.theirs, 0),
    };
  }, [expenses, destinations, currentUserId]);

  if (total === 0) return null;

  const minePct = total > 0 ? Math.round((mine / total) * 100) : 0;
  const theirsPct = total > 0 ? Math.round((theirs / total) * 100) : 0;
  const diff = Math.abs(mine - theirs);
  // 【修 V1 的 bug】V1 里 myTotal > partnerTotal 时文案显示「Ta多付了」，方向反了
  const who = mine > theirs ? '我' : 'Ta';

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="mb-3 text-sm font-medium">结算摘要</p>

      <div className="mb-3 text-center">
        <span className="text-2xl font-bold tabular-nums text-primary">
          {formatMoney(total)}
        </span>
        <p className="text-xs text-muted-foreground">总花费</p>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <span className="w-8 text-xs">我</span>
        <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-sky-500 transition-all"
            style={{ width: `${minePct}%` }}
          />
        </div>
        <span className="w-16 text-right text-xs tabular-nums">{formatMoney(mine)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs">Ta</span>
        <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${theirsPct}%` }}
          />
        </div>
        <span className="w-16 text-right text-xs tabular-nums">{formatMoney(theirs)}</span>
      </div>

      {diff > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {who}多付了 {formatMoney(diff)}，结算时对方转 {formatMoney(diff / 2)}
        </p>
      )}
    </div>
  );
}

/** 按目的地分组的花费列表（对齐 V1 的 ExpenseList） */
export function ExpenseGroupList({
  expenses,
  destinations,
  currentUserId,
  onRemove,
}: {
  expenses: TravelExpense[];
  destinations: ExpenseDestination[];
  currentUserId?: string;
  onRemove?: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const nameOf = new Map(destinations.map((d) => [d.id, d.name]));
    const map = new Map<string, ResolvedExpense[]>();
    for (const resolved of resolveExpenses(expenses, destinations, currentUserId)) {
      const key = resolved.expense.destination;
      const list = map.get(key) ?? [];
      list.push(resolved);
      map.set(key, list);
    }
    // 按目的地名称排序，找不到名称的排在最后
    return [...map.entries()]
      .map(([destId, list]) => ({
        destId,
        name: nameOf.get(destId) ?? '未知目的地',
        list,
        total: list.reduce((s, r) => s + (r.expense.amount || 0), 0),
        mine: list.reduce((s, r) => s + r.mine, 0),
        theirs: list.reduce((s, r) => s + r.theirs, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, destinations, currentUserId]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.destId} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="flex min-w-0 items-center gap-1 text-sm font-medium">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{g.name}</span>
            </h4>
            <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
              {formatMoney(g.total)}
            </span>
          </div>

          <div className="mb-2 flex gap-3 text-xs text-muted-foreground">
            <span>我付：{formatMoney(g.mine)}</span>
            <span>Ta付：{formatMoney(g.theirs)}</span>
          </div>

          <div className="space-y-1.5">
            {g.list.map((r) => {
              const Icon = CATEGORY_ICON[r.expense.category] ?? EllipsisHorizontalIcon;
              return (
                <div key={r.expense.id} className="flex items-center gap-2 text-sm">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Badge variant="secondary" className="shrink-0 rounded-full text-xs">
                    {EXPENSE_CATEGORY_LABEL[r.expense.category] ?? r.expense.category}
                  </Badge>
                  {r.expense.note && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {r.expense.note}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs tabular-nums">
                    {formatMoney(r.expense.amount)}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {r.paidByMe ? '我' : 'Ta'}
                  </span>
                  {onRemove && (
                    <button
                      type="button"
                      aria-label="删除"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(r.expense.id)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
