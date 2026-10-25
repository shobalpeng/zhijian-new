import { useCallback, useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';
import type { InteractiveItem, InteractiveKind } from '@/lib/types';

/**
 * tasks / wishes 共用的列表 + 操作 hook。
 *
 * 状态流转与积分发放全部由 pb_hooks 在服务端强制（前端只提交 status）：
 *   pending -> submitted -> confirmed
 * 因此这里不需要、也不应该自己拼积分事务。
 */

/** 各集合中「对方角色」的字段名 */
export const COUNTERPART_FIELD: Record<InteractiveKind, string> = {
  tasks: 'assignee',
  wishes: 'fulfiller',
};

/** 列表/详情都要 expand 的关联字段（发起人 + 执行人） */
export function expandFields(kind: InteractiveKind) {
  return `creator,${COUNTERPART_FIELD[kind]}`;
}

/**
 * PocketBase 记录 -> 统一视图。
 * ⚠️ 时间字段是自定义 autodate 的 `created_at` / `updated_at`，
 *    不是 PocketBase 内置的 `created` / `updated`（内置字段在自定义集合里是空的）。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toInteractiveItem(r: any, kind: InteractiveKind): InteractiveItem {
  const counterpartField = COUNTERPART_FIELD[kind];
  const person = (u: { name?: string; username?: string } | undefined) =>
    u?.name || u?.username || '';
  return {
    id: r.id,
    title: r.title ?? '',
    description: r.description ?? '',
    image: r.image ?? '',
    points: Number(r.points ?? 0),
    creator: r.creator ?? '',
    counterpart: r[counterpartField] ?? '',
    status: r.status,
    submitted_at: r.submitted_at ?? '',
    confirmed_at: r.confirmed_at ?? '',
    created_at: r.created_at ?? '',
    updated_at: r.updated_at ?? '',
    creatorName: person(r.expand?.creator),
    counterpartName: person(r.expand?.[counterpartField]),
  };
}

export interface CreateItemInput {
  title: string;
  description: string;
  points: number;
  image?: File | null;
}

export function useInteractiveItems(kind: InteractiveKind) {
  const { user } = useAuth();
  const [items, setItems] = useState<InteractiveItem[]>([]);
  /** 全量数据（仅用于统计口径，不用于渲染列表） */
  const [allItems, setAllItems] = useState<InteractiveItem[]>([]);
  /** 总条数 */
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /** 「加载更多」进行中（与首屏 loading 分开，避免整页转圈） */
  const [loadingMore, setLoadingMore] = useState(false);
  /** 还有没有下一页 */
  const [hasMore, setHasMore] = useState(false);
  /** 当前已加载到第几页（realtime 刷新时保持已展开的内容） */
  const pageRef = useRef(1);

  /** 每页条数 */
  const PAGE_SIZE = 20;
  /** 统计用全量上限 */
  const ALL_LIMIT = 1000;

  /** 加载前 targetPage 页（一次性取 targetPage * PAGE_SIZE 条） */
  const load = useCallback(
    async (targetPage = 1) => {
      try {
        const query = {
          sort: '-created_at',
          expand: expandFields(kind),
          $autoCancel: false,
        };
        const [res, all] = await Promise.all([
          pb.collection(kind).getList(1, Math.max(1, targetPage) * PAGE_SIZE, query),
          targetPage === 1 ? pb.collection(kind).getList(1, ALL_LIMIT, query) : Promise.resolve(null),
        ]);
        setItems(res.items.map((r) => toInteractiveItem(r, kind)));
        if (all) setAllItems(all.items.map((r) => toInteractiveItem(r, kind)));
        setTotal(res.totalItems);
        pageRef.current = targetPage;
        setHasMore(res.totalItems > res.items.length);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    setLoading(true);
    void load(1);

    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        // 有新数据时重取「当前已加载的量」，保持用户已展开的内容不丢失
        unsub = await pb.collection(kind).subscribe('*', () => void load(pageRef.current));
      } catch {
        /* 订阅失败不阻塞 */
      }
    })();

    return () => unsub?.();
  }, [kind, load]);

  const create = useCallback(
    async (input: CreateItemInput) => {
      const fd = new FormData();
      fd.append('title', input.title);
      fd.append('description', input.description);
      fd.append('points', String(input.points));
      if (input.image) fd.append('image', input.image);
      const rec = await pb.collection(kind).create(fd);
      void load(pageRef.current);
      return rec;
    },
    [kind, load],
  );

  /** 执行人/实现人标记完成 */
  const submit = useCallback(
    async (id: string) => {
      await pb.collection(kind).update(id, { status: 'submitted' });
      void load(pageRef.current);
    },
    [kind, load],
  );

  /** 创建者确认（服务端发放/扣减积分） */
  const confirm = useCallback(
    async (id: string) => {
      await pb.collection(kind).update(id, { status: 'confirmed' });
      void load(pageRef.current);
    },
    [kind, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await pb.collection(kind).delete(id);
      void load(pageRef.current);
    },
    [kind, load],
  );

  /** 加载下一页 */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await load(pageRef.current + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [load, loadingMore]);

  return {
    items,
    /** 全量数据：统计用它 */
    allItems,
    /** 总条数 */
    total,
    /** 还剩多少条没加载出来 */
    remaining: Math.max(0, total - items.length),
    loading,
    loadingMore,
    hasMore,
    reload: () => load(pageRef.current),
    loadMore,
    create,
    submit,
    confirm,
    remove,
    meId: user?.id ?? '',
  };
}
