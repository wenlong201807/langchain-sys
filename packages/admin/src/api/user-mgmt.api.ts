import request from './request';

export interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export interface UserItem {
  id: string;
  username: string;
  nickname: string;
  email: string;
  avatar?: string;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLogin: string;
}

interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getUserList(params: UserListParams): Promise<PageResult<UserItem>> {
  const res = await request.get<unknown, { data: PageResult<UserItem> }>('/users', { params });
  return res.data;
}

export async function getUserDetail(id: string): Promise<UserItem> {
  const res = await request.get<unknown, { data: UserItem }>(`/users/${id}`);
  return res.data;
}

export async function updateUserStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
  await request.put(`/users/${id}/status`, { status });
}

export async function deleteUser(id: string): Promise<void> {
  await request.delete(`/users/${id}`);
}
