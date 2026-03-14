import { AppConfig } from '../types/config.types';

export function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV || 'development') as AppConfig['server']['env'];

  return {
    server: {
      port: parseInt(process.env.PORT || '8080', 10),
      host: process.env.HOST || '0.0.0.0',
      env,
    },
    database: {
      url: requireEnv('DATABASE_URL'),
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
    },
    jwt: {
      secret: requireEnv('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    adminJwt: {
      secret: requireEnv('ADMIN_JWT_SECRET'),
      expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h',
    },
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
