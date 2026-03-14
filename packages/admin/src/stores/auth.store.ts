import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdminUser {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  role: string;
}

export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  children?: MenuItem[];
  path?: string;
  permission?: string;
}

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  permissions: string[];
  menus: MenuItem[];
  setAuth: (token: string, user: AdminUser, permissions: string[], menus: MenuItem[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: [],
      menus: [],
      setAuth: (token, user, permissions, menus) =>
        set({ token, user, permissions, menus }),
      logout: () =>
        set({ token: null, user: null, permissions: [], menus: [] }),
    }),
    {
      name: 'thinkagent-admin-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        permissions: state.permissions,
        menus: state.menus,
      }),
    }
  )
);
