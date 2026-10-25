import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth-provider';
import { useTheme } from '@/components/theme-provider';
import { pb } from '@/lib/pocketbase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SettingsGroup, SettingsRow } from '@/components/common/settings-list';
import { COLOR_LABELS } from '@/components/theme-sync';
import {
  ArrowRightStartOnRectangleIcon,
  HeartIcon,
  MoonIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

/**
 * 「我的」：只放身份信息 + 设置入口。
 * 伴侣/邀请码、外观、账号安全都拆到二级页（/me/partner、/me/appearance、/me/security），
 * 避免首页堆五六张卡片。
 */
export function MePage() {
  const { user, partner, logout } = useAuth();
  const { theme, colorTheme } = useTheme();
  const navigate = useNavigate();

  const avatarUrl = user?.avatar
    ? pb.files.getUrl({ collectionId: '_pb_users_auth_', id: user.id } as never, user.avatar)
    : '';
  const name = user?.name || user?.username || '未命名';
  const partnerName = partner ? partner.name || partner.username : '未绑定';
  const appearanceLabel = `${theme === 'dark' ? '深色' : '浅色'} · ${COLOR_LABELS[colorTheme]}`;

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-4 pb-4">
      <h1 className="pt-2 text-2xl font-semibold tracking-tight">我的</h1>

      <Card className="rounded-2xl py-0">
        <CardContent className="flex items-center gap-4 py-5">
          <Avatar className="h-14 w-14">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-medium">{name}</p>
            <p className="truncate text-sm text-muted-foreground">@{user?.username}</p>
          </div>
        </CardContent>
      </Card>

      <SettingsGroup>
        <SettingsRow icon={HeartIcon} label="伴侣" to="/me/partner" value={partnerName} />
        <SettingsRow icon={MoonIcon} label="外观" to="/me/appearance" value={appearanceLabel} />
        <SettingsRow icon={ShieldCheckIcon} label="账号安全" to="/me/security" value="修改密码" />
      </SettingsGroup>

      <Button variant="outline" className="w-full rounded-xl" onClick={handleLogout}>
        <ArrowRightStartOnRectangleIcon className="mr-2 h-4 w-4" />
        退出登录
      </Button>
    </div>
  );
}
