import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubPageHeader } from '@/components/common/settings-list';

/** 二级页：账号安全（修改密码） */
export function SecuritySettingsPage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPassword || !password) {
      toast.error('请填写原密码与新密码');
      return;
    }
    if (password.length < 8) {
      toast.error('新密码至少 8 位');
      return;
    }
    if (password !== passwordConfirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      await pb.collection('users').update(user!.id, {
        oldPassword,
        password,
        passwordConfirm,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
      setBusy(false);
      return;
    }

    /**
     * ⚠️ PocketBase 改密码后会立即作废当前 auth token。
     * 若不重新登录，之后所有请求都会 401/404：伴侣信息读不到 → 界面显示「未绑定」，
     * 各列表也会变空（看起来像数据丢了，其实只是登录态失效）。
     * 这里用刚设置的新密码重新认证，换一个新的 token。
     */
    setOldPassword('');
    setPassword('');
    setPasswordConfirm('');
    try {
      await login(user!.username, password);
      toast.success('密码已修改');
      navigate('/me', { replace: true });
    } catch {
      // 密码已经改成功了，只是自动登录失败：清掉失效登录态，让用户手动登一次
      toast.error('密码已修改，请重新登录');
      logout();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <SubPageHeader title="账号安全" backTo="/me" />

      <Card className="rounded-2xl py-0">
        <CardContent className="space-y-4 py-5">
          <div className="space-y-2">
            <Label htmlFor="old-password">原密码</Label>
            <Input
              id="old-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="当前使用的密码"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">新密码（至少 8 位）</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位字符"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="再输入一次新密码"
            />
          </div>

          <Button
            className="w-full rounded-xl"
            disabled={busy || !oldPassword || !password || !passwordConfirm}
            onClick={() => void submit()}
          >
            {busy ? '保存中…' : '保存'}
          </Button>
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        迁移过来的账号使用临时密码登录，建议尽快改成自己的密码。
      </p>
    </div>
  );
}
