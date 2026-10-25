import { Lunar } from 'lunar-javascript';
import { daysBetween, today } from '@/lib/format';

/**
 * 农历 → 公历转换与纪念日倒计时。
 *
 * 【修 V1 的 bug】V1 服务端 toSolarDate 已把农历转成公历，但前端 AnniversaryCard
 * 直接把 date 当公历算倒计时，导致农历纪念日天数错误。这里前后端统一走同一函数。
 */

export interface AnniversaryOccurrence {
  /** 下一次（今年或明年）的公历日期 YYYY-MM-DD */
  solarDate: string;
  /** 距今天数：0 = 就是今天 */
  daysUntil: number;
  /** 已经过了多少周年（本次纪念日是第几周年） */
  years: number;
}

/** 把纪念日（可能是农历）转成公历月日；失败时退回原日期 */
export function toSolarYmd(dateStr: string, isLunar?: boolean): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return dateStr.slice(0, 10);

  if (isLunar) {
    try {
      const solar = Lunar.fromYmd(y, m, d).getSolar();
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}`;
    } catch {
      return dateStr.slice(0, 10);
    }
  }
  return dateStr.slice(0, 10);
}

/** 计算下一次到来的公历日期与倒计时 */
export function nextOccurrence(dateStr: string, isLunar?: boolean): AnniversaryOccurrence {
  const origin = dateStr.slice(0, 10);
  const solarOrigin = toSolarYmd(origin, isLunar);
  const now = today();

  const [, m, d] = solarOrigin.split('-');
  const thisYear = `${now.slice(0, 4)}-${m}-${d}`;

  let target = thisYear;
  let years = 0;
  try {
    years = Number(now.slice(0, 4)) - Number(origin.slice(0, 4));
  } catch {
    years = 0;
  }

  if (daysBetween(now, thisYear) < 0) {
    target = `${Number(now.slice(0, 4)) + 1}-${m}-${d}`;
    years += 1;
  }

  return {
    solarDate: target,
    daysUntil: daysBetween(now, target),
    years: Math.max(years, 0),
  };
}

/** 在一起多少天（is_together 的纪念日专用） */
export function daysSince(dateStr: string, isLunar?: boolean): number {
  return Math.max(0, daysBetween(toSolarYmd(dateStr, isLunar), today()));
}
