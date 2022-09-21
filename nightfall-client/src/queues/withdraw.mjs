import logger from 'common-files/utils/logger.mjs';
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
      const txDataToSign = await withdraw(JSON.parse(message.content.toString()));
      logger.debug({
        msg: 'Returning raw transaction',
        rawTransaction: JSON.stringify(txDataToSign, null, 2)
      });

      response.data = { txDataToSign };
    } catch (err) {
      logger.error(err);
      response.error = err;
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
