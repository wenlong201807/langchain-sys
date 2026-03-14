import { useState } from 'react';
import {
  Table,
  Card,
  Input,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Avatar,
} from 'antd';
import {
  SearchOutlined,
  StopOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AuthButton from '@/components/auth/AuthButton';

interface UserRecord {
  id: string;
  username: string;
  nickname: string;
  email: string;
  avatar?: string;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLogin: string;
}

const mockUsers: UserRecord[] = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  username: `user${i + 1}`,
  nickname: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  status: i % 7 === 0 ? 'disabled' : 'active',
  createdAt: new Date(2025, 0, 1 + i).toISOString().slice(0, 10),
  lastLogin: new Date(2026, 2, 14 - (i % 14)).toISOString().slice(0, 10),
}));

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data] = useState(mockUsers);

  const filtered = data.filter(
    (u) =>
      u.username.includes(search) ||
      u.nickname.includes(search) ||
      u.email.includes(search)
  );

  const handleToggleStatus = (record: UserRecord) => {
    const action = record.status === 'active' ? 'disable' : 'enable';
    Modal.confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      content: `Are you sure you want to ${action} "${record.nickname}"?`,
      onOk: () => {
        message.success(`User ${action}d successfully`);
      },
    });
  };

  const columns: ColumnsType<UserRecord> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} src={record.avatar} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname}</div>
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username}</div>
          </div>
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={status === 'active' ? 'green' : 'red'}
          icon={status === 'active' ? <CheckCircleOutlined /> : <StopOutlined />}
        >
          {status.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    { title: 'Last Login', dataIndex: 'lastLogin', key: 'lastLogin', width: 120 },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <AuthButton
          permission="user:edit"
          size="small"
          danger={record.status === 'active'}
          onClick={() => handleToggleStatus(record)}
        >
          {record.status === 'active' ? 'Disable' : 'Enable'}
        </AuthButton>
      ),
    },
  ];

  return (
    <Card title="User Management">
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search users..."
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 300 }}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{
          current: page,
          pageSize: 10,
          total: filtered.length,
          showTotal: (total) => `Total ${total} users`,
          onChange: setPage,
        }}
      />
    </Card>
  );
}
