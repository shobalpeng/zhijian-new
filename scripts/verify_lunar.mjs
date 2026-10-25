/**
 * Phase 6：直接编译前端 `src/lib/lunar.ts` 并在 Node 里验证农历换算与倒计时，
 * 保证「前端算的天数」与 lunar-javascript 的权威结果一致（V1 的农历 bug 回归测试）。
 *
 * 用法: node scripts/verify_lunar.mjs
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const outFile = path.join(os.tmpdir(), 'zhijian_lunar_verify.cjs');

await build({
  entryPoints: [path.join(root, 'src/lib/lunar.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  alias: { '@': path.join(root, 'src') },
  define: { 'import.meta.env': '{"POCKETBASE_URL":"http://127.0.0.1:8090"}' },
  outfile: outFile,
  logLevel: 'error',
});

const require = createRequire(import.meta.url);
const { Lunar } = require('lunar-javascript');
const { toSolarYmd, nextOccurrence, daysSince } = require(outFile);
fs.rmSync(outFile, { force: true });

const pad = (n) => String(n).padStart(2, '0');
let ok = true;
const check = (label, cond, extra = '') => {
  console.log('  [%s] %s %s', cond ? 'OK' : 'FAIL', label, extra);
  ok = ok && cond;
};

function expectedSolar(y, m, d) {
  const s = Lunar.fromYmd(y, m, d).getSolar();
  return `${s.getYear()}-${pad(s.getMonth())}-${pad(s.getDay())}`;
}

const today = new Date();
const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

console.log('== 农历 -> 公历换算 ==');
const exp = expectedSolar(1955, 5, 5);
check(`农历 1955-05-05 -> 公历 ${exp}`, toSolarYmd('1955-05-05', true) === exp,
  'got=' + toSolarYmd('1955-05-05', true));
check('公历输入不做换算', toSolarYmd('2022-03-20', false) === '2022-03-20');

console.log('== 倒计时（下一次到来）==');
const passed = nextOccurrence('2000-01-01', false);
check('已过的日期落到明年', passed.solarDate === `${today.getFullYear() + 1}-01-01`, passed.solarDate);
const expectDays = Math.round(
  (Date.parse(passed.solarDate + 'T00:00:00') - Date.parse(todayStr + 'T00:00:00')) / 86400000);
check('倒计时天数正确', passed.daysUntil === expectDays, `${passed.daysUntil} vs ${expectDays}`);

const future = new Date(today.getTime() + 3 * 86400000);
const fmd = `${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
const occFuture = nextOccurrence('2020-' + fmd, false);
check('未来日期落在本年且 days=3',
  occFuture.solarDate === `${today.getFullYear()}-${fmd}` && occFuture.daysUntil === 3,
  `${occFuture.solarDate} days=${occFuture.daysUntil}`);

console.log('== 农历纪念日（V1 bug 回归）==');
const lunarDate = '1995-12-08'; // 农历腊月初八
const solarBirth = expectedSolar(1995, 12, 8);
const occLunar = nextOccurrence(lunarDate, true);
const mmdd = solarBirth.slice(5);
const expectDate = `${today.getFullYear()}-${mmdd}` >= todayStr
  ? `${today.getFullYear()}-${mmdd}` : `${today.getFullYear() + 1}-${mmdd}`;
check('农历生日按公历月日推算下一次', occLunar.solarDate === expectDate,
  `got=${occLunar.solarDate} expect=${expectDate} (农历=公历 ${solarBirth})`);
check('农历与公历月日不同（证明确实换算过）', solarBirth.slice(5) !== lunarDate.slice(5),
  `农历 ${lunarDate} -> 公历 ${solarBirth}`);

console.log('== 在一起天数 ==');
const since = daysSince('2022-03-20', false);
const expectSince = Math.round(
  (Date.parse(todayStr + 'T00:00:00') - Date.parse('2022-03-20T00:00:00')) / 86400000);
check('在一起天数正确', since === expectSince, `${since} vs ${expectSince}`);

console.log('\n== 结果：%s ==', ok ? '全部通过' : '存在失败项');
process.exit(ok ? 0 : 1);
