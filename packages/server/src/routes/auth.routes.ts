import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';

const sendCodeSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, 'Invalid phone number'),
});

const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, 'Invalid phone number'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService();

  app.post('/auth/send-code', async (request, reply) => {
    const parsed = sendCodeSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    await authService.sendVerificationCode(parsed.data.phone);
    return reply.send({ success: true, message: 'Verification code sent' });
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.flatten());

    const result = await authService.loginOrRegister(parsed.data.phone, parsed.data.code);
    return reply.send({ success: true, data: result });
  });

  app.get('/auth/profile', { preHandler: [authMiddleware] }, async (request, reply) => {
    const profile = await authService.getProfile(request.currentUser!.sub);
    return reply.send({ success: true, data: profile });
  });
}
