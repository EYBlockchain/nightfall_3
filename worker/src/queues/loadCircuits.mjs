import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';
import loadCircuits from '../services/loadCircuits.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('load-circuits', async message => {
    const circuits = JSON.parse(message.content.toString());
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      response.data = await loadCircuits(circuits);
    } catch (err) {
      logger.error('Error in load-circuits', err);
      response.error = 'Load-circuits failed';
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
