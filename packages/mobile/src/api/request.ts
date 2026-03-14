import { envConfig } from '../config/env';
import { getToken, clearAuth } from '../utils/storage';
import type { ApiResponse } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  url: string;
  method?: HttpMethod;
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  showLoading?: boolean;
  withAuth?: boolean;
}

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.header,
  };

  if (options.withAuth !== false) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

function handleAuthError(): void {
  clearAuth();
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
  setTimeout(() => {
    uni.reLaunch({ url: '/pages/mine/index' });
  }, 1500);
}

export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, showLoading = false } = options;
  const fullUrl = url.startsWith('http') ? url : `${envConfig.apiBaseUrl}${url}`;

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true });
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: buildHeaders(options),
      success: (res) => {
        if (showLoading) uni.hideLoading();

        const statusCode = res.statusCode;

        if (statusCode === 401) {
          handleAuthError();
          reject(new Error('Unauthorized'));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          const errMsg =
            (res.data as ApiResponse)?.message || `请求失败 (${statusCode})`;
          uni.showToast({ title: errMsg, icon: 'none' });
          reject(new Error(errMsg));
          return;
        }

        const body = res.data as ApiResponse<T>;
        if (body.code !== undefined && body.code !== 0) {
          uni.showToast({ title: body.message || '请求失败', icon: 'none' });
          reject(new Error(body.message));
          return;
        }

        resolve(body.data !== undefined ? body.data : (body as unknown as T));
      },
      fail: (err) => {
        if (showLoading) uni.hideLoading();
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
        reject(new Error(err.errMsg));
      },
    });
  });
}

export function get<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<T> {
  return request<T>({ url, method: 'GET', data, ...options });
}

export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...options });
}

export function put<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...options });
}

export function del<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<T> {
  return request<T>({ url, method: 'DELETE', data, ...options });
}
