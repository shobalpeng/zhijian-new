import { useCallback, useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';

/**
 * 内容模块（recipes / anniversaries / travel / wanders / dines / items / todos）共用的
 * 列表 + 增删 hook。
 *
 * 与 use-interactive-items 的区别：这里是纯 CRUD，没有状态机与积分逻辑——
 * 这些集合的写入权限完全由 PocketBase collection rule 在服务端保证
 * （情侣对共享 / personal 仅本人可见），前端不需要自己拼权限条件。
 *
 * 分页：默认每页 20 条，调用方用 loadMore() 追加下一页。
 * 每次都按「已加载的总条数」整段重取（而不是 offset 拼接），
 * 这样实时推送触发刷新时不会丢数据或出现重复。
 */

/** 统计用全量数据的上限（情侣场景数据量小，1000 条足够；超出部分统计会略偏） */
const ALL_LIMIT = 1000;

export interface UseCollectionOptions {
  /** 排序字段，默认自建的 created_at（PocketBase 内置 created 也可，但本项目统一用 created_at） */
  sort?: string;
  /** expand 关系字段，如 'creator' */
  expand?: string;
  /** 额外过滤条件（PocketBase filter 语法） */
  filter?: string;
  /** 每页条数，默认 20 */
  perPage?: number;
  /** 是否订阅 realtime（默认 true） */
  realtime?: boolean;
}

export function useCollection<T = Record<string, unknown>>(
  collection: string,
  opts: UseCollectionOptions = {},
) {
  const {
    sort = '-created_at',
    expand,
    filter = '',
    perPage = 20,
    realtime = true,
  } = opts;

  const [records, setRecords] = useState<T[]>([]);
  /** 全量数据（仅用于统计/搜索，不用于渲染列表）——统计口径必须是全部数据，不能只统计已加载的一页 */
  const [allRecords, setAllRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  /** 「加载更多」进行中（与首屏 loading 分开，避免整页转圈） */
  const [loadingMore, setLoadingMore] = useState(false);
  /** 还有没有下一页 */
  const [hasMore, setHasMore] = useState(false);
  /** 加载失败原因：不要把错误静默吞成「空列表」，否则排查时无从下手 */
  const [error, setError] = useState<string | null>(null);
  /** 当前已加载到第几页（realtime 刷新时要用它保持已加载的量） */
  const pageRef = useRef(1);

  /** 加载前 targetPage 页（一次性取 targetPage * perPage 条） */
  const load = useCallback(
    async (targetPage = 1) => {
      const size = Math.max(1, targetPage) * perPage;
      const query = {
        sort,
        expand,
        filter: filter || undefined,
        $autoCancel: false,
      };
      // 列表按页取；统计用的全量只在第一页时取一次（JSON 很轻，不含图片）
      const [res, all] = await Promise.all([
        pb.collection(collection).getList(1, size, query),
        targetPage === 1
          ? pb.collection(collection).getList(1, ALL_LIMIT, query)
          : Promise.resolve(null),
      ]);
      setRecords(res.items as unknown as T[]);
      if (all) setAllRecords(all.items as unknown as T[]);
      pageRef.current = targetPage;
      setHasMore(res.totalItems > res.items.length);
      setError(null);
    },
    [collection, sort, expand, filter, perPage],
  );

  useEffect(() => {
    setLoading(true);
    void load(1);

    if (!realtime) return;

    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        // 有新数据时重取「当前已加载的量」，保持用户已展开的内容不丢失
        unsub = await pb.collection(collection).subscribe('*', () => void load(pageRef.current));
      } catch {
        /* 订阅失败不阻塞 */
      }
    })();

    return () => unsub?.();
  }, [collection, load, realtime]);

  /** 加载下一页 */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await load(pageRef.current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoadingMore(false);
    }
  }, [load, loadingMore]);

  const create = useCallback(
    async (data: FormData | Record<string, unknown>) => {
      const rec = await pb.collection(collection).create(data);
      void load(pageRef.current);
      return rec;
    },
    [collection, load],
  );

  const update = useCallback(
    async (id: string, data: FormData | Record<string, unknown>) => {
      const rec = await pb.collection(collection).update(id, data);
      void load(pageRef.current);
      return rec;
    },
    [collection, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await pb.collection(collection).delete(id);
      void load(pageRef.current);
    },
    [collection, load],
  );

  return {
    records,
    /** 全量数据：统计与搜索用它，不要用分页后的 records */
    allRecords,
    loading,
    loadingMore,
    hasMore,
    error,
    reload: () => load(pageRef.current),
    loadMore,
    create,
    update,
    remove,
  };
}
