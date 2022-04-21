import rabbitmq from '../utils/rabbitmq.mjs';
import logger from '../utils/logger.mjs';
import generateProof from '../services/generateProof.mjs';

export default function receiveMessage() {
  rabbitmq.receiveMessage('generate-proof', async message => {
    const { replyTo, correlationId } = message.properties;

    const response = {
      error: null,
      data: null,
    };

    try {
      response.data = await generateProof(JSON.parse(message.content.toString()));
    } catch (err) {
      logger.error('Error in generate-proof', err);
      response.error = 'Proof generation failed';
    }

    rabbitmq.sendMessage(replyTo, response, { correlationId });
    rabbitmq.sendACK(message);
  });
}
