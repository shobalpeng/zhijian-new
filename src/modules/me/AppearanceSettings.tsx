import { useTheme } from '@/components/theme-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SubPageHeader } from '@/components/common/settings-list';
import { CheckIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { COLOR_LABELS, COLOR_THEMES, type AppColorTheme } from '@/components/theme-sync';

const MODES = [
  { value: 'light' as const, label: '浅色', desc: '明亮清爽，适合白天', icon: SunIcon },
  { value: 'dark' as const, label: '深色', desc: '柔和护眼，适合夜晚', icon: MoonIcon },
];

/** 配色选项：hex 用于色点展示，实际主色由 index.css 的 .color-* 变量决定 */
const COLOR_HEX: Record<AppColorTheme, string> = {
  blue: '#1447e6',
  pink: '#d03b59', // 0.58 / 13.4 —— 见 index.css 注释（原 #dd4864 对比度不足）
  green: '#008826',
  red: '#d3013d',
  gray: '#636363',
};

/** 二级页：外观（明暗 + 配色，切换后同步到服务端 user_settings） */
export function AppearanceSettingsPage() {
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();

  return (
    <div className="space-y-4 pb-4">
      <SubPageHeader title="外观" backTo="/me" />

      <div className="grid grid-cols-2 gap-3">
        {MODES.map((opt) => {
          const active = theme === opt.value;
          return (
            <Button
              key={opt.value}
              variant="outline"
              className={cn(
                'h-auto flex-col items-start gap-2 rounded-2xl p-4',
                active && 'border-primary bg-primary/5',
              )}
              onClick={() => setTheme(opt.value)}
            >
              <div className="flex w-full items-center justify-between">
                <opt.icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
                {active && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{opt.desc}</span>
            </Button>
          );
        })}
      </div>

      <Card className="rounded-2xl py-0">
        <CardContent className="space-y-3 py-4">
          <p className="text-sm font-medium">配色</p>
          <div className="flex gap-2">
            {COLOR_THEMES.map((value) => {
              const active = colorTheme === value;
              const hex = COLOR_HEX[value];
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`${COLOR_LABELS[value]}色主题`}
                  aria-pressed={active}
                  onClick={() => setColorTheme(value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 py-2 transition-colors',
                    active ? 'border-primary' : 'border-transparent hover:bg-muted/40',
                  )}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: hex }}
                  >
                    {active && <CheckIcon className="h-4 w-4 text-white" />}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      active ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {COLOR_LABELS[value]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            配色影响按钮、选中态等强调色；外观会跟随账号同步到你的所有设备。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
