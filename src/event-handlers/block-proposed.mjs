import config from 'config';
import Web3 from '../utils/web3.mjs';
// import Web3 from 'web3';
import logger from '../utils/logger.mjs';
import checkBlock from '../services/check-block.mjs';
import BlockError from '../classes/block-error.mjs';
import { getContractInstance, getContractAddress } from '../utils/contract.mjs';
import subscribeToEvent from './event.mjs';
import submitChallenge from '../utils/submitChallenge.mjs';

const { SHIELD_CONTRACT_NAME } = config;

async function submitTransaction(unsignedTransaction, privateKey, shieldAddress, gas, value = 0) {
  const tx = {
    to: shieldAddress,
    data: unsignedTransaction,
    value,
    gas,
  };
  try {
    const web3 = Web3.connection();
    const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
    return web3.eth.sendSignedTransaction(signed.rawTransaction);
  } catch (err) {
    return err;
  }
}

/**
This handler runs whenever a BlockProposed event is emitted by the blockchain
*/
async function blockProposedEventHandler(data) {
  const { b: block, t: transactions } = data.returnValues;
  logger.info('Received BlockProposed event');
  try {
    await checkBlock(block, transactions);
    logger.info('Block was valid');
  } catch (err) {
    if (err instanceof BlockError) {
      logger.warn(`Block invalid, with code ${err.code}! ${err.message}`);
      if (process.env.IS_CHALLENGER === 'true') {
        const shieldContractInstance = await getContractInstance(SHIELD_CONTRACT_NAME);
        let txDataToSign;
        let receipt;
        if (err.code === 4) {
          logger.debug(`Challenging the root of block ${JSON.stringify(block, null, 2)}`);

          // Getting prior block hash // TODO remove signing here and sending
          txDataToSign = await shieldContractInstance.methods
            .blockHashes(block.blockHash)
            .encodeABI();
          receipt = await submitTransaction(
            txDataToSign,
            '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d', // privateKey,
            await getContractAddress(SHIELD_CONTRACT_NAME),
            10000000, // gas,
          );
          const priorBlockHash = receipt.logs[1];
          // priorBlockHash =
          const eventData = await subscribeToEvent(shieldContractInstance, 'BlockProposed', [
            priorBlockHash,
          ]);
          // const priorBlock =
          // const priorBlockLastTransaction =
          // priorBlockLastTransaction =
          // txDataToSign = await shieldContractInstance.methods
          //   .challengeNewRootCorrect(priorBlock, priorBlockLastTransaction, block, transactions)
          //   .encodeABI();
        } else if (err.code === 0) {
          txDataToSign = await shieldContractInstance.methods
            .challengeBlockIsReal(block)
            .encodeABI();
          await submitChallenge(txDataToSign);
        } else {
          // To write
        }
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
      } else {
        // only proposer not a challenger
        logger.info(
          "Faulty block detected. Don't submit new blocks until the faulty blocks are removed",
        );
      }
    } else throw new Error(err);
  }
}

export default blockProposedEventHandler;
