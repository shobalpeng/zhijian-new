import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserIcon, LockClosedIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({
        username: username.trim(),
        password,
        passwordConfirm,
        name: name.trim() || username.trim(),
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      const data = err?.response?.data;
      const message = data
        ? Object.values(data)
            .flat()
            .map((item: any) => item?.message || String(item))
            .join('；')
        : null;
      setError(message || err?.message || '注册失败，请更换用户名重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          {/* 与登录页保持同一套品牌头部 */}
          <img src="/logo.svg" alt="" className="mx-auto h-16 w-16" />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">织间</h1>
          <p className="mt-1 text-sm text-muted-foreground">创建你的账号</p>
        </div>
        <Card className="w-full rounded-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl font-bold">注册</CardTitle>
            <CardDescription>注册后用邀请码与伴侣绑定</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="字母、数字、下划线"
                    className="pl-9 rounded-xl"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">昵称</Label>
                <Input
                  id="name"
                  placeholder="对方看到的名字"
                  className="rounded-xl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="至少 8 位"
                    className="pl-9 rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">确认密码</Label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="passwordConfirm"
                    type="password"
                    placeholder="再输入一次密码"
                    className="pl-9 rounded-xl"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
                {isSubmitting && <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />}
                注册
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              已有账号？{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                去登录
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
