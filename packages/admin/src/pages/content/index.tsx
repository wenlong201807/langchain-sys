import { useState } from 'react';
import { Table, Card, Tabs, Tag, Button, Space, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import AuthButton from '@/components/auth/AuthButton';

type ContentStatus = 'pending' | 'approved' | 'rejected';

interface ContentRecord {
  id: string;
  title: string;
  author: string;
  type: 'text' | 'image' | 'video';
  status: ContentStatus;
  reportCount: number;
  createdAt: string;
}

const mockContent: ContentRecord[] = Array.from({ length: 40 }, (_, i) => ({
  id: `content-${i + 1}`,
  title: `Content Item ${i + 1}`,
  author: `user${(i % 20) + 1}`,
  type: (['text', 'image', 'video'] as const)[i % 3],
  status: (['pending', 'approved', 'rejected'] as const)[i % 3],
  reportCount: Math.floor(Math.random() * 10),
  createdAt: new Date(2026, 2, 14 - (i % 14)).toISOString().slice(0, 10),
}));

const statusColors: Record<ContentStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<string>('all');

  const filtered =
    activeTab === 'all'
      ? mockContent
      : mockContent.filter((c) => c.status === activeTab);

  const handleAction = (record: ContentRecord, action: 'approve' | 'reject') => {
    Modal.confirm({
      title: `${action === 'approve' ? 'Approve' : 'Reject'} Content`,
      content: `Are you sure you want to ${action} "${record.title}"?`,
      onOk: () => message.success(`Content ${action}d`),
    });
  };

  const columns: ColumnsType<ContentRecord> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Author', dataIndex: 'author', key: 'author', width: 120 },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ContentStatus) => (
        <Tag color={statusColors[status]}>{status.toUpperCase()}</Tag>
      ),
    },
    { title: 'Reports', dataIndex: 'reportCount', key: 'reportCount', width: 80 },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}>
            View
          </Button>
          {record.status === 'pending' && (
            <>
              <AuthButton
                permission="content:edit"
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleAction(record, 'approve')}
              >
                Approve
              </AuthButton>
              <AuthButton
                permission="content:edit"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleAction(record, 'reject')}
              >
                Reject
              </AuthButton>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title="Content Moderation">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'all', label: `All (${mockContent.length})` },
          {
            key: 'pending',
            label: `Pending (${mockContent.filter((c) => c.status === 'pending').length})`,
          },
          {
            key: 'approved',
            label: `Approved (${mockContent.filter((c) => c.status === 'approved').length})`,
          },
          {
            key: 'rejected',
            label: `Rejected (${mockContent.filter((c) => c.status === 'rejected').length})`,
          },
        ]}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} items` }}
      />
    </Card>
  );
}
