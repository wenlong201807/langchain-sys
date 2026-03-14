import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { getConfig } from '../config';
import { UnauthorizedError, ValidationError } from '../utils/errors';

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const { username, password } = parsed.data;

    const admin = await prisma.adminUser.findUnique({ where: { username } });
    if (!admin || admin.status === 'DISABLED') {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const config = getConfig();
    const token = jwt.sign(
      { sub: admin.id, username: admin.username },
      config.adminJwt.secret,
      { expiresIn: config.adminJwt.expiresIn }
    );

    return reply.send({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          nickname: admin.nickname,
        },
      },
    });
  });
}
