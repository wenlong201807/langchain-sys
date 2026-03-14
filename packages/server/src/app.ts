import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { getConfig } from './config';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';
import { getRedis, closeRedis } from './utils/redis';
import { registerUserRoutes } from './routes';
import { registerAdminRoutes } from './admin-routes';
import { AppError } from './utils/errors';

async function bootstrap() {
  const config = getConfig();

  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  const isDev = config.server.env === 'development';
  
  const corsOptions = isDev
    ? {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3005',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:8080',
          'http://localhost:8081',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3005',
          'http://127.0.0.1:8081',
        ],
        credentials: true,
      }
    : {
        origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
        credentials: true,
      };

  await app.register(cors, corsOptions);

  await app.register(helmet, {
    contentSecurityPolicy: config.server.env === 'production' ? undefined : false,
  });

  // Health check
  app.get('/health', async (_request, reply) => {
    const checks: Record<string, string> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      const redis = getRedis();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    const status = healthy ? 200 : 503;

    return reply.status(status).send({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // User-facing API routes
  await app.register(registerUserRoutes, { prefix: '/api/v1' });

  // Admin API routes
  await app.register(registerAdminRoutes, { prefix: '/api/admin/v1' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      logger.warn(
        { err: error, path: request.url, method: request.method },
        error.message
      );
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...('details' in error ? { details: (error as any).details } : {}),
        },
      });
    }

    // Fastify built-in validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    logger.error(
      { err: error, path: request.url, method: request.method },
      'Unhandled error'
    );

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          config.server.env === 'production'
            ? 'Internal server error'
            : error.message,
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Start server
  try {
    await app.listen({ port: config.server.port, host: config.server.host });
    logger.info(
      { port: config.server.port, env: config.server.env },
      `ThinkAgent server started on http://${config.server.host}:${config.server.port}`
    );
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');
    try {
      await app.close();
      await prisma.$disconnect();
      await closeRedis();
      logger.info('Cleanup complete, exiting');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
