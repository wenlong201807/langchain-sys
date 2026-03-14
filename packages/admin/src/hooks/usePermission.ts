import { useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions);

  const hasPermission = useCallback(
    (perm: string) => permissions.includes('*') || permissions.includes(perm),
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]) =>
      permissions.includes('*') || perms.some((p) => permissions.includes(p)),
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]) =>
      permissions.includes('*') || perms.every((p) => permissions.includes(p)),
    [permissions]
  );

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}
