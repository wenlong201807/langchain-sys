import { prisma } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import { UserStatus } from '@prisma/client';

interface ListUsersParams {
  page?: number;
  pageSize?: number;
  phone?: string;
  status?: UserStatus;
  tier?: string;
}

export class AdminUserService {
  async listUsers(params: ListUsersParams) {
    const { page = 1, pageSize = 20, phone, status, tier } = params;

    const where: Record<string, unknown> = {};
    if (phone) where.phone = { contains: phone };
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          nickname: true,
          avatar: true,
          tier: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { threads: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, pageSize };
  }

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: { select: { threads: true, knowledgeBases: true } },
      },
    });
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async setUserStatus(userId: string, status: UserStatus) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    return prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }
}
