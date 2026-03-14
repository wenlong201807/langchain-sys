import axios from 'axios';
import { message } from 'antd';
import { config } from '@/config';
import { useAuthStore } from '@/stores/auth.store';

const request = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
});

request.interceptors.request.use(
  (cfg) => {
    const token = useAuthStore.getState().token;
    if (token) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  },
  (error) => Promise.reject(error)
);

request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (data.code !== 0 && data.code !== 200) {
      message.error(data.message || 'Request failed');
      return Promise.reject(new Error(data.message));
    }
    return data;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (error.response?.status === 403) {
      message.error('No permission');
    } else {
      message.error(error.message || 'Network error');
    }
    return Promise.reject(error);
  }
);

export default request;
