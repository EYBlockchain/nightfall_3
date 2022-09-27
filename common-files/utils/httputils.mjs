/* ignore unused exports */
/* eslint no-unused-vars: "off" */
/* eslint no-param-reassign: "off" */
/* eslint no-shadow: "off" */

import axios from 'axios';
import fs from 'fs';
import config from 'config';
import * as stream from 'stream';
import { promisify } from 'util';
import bodyParser from 'body-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import ValidationError from './validation-error.mjs';
import NotFoundError from './not-found-error.mjs';
import logger from './logger.mjs';
import correlator from './correlation-id.mjs';
import { isDev, obfuscate } from './utils.mjs';

const { LOG_HTTP_PAYLOAD_ENABLED } = config;

/**
 * Default obfuscation's rules.
 */
const OBFUSCATION_SETTINGS = {
  '.*key(s)?|.*password.*|.*secret.*': 'ALL',
};

const doObfuscation = object => {
  return obfuscate(object, OBFUSCATION_SETTINGS);
};

const finished = promisify(stream.finished);

const downloadFile = async (fileUrl, outputLocationPath) => {
  logger.debug(`Downloading file: $fileUrl`);

  const writer = fs.createWriteStream(outputLocationPath);
  return axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  }).then(response => {
    response.data.pipe(writer);
    return finished(writer); // this is a Promise
  });
};

/**
 * Handles errors raised in the application returning a proper HTTP Status.
 *
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const errorHandler = (err, req, res, next) => {
  logger.error(err);

  if (err instanceof NotFoundError) {
    res.sendStatus(404);
  } else if (err instanceof ValidationError) {
    res.status(400).send(err.message);
  } else {
    const message = !isDev()
      ? 'Sorry, something went wrong. Please, try again later!'
      : err.message;

    res.status(500).send(message);
  }
};

const HEADER_CORRELATION_ID = 'X-Correlation-Id';

/**
 * Adds a correlationId header if absent.
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const handleCorrelationId = (req, res, next) => {
  correlator.bindEmitter(req);
  correlator.bindEmitter(res);
  correlator.bindEmitter(req.socket);

  correlator.withId(() => {
    const currentCorrelationId = correlator.getId();
    res.set(HEADER_CORRELATION_ID, currentCorrelationId);
    next();
  }, req.get(HEADER_CORRELATION_ID));
};

/**
 * Creates axios defaults to be applied in every call.
 */
const applyAxiosDefaults = () => {
  // Creates a request interceptor that adds the correlationId as an HTTP header in every call
  axios.interceptors.request.use(function (config) {
    config.headers[HEADER_CORRELATION_ID] = correlator.getId();
    return config;
  });
};

/**
 * Logs request information if the DEBUG log level is enabled (We can create a
 * environment variable in another moment to handle this).
 */
const requestLogger = (req, res, next) => {
  if (
    req.url === '/healthcheck' ||
    !logger.isLevelEnabled('debug') ||
    LOG_HTTP_PAYLOAD_ENABLED !== true
  ) {
    return next();
  }

  logger.debug({
    message: 'Request info',
    request: {
      method: req.method,
      url: doObfuscation(req.url),
      originalUrl: doObfuscation(req.originalUrl),
      headers: doObfuscation(req.headers),
      query: doObfuscation(req.query),
      params: doObfuscation(req.params),
      body: doObfuscation(req.body),
    },
  });

  return next();
};

/**
 * Intercepts res.json() calls then save the in the res.locals for getting the value
 * later then logging it.
 */
const addInterceptorForJson = (res, next) => {
  const originalJsonHandler = res.json;

  res.json = data => {
    if (data && data.then !== undefined) {
      data
        .then(responseData => {
          res.json = originalJsonHandler;
          originalJsonHandler.call(res, responseData);

          // stores for getting it later
          res.locals.jsonResponseData = responseData;
        })
        .catch(error => {
          next(error);
        });
    } else {
      // stores for getting it later
      res.locals.jsonResponseData = data;

      res.json = originalJsonHandler;
      originalJsonHandler.call(res, data);
    }
  };
};

const logResponseData = (res, jsonData) => {
  logger.debug({
    message: 'Response info',
    response: {
      status: res.statusCode,
      data: doObfuscation(jsonData),
      headers: doObfuscation(res.getHeaders()),
    },
  });
};

/**
 * Intercepts response completion then logs the response info.
 */
const addInterceptorForResponseCompletion = res => {
  res.on('finish', () => {
    logResponseData(res, res.locals.jsonResponseData);
  });
};

/**
 * Logs response information if the DEBUG log level is enabled.
 */
const responseLogger = (req, res, next) => {
  if (
    req.url === '/healthcheck' ||
    !logger.isLevelEnabled('debug') ||
    LOG_HTTP_PAYLOAD_ENABLED !== true
  ) {
    return next();
  }

  try {
    addInterceptorForJson(res, next);
    addInterceptorForResponseCompletion(res);
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Setup the default filters for the app being passed as parameter. This can be extended later to allow
 * additional parameters to be passed to customize the filters/handlers.
 *
 * @param {*} app - an instance of 'expressjs'.
 */
export const setupHttpDefaults = (
  app,
  routesDefiner,
  addHealthCheck = true,
  useFileUpload = true,
) => {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

  applyAxiosDefaults();

  // disable the hint for the framework we're using
  app.disable(`x-powered-by`);

  app.use(handleCorrelationId);
  app.use(cors());
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use(bodyParser.urlencoded({ limit: '2mb', extended: true }));
  app.use(requestLogger);
  app.use(responseLogger);

  if (routesDefiner) {
    routesDefiner(app);
  }

  if (addHealthCheck) {
    app.get('/healthcheck', (req, res) => {
      res.sendStatus(200);
    });
  }

  if (useFileUpload) {
    app.use(
      fileUpload({
        createParentPath: true,
      }),
    );
  }

  app.use(errorHandler); // The Error handler should be the last in the stack!

  logger.info('HTTP handlers setup done!');
};

export default downloadFile;
