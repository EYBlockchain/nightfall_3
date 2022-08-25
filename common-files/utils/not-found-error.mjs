/* eslint no-useless-constructor: off */

/**
 * An Error class to report that the operation couldn't find results. It is used in the `errorHandler`
 * to report 404 HTTP statuses (see httputils.mjs).
 */
class NotFoundError extends Error {
  constructor(message) {
    super(message);
  }
}

export default NotFoundError;
