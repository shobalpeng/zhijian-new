import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';

export interface PendingSummary {
  /** 我发起、对方已提交，等我确认（红点口径，与 V1 /pending 一致） */
  submittedTasks: number;
  submittedWishes: number;
  /** 对方发起、等我完成 / 等我实现 */
  pendingTasks: number;
  pendingWishes: number;
  /** 红点：只算「待你确认」 */
  confirmTotal: number;
  /** 「待处理」卡片：四类合计 */
  total: number;
}

const EMPTY: PendingSummary = {
  submittedTasks: 0,
  submittedWishes: 0,
  pendingTasks: 0,
  pendingWishes: 0,
  confirmTotal: 0,
  total: 0,
};

/**
 * 待处理数量（纯查询，不落库，realtime 刷新）。
 * 底部导航红点只用 confirmTotal（用户只要「待你确认」）；
 * 首页「待处理」卡片用四类合计，与 V1 的 PendingCard 一致。
 */
export function usePendingCount(): PendingSummary {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PendingSummary>(EMPTY);

  useEffect(() => {
    if (!user?.id) {
      setSummary(EMPTY);
      return;
    }

    let cancelled = false;
    const uid = user.id;

    const load = async () => {
      const count = async (collection: string, filter: string) => {
        try {
          const res = await pb.collection(collection).getList(1, 1, {
            filter,
            fields: 'id',
            $autoCancel: false,
          });
          return res.totalItems;
        } catch {
          return 0;
        }
      };

      const [submittedTasks, submittedWishes, pendingTasks, pendingWishes] = await Promise.all([
        count('tasks', `status = "submitted" && creator = "${uid}"`),
        count('wishes', `status = "submitted" && creator = "${uid}"`),
        count('tasks', `status = "pending" && assignee = "${uid}"`),
        count('wishes', `status = "pending" && fulfiller = "${uid}"`),
      ]);

      if (cancelled) return;
      setSummary({
        submittedTasks,
        submittedWishes,
        pendingTasks,
        pendingWishes,
        confirmTotal: submittedTasks + submittedWishes,
        total: submittedTasks + submittedWishes + pendingTasks + pendingWishes,
      });
    };

    void load();

    let unsubTasks: (() => void) | undefined;
    let unsubWishes: (() => void) | undefined;
    void (async () => {
      try {
        unsubTasks = await pb.collection('tasks').subscribe('*', () => void load());
      } catch {
        /* 订阅失败不阻塞 */
      }
      try {
        unsubWishes = await pb.collection('wishes').subscribe('*', () => void load());
      } catch {
        /* 订阅失败不阻塞 */
      }
    })();

    return () => {
      cancelled = true;
      unsubTasks?.();
      unsubWishes?.();
    };
  }, [user?.id]);

  return summary;
}
