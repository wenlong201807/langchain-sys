import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
  SafetyOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/usePermission';

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  user: <UserOutlined />,
  content: <FileTextOutlined />,
  setting: <SettingOutlined />,
  role: <SafetyOutlined />,
  audit: <AuditOutlined />,
};

type AntMenuItem = Required<MenuProps>['items'][number];

const allMenuItems: {
  key: string;
  label: string;
  icon?: string;
  permission?: string;
  children?: { key: string; label: string; icon?: string; permission?: string }[];
}[] = [
  { key: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard:view' },
  { key: '/users', label: 'Users', icon: 'user', permission: 'user:view' },
  { key: '/content', label: 'Content', icon: 'content', permission: 'content:view' },
  {
    key: '/system',
    label: 'System',
    icon: 'setting',
    children: [
      { key: '/system/config', label: 'Config', icon: 'setting', permission: 'system:config' },
      { key: '/system/roles', label: 'Roles', icon: 'role', permission: 'system:role' },
      { key: '/system/audit', label: 'Audit Logs', icon: 'audit', permission: 'system:audit' },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const menus = useAuthStore((s) => s.menus);
  const { hasPermission } = usePermission();

  const menuItems: AntMenuItem[] = useMemo(() => {
    const source = menus.length > 0 ? menus : allMenuItems;

    const buildItems = (
      items: typeof allMenuItems
    ): AntMenuItem[] =>
      items
        .filter((item) => {
          if (item.permission && !hasPermission(item.permission)) return false;
          if (item.children) {
            return item.children.some(
              (c) => !c.permission || hasPermission(c.permission)
            );
          }
          return true;
        })
        .map((item) => ({
          key: item.key,
          label: item.label,
          icon: iconMap[item.icon || ''],
          children: item.children
            ? buildItems(item.children as typeof allMenuItems)
            : undefined,
        }));

    return buildItems(source as typeof allMenuItems);
  }, [menus, hasPermission]);

  const selectedKeys = useMemo(() => [location.pathname], [location.pathname]);

  const openKeys = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.length > 1 ? [`/${parts[0]}`] : [];
  }, [location.pathname]);

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ borderRight: 0 }}
    />
  );
}
