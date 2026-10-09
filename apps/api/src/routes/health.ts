import { Router } from 'express';
import { currentRequestId } from '../middleware/request-id.js';
import { success } from '../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json(
    success(
      {
        status: 'ok' as const,
        service: 'turf-and-taste-api' as const,
        timestamp: new Date().toISOString(),
        gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? 'unknown',
        buildTimestamp:
          process.env.VERCEL_BUILD_TIMESTAMP ??
          process.env.BUILD_TIMESTAMP ??
          new Date().toISOString(),
        environment: process.env.VERCEL_ENV ?? 'development',
      },
      currentRequestId(res),
    ),
  );
});
