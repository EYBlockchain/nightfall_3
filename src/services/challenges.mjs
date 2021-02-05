import config from 'config';
import WebSocket from 'ws';
// import Web3 from '../utils/web3.mjs';
import logger from '../utils/logger.mjs';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
// import subscribeToEvent from './event.mjs';

const { SHIELD_CONTRACT_NAME, ORCHESTRATOR_WS_HOST, ORCHESTRATOR_WS_PORT } = config;

// async function submitTransaction(unsignedTransaction, privateKey, shieldAddress, gas, value = 0) {
//   const tx = {
//     to: shieldAddress,
//     data: unsignedTransaction,
//     value,
//     gas,
//   };
//   try {
//     const web3 = Web3.connection();
//     const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
//     return web3.eth.sendSignedTransaction(signed.rawTransaction);
//   } catch (err) {
//     return err;
//   }
// }

function submitChallenge(message) {
  const client = new WebSocket(`ws://${ORCHESTRATOR_WS_HOST}:${ORCHESTRATOR_WS_PORT}`);
  client.on('open', () => {
    logger.info('Websocket connection open with server');
    logger.debug(
      `raw challenge transaction has been sent to be signed and submitted ${JSON.stringify(
        message,
        null,
        2,
      )}`,
    );
    client.send(message);
  });
  client.on('error', () => {
    logger.info('Websocket connection failed. Retrying... ');
    submitChallenge();
  });
  client.on('close', () => {
    logger.info('Websocket disconnected');
  });
}

export default async function createChallenge(block, transactions, err) {
  logger.warn(`Block invalid, with code ${err.code}! ${err.message}`);
  if (process.env.IS_CHALLENGER === 'true') {
    const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
    let txDataToSign;
    // let receipt;
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
