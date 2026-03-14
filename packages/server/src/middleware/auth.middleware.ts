import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config';
import { UnauthorizedError } from '../utils/errors';
import { JwtPayload } from '../types/config.types';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getConfig().jwt.secret) as JwtPayload;
    request.currentUser = payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
