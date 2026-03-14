import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../admin-services/audit.service';
import { logger } from '../utils/logger';

interface AuditOptions {
  action: string;
  module: string;
  getResource?: (request: FastifyRequest) => string | undefined;
  getChanges?: (request: FastifyRequest) => unknown;
}

export function auditLog(options: AuditOptions) {
  return async function auditLogHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const startTime = Date.now();

    reply.raw.on('finish', async () => {
      try {
        const admin = request.adminUser;
        if (!admin) return;

        const auditService = new AuditService();
        await auditService.log({
          adminId: admin.sub,
          action: options.action,
          module: options.module,
          resource: options.getResource?.(request),
          changes: options.getChanges?.(request),
          statusCode: reply.statusCode,
          durationMs: Date.now() - startTime,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } catch (err) {
        logger.error({ err }, 'Failed to write audit log');
      }
    });
  };
}
