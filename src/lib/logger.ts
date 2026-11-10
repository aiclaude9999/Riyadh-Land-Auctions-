import pino from 'pino';

const pretty = process.env.LOG_PRETTY === '1' || (process.env.NODE_ENV !== 'production' && process.env.LOG_PRETTY !== '0');

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { svc: process.env.SERVICE_NAME ?? 'app' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(pretty ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
});

export type Logger = typeof logger;
