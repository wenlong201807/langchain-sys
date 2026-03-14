import { FastifyInstance } from 'fastify';
import { adminAuthRoutes } from './admin-auth.routes';
import { adminUserRoutes } from './user.routes';
import { adminSystemConfigRoutes } from './system-config.routes';
import { adminAuditRoutes } from './audit.routes';

export async function registerAdminRoutes(app: FastifyInstance) {
  app.register(adminAuthRoutes);
  app.register(adminUserRoutes);
  app.register(adminSystemConfigRoutes);
  app.register(adminAuditRoutes);
}
