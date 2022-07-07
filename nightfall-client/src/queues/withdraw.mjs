import logger from 'common-files/utils/logger.mjs';
import withdraw from '../services/withdraw.mjs';

export default async function receiveMessage(message, channel) {
  const { replyTo, correlationId } = message.properties;
  const response = {
    error: null,
    data: null,
  };

  try {
    const txDataToSign = await withdraw(JSON.parse(message.content.toString()));
    logger.debug('returning raw transaction');
    logger.silly(` raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);

    response.data = { txDataToSign };
  } catch (err) {
    logger.error(err);
    response.error = err;
  }

  channel.sendMessage(replyTo, response, { correlationId });
}
