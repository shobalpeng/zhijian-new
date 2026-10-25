import { InteractiveBoard } from '@/components/interactive/interactive-board';

/** 任务：creator 发起、assignee 执行，确认后 assignee 得分 */
export function TasksPage() {
  return <InteractiveBoard kind="tasks" />;
}
