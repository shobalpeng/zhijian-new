import { useEffect, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';
import type { BalanceResult } from '@/lib/types';

/** 积分余额（来自 /api/zhijian/balance，由 pb_hooks 汇总 point_transactions） */
export function useBalance() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<BalanceResult | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await pb.send('/api/zhijian/balance', { method: 'GET' });
        if (!cancelled) {
          setBalance({ me: res?.me ?? 0, partner: res?.partner ?? null, partnerId: res?.partnerId ?? null });
        }
      } catch {
        if (!cancelled) setBalance(null);
      }
    };
    void load();
    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        unsub = await pb.collection('point_transactions').subscribe('*', () => void load());
      } catch {
        /* 无权限订阅时忽略 */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user?.id]);

  return balance;
}
