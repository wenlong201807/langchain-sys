import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tree,
  Space,
  Tag,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import AuthButton from '@/components/auth/AuthButton';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
}

const permissionTree: DataNode[] = [
  {
    title: 'Dashboard',
    key: 'dashboard',
    children: [{ title: 'View Dashboard', key: 'dashboard:view' }],
  },
  {
    title: 'User Management',
    key: 'user',
    children: [
      { title: 'View Users', key: 'user:view' },
      { title: 'Edit Users', key: 'user:edit' },
      { title: 'Delete Users', key: 'user:delete' },
    ],
  },
  {
    title: 'Content',
    key: 'content',
    children: [
      { title: 'View Content', key: 'content:view' },
      { title: 'Edit Content', key: 'content:edit' },
      { title: 'Delete Content', key: 'content:delete' },
    ],
  },
  {
    title: 'System',
    key: 'system',
    children: [
      { title: 'System Config', key: 'system:config' },
      { title: 'Role Management', key: 'system:role' },
      { title: 'Audit Logs', key: 'system:audit' },
    ],
  },
];

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'Super Admin',
    description: 'Full access to everything',
    permissions: ['*'],
    userCount: 2,
  },
  {
    id: '2',
    name: 'Content Moderator',
    description: 'Manage content and users',
    permissions: ['dashboard:view', 'user:view', 'content:view', 'content:edit'],
    userCount: 5,
  },
  {
    id: '3',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['dashboard:view', 'user:view', 'content:view'],
    userCount: 12,
  },
];

export default function RoleManagementPage() {
  const [roles] = useState(mockRoles);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  const openModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      form.setFieldsValue(role);
      setCheckedKeys(role.permissions);
    } else {
      setEditingRole(null);
      form.resetFields();
      setCheckedKeys([]);
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    form.validateFields().then(() => {
      message.success(editingRole ? 'Role updated' : 'Role created');
      setModalOpen(false);
    });
  };

  const handleDelete = (role: Role) => {
    Modal.confirm({
      title: 'Delete Role',
      content: `Delete role "${role.name}"? This cannot be undone.`,
      onOk: () => message.success('Role deleted'),
    });
  };

  const columns: ColumnsType<Role> = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180 },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: string[]) =>
        perms.includes('*') ? (
          <Tag color="gold">ALL</Tag>
        ) : (
          <span>{perms.length} permissions</span>
        ),
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 80,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <AuthButton
            permission="system:role"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            Edit
          </AuthButton>
          <AuthButton
            permission="system:role"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Delete
          </AuthButton>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Role Management"
      extra={
        <AuthButton
          permission="system:role"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
        >
          New Role
        </AuthButton>
      }
    >
      <Table rowKey="id" columns={columns} dataSource={roles} pagination={false} />

      <Modal
        title={editingRole ? 'Edit Role' : 'New Role'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Role Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Content Moderator" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Permissions">
            <Tree
              checkable
              defaultExpandAll
              treeData={permissionTree}
              checkedKeys={checkedKeys}
              onCheck={(keys) => setCheckedKeys(keys as string[])}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
