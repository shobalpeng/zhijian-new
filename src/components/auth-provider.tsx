import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { pb } from '@/lib/pocketbase';
import type { ZjUser } from '@/lib/types';

interface AuthContextType {
  user: ZjUser | null;
  partner: ZjUser | null;
  isValid: boolean;
  isLoading: boolean;
  /** 是否为管理员（后台管理布局使用，情侣 App 主流程不依赖） */
  isSuperAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: {
    username: string;
    password: string;
    passwordConfirm: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  pair: (code: string) => Promise<{ ok: boolean; already?: boolean; error?: string }>;
  unpair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function asUser(model: any): ZjUser | null {
  return (model as ZjUser) ?? null;
}

/**
 * 登录标识：用户名 → 占位邮箱。
 * PocketBase v0.40 的 passwordAuth.identityFields 无法通过 Admin API 开启 username
 * （实测 JSON/multipart 均不生效，JS 钩子改配置会 panic），
 * 因此沿用「username@zhijian.local」一一映射：用户只输入用户名，体验一致。
 */
const EMAIL_SUFFIX = '@zhijian.local';
function toIdentity(username: string) {
  const value = username.trim();
  return value.includes('@') ? value : `${value}${EMAIL_SUFFIX}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ZjUser | null>(asUser(pb.authStore.model));
  const [partner, setPartner] = useState<ZjUser | null>(null);
  const [isValid, setIsValid] = useState(pb.authStore.isValid);
  const [isLoading, setIsLoading] = useState(true);
  const isSuperAdmin = !!user?.is_admin || user?.collectionName === '_superusers';

  /** 拉取伴侣资料（未配对时为 null） */
  const loadPartner = useCallback(async (pairedId: string | undefined) => {
    if (!pairedId) {
      setPartner(null);
      return;
    }
    try {
      const record = await pb.collection('users').getOne<ZjUser>(pairedId, { $autoCancel: false });
      setPartner(record);
    } catch {
      /**
       * 读不到时**保留上一次的值**，不要清空。
       * 典型场景：修改密码后旧 token 立即失效，读伴侣会 404，
       * 若在这里 setPartner(null)，界面就会误显示成「未绑定」（数据其实还在）。
       * 真正的解绑会走上面的 pairedId 为空分支，仍然会清空。
       */
    }
  }, []);

  useEffect(() => {
    return pb.authStore.onChange((token, model) => {
      setUser(asUser(model));
      setIsValid(!!token);
      void loadPartner((model as ZjUser | null)?.paired_user);
    });
  }, [loadPartner]);

  useEffect(() => {
    const initAuth = async () => {
      if (!pb.authStore.isValid || !pb.authStore.model) {
        setIsLoading(false);
        return;
      }
      try {
        await pb.collection('users').authRefresh({ $autoCancel: false });
      } catch (err: any) {
        if (err?.status === 401 || err?.status === 403) {
          pb.authStore.clear();
          setUser(null);
          setIsValid(false);
          setPartner(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // 用户变化（含首次恢复会话）时同步伴侣资料
  useEffect(() => {
    void loadPartner(user?.paired_user);
  }, [user?.paired_user, loadPartner]);

  const login = async (username: string, password: string) => {
    const authData = await pb.collection('users').authWithPassword(toIdentity(username), password);
    setUser(authData.record as unknown as ZjUser);
    setIsValid(true);
    await loadPartner((authData.record as any)?.paired_user);
  };

  const register = async ({
    username,
    password,
    passwordConfirm,
    name,
  }: {
    username: string;
    password: string;
    passwordConfirm: string;
    name?: string;
  }) => {
    // PocketBase auth 集合要求 email，这里用占位邮箱（登录走 username）
    await pb.collection('users').create({
      username,
      email: `${username}@zhijian.local`,
      emailVisibility: false,
      password,
      passwordConfirm,
      name: name || username,
    });
    await login(username, password); // 注册后自动登录
  };

  const refreshUser = async () => {
    if (!pb.authStore.model?.id) return;
    const record = await pb
      .collection('users')
      .getOne<ZjUser>(pb.authStore.model.id, { $autoCancel: false });
    setUser(record);
    await loadPartner(record.paired_user);
  };

  const logout = () => {
    pb.authStore.clear();
    setUser(null);
    setPartner(null);
    setIsValid(false);
  };

  const pair = async (code: string) => {
    try {
      const res = await pb.send('/api/zhijian/pair', { method: 'POST', body: { code } });
      await refreshUser();
      return { ok: true, already: !!res?.already };
    } catch (err: any) {
      return { ok: false, error: err?.response?.error || err?.message || '配对失败' };
    }
  };

  const unpair = async () => {
    await pb.send('/api/zhijian/unpair', { method: 'POST' });
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        partner,
        isValid,
        isLoading,
        isSuperAdmin,
        login,
        register,
        logout,
        refreshUser,
        pair,
        unpair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
