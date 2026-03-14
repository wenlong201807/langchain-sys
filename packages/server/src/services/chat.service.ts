import { prisma } from '../utils/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export class ChatService {
  async createThread(userId: string, title?: string) {
    return prisma.thread.create({
      data: { userId, title: title || 'New Chat' },
    });
  }

  async listThreads(userId: string, page = 1, pageSize = 20) {
    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, role: true, createdAt: true },
          },
        },
      }),
      prisma.thread.count({ where: { userId } }),
    ]);
    return { threads, total, page, pageSize };
  }

  async getThread(userId: string, threadId: string) {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!thread) throw new NotFoundError('Thread');
    if (thread.userId !== userId) throw new ForbiddenError();
    return thread;
  }

  async deleteThread(userId: string, threadId: string) {
    const thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundError('Thread');
    if (thread.userId !== userId) throw new ForbiddenError();
    await prisma.thread.delete({ where: { id: threadId } });
  }

  async addMessage(userId: string, threadId: string, role: 'USER' | 'ASSISTANT' | 'SYSTEM', content: string) {
    const thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundError('Thread');
    if (thread.userId !== userId) throw new ForbiddenError();

    const message = await prisma.message.create({
      data: { threadId, role, content },
    });

    await prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Generate a mock AI streaming response.
   * Yields tokens one at a time with a small delay.
   */
  async *generateMockStream(userMessage: string): AsyncGenerator<string> {
    const responses = [
      `I received your message: "${userMessage.slice(0, 50)}". `,
      'This is a mock AI response from ThinkAgent. ',
      'In production, this would connect to an LLM provider like OpenAI or Anthropic. ',
      'The streaming SSE endpoint is working correctly. ',
      'Each token is sent individually with a small delay to simulate real-time generation.',
    ];

    const fullText = responses.join('');
    const words = fullText.split(' ');

    for (const word of words) {
      yield word + ' ';
      await sleep(50 + Math.random() * 100);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
