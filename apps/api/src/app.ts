import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { ApiEnv } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { requestId } from './middleware/request-id';
import { healthRouter } from './routes/health';
import { v1Router } from './routes/v1';

export function createApp(env: ApiEnv): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === env.WEB_ORIGIN) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);

  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger: pino({ level: env.LOG_LEVEL }),
      }),
    );
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health',
      }),
    );
  }

  app.use('/health', healthRouter);
  app.use('/api/v1', v1Router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
