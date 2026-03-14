import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuditService } from '../admin-services/audit.service';
import { adminAuthMiddleware } from '../admin-middleware/admin-auth.middleware';
import { requirePermission } from '../admin-middleware/rbac-guard.middleware';
import { ValidationError } from '../utils/errors';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  adminId: z.string().uuid().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export async function adminAuditRoutes(app: FastifyInstance) {
  const auditService = new AuditService();

  app.addHook('preHandler', adminAuthMiddleware);

  app.get(
    '/audit-logs',
    { preHandler: [requirePermission('audit:view')] },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

      const result = await auditService.query(parsed.data);
      return reply.send({ success: true, data: result });
    }
  );
}
