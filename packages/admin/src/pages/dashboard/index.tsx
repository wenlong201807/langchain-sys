import { Row, Col, Card, Statistic } from 'antd';
import {
  UserOutlined,
  RiseOutlined,
  MessageOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

const statsData = [
  { title: 'Total Users', value: 128456, icon: <UserOutlined />, color: '#1890ff', prefix: '' },
  { title: 'DAU', value: 23890, icon: <RiseOutlined />, color: '#52c41a', prefix: '' },
  { title: 'Messages Today', value: 892345, icon: <MessageOutlined />, color: '#722ed1', prefix: '' },
  { title: 'Revenue', value: 56780, icon: <DollarOutlined />, color: '#faad14', prefix: '$' },
];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const userGrowthOption = {
  title: { text: 'User Growth (7d)', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' as const },
  xAxis: { type: 'category' as const, data: days },
  yAxis: { type: 'value' as const },
  grid: { left: 60, right: 30, top: 50, bottom: 30 },
  series: [
    {
      name: 'New Users',
      type: 'line',
      smooth: true,
      data: [820, 932, 901, 1234, 1290, 1330, 1520],
      areaStyle: { color: 'rgba(24,144,255,0.15)' },
      lineStyle: { color: '#1890ff' },
      itemStyle: { color: '#1890ff' },
    },
  ],
};

const messageVolumeOption = {
  title: { text: 'Message Volume (7d)', left: 'center', textStyle: { fontSize: 14 } },
  tooltip: { trigger: 'axis' as const },
  xAxis: { type: 'category' as const, data: days },
  yAxis: { type: 'value' as const },
  grid: { left: 60, right: 30, top: 50, bottom: 30 },
  series: [
    {
      name: 'Messages',
      type: 'line',
      smooth: true,
      data: [45000, 52000, 49000, 63000, 58000, 71000, 68000],
      areaStyle: { color: 'rgba(114,46,209,0.15)' },
      lineStyle: { color: '#722ed1' },
      itemStyle: { color: '#722ed1' },
    },
    {
      name: 'Active Sessions',
      type: 'line',
      smooth: true,
      data: [12000, 14200, 13100, 16500, 15800, 18200, 17400],
      areaStyle: { color: 'rgba(82,196,26,0.1)' },
      lineStyle: { color: '#52c41a' },
      itemStyle: { color: '#52c41a' },
    },
  ],
};

export default function DashboardPage() {
  return (
    <div>
      <Row gutter={[16, 16]}>
        {statsData.map((item) => (
          <Col xs={24} sm={12} lg={6} key={item.title}>
            <Card hoverable>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={
                  <span style={{ color: item.color, marginRight: 8 }}>
                    {item.icon}
                  </span>
                }
                valueStyle={{ color: item.color }}
                formatter={(val) => `${item.prefix}${Number(val).toLocaleString()}`}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={userGrowthOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={messageVolumeOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
