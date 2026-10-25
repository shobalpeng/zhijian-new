/** 织间 zhijian —— 领域类型定义 */

/** users(auth) 集合记录 */
export interface ZjUser {
  id: string;
  username: string;
  /** 昵称（PocketBase users 内置 name 字段） */
  name: string;
  /** 头像（PocketBase users 内置 avatar 字段） */
  avatar: string;
  email: string;
  invite_code: string;
  paired_user: string;
  is_admin: boolean;
  created: string;
  updated: string;
  /** PocketBase auth 记录自带 */
  collectionName?: string;
}

export type TaskStatus = 'pending' | 'submitted' | 'confirmed';

export interface ZjTask {
  id: string;
  title: string;
  description: string;
  image: string;
  points: number;
  creator: string;
  assignee: string;
  status: TaskStatus;
  submitted_at: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ZjWish {
  id: string;
  title: string;
  description: string;
  image: string;
  points: number;
  creator: string;
  fulfiller: string;
  status: TaskStatus;
  submitted_at: string;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
}

/** tasks / wishes 统一视图：counterpart 即「对方角色」（assignee 或 fulfiller） */
export interface InteractiveItem {
  id: string;
  title: string;
  description: string;
  image: string;
  points: number;
  creator: string;
  counterpart: string;
  status: TaskStatus;
  submitted_at: string;
  confirmed_at: string;
  /** 发布时间（PocketBase autodate 字段） */
  created_at: string;
  updated_at: string;
  creatorName: string;
  counterpartName: string;
}

export type InteractiveKind = 'tasks' | 'wishes';

/** 积分余额响应（/api/zhijian/balance） */
export interface BalanceResult {
  me: number;
  partner: number | null;
  partnerId: string | null;
}
