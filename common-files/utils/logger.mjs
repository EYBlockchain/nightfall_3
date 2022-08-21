/* eslint import/no-extraneous-dependencies: "off" */
/* eslint no-unused-vars: "off" */

import config from 'config';
import pino from 'pino';
import isDev from './utils.mjs';
import correlator from './correlation-id.mjs';

const LOGGER_TIME_STRING = 'yyyy-mm-dd HH:MM:ss.l';

const getInstance = () => {
  const pinoOptions = {
    level: config.LOG_LEVEL || 'info',
    formatters: {
      // echoes the level as the label instead of the number
      level(label, number) {
        return { level: label };
      },
      // removes the pid and hostname fields from the logs
      bindings(bindings) {
        return { correlationId: correlator.getId() };
      },
    },
    timestamp: () => `,"time": "${new Date(Date.now()).toISOString()}"`,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname,filename',
        translateTime: LOGGER_TIME_STRING,
      },
    },
  };

  if (!isDev()) {
    delete pinoOptions.transport;
  }

  return pino(pinoOptions);
};

const instance = getInstance();

export default instance;
