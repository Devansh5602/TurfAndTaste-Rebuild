import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const maxRequestIdLength = 100;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= maxRequestIdLength ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export function currentRequestId(res: Response): string {
  const value = res.locals.requestId;
  return typeof value === 'string' ? value : 'unknown';
}
