import { prisma } from '../utils/prisma';
import { getRedis } from '../utils/redis';
import { logger } from '../utils/logger';

const PERMISSION_CACHE_PREFIX = 'admin:perms:';
const PERMISSION_CACHE_TTL = 300; // 5 minutes

export class RbacService {
  async getPermissions(adminId: string): Promise<string[]> {
    const redis = getRedis();
    const cacheKey = `${PERMISSION_CACHE_PREFIX}${adminId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const assignments = await prisma.adminRoleAssignment.findMany({
      where: { adminId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const assignment of assignments) {
      for (const rp of assignment.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }

    const permList = [...permissions];
    await redis.set(cacheKey, JSON.stringify(permList), 'EX', PERMISSION_CACHE_TTL);

    return permList;
  }

  async hasPermission(adminId: string, requiredCodes: string[]): Promise<boolean> {
    const permissions = await this.getPermissions(adminId);

    if (permissions.includes('*')) return true;

    return requiredCodes.some((code) => permissions.includes(code));
  }

  async invalidateCache(adminId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`${PERMISSION_CACHE_PREFIX}${adminId}`);
    logger.debug({ adminId }, 'RBAC cache invalidated');
  }
}
