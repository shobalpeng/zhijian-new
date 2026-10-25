import { useMemo } from 'react';
import { useCollection } from '@/hooks/use-collection';
import { daysSince, nextOccurrence } from '@/lib/lunar';
import { today } from '@/lib/format';

interface AnniversaryRow {
  id: string;
  name: string;
  date: string;
  is_lunar?: boolean;
  is_together?: boolean;
}

/**
 * 首页用：在一起天数 + 最近的一次纪念日倒计时（与 V1 的 PointsOverview/ActivityTimeline 口径一致）。
 */
export function useAnniversarySummary() {
  const list = useCollection<AnniversaryRow>('anniversaries', { sort: '-created_at' });

  return useMemo(() => {
    const all = list.allRecords.length ? list.allRecords : list.records;
    if (all.length === 0) {
      return { togetherDays: null as number | null, upcoming: null as { name: string; daysUntil: number } | null };
    }

    const together = all.find((a) => a.is_together);
    const togetherDays = together ? daysSince(together.date, together.is_lunar) : null;

    // 「距离下一次…还剩」取最近的一次（含在一起纪念日）
    let upcoming: { name: string; daysUntil: number } | null = null;
    for (const a of all) {
      const occ = nextOccurrence(a.date, a.is_lunar);
      if (!upcoming || occ.daysUntil < upcoming.daysUntil) {
        upcoming = { name: a.name, daysUntil: occ.daysUntil };
      }
    }

    // 生日等当天 0 天时展示「就是今天」，由调用方处理；这里保留 0
    void today();
    return { togetherDays, upcoming };
  }, [list.allRecords, list.records]);
}
