/* eslint no-useless-constructor: off */

/**
 * An Error class that reports that the operation wasn't able to find something. Is is used in the errorHandler
 * defined in httputils.mjs, this error reports a 404 HTTP Status.
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message);
  }
}

export default NotFoundError;
