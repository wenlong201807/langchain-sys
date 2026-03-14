import { create } from 'zustand';
import type { MenuItem } from './auth.store';

interface PermissionState {
  permissions: string[];
  menus: MenuItem[];
  setPermissions: (permissions: string[], menus: MenuItem[]) => void;
  clear: () => void;
}

export const usePermissionStore = create<PermissionState>()((set) => ({
  permissions: [],
  menus: [],
  setPermissions: (permissions, menus) => set({ permissions, menus }),
  clear: () => set({ permissions: [], menus: [] }),
}));
