import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/hooks/usePermission';

interface AuthRouteProps {
  permission?: string;
  children: React.ReactNode;
}

export default function AuthRoute({ permission, children }: AuthRouteProps) {
  const token = useAuthStore((s) => s.token);
  const { hasPermission } = usePermission();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
