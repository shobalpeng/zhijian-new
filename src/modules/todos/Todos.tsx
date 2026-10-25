import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArchiveBoxIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/auth-provider';
import { useCollection } from '@/hooks/use-collection';
import { useNewRecord } from '@/hooks/use-new-record';
import { EmptyState, LoadMoreButton, LoadingText, PageHeader } from '@/components/common/list-parts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Todo {
  id: string;
  content: string;
  done?: boolean;
  archived?: boolean;
  area: 'together' | 'personal';
  user?: string;
  sort_order: number;
}

export function TodosPage() {
  const { user } = useAuth();
  const list = useCollection<Todo>('todos', { sort: 'sort_order' });

  const { open: newOpen, setOpen: setNewOpen } = useNewRecord();
  const [draft, setDraft] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<'together' | 'personal'>('together');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 底部「+」进来时直接聚焦输入框（待办没有弹窗，写一条就行）
  useEffect(() => {
    if (!newOpen) return;
    inputRef.current?.focus();
    setNewOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOpen]);

  /**
   * 输入框随内容自动增高（与 V1 的 textarea 一致），超高后在框内滚动。
   * 依赖 area：切换分栏时 Radix 会挂载另一个 textarea，需要重新计算高度。
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const full = el.scrollHeight;
    // 高度直接取内容高度（多留 1px 下限会出现常驻滚动条）；超过 160px 才在框内滚动
    el.style.height = `${Math.min(full, 160)}px`;
    el.style.overflowY = full > 160 ? 'auto' : 'hidden';
  }, [draft, area]);

  const byArea = useMemo(() => {
    const pick = (area: 'together' | 'personal') =>
      list.records
        .filter((t) => t.area === area && (showArchived ? t.archived : !t.archived))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { together: pick('together'), personal: pick('personal') };
  }, [list.records, showArchived]);

  /** 分组条数按全量统计（列表仍是分页加载的） */
  const countByArea = useMemo(() => {
    const all = list.allRecords.length ? list.allRecords : list.records;
    const visible = all.filter((t) => (showArchived ? t.archived : !t.archived));
    return {
      together: visible.filter((t) => t.area === 'together').length,
      personal: visible.filter((t) => t.area === 'personal').length,
    };
  }, [list.allRecords, list.records, showArchived]);

  const add = async (area: 'together' | 'personal') => {
    const content = draft.trim();
    if (!content) {
      toast.error('先写点什么');
      return;
    }
    setBusy(true);
    try {
      const max = list.records
        .filter((t) => t.area === area)
        .reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
      await list.create({
        content,
        area,
        user: user?.id ?? '',
        done: false,
        archived: false,
        sort_order: max + 1,
      });
      setDraft('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '新增失败');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t: Todo) => {
    try {
      await list.update(t.id, { done: !t.done });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const archive = async (t: Todo) => {
    try {
      await list.update(t.id, { archived: !t.archived });
      toast.success(t.archived ? '已恢复' : '已归档');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  /** 与相邻项交换 sort_order */
  const move = async (rows: Todo[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[index];
    const b = rows[target];
    try {
      await list.update(a.id, { sort_order: b.sort_order ?? 0 });
      await list.update(b.id, { sort_order: a.sort_order ?? 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '排序失败');
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="待办"
        subtitle="一起的 / 各自的"
        action={
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowArchived((v) => !v)}
          >
            <ArchiveBoxIcon className="mr-1 h-4 w-4" />
            {showArchived ? '看未归档' : '看归档'}
          </Button>
        }
      />

      {list.loading && list.records.length === 0 ? (
        <LoadingText />
      ) : (
        <Tabs value={area} onValueChange={(v) => setArea(v as 'together' | 'personal')}>
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="together" className="rounded-lg">
              一起 {countByArea.together}
            </TabsTrigger>
            <TabsTrigger value="personal" className="rounded-lg">
              我的 {countByArea.personal}
            </TabsTrigger>
          </TabsList>

          {(['together', 'personal'] as const).map((area) => {
            const rows = byArea[area];
            return (
              <TabsContent key={area} value={area} className="space-y-3 pt-2">
                <div className="flex items-start gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={area === 'together' ? '一起要做的事（回车换行）' : '我自己要做的事（回车换行）'}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                    style={{ minHeight: '2.5rem' }}
                    onKeyDown={(e) => {
                      // 回车换行（默认行为）；⌘/Ctrl + 回车提交
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void add(area);
                      }
                    }}
                  />
                  <Button
                    className="shrink-0 rounded-xl"
                    disabled={busy || !draft.trim()}
                    onClick={() => void add(area)}
                  >
                    添加
                  </Button>
                </div>

                {rows.length === 0 ? (
                  <EmptyState text="还没有待办" />
                ) : (
                  rows.map((t, i) => (
                    <Card key={t.id} className="rounded-2xl">
                      <CardContent className="flex items-start gap-2 py-3">
                        <Checkbox
                          checked={!!t.done}
                          onCheckedChange={() => void toggle(t)}
                          aria-label="完成"
                          className="mt-0.5"
                        />
                        <Link
                          to={`/todos/${t.id}`}
                          className={cn(
                            'min-w-0 flex-1 whitespace-pre-wrap break-words text-sm',
                            t.done && 'text-muted-foreground line-through',
                          )}
                        >
                          {t.content}
                        </Link>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl text-muted-foreground"
                            aria-label="上移"
                            disabled={i === 0}
                            onClick={() => void move(rows, i, -1)}
                          >
                            <ArrowUpIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl text-muted-foreground"
                            aria-label="下移"
                            disabled={i === rows.length - 1}
                            onClick={() => void move(rows, i, 1)}
                          >
                            <ArrowDownIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-xl text-muted-foreground"
                            aria-label={t.archived ? '恢复' : '归档'}
                            onClick={() => void archive(t)}
                          >
                            {t.archived ? <CheckIcon className="h-3.5 w-3.5" /> : <ArchiveBoxIcon className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>

      )}
        <LoadMoreButton
          hasMore={list.hasMore}
          remaining={list.remaining}
          loading={list.loadingMore}
          onClick={() => void list.loadMore()}
        />
    </div>
  );
}
