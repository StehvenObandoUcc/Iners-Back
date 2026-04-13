import { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../dto/response/ApiResponse';
import { HttpError } from '../errors/HttpError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = err instanceof HttpError ? err.status : 500;
  const payload: ApiResponse<never> = {
    success: false,
    data: null,
    error: err.message,
  };
  res.status(status).json(payload);
};
