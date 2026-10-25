import { useCallback, useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';

/**
 * 内容模块（recipes / anniversaries / travel / wanders / dines / items / todos）共用的
 * 列表 + 增删 hook。
 *
 * 与 use-interactive-items 的区别：这里是纯 CRUD，没有状态机与积分逻辑——
 * 这些集合的写入权限完全由 PocketBase collection rule 在服务端保证
 * （情侣对共享 / personal 仅本人可见），前端不需要自己拼权限条件。
 */

export interface UseCollectionOptions {
  /** 排序字段，默认自建的 created_at（PocketBase 内置 created 也可，但本项目统一用 created_at） */
  sort?: string;
  /** expand 关系字段，如 'creator' */
  expand?: string;
  /** 额外过滤条件（PocketBase filter 语法） */
  filter?: string;
  /** 单页条数，情侣场景数据量小，默认拉 200 */
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
    perPage = 200,
    realtime = true,
  } = opts;

  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  /** 加载失败原因：不要把错误静默吞成「空列表」，否则排查时无从下手 */
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await pb.collection(collection).getList(1, perPage, {
        sort,
        expand,
        filter: filter || undefined,
        $autoCancel: false,
      });
      setRecords(res.items as unknown as T[]);
      setError(null);
    } catch (err) {
      setRecords([]);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [collection, sort, expand, filter, perPage]);

  useEffect(() => {
    setLoading(true);
    void load();

    if (!realtime) return;

    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        unsub = await pb.collection(collection).subscribe('*', () => void load());
      } catch {
        /* 订阅失败不阻塞 */
      }
    })();

    return () => unsub?.();
  }, [collection, load, realtime]);

  const create = useCallback(
    async (data: FormData | Record<string, unknown>) => {
      const rec = await pb.collection(collection).create(data);
      void load();
      return rec;
    },
    [collection, load],
  );

  const update = useCallback(
    async (id: string, data: FormData | Record<string, unknown>) => {
      const rec = await pb.collection(collection).update(id, data);
      void load();
      return rec;
    },
    [collection, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await pb.collection(collection).delete(id);
      void load();
    },
    [collection, load],
  );

  return { records, loading, error, reload: load, create, update, remove };
}
