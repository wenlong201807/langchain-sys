import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SystemConfigService } from '../admin-services/system-config.service';
import { adminAuthMiddleware } from '../admin-middleware/admin-auth.middleware';
import { requirePermission } from '../admin-middleware/rbac-guard.middleware';
import { auditLog } from '../admin-middleware/audit-logger.middleware';
import { ValidationError } from '../utils/errors';

const setConfigSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(5000),
  description: z.string().max(500).optional(),
});

export async function adminSystemConfigRoutes(app: FastifyInstance) {
  const configService = new SystemConfigService();

  app.addHook('preHandler', adminAuthMiddleware);

  // List all configs
  app.get(
    '/system-configs',
    { preHandler: [requirePermission('system_config:read')] },
    async (_request, reply) => {
      const configs = await configService.getAll();
      return reply.send({ success: true, data: configs });
    }
  );

  // Get single config value
  app.get<{ Params: { key: string } }>(
    '/system-configs/:key',
    { preHandler: [requirePermission('system_config:read')] },
    async (request, reply) => {
      const value = await configService.getValue(request.params.key);
      return reply.send({ success: true, data: { key: request.params.key, value } });
    }
  );

  // Set config value
  app.put(
    '/system-configs',
    {
      preHandler: [
        requirePermission('system_config:write'),
        auditLog({
          action: 'UPDATE_SYSTEM_CONFIG',
          module: 'system_config',
          getChanges: (req) => req.body,
        }),
      ],
    },
    async (request, reply) => {
      const parsed = setConfigSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

      const config = await configService.setValue(parsed.data.key, parsed.data.value, parsed.data.description);
      return reply.send({ success: true, data: config });
    }
  );

  // Delete config
  app.delete<{ Params: { key: string } }>(
    '/system-configs/:key',
    {
      preHandler: [
        requirePermission('system_config:write'),
        auditLog({
          action: 'DELETE_SYSTEM_CONFIG',
          module: 'system_config',
          getResource: (req) => (req.params as { key: string }).key,
        }),
      ],
    },
    async (request, reply) => {
      await configService.deleteConfig(request.params.key);
      return reply.status(204).send();
    }
  );
}
