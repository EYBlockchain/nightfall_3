/* eslint import/no-extraneous-dependencies: "off" */
/* eslint no-unused-vars: "off" */
/* eslint no-param-reassign: "off" */

import config from 'config';
import pino from 'pino';
import { isLocal } from './utils.mjs';
import correlator from './correlation-id.mjs';
import { pid } from 'node:process';

const LOGGER_TIME_STRING = 'yyyy-mm-dd HH:MM:ss.l';

const getInstance = () => {
  const pinoOptions = {
    level: config.LOG_LEVEL || 'info',
    base: undefined,
    hooks: {
      logMethod(inputArgs, method, level) {
        if (inputArgs.length === 1 && typeof inputArgs[0] === 'string') {
          inputArgs[0] = { msg: inputArgs[0] };
        }

        return method.apply(this, inputArgs);
      },
    },
    mixin() {
      return { correlationId: correlator.getId(), pid: pid };
    },
    mixinMergeStrategy(mergeObject, mixinObject) {
      return Object.assign(mergeObject, mixinObject);
    },
    formatters: {
      // echoes the level as the label instead of the number
      level(label, number) {
        return { level: label };
      },
    },
    timestamp: () => `,"time": "${new Date(Date.now()).toISOString()}"`,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'hostname,filename',
        translateTime: LOGGER_TIME_STRING,
      },
    },
  };

  if (!isLocal()) {
    delete pinoOptions.transport;
  }

  return pino(pinoOptions);
};

const instance = getInstance();

export default instance;
