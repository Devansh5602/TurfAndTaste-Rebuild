import { Router } from 'express';
import { currentRequestId } from '../middleware/request-id';
import { success } from '../utils/response';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json(
    success(
      {
        status: 'ok' as const,
        service: 'turf-and-taste-api' as const,
        timestamp: new Date().toISOString(),
      },
      currentRequestId(res),
    ),
  );
});
