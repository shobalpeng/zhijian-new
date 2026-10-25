import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/components/auth-provider';
import { LoadingText } from '@/components/common/list-parts';
import { ZoomableImage } from '@/components/common/zoomable-image';
import { Badge } from '@/components/ui/badge';
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
import { COLLECTION_ID, fileUrl, formatDateTime } from '@/lib/format';
import { KIND_CONFIG, STATUS_META } from './config';
import { expandFields, toInteractiveItem } from '@/hooks/use-interactive-items';
import type { InteractiveItem, InteractiveKind } from '@/lib/types';

/** 时间轴上的一步 */
function Step({
  label,
  time,
  done,
  hint,
  isLast,
}: {
  label: string;
  time?: string;
  done: boolean;
  hint?: string;
  isLast?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            done ? 'bg-primary' : 'bg-muted-foreground/25'
          }`}
        />
        {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-3'}`}>
        <p className={`text-sm ${done ? 'font-medium' : 'text-muted-foreground'}`}>{label}</p>
        <p className="text-xs text-muted-foreground/80">
          {done ? time || '已记录' : hint || '尚未发生'}
        </p>
      </div>
    </li>
  );
}

/**
 * 任务 / 心愿详情页（`/tasks/:id`、`/wishes/:id`）。
 * 列表点卡片进来，展示完整信息 + 发布/提交/完成时间 + 对应状态下的操作。
 */
export function InteractiveDetailPage({ kind }: { kind: InteractiveKind }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const cfg = KIND_CONFIG[kind];

  const [item, setItem] = useState<InteractiveItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rec = await pb.collection(kind).getOne(id, {
        expand: expandFields(kind),
        $autoCancel: false,
      });
      setItem(toInteractiveItem(rec, kind));
    } catch {
      toast.error('找不到这条记录');
      navigate(`/${kind}`, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, kind, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const meId = user?.id ?? '';

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await pb.collection(kind).delete(id);
      toast.success('已删除');
      navigate(`/${kind}`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingText />;
  if (!item) return null;

  const meta = STATUS_META[item.status];
  const isCreator = item.creator === meId;
  const isCounterpart = item.counterpart === meId;

  const image = fileUrl(COLLECTION_ID[kind], item.id, item.image);

  /** 返回：优先回上一页（列表会带着 ?tab= 还原所在分栏），直接打开详情时回列表 */
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(`/${kind}`, { replace: true });
  };

  /** 当前用户在此状态下是否有可执行动作（没有则显示一句说明，避免看起来像功能缺失） */
  const canAct =
    (item.status === 'pending' && (isCreator || isCounterpart)) ||
    (item.status === 'submitted' && isCreator);

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-2 pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label="返回"
          onClick={goBack}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-xl font-semibold tracking-tight">{item.title}</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`rounded-full ${meta.className}`}>{meta.label}</Badge>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary">
          <SparklesIcon className="h-4 w-4" />
          {item.points} 积分
        </span>
      </div>

      {image && (
        <ZoomableImage
          src={image}
          alt={item.title}
          className="w-full rounded-2xl object-cover"
        />
      )}

      {item.description && (
        <Card className="rounded-2xl">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">描述</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{item.description}</p>
          </CardContent>
        </Card>
      )}

      {/* 双方 */}
      <Card className="rounded-2xl">
        <CardContent className="space-y-2 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{cfg.creatorRole}</span>
            <span className="font-medium">
              {item.creatorName || '—'}
              {isCreator ? '（我）' : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{cfg.counterpartRole}</span>
            <span className="font-medium">
              {item.counterpartName || '—'}
              {isCounterpart ? '（我）' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 时间轴 */}
      <Card className="rounded-2xl">
        <CardContent className="pt-4">
          <p className="mb-3 text-sm font-medium">时间</p>
          <ul>
            <Step label={`发布${cfg.unit}`} time={formatDateTime(item.created_at)} done />
            <Step
              label={kind === 'tasks' ? '标记完成' : '标记实现'}
              time={formatDateTime(item.submitted_at)}
              done={!!item.submitted_at}
              hint={item.status === 'pending' ? cfg.waitForCounterpart : '待提交'}
            />
            <Step
              label="确认完成"
              time={formatDateTime(item.confirmed_at)}
              done={!!item.confirmed_at}
              hint={item.status === 'submitted' ? cfg.waitForCreator : '待确认'}
              isLast
            />
          </ul>
        </CardContent>
      </Card>

      {/* 操作 */}
      <div className="flex flex-wrap gap-3">
        {item.status === 'pending' && isCounterpart && (
          <Button
            className="flex-1 rounded-xl"
            disabled={busy}
            onClick={() =>
              void run(
                () => pb.collection(kind).update(id, { status: 'submitted' }),
                '已提交，等待确认',
              )
            }
          >
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            {cfg.submitLabel}
          </Button>
        )}

        {item.status === 'submitted' && isCreator && (
          <Button
            className="flex-1 rounded-xl"
            disabled={busy}
            onClick={() =>
              void run(
                () => pb.collection(kind).update(id, { status: 'confirmed' }),
                '已确认，积分已结算',
              )
            }
          >
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            {cfg.confirmLabel}
          </Button>
        )}

        {item.status === 'pending' && isCreator && (
          <Button asChild variant="outline" className="flex-1 rounded-xl">
            <Link to={`/${kind}/${id}/edit`}>
              <PencilIcon className="mr-2 h-4 w-4" />
              编辑
            </Link>
          </Button>
        )}

        {item.status === 'pending' && isCreator && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1 rounded-xl text-destructive">
                <TrashIcon className="mr-2 h-4 w-4" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>删除这个{cfg.unit}？</AlertDialogTitle>
                <AlertDialogDescription>删除后无法恢复。</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={() => void remove()}>
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!canAct && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="h-4 w-4" />
            {item.status === 'confirmed'
              ? `已${kind === 'tasks' ? '完成' : '实现'}，无需操作`
              : item.status === 'submitted'
                ? cfg.waitForCreator
                : cfg.waitForCounterpart}
          </span>
        )}
      </div>
    </div>
  );
}
