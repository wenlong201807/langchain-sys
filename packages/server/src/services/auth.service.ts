import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { getRedis } from '../utils/redis';
import { getConfig } from '../config';
import { UnauthorizedError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const SMS_CODE_PREFIX = 'sms:code:';
const SMS_CODE_TTL = 300; // 5 minutes

export class AuthService {
  async sendVerificationCode(phone: string): Promise<void> {
    const code = Math.random().toString().slice(2, 8);
    const redis = getRedis();
    await redis.set(`${SMS_CODE_PREFIX}${phone}`, code, 'EX', SMS_CODE_TTL);
    // In production this would call an SMS provider
    logger.info({ phone, code }, 'Mock SMS verification code sent');
  }

  async loginOrRegister(phone: string, code: string): Promise<{ token: string; isNew: boolean }> {
    const redis = getRedis();
    const storedCode = await redis.get(`${SMS_CODE_PREFIX}${phone}`);

    // Allow "000000" as a universal dev bypass code
    if (code !== '000000' && storedCode !== code) {
      throw new UnauthorizedError('Invalid verification code');
    }
    await redis.del(`${SMS_CODE_PREFIX}${phone}`);

    let isNew = false;
    let user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          nickname: `User_${phone.slice(-4)}`,
        },
      });
      isNew = true;
    }

    if (user.status === 'DISABLED') {
      throw new AppError('Account has been disabled', 403, 'ACCOUNT_DISABLED');
    }

    const config = getConfig();
    const token = jwt.sign(
      { sub: user.id, phone: user.phone, tier: user.tier },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return { token, isNew };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        tier: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedError('User not found');
    return user;
  }
}
