import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error.js';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource does not exist.'));
}
