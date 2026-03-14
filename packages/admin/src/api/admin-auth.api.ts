import request from './request';
import type { AdminUser, MenuItem } from '@/stores/auth.store';

interface LoginParams {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: AdminUser;
  permissions: string[];
  menus: MenuItem[];
}

export async function adminLogin(params: LoginParams): Promise<LoginResponse> {
  // Mock login for development - replace with real API call
  if (params.username && params.password) {
    return {
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '1',
        username: params.username,
        nickname: 'Administrator',
        role: 'super_admin',
      },
      permissions: ['*'],
      menus: [],
    };
  }
  const res = await request.post<unknown, { data: LoginResponse }>('/auth/login', params);
  return res.data;
}

export async function adminLogout(): Promise<void> {
  await request.post('/auth/logout');
}

export async function getCurrentAdmin(): Promise<{
  user: AdminUser;
  permissions: string[];
  menus: MenuItem[];
}> {
  const res = await request.get<unknown, { data: { user: AdminUser; permissions: string[]; menus: MenuItem[] } }>('/auth/me');
  return res.data;
}
