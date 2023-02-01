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

const { LOG_HTTP_PAYLOAD_ENABLED, LOG_HTTP_FULL_DATA } = config;

const ENDPOINTS_WHITELISTED = 'ENDPOINTS_WHITELISTED';

/**
 * Default obfuscation's rules.
 */
const OBFUSCATION_SETTINGS = {
  '^(?!.*public).*key(s)?$|.*password.*|.*secret.*|.*mnemonic.*|.*salt.*': 'ALL',
};

const doObfuscation = object => {
  return obfuscate(object, OBFUSCATION_SETTINGS);
};

const finished = promisify(stream.finished);

const downloadFile = async (fileUrl, outputLocationPath) => {
  logger.debug(`Downloading file: ${fileUrl}`);

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
    if (correlator.getId()) {
      config.headers[HEADER_CORRELATION_ID] = correlator.getId();
    }

    return config;
  });
};

/* eslint no-else-return: "off" */
const getRequestParam = req => {
  const dataInput = {};

  if (req.query && Object.keys(req.query).length !== 0) dataInput.query = req.query;
  if (req.params && Object.keys(req.params).length !== 0) dataInput.params = req.params;
  if (req.body && Object.keys(req.body).length !== 0) dataInput.body = req.body;

  return dataInput;
};

/**
 * Logs request information if the DEBUG log level is enabled (We can create a
 * environment variable in another moment to handle this).
 */
const requestLogger = (req, res, next) => {
  if (
    req.url === '/healthcheck' ||
    !logger.isLevelEnabled('debug') ||
    LOG_HTTP_PAYLOAD_ENABLED !== 'true'
  ) {
    return next();
  }

  if (LOG_HTTP_FULL_DATA === 'true') {
    logger.debug({
      msg: 'Request info',
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
  } else {
    logger.debug({
      msg: `Call to endpoint '${doObfuscation(req.url)}'`,
      inputParams: doObfuscation(getRequestParam(req)),
    });
  }

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

const logResponseData = (req, res, jsonData) => {
  if (LOG_HTTP_FULL_DATA === 'true') {
    logger.debug({
      msg: 'Response info',
      request: {
        url: doObfuscation(req.url),
        method: req.method,
      },
      response: {
        status: res.statusCode,
        data: doObfuscation(jsonData),
        headers: doObfuscation(res.getHeaders()),
      },
    });
  } else {
    logger.debug({
      msg: `Result from endpoint ${req.baseUrl}${doObfuscation(req.url)} [${res.statusCode}]`,
      result: doObfuscation(jsonData),
    });
  }
};

/**
 * Intercepts response completion then logs the response info.
 */
const addInterceptorForResponseCompletion = (req, res) => {
  res.on('finish', () => {
    logResponseData(req, res, res.locals.jsonResponseData);
  });
};

/**
 * Logs response information if the DEBUG log level is enabled.
 */
const responseLogger = (req, res, next) => {
  if (
    req.url === '/healthcheck' ||
    !logger.isLevelEnabled('debug') ||
    LOG_HTTP_PAYLOAD_ENABLED !== 'true'
  ) {
    return next();
  }

  try {
    addInterceptorForJson(res, next);
    addInterceptorForResponseCompletion(req, res);
    return next();
  } catch (error) {
    return next(error);
  }
};

const isEndpointWhitelisted = req => {
  let result = false;
  req.app.get(ENDPOINTS_WHITELISTED).forEach(e => {
    if (result === false && e) {
      result = req.url.match(e) != null;
    }
  });

  return result;
};

const HEALTH_CHECK_REGEX = new RegExp(/^\/healthcheck\/?$/);
const authenticationHandler = (req, res, next) => {
  if (
    req.url.match(HEALTH_CHECK_REGEX) != null ||
    isEndpointWhitelisted(req) ||
    req.get('x-api-key') === process.env.AUTHENTICATION_KEY
  ) {
    return next();
  }

  logger.warn('Unauthorized access!');

  res.sendStatus(401);

  return null;
};

/**
 * Setup the default filters for the app being passed as parameter. It also enables endpoint authentication when
 * the environment variable AUTHENTICATION_KEY is set: this is the key that will be used to authenticate requests
 * against the request header 'X-API-Key'. Endpoints can be whitelisted by using the environment variable
 * ENDPOINTS_WHITELISTED listing the whitelisted endpoints (e.g. ENDPOINTS_WHITELISTED="/commitment/save, /commitment/delete").
 * The env var ENDPOINTS_WHITELISTED accepts regex expression values.
 *
 * @param {*} app - an instance of 'expressjs'
 * @param {Function} routesDefiner - an annonymous function that receives an expressjs instance and defines the routes
 * @param {boolean} addHealthCheck - adds a /healthcheck endpoint automatically
 * @param {boolean} useFileUpload - adds a middleware for file uploading
 */
export const setupHttpDefaults = (
  app,
  routesDefiner,
  addHealthCheck = true,
  useFileUpload = true,
) => {
  app.use(requestLogger);

  if (process.env.AUTHENTICATION_KEY) {
    const whitelistConf = process.env.ENDPOINTS_WHITELISTED;

    logger.info({ msg: 'Authentication key is defined. Setting up the authentication handler', whitelistConf });

    app.set(
      ENDPOINTS_WHITELISTED,
      whitelistConf ? whitelistConf.split(',').map(v => v.trim()) : [],
    );

    app.use(authenticationHandler);
  }

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
