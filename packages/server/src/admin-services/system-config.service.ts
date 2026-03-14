import { prisma } from '../utils/prisma';
import { getRedis } from '../utils/redis';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const CONFIG_CACHE_PREFIX = 'sys:config:';
const CONFIG_CACHE_TTL = 600; // 10 minutes
const CONFIG_CHANGE_CHANNEL = 'sys:config:changed';

export class SystemConfigService {
  async getAll() {
    return prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  async getValue(key: string): Promise<string | null> {
    const redis = getRedis();
    const cacheKey = `${CONFIG_CACHE_PREFIX}${key}`;

    const cached = await redis.get(cacheKey);
    if (cached !== null) return cached;

    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (!config) return null;

    await redis.set(cacheKey, config.value, 'EX', CONFIG_CACHE_TTL);
    return config.value;
  }

  async setValue(key: string, value: string, description?: string) {
    const config = await prisma.systemConfig.upsert({
      where: { key },
      update: { value, ...(description !== undefined && { description }) },
      create: { key, value, description },
    });

    const redis = getRedis();
    await redis.set(`${CONFIG_CACHE_PREFIX}${key}`, value, 'EX', CONFIG_CACHE_TTL);
    await redis.publish(CONFIG_CHANGE_CHANNEL, JSON.stringify({ key, value }));

    logger.info({ key, value }, 'System config updated');
    return config;
  }

  async deleteConfig(key: string) {
    const config = await prisma.systemConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundError('SystemConfig');

    await prisma.systemConfig.delete({ where: { key } });

    const redis = getRedis();
    await redis.del(`${CONFIG_CACHE_PREFIX}${key}`);
    await redis.publish(CONFIG_CHANGE_CHANNEL, JSON.stringify({ key, deleted: true }));

    return config;
  }

  subscribeToChanges(callback: (data: { key: string; value?: string; deleted?: boolean }) => void) {
    const redis = getRedis().duplicate();
    redis.subscribe(CONFIG_CHANGE_CHANNEL);
    redis.on('message', (_channel, message) => {
      try {
        callback(JSON.parse(message));
      } catch (err) {
        logger.error({ err }, 'Failed to parse config change message');
      }
    });
    return () => {
      redis.unsubscribe(CONFIG_CHANGE_CHANNEL);
      redis.disconnect();
    };
  }
}
