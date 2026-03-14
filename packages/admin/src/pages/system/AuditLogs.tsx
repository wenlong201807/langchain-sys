import { useState } from 'react';
import { Table, Card, Input, Select, DatePicker, Space, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;

interface AuditLog {
  id: string;
  operator: string;
  action: string;
  target: string;
  ip: string;
  result: 'success' | 'failed';
  createdAt: string;
}

const actions = [
  'login',
  'logout',
  'user.create',
  'user.update',
  'user.disable',
  'content.approve',
  'content.reject',
  'role.create',
  'role.update',
  'config.update',
];

const mockLogs: AuditLog[] = Array.from({ length: 80 }, (_, i) => ({
  id: `log-${i + 1}`,
  operator: `admin${(i % 5) + 1}`,
  action: actions[i % actions.length],
  target: i % 2 === 0 ? `user-${i + 1}` : `content-${i + 1}`,
  ip: `192.168.1.${(i % 255) + 1}`,
  result: i % 8 === 0 ? 'failed' : 'success',
  createdAt: new Date(2026, 2, 14, 10 - (i % 10), i % 60)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19),
}));

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>();

  const filtered = mockLogs.filter((log) => {
    if (search && !log.operator.includes(search) && !log.target.includes(search))
      return false;
    if (actionFilter && log.action !== actionFilter) return false;
    return true;
  });

  const columns: ColumnsType<AuditLog> = [
    { title: 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    { title: 'Operator', dataIndex: 'operator', key: 'operator', width: 120 },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (action: string) => <Tag color="blue">{action}</Tag>,
    },
    { title: 'Target', dataIndex: 'target', key: 'target', width: 140 },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
    {
      title: 'Result',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (result: string) => (
        <Tag color={result === 'success' ? 'green' : 'red'}>
          {result.toUpperCase()}
        </Tag>
      ),
    },
  ];

  return (
    <Card title="Audit Logs">
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search operator/target..."
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
        />
        <Select
          placeholder="Filter by action"
          allowClear
          value={actionFilter}
          onChange={setActionFilter}
          style={{ width: 200 }}
          options={actions.map((a) => ({ label: a, value: a }))}
        />
        <RangePicker />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 15, showTotal: (t) => `Total ${t} logs` }}
        size="small"
      />
    </Card>
  );
}
