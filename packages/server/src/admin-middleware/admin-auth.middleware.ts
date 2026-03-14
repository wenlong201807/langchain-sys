import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';
import { UnauthorizedError } from '../utils/errors';
import { AdminJwtPayload } from '../types/config.types';

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminJwtPayload;
  }
}

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getConfig().adminJwt.secret) as AdminJwtPayload;
    request.adminUser = payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired admin token');
  }
}
