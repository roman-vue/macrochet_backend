import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import path from 'path';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  logger.info(`--> ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    body: Object.keys(req.body || {}).length ? req.body : undefined,
  });

  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info(`<-- ${req.method} ${req.originalUrl} ${res.statusCode} (${ms}ms)`);
  });

  next();
};
