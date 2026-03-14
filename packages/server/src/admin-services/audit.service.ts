import { prisma } from '../utils/prisma';

interface CreateAuditLogParams {
  adminId: string;
  action: string;
  module: string;
  resource?: string;
  changes?: unknown;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
}

interface QueryAuditLogsParams {
  page?: number;
  pageSize?: number;
  adminId?: string;
  module?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditService {
  async log(params: CreateAuditLogParams) {
    return prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        module: params.module,
        resource: params.resource,
        changes: params.changes as object | undefined,
        statusCode: params.statusCode,
        durationMs: params.durationMs,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  }

  async query(params: QueryAuditLogsParams) {
    const { page = 1, pageSize = 20, adminId, module, action, startDate, endDate } = params;

    const where: Record<string, unknown> = {};
    if (adminId) where.adminId = adminId;
    if (module) where.module = module;
    if (action) where.action = { contains: action };
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: { select: { id: true, username: true, nickname: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pageSize };
  }
}
