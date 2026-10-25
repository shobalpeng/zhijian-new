import { useEffect, useRef, useState } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';

export type AppTheme = 'light' | 'dark';
export const COLOR_THEMES = ['blue', 'pink', 'green', 'red', 'gray'] as const;
export type AppColorTheme = (typeof COLOR_THEMES)[number];

/** 配色中文名（与 index.css 的 .color-* 一一对应） */
export const COLOR_LABELS: Record<AppColorTheme, string> = {
  blue: '蓝',
  pink: '粉',
  green: '绿',
  red: '红',
  gray: '灰',
};

function normalizeColor(v: unknown): AppColorTheme {
  return COLOR_THEMES.includes(v as AppColorTheme) ? (v as AppColorTheme) : 'blue';
}

/**
 * 主题同步：明暗（theme）与配色（color_theme）都以服务端 user_settings 为准（跨设备一致），
 * 本地切换时回写服务端。
 *
 * 【修 V1 的「dark 变体全部失效」】新版主题机制是 `<html class="dark color-pink">` +
 * `@custom-variant dark (&:is(.dark *))`，由 ThemeProvider 统一维护，
 * 不再出现 V1 那种「只设 data-theme 却绑定 .dark」的错配。
 */
export function ThemeSync() {
  const { user } = useAuth();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const lastSavedTheme = useRef<string>('');
  const lastSavedColor = useRef<string>('');

  // 登录（或切换账号）后，以服务端保存的主题为准
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    void (async () => {
      try {
        const res = await pb.collection('user_settings').getList(1, 1, {
          filter: `user = "${user.id}"`,
          $autoCancel: false,
        });
        const rec = res.items[0];
        if (!alive || !rec) return;
        setSettingsId(rec.id);

        const server: AppTheme = rec.theme === 'dark' ? 'dark' : 'light';
        lastSavedTheme.current = server;
        if (theme !== server) setTheme(server);

        const serverColor = normalizeColor(rec.color_theme);
        lastSavedColor.current = serverColor;
        if (colorTheme !== serverColor) setColorTheme(serverColor);
      } catch {
        /* 主题同步失败不影响使用 */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 本地切换明暗 -> 写回服务端
  useEffect(() => {
    if (!settingsId || theme === 'system') return;
    if (theme === lastSavedTheme.current) return;
    lastSavedTheme.current = theme;
    void pb.collection('user_settings').update(settingsId, { theme }).catch(() => {});
  }, [theme, settingsId]);

  // 本地切换配色 -> 写回服务端
  useEffect(() => {
    if (!settingsId) return;
    if (colorTheme === lastSavedColor.current) return;
    lastSavedColor.current = colorTheme;
    void pb.collection('user_settings').update(settingsId, { color_theme: colorTheme }).catch(() => {});
  }, [colorTheme, settingsId]);

  return null;
}
