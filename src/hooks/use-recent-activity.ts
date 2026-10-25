import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';

export interface RecentActivity {
  id: string;
  type: 'task' | 'wish';
  title: string;
  points: number;
  time: string;
}

/**
 * 首页「最近动态」：最近确认完成的任务 / 心愿（按 confirmed_at 倒序合并）。
 * 与 V1 的 ActivityTimeline 数据源（任务/心愿确认）保持一致，不复用已移除的通知表。
 */
export function useRecentActivity(limit = 3) {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentActivity[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const fetchList = async (collection: 'tasks' | 'wishes') => {
        try {
          const res = await pb.collection(collection).getList(1, limit, {
            filter: 'status = "confirmed"',
            sort: '-confirmed_at',
            fields: 'id,title,points,confirmed_at',
            $autoCancel: false,
          });
          return res.items.map(
            (r: Record<string, unknown>): RecentActivity => ({
              id: String(r.id),
              type: collection === 'tasks' ? 'task' : 'wish',
              title: String(r.title ?? ''),
              points: Number(r.points ?? 0),
              time: String(r.confirmed_at ?? ''),
            }),
          );
        } catch {
          return [] as RecentActivity[];
        }
      };

      const [tasks, wishes] = await Promise.all([fetchList('tasks'), fetchList('wishes')]);
      if (cancelled) return;
      setItems(
        [...tasks, ...wishes]
          .sort((a, b) => (Date.parse(b.time.replace(' ', 'T')) || 0) - (Date.parse(a.time.replace(' ', 'T')) || 0))
          .slice(0, limit),
      );
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, limit]);

  return items;
}
