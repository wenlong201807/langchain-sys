import { Dropdown, Avatar, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

const { Text } = Typography;

export default function HeaderBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        height: '100%',
        padding: '0 24px',
      }}
    >
      <Dropdown
        menu={{
          items: [
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Logout',
              onClick: handleLogout,
            },
          ],
        }}
        placement="bottomRight"
      >
        <Space style={{ cursor: 'pointer' }}>
          <Avatar
            size="small"
            icon={<UserOutlined />}
            src={user?.avatar}
          />
          <Text style={{ color: '#fff' }}>
            {user?.nickname || user?.username || 'Admin'}
          </Text>
        </Space>
      </Dropdown>
    </div>
  );
}
