import config from 'config';
import logger from '../utils/logger.mjs';
import { getContractInstance } from '../utils/contract.mjs';

const { SHIELD_CONTRACT_NAME } = config;

let ws;

export function setChallengeWebSocketConnection(_ws) {
  ws = _ws;
}

function submitChallenge(message) {
  logger.debug(
    `raw challenge transaction has been sent to be signed and submitted ${JSON.stringify(
      message,
      null,
      2,
    )}`,
  );
  ws.send(message);
}

export default async function createChallenge(block, transactions, err) {
  logger.warn(`Block invalid, with code ${err.code}! ${err.message}`);
  if (process.env.IS_CHALLENGER === 'true') {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    let txDataToSign;
    switch (err.code) {
      case 0:
        txDataToSign = await shieldContractInstance.methods.challengeBlockHash(block).encodeABI();
        await submitChallenge(txDataToSign);
        break;
      case 1:
      case 2:
        txDataToSign = await shieldContractInstance.methods
          .challengeTransactionHashesInBlock(block, transactions, err.metadata.index)
          .encodeABI();
        await submitChallenge(txDataToSign);
        break;
      case 3:
        txDataToSign = await shieldContractInstance.methods
          .challengeTransactionCount(block, transactions)
          .encodeABI();
        await submitChallenge(txDataToSign);
        break;
      case 4:
        // // Getting prior block hash // TODO remove signing here and sending
        // txDataToSign = await shieldContractInstance.methods
        //   .blockHashes(block.blockHash)
        //   .encodeABI();
        // receipt = await submitTransaction(
        //   txDataToSign,
        //   '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', // privateKey,
        //   await getContractAddress(SHIELD_CONTRACT_NAME),
        //   10000000, // gas,
        // );
        // const priorBlockHash = receipt.logs[1];
        // // priorBlockHash =
        // const eventData = await subscribeToEvent(shieldContractInstance, 'BlockProposed', [
        //   priorBlockHash,
        // ]);
        // const priorBlock =
        // const priorBlockLastTransaction =
        // priorBlockLastTransaction =
        // txDataToSign = await shieldContractInstance.methods
        //   .challengeNewRootCorrect(priorBlock, priorBlockLastTransaction, block, transactions)
        //   .encodeABI();
        // receipt = await submitTransaction(
        //   txDataToSign,
        //   '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', // privateKey,
        //   await getContractAddress(SHIELD_CONTRACT_NAME),
        //   10000000, // gas,
        // );
        // create challenge transaction and submit
        // logger.debug('returning raw transaction');
        // logger.silly(`raw transaction is ${JSON.stringify(txDataToSign, null, 2)}`);
        // res.json({ txDataToSign, priorBlock, priorBlockLastTransaction, block, transactions });
        break;
      case 5:
        txDataToSign = await shieldContractInstance.methods.challengeBlockIsReal(block).encodeABI();
        await submitChallenge(txDataToSign);
        break;
      default:
      // code block
    }
  } else {
    // only proposer not a challenger
    logger.info(
      "Faulty block detected. Don't submit new blocks until the faulty blocks are removed",
    );
  }
}
