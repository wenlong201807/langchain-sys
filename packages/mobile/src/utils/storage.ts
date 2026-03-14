const TOKEN_KEY = 'thinkagent_token';
const REFRESH_TOKEN_KEY = 'thinkagent_refresh_token';
const USER_KEY = 'thinkagent_user';

export function getToken(): string | null {
  try {
    return uni.getStorageSync(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    uni.setStorageSync(TOKEN_KEY, token);
  } catch (e) {
    console.error('[Storage] Failed to set token', e);
  }
}

export function getRefreshToken(): string | null {
  try {
    return uni.getStorageSync(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string): void {
  try {
    uni.setStorageSync(REFRESH_TOKEN_KEY, token);
  } catch (e) {
    console.error('[Storage] Failed to set refresh token', e);
  }
}

export function getUserInfo<T>(): T | null {
  try {
    const raw = uni.getStorageSync(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setUserInfo<T>(user: T): void {
  try {
    uni.setStorageSync(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('[Storage] Failed to set user info', e);
  }
}

export function clearAuth(): void {
  try {
    uni.removeStorageSync(TOKEN_KEY);
    uni.removeStorageSync(REFRESH_TOKEN_KEY);
    uni.removeStorageSync(USER_KEY);
  } catch (e) {
    console.error('[Storage] Failed to clear auth', e);
  }
}
