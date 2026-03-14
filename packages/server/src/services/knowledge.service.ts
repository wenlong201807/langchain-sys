import { prisma } from '../utils/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export class KnowledgeService {
  async createKnowledgeBase(userId: string, name: string, description?: string) {
    return prisma.knowledgeBase.create({
      data: { userId, name, description },
    });
  }

  async listKnowledgeBases(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { documents: true } },
        },
      }),
      prisma.knowledgeBase.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async getKnowledgeBase(userId: string, kbId: string) {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: kbId },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, chunkCount: true, createdAt: true },
        },
      },
    });
    if (!kb) throw new NotFoundError('KnowledgeBase');
    if (kb.userId !== userId) throw new ForbiddenError();
    return kb;
  }

  async updateKnowledgeBase(userId: string, kbId: string, data: { name?: string; description?: string }) {
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundError('KnowledgeBase');
    if (kb.userId !== userId) throw new ForbiddenError();

    return prisma.knowledgeBase.update({
      where: { id: kbId },
      data,
    });
  }

  async deleteKnowledgeBase(userId: string, kbId: string) {
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    if (!kb) throw new NotFoundError('KnowledgeBase');
    if (kb.userId !== userId) throw new ForbiddenError();
    await prisma.knowledgeBase.delete({ where: { id: kbId } });
  }
}
