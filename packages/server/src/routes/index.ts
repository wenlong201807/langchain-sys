import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { chatRoutes } from './chat.routes';
import { knowledgeRoutes } from './knowledge.routes';

export async function registerUserRoutes(app: FastifyInstance) {
  app.register(authRoutes);
  app.register(chatRoutes);
  app.register(knowledgeRoutes);
}
