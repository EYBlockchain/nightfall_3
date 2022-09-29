/* eslint-disable max-classes-per-file */
/* eslint no-useless-constructor: off */

/**
 * An Error class to report validation errors. It covers all sort of validations,
 * and signals that something went wrong during a validation.
 * It is used in the `errorHandler` to report 400 HTTP statuses (see httputils.mjs).
 */
export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.code = 400;
  }
}

/**
 * An Error class to report that the operation couldn't find results. It is used in the `errorHandler`
 * to report 404 HTTP statuses (see httputils.mjs).
 */
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.code = 404;
  }
}

/**
 * An Error class to report that the operation couldn't find results. It is used in the `errorHandler`
 * to report 404 HTTP statuses (see httputils.mjs).
 */
export class InternalServerError extends Error {
  constructor(message) {
    super(message);
    this.code = 500;
  }
}
