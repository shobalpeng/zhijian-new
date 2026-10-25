import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { pb } from '@/lib/pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SubPageHeader } from '@/components/common/settings-list';
import { HeartIcon, UserPlusIcon } from '@heroicons/react/24/outline';

/** 二级页：伴侣与邀请码（绑定 / 解绑 / 复制邀请码） */
export function PartnerSettingsPage() {
  const { user, partner, unpair } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleUnpair = async () => {
    setBusy(true);
    try {
      await unpair();
      toast.success('已解除绑定');
    } catch {
      toast.error('解除失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!user?.invite_code) return;
    try {
      await navigator.clipboard.writeText(user.invite_code);
      toast.success('邀请码已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  const partnerAvatar = partner?.avatar
    ? pb.files.getURL({ collectionId: '_pb_users_auth_', id: partner.id } as never, partner.avatar)
    : '';
  const partnerName = partner ? partner.name || partner.username : '';

  return (
    <div className="space-y-4 pb-4">
      <SubPageHeader title="伴侣" backTo="/me" />

      {partner ? (
        <>
          <Card className="rounded-2xl py-0">
            <CardContent className="flex items-center gap-4 py-4">
              <Avatar className="h-12 w-12">
                {partnerAvatar && <AvatarImage src={partnerAvatar} alt={partnerName} />}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {partnerName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{partnerName}</p>
                <p className="truncate text-sm text-muted-foreground">@{partner.username}</p>
              </div>
              <HeartIcon className="h-5 w-5 text-primary/60" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl py-0">
            <CardContent className="space-y-3 py-4">
              <p className="text-sm font-medium">我的邀请码</p>
              <p className="font-mono text-2xl tracking-widest text-primary">
                {user?.invite_code || '—'}
              </p>
              <Button variant="outline" className="w-full rounded-xl" onClick={copyCode}>
                复制邀请码
              </Button>
              <p className="text-xs text-muted-foreground">
                邀请码用于与伴侣绑定，请勿分享给其他人。
              </p>
            </CardContent>
          </Card>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full rounded-xl text-destructive">
                解除绑定
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>解除绑定？</AlertDialogTitle>
                <AlertDialogDescription>
                  解除后你们将看不到对方的新记录，需要重新用邀请码绑定。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => void handleUnpair()}
                >
                  确认解除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <Card className="rounded-2xl py-0">
            <CardContent className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                还没有绑定伴侣。把下面的邀请码给对方，或者输入对方的邀请码完成绑定。
              </p>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">我的邀请码</p>
                <p className="mt-1 font-mono text-2xl tracking-widest text-primary">
                  {user?.invite_code || '—'}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={copyCode}>
                  复制
                </Button>
                <Button className="flex-1 rounded-xl" onClick={() => navigate('/pair')}>
                  <UserPlusIcon className="mr-2 h-4 w-4" />
                  去绑定
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
