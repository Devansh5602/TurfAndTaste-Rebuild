import cors from 'cors';
import express, { type Express, type Request, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { HelmetOptions } from 'helmet';
import { createRequire } from 'node:module';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import type { ApiEnv } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { requestId } from './middleware/request-id';
import { healthRouter } from './routes/health';
import { createV1Router } from './routes/v1';
import { createSupabaseAdmin } from './db/supabase';

// Helmet's runtime CommonJS export is callable, but its conditional declarations are
// interpreted as a namespace by Vercel's function tracer. Load that documented CJS
// entry explicitly so both the regular compiler and the tracer see one callable shape.
const require = createRequire(import.meta.url);
const helmet = require('helmet') as (options?: Readonly<HelmetOptions>) => RequestHandler;

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
  // The webhook route verifies Razorpay signatures over the exact raw body bytes,
  // so the raw body must be preserved before JSON parsing.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
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

  // Create Supabase admin client for server-side operations
  const supabaseAdmin = createSupabaseAdmin(env);

  app.use('/health', healthRouter);
  app.use('/api/v1', createV1Router(env, supabaseAdmin));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
