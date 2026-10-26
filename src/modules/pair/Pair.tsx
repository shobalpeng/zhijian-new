import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

export function PairPage() {
  const { user, partner, pair } = useAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await pair(code.trim());
      if (res.ok) {
        toast.success(res.already ? '你们已经绑定过了' : '绑定成功');
        navigate('/', { replace: true });
      } else {
        toast.error(res.error || '绑定失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">绑定伴侣</h1>
      </div>

      {partner ? (
        <Card className="rounded-2xl">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            你已与 <span className="font-medium text-foreground">{partner.name || partner.username}</span> 绑定。
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">输入对方的邀请码</CardTitle>
            <CardDescription>绑定后，你们的任务、心愿与生活记录将互相可见</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">邀请码</Label>
                <Input
                  id="code"
                  placeholder="8 位邀请码"
                  className="rounded-xl font-mono tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>
                {isSubmitting && <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />}
                绑定
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">我的邀请码</CardTitle>
          <CardDescription>也可以把你的邀请码发给对方</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl tracking-widest text-primary">{user?.invite_code || '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
