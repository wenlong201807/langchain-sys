import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AdminUserService } from '../admin-services/user.service';
import { adminAuthMiddleware } from '../admin-middleware/admin-auth.middleware';
import { requirePermission } from '../admin-middleware/rbac-guard.middleware';
import { auditLog } from '../admin-middleware/audit-logger.middleware';
import { ValidationError } from '../utils/errors';

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  tier: z.enum(['FREE', 'PRO']).optional(),
});

const setStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export async function adminUserRoutes(app: FastifyInstance) {
  const userService = new AdminUserService();

  app.addHook('preHandler', adminAuthMiddleware);

  // List users
  app.get(
    '/users',
    { preHandler: [requirePermission('user:read')] },
    async (request, reply) => {
      const parsed = listUsersSchema.safeParse(request.query);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

      const result = await userService.listUsers(parsed.data);
      return reply.send({ success: true, data: result });
    }
  );

  // Get user detail
  app.get<{ Params: { userId: string } }>(
    '/users/:userId',
    { preHandler: [requirePermission('user:read')] },
    async (request, reply) => {
      const user = await userService.getUserDetail(request.params.userId);
      return reply.send({ success: true, data: user });
    }
  );

  // Disable / enable user
  app.patch<{ Params: { userId: string } }>(
    '/users/:userId/status',
    {
      preHandler: [
        requirePermission('user:disable'),
        auditLog({
          action: 'UPDATE_USER_STATUS',
          module: 'user',
          getResource: (req) => (req.params as { userId: string }).userId,
          getChanges: (req) => req.body,
        }),
      ],
    },
    async (request, reply) => {
      const parsed = setStatusSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

      const user = await userService.setUserStatus(request.params.userId, parsed.data.status);
      return reply.send({ success: true, data: user });
    }
  );
}
