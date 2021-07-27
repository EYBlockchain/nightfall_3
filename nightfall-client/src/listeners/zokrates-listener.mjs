/**
Listens for the return of a zokrates proof
*/
import config from 'config';
import rand from 'common-files/utils/crypto/crypto-random.mjs';
import rabbitmq from '../utils/rabbitmq.mjs';

const { PROOF_QUEUE, ZKP_KEY_LENGTH, PROVING_SCHEME, BACKEND } = config;

const queue = PROOF_QUEUE;
const replyTo = `${queue}-reply`; // replyTo queue

async function submitProof(folderpath, witness, publicData) {
  const correlationId = await rand(ZKP_KEY_LENGTH);
  rabbitmq.sendMessage(
    queue,
    {
      folderpath,
      inputs: witness,
      provingScheme: PROVING_SCHEME,
      backend: BACKEND,
    },
    {
      correlationId,
      replyTo,
      publicData,
    },
  );
  return correlationId;
}

function getProof(correlationId) {
  return new Promise(resolve => {
    rabbitmq.listenToReplyQueue(replyTo, correlationId, data => {
      // TODO handle a reject
      resolve(data);
    });
  });
}

export { submitProof, getProof };
