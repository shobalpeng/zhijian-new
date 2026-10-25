import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { pb } from '@/lib/pocketbase';
import { DetailRow, DetailShell } from '@/components/common/detail-shell';
import { CoverImage } from '@/components/common/list-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormDialog } from '@/components/common/form-dialog';
import { COLLECTION_ID, formatDate, formatMoney, today } from '@/lib/format';
import { useAuth } from '@/components/auth-provider';
import type { FieldDef } from '@/components/common/form-dialog';

interface Destination {
  id: string;
  name: string;
  city?: string;
  status: string;
  cover_image?: string;
  tagline?: string;
  places_to_visit?: string;
  itinerary_draft?: string;
  budget_estimate?: number;
  notes?: string;
  visited_at?: string;
  creator?: string;
}

interface Expense {
  id: string;
  destination: string;
  category: string;
  amount: number;
  payer: 'me' | 'partner';
  note?: string;
}

export const EXPENSE_FIELDS: FieldDef[] = [
  {
    name: 'category',
    label: '类别',
    type: 'select',
    required: true,
    options: [
      { label: '交通', value: 'transport' },
      { label: '住宿', value: 'accommodation' },
      { label: '餐饮', value: 'dining' },
      { label: '门票', value: 'tickets' },
      { label: '购物', value: 'shopping' },
      { label: '其他', value: 'other' },
    ],
  },
  { name: 'amount', label: '金额', type: 'number', required: true, min: 0, placeholder: '元' },
  {
    name: 'payer',
    label: '付款方',
    type: 'select',
    required: true,
    options: [
      { label: '我', value: 'me' },
      { label: 'Ta', value: 'partner' },
    ],
  },
  { name: 'note', label: '备注', type: 'text' },
];

export const CATEGORY_LABEL: Record<string, string> = {
  transport: '交通',
  accommodation: '住宿',
  dining: '餐饮',
  tickets: '门票',
  shopping: '购物',
  other: '其他',
};

/** 目的地详情：想去的地方、行程草稿、花费明细与结算，可编辑或删除 */
export function DestinationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dest, setDest] = useState<Destination | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rec = await pb.collection('destinations').getOne<Destination>(id, { $autoCancel: false });
        if (alive) setDest(rec);
        const exps = await pb
          .collection('expenses')
          .getList<Expense>(1, 200, { filter: `destination = "${id}"`, $autoCancel: false });
        if (alive) setExpenses(exps.items);
      } catch {
        toast.error('找不到这个目的地');
        navigate('/travel', { replace: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const mine = expenses;
  const isCreator = !!dest && dest.creator === user?.id;

  const creatorPaid = mine
    .filter((e) => e.payer === 'me')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const partnerPaid = mine
    .filter((e) => e.payer === 'partner')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const myTotal = isCreator ? creatorPaid : partnerPaid;
  const partnerTotal = isCreator ? partnerPaid : creatorPaid;
  const total = myTotal + partnerTotal;
  const diff = Math.abs(myTotal - partnerTotal);
  const who = myTotal > partnerTotal ? '我' : 'Ta';

  const remove = async () => {
    try {
      await pb.collection('destinations').delete(id);
      toast.success('已删除');
      navigate('/travel', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const markVisited = async () => {
    try {
      await pb.collection('destinations').update(id, { status: 'visited', visited_at: today() });
      toast.success('已标记为去过');
      setDest((d) => (d ? { ...d, status: 'visited', visited_at: today() } : d));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const submitExpense = async (fd: FormData) => {
    // payer 以「目的地创建者」为参照：非创建者填写时要互换，否则结算方向会反
    if (dest?.creator !== user?.id) {
      const picked = String(fd.get('payer') ?? 'me');
      fd.set('payer', picked === 'me' ? 'partner' : 'me');
    }
    fd.append('destination', id);
    await pb.collection('expenses').create(fd);
    const exps = await pb
      .collection('expenses')
      .getList<Expense>(1, 200, { filter: `destination = "${id}"`, $autoCancel: false });
    setExpenses(exps.items);
    setExpenseOpen(false);
  };

  return (
    <>
      <DetailShell
        title={dest?.name ?? '目的地'}
        loading={loading}
        hasRecord={!!dest}
        editTo={`/travel/${id}/edit`}
        onDelete={remove}
        deleteTitle="删除这个目的地？"
      >
        {dest?.cover_image && (
          <CoverImage
            collectionId={COLLECTION_ID.destinations}
            recordId={dest.id}
            file={dest.cover_image}
            className="max-h-64 w-full"
          />
        )}

        <Card className="rounded-2xl">
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {dest?.city && <span className="text-muted-foreground">{dest.city}</span>}
              <Badge variant="secondary" className="rounded-full">
                {dest?.status === 'visited' ? '去过' : '想去'}
              </Badge>
              {dest?.visited_at && (
                <span className="text-muted-foreground">{formatDate(dest.visited_at)}</span>
              )}
              {dest?.budget_estimate ? (
                <span className="text-muted-foreground">
                  预算 {formatMoney(dest.budget_estimate)}
                </span>
              ) : null}
            </div>

            {dest?.places_to_visit && (
              <DetailRow label="想去的地方">
                <p className="whitespace-pre-wrap">{dest.places_to_visit}</p>
              </DetailRow>
            )}
            {dest?.itinerary_draft && (
              <DetailRow label="行程草稿">
                <p className="whitespace-pre-wrap">{dest.itinerary_draft}</p>
              </DetailRow>
            )}
            {dest?.notes && (
              <DetailRow label="备注">
                <p className="whitespace-pre-wrap">{dest.notes}</p>
              </DetailRow>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">花费</p>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setExpenseOpen(true)}>
                <PlusIcon className="mr-1 h-4 w-4" />
                记一笔
              </Button>
            </div>

            {mine.length === 0 ? (
              <p className="text-xs text-muted-foreground">还没有记录花费</p>
            ) : (
              <>
                <div className="space-y-1">
                  {mine.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {CATEGORY_LABEL[e.category] ?? e.category}
                        </Badge>
                        <span className="truncate text-muted-foreground">{e.note || '—'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums">{formatMoney(e.amount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {(e.payer === 'me') === isCreator ? '我' : 'Ta'}
                        </span>
                        <button
                          type="button"
                          aria-label="删除"
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            await pb.collection('expenses').delete(e.id);
                            setExpenses((list) => list.filter((x) => x.id !== e.id));
                            toast.success('已删除');
                          }}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 border-t pt-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">合计</span>
                    <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">我 / Ta</span>
                    <span className="tabular-nums">
                      {formatMoney(myTotal)} / {formatMoney(partnerTotal)}
                    </span>
                  </div>
                  {diff > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {who}多付了 {formatMoney(diff)}，结算时对方转 {formatMoney(diff / 2)}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {dest?.status === 'wishlist' && (
          <Button variant="outline" className="w-full rounded-xl" onClick={() => void markVisited()}>
            标记为去过
          </Button>
        )}
      </DetailShell>

      <FormDialog
        title="记一笔花费"
        fields={EXPENSE_FIELDS}
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        onSubmit={submitExpense}
        submitLabel="记录"
      />
    </>
  );
}
