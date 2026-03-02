import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error & { status?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Запись не найдена' });
  }

  const status = err.status || 500;
  // Never expose internal server error details to the client
  const message = status === 500 ? 'Internal Server Error' : err.message;

  res.status(status).json({ error: message });
};

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
};
