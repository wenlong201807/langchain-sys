import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ChatService } from '../services/chat.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';

const createThreadSchema = z.object({
  title: z.string().max(200).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export async function chatRoutes(app: FastifyInstance) {
  const chatService = new ChatService();

  app.addHook('preHandler', authMiddleware);

  // Create thread
  app.post('/threads', async (request, reply) => {
    const parsed = createThreadSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const thread = await chatService.createThread(request.currentUser!.sub, parsed.data.title);
    return reply.status(201).send({ success: true, data: thread });
  });

  // List threads
  app.get('/threads', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const result = await chatService.listThreads(request.currentUser!.sub, parsed.data.page, parsed.data.pageSize);
    return reply.send({ success: true, data: result });
  });

  // Get thread with messages
  app.get<{ Params: { threadId: string } }>('/threads/:threadId', async (request, reply) => {
    const thread = await chatService.getThread(request.currentUser!.sub, request.params.threadId);
    return reply.send({ success: true, data: thread });
  });

  // Delete thread
  app.delete<{ Params: { threadId: string } }>('/threads/:threadId', async (request, reply) => {
    await chatService.deleteThread(request.currentUser!.sub, request.params.threadId);
    return reply.status(204).send();
  });

  // Send message + stream AI response via SSE
  app.post<{ Params: { threadId: string } }>(
    '/threads/:threadId/messages',
    async (request, reply) => {
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

      const userId = request.currentUser!.sub;
      const { threadId } = request.params;
      const { content } = parsed.data;

      // Save user message
      await chatService.addMessage(userId, threadId, 'USER', content);

      // Stream AI response via SSE
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let fullResponse = '';

      for await (const token of chatService.generateMockStream(content)) {
        fullResponse += token;
        reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // Save assistant message after streaming completes
      await chatService.addMessage(userId, threadId, 'ASSISTANT', fullResponse.trim());

      reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      reply.raw.end();
    }
  );
}
