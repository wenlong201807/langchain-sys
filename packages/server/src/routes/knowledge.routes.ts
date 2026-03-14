import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { KnowledgeService } from '../services/knowledge.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';

const createKbSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateKbSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function knowledgeRoutes(app: FastifyInstance) {
  const knowledgeService = new KnowledgeService();

  app.addHook('preHandler', authMiddleware);

  // Create knowledge base
  app.post('/knowledge-bases', async (request, reply) => {
    const parsed = createKbSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const kb = await knowledgeService.createKnowledgeBase(
      request.currentUser!.sub,
      parsed.data.name,
      parsed.data.description
    );
    return reply.status(201).send({ success: true, data: kb });
  });

  // List knowledge bases
  app.get('/knowledge-bases', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const result = await knowledgeService.listKnowledgeBases(
      request.currentUser!.sub,
      parsed.data.page,
      parsed.data.pageSize
    );
    return reply.send({ success: true, data: result });
  });

  // Get knowledge base detail
  app.get<{ Params: { kbId: string } }>('/knowledge-bases/:kbId', async (request, reply) => {
    const kb = await knowledgeService.getKnowledgeBase(request.currentUser!.sub, request.params.kbId);
    return reply.send({ success: true, data: kb });
  });

  // Update knowledge base
  app.patch<{ Params: { kbId: string } }>('/knowledge-bases/:kbId', async (request, reply) => {
    const parsed = updateKbSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const kb = await knowledgeService.updateKnowledgeBase(
      request.currentUser!.sub,
      request.params.kbId,
      parsed.data
    );
    return reply.send({ success: true, data: kb });
  });

  // Delete knowledge base
  app.delete<{ Params: { kbId: string } }>('/knowledge-bases/:kbId', async (request, reply) => {
    await knowledgeService.deleteKnowledgeBase(request.currentUser!.sub, request.params.kbId);
    return reply.status(204).send();
  });
}
