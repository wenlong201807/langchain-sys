import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { RbacService } from '../admin-services/rbac.service';

export function requirePermission(...requiredCodes: string[]) {
  return async function rbacGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const admin = request.adminUser;
    if (!admin) {
      throw new UnauthorizedError('Admin authentication required');
    }

    const rbacService = new RbacService();
    const hasAccess = await rbacService.hasPermission(admin.sub, requiredCodes);

    if (!hasAccess) {
      throw new ForbiddenError(`Required permissions: ${requiredCodes.join(', ')}`);
    }
  };
}
