/* eslint-disable max-classes-per-file */
import axios from 'axios';
import crypto from 'crypto';
import config from 'config';

const {
  WEBHOOK: { CALL_WEBHOOK_MAX_RETRIES, CALL_WEBHOOK_INITIAL_BACKOFF },
} = config;

/**
 * Class for signing request payloads.
 */
class PayloadSigner {
  /**
   * @param {string} signingKey - The signing key.
   */
  constructor(signingkey) {
    this.signingKey = signingkey;
  }

  /**
   * Signs a payload.
   * @param {*} data - The data to be signed.
   * @returns {string} The signature.
   * @throws {Error} If the data is not an object or is null.
   */
  sign(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Data must be an object');
    }

    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
  }
}

/**
 * Class for handling retries with exponential backoff and jitter.
 */
class RetryHandler {
  /**
   * @param {number} maxRetries - The maximum number of retries.
   * @param {number} initialBackoff - The initial backoff time in milliseconds.
   */
  constructor(maxRetries, initialBackoff) {
    this.maxRetries = maxRetries;
    this.initialBackoff = initialBackoff;
  }

  /**
   * Executes a request function with retries.
   * @param {Function} requestFunction - The function to execute with retries.
   * @returns {*} The result of the request function.
   * @throws {Error} If the request function fails after all retries.
   */
  async executeWithRetry(requestFunction, retries = 0) {
    let timeIdToClear;
    if (retries >= this.maxRetries) {
      throw new Error('Failed to execute request after retries');
    }

    try {
      return await requestFunction();
    } catch (error) {
      // Passing an invalid ID to clearTimeout() silently does nothing; no exception is thrown.
      clearTimeout(timeIdToClear);
      // Have an exponential back-off strategy with jitter
      const newBackoff = this.initialBackoff * 2 ** retries + Math.random() * this.initialBackoff;
      timeIdToClear = await new Promise(resolve => setTimeout(resolve, newBackoff));
      return this.executeWithRetry(requestFunction, retries + 1);
    }
  }
}

/**
 * Class for publishing data to webhook destinations.
 */
class WebhookPublisher {
  /**
   * @param {PayloadSigner} signer - The payload signer instance.
   * @param {RetryHandler} retryHandler - The retry handler instance.
   */
  constructor(signer, retryHandler) {
    this.signer = signer;
    this.retryHandler = retryHandler;
  }

  /**
   * Validates the destination configuration
   * @param {Object} destination - the webhook destination configuration
   * @throws {Error} If the destination configuration is invalid
   */
  static validateDestination(destination) {
    if (!destination || typeof destination !== 'object') {
      throw new Error('Invalid destination configuration: must be an object');
    }

    if (!destination.url || typeof destination.url !== 'string') {
      throw new Error('Invalid destination configuration: url must be a string');
    }
  }

  /**
   * Publishes data to a webhook destination.
   * @param {Object} destination - The webhook destination configuration.
   * @param {*} data - The data to be published.
   */
  async publish(destination, data) {
    WebhookPublisher.validateDestination(destination);
    const headers = {};

    if (destination.signingKey) {
      const signature = this.signer.sign(data);
      headers['X-Signature-SHA256'] = signature;
    }

    const requestFunction = async () => {
      const response = await axios.post(destination.url, data, { headers });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }
    };

    await this.retryHandler.executeWithRetry(requestFunction);
  }
}

/**
 * Class for publishing data to various destinations.
 */
export default class DataPublisher {
  /**
   * @param {Array} options - An array of destination configurations.
   */
  constructor(options) {
    this.options = options || [];
  }

  /**
   * Publishes data to all configured destinations/transports.
   * @param {*} data - The data to be published.
   */
  async publish(data) {
    const promises = this.options.map(async destination => {
      try {
        const signer = new PayloadSigner(destination.signingKey);
        const retryHandler = new RetryHandler(
          destination.maxRetries || CALL_WEBHOOK_MAX_RETRIES,
          destination.initialBackoff || CALL_WEBHOOK_INITIAL_BACKOFF,
        );

        switch (destination.type) {
          case 'webhook': {
            const publisher = new WebhookPublisher(signer, retryHandler);
            await publisher.publish(destination, data);
            break;
          }
          // Other destination types can be added here as needed
          default:
            console.error('Unknown destination type:', destination.type);
        }
      } catch (err) {
        console.error('Unable to publish to destination: ', err);
      }
    });

    return Promise.all(promises);
  }
}
