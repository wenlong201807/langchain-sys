import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post } from '../api/request';
import {
  getToken,
  setToken,
  setRefreshToken,
  setUserInfo,
  getUserInfo,
  clearAuth,
} from '../utils/storage';
import type { User, LoginParams, LoginResult } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);

  const isLoggedIn = computed(() => !!token.value);

  function initialize(): void {
    token.value = getToken();
    user.value = getUserInfo<User>();
  }

  async function login(params: LoginParams): Promise<void> {
    const result = await post<LoginResult>('/auth/login', params as unknown as Record<string, unknown>, {
      withAuth: false,
    });

    token.value = result.accessToken;
    user.value = result.user;

    setToken(result.accessToken);
    setRefreshToken(result.refreshToken);
    setUserInfo(result.user);
  }

  async function logout(): Promise<void> {
    try {
      await post('/auth/logout');
    } catch {
      // ignore logout API errors
    } finally {
      token.value = null;
      user.value = null;
      clearAuth();
    }
  }

  async function refreshProfile(): Promise<void> {
    const { get } = await import('../api/request');
    const profile = await get<User>('/auth/profile');
    user.value = profile;
    setUserInfo(profile);
  }

  return {
    token,
    user,
    isLoggedIn,
    initialize,
    login,
    logout,
    refreshProfile,
  };
});
