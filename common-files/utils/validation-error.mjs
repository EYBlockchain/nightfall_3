/* eslint no-useless-constructor: off */

/**
 * An Error class that designates a validation error. All sort of validations are supposed to throw this
 * error, which will sign that something wrong happened during a validation. By using the errorHandler defined
 * in httputils.mjs, this error is handled appropriately returning the 400 HTTP Status with the message provided
 * in the error caught.
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
  }
}

export default ValidationError;
