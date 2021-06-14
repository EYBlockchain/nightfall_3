import logger from 'winston';
import config from 'config';

const { createLogger, format, transports } = logger;
const winstonLogger = createLogger({
  level: config.LOG_LEVEL,
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()],
});

export default winstonLogger;
