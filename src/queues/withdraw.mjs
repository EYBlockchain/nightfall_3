import logger from '../utils/logger.mjs';
import withdraw from '../services/withdraw.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('withdraw', async message => {
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      const txToSign = await withdraw(JSON.parse(message.content.toString()));
      logger.debug('returning raw transaction');
      logger.silly(` raw transaction is ${JSON.stringify(txToSign, null, 2)}`);

      response.data = { txToSign };
    } catch (err) {
      logger.error(err);
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
