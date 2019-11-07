import logger from './logger';

export function formatResponse(req, res, next) {
  const { data } = res;
  if (data === undefined) {
    const err = new Error('Url Not Found');
    err.status = 404;
    return next(err);
  }
  return res.status(200).send({
    error: null,
    data,
  });
}

export function formatError(err, req, res, next) {
  console.log('\nsrc/middleware/response formatError()');
  console.log('err:');
  console.log(err);

  next({
    code: err.code,
    message: err.message,
    [process.env.NODE_ENV !== 'production' ? 'errorStack' : undefined]:
      process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
}

export function errorHandler(err, req, res, next) {
  console.log('\nsrc/middleware/response errorHandler()');
  console.log('err:');
  console.log(err);

  res.status(err.status || 500).send({
    error: err,
    data: null,
  });
  next(err);
}

export function logError(err, req, res, next) {
  console.log('\nsrc/middleware/response logError()');
  console.log('err:');
  console.log(err);

  logger.error(
    `${req.method}:${req.url}
    ${JSON.stringify({ error: err.message })}
    ${JSON.stringify({ errorStack: err.stack.split('\n') }, null, 1)}
    ${JSON.stringify({ body: req.body })}
    ${JSON.stringify({ params: req.params })}
    ${JSON.stringify({ query: req.query })}
  `,
  );
  console.error(JSON.stringify(err, null, 2));
  next(err);
}
