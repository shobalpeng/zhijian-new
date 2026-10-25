import type { InteractiveKind, TaskStatus } from '@/lib/types';

/** 状态徽章样式（任务/心愿共用） */
export const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: '待完成', className: 'bg-muted text-muted-foreground' },
  submitted: { label: '待确认', className: 'bg-amber-500/15 text-amber-600' },
  confirmed: { label: '已完成', className: 'bg-primary/15 text-primary' },
};

export interface KindConfig {
  /** 模块名：任务 / 心愿 */
  title: string;
  /** 量词：个任务 / 个心愿 */
  unit: string;
  createLabel: string;
  submitLabel: string;
  confirmLabel: string;
  waitForCounterpart: string;
  waitForCreator: string;
  emptyText: string;
  /** 列表为空时的空态（按状态区分） */
  emptyByStatus: Record<TaskStatus, string>;
  /** 「发起人」/「执行人」的角色叫法 */
  creatorRole: string;
  counterpartRole: string;
}

export const KIND_CONFIG: Record<InteractiveKind, KindConfig> = {
  tasks: {
    title: '任务',
    unit: '任务',
    createLabel: '新建任务',
    submitLabel: '我完成了',
    confirmLabel: '确认完成',
    waitForCounterpart: '等待 Ta 完成',
    waitForCreator: '等待 Ta 确认',
    emptyText: '还没有任务，新建一个吧',
    emptyByStatus: {
      pending: '没有待完成的任务',
      submitted: '没有待确认的任务',
      confirmed: '还没有已完成的任务',
    },
    creatorRole: '发起人',
    counterpartRole: '执行人',
  },
  wishes: {
    title: '心愿',
    unit: '心愿',
    createLabel: '许个愿',
    submitLabel: '我实现了',
    confirmLabel: '确认已实现',
    waitForCounterpart: '等待 Ta 实现',
    waitForCreator: '等待 Ta 确认',
    emptyText: '还没有心愿，许一个吧',
    emptyByStatus: {
      pending: '没有待实现的心愿',
      submitted: '没有待确认的心愿',
      confirmed: '还没有已实现的心愿',
    },
    creatorRole: '许愿人',
    counterpartRole: '实现人',
  },
};
