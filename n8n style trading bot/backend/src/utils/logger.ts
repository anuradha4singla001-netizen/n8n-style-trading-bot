import winston from 'winston';
const { combine, timestamp, colorize, printf } = winston.format;
const fmt = printf(({ level, message, timestamp, ...meta }) => {
  const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${timestamp} [${level}] ${message}${extra}`;
});
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'HH:mm:ss.SSS' }), colorize(), fmt),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
