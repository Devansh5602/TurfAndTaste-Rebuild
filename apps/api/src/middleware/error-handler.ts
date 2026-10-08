import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors/http-error.js';
import { currentRequestId } from './request-id.js';
import { failure } from '../utils/response.js';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = currentRequestId(res);

  if (error instanceof HttpError) {
    res.status(error.status).json(failure(error.code, error.message, requestId));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(failure('VALIDATION_ERROR', 'The request payload is invalid.', requestId));
    return;
  }

  res.status(500).json(failure('INTERNAL_ERROR', 'The request could not be completed.', requestId));
}
