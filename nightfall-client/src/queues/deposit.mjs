import logger from 'common-files/utils/logger.mjs';
import deposit from '../services/deposit.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('deposit', async message => {
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      const txDataToSign = await deposit(JSON.parse(message.content.toString()));
      logger.debug('returning raw transaction');
      logger.trace(` raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);

      response.data = { txDataToSign };
    } catch (err) {
      logger.error(err);
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
