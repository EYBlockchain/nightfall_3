import logger from 'common-files/utils/logger.mjs';
import burn from '../services/burn.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('burn', async message => {
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      logger.debug(`Burn queue handler ${message.content.toString()}`);

      const txDataToSign = await burn(JSON.parse(message.content.toString()));
      logger.debug({
        msg: 'Returning raw transaction',
        rawTransaction: JSON.stringify(txDataToSign, null, 2),
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
