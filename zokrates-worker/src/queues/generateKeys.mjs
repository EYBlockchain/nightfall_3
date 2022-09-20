import logger from 'common-files/utils/logger.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';
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
    } catch (error) {
      logger.error({ message: 'Error in generate-keys', error });
      response.error = 'Key generation failed';
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
