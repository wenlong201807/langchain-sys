import request from './request';

export interface DashboardStats {
  totalUsers: number;
  dau: number;
  messagesToday: number;
  revenue: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await request.get<unknown, { data: DashboardStats }>('/stats/dashboard');
  return res.data;
}

export async function getUserGrowthChart(days: number = 7): Promise<ChartDataPoint[]> {
  const res = await request.get<unknown, { data: ChartDataPoint[] }>('/stats/user-growth', {
    params: { days },
  });
  return res.data;
}

export async function getMessageVolumeChart(days: number = 7): Promise<ChartDataPoint[]> {
  const res = await request.get<unknown, { data: ChartDataPoint[] }>('/stats/message-volume', {
    params: { days },
  });
  return res.data;
}
