/* eslint import/no-extraneous-dependencies: "off" */

/*
  Pulled from https://github.com/winstonjs/winston/issues/1427 with some edits.
*/

import winston from 'winston';
import util from 'util';
import config from 'config';

const { createLogger, format, transports } = winston;
const { inspect } = util;

function formatWithInspect(val) {
  return `${val instanceof Object ? '\n' : ''} ${inspect(val, {
    depth: null,
    colors: true,
  })}`;
}

export default createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    format.errors({ stack: true }),
    format.colorize(),
    format.printf(info => {
      const splatArgs = info[Symbol.for('splat')];
      let log = `${info.level}: ${info.message}`;

      // append splat messages to log
      if (splatArgs) {
        const rest = splatArgs.map(formatWithInspect).join();
        log += ` ${rest}`;
      }

      // check if error log, if so append error stack
      if (info.stack) {
        log += ` ${info.stack}`;
      }
      return log;
    }),
  ),
  transports: [new transports.Console()],
});
