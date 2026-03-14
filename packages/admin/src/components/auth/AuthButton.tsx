import { Button, Tooltip } from 'antd';
import type { ButtonProps } from 'antd';
import { usePermission } from '@/hooks/usePermission';

interface AuthButtonProps extends ButtonProps {
  permission: string;
}

export default function AuthButton({
  permission,
  children,
  ...rest
}: AuthButtonProps) {
  const { hasPermission } = usePermission();

  if (!hasPermission(permission)) {
    return (
      <Tooltip title="No permission">
        <Button {...rest} disabled>
          {children}
        </Button>
      </Tooltip>
    );
  }

  return <Button {...rest}>{children}</Button>;
}
