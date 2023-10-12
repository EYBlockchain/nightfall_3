import axios from 'axios';
import crypto from 'crypto';

export default class DataPublisher {
  constructor(options) {
    this.options = options || [];
  }

  async publish(data) {
    const promises = this.options.map(async destination => {
      switch (destination.type) {
        case 'webhook': {
          await this.publishWebhook(destination, data);
          break;
        }

        default:
          throw new Error('Unknown destination type');
      }
    });

    await Promise.all(promises);
  }

  publishWebhook = async (destination, data) => {
    const headers = {};

    if (destination.signingkey) {
      const signature = await this.signWebhookPayload(data, destination.signingkey);
      headers['X-Signature'] = signature;
    }

    const response = await axios.post(destination.url, data, { headers });

    if (response.status !== 200) {
      throw new Error('Webhook failed with status: ', response.status);
    }
  };

  signWebhookPayload = (data, signingKey) => {
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
  };
}
