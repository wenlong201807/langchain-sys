import Redis from 'ioredis';
import { getConfig } from '../config';
import { logger } from './logger';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    const cfg = getConfig().redis;
    _redis = new Redis({
      host: cfg.host,
      port: cfg.port,
      password: cfg.password || undefined,
      family: 4,
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    _redis.on('connect', () => logger.info('Redis connected'));
    _redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
  }
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
