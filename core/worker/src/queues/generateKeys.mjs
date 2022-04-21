import rabbitmq from '../utils/rabbitmq.mjs';
import logger from '../utils/logger.mjs';
import generateKeys from '../services/generateKeys.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('generate-keys', async message => {
    const { replyTo, correlationId } = message.properties;
    const response = {
      error: null,
      data: null,
    };

    try {
      response.data = await generateKeys(JSON.parse(message.content.toString()));
    } catch (err) {
      logger.error('Error in generate-keys', err);
      response.error = 'Key generation failed';
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
