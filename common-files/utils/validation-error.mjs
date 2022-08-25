/* eslint no-useless-constructor: off */

/**
 * An Error class to report validation errors. It covers all sort of validations,
 * and signals that something went wrong during a validation.
 * It is used in the `errorHandler` to report 400 HTTP statuses (see httputils.mjs).
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
  }
}

export default ValidationError;
