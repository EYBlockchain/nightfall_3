/* eslint-disable import/no-unresolved */
/* eslint-disable no-await-in-loop */
/**
Module that runs up as a proposer
*/
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

const TIMER_CACP = process.env.TIMER_CACP || 30;
const MAX_ROTATE_TIMES = process.env.MAX_ROTATE_TIMES || 2;

/**
 * check that it is possible to make the proposer change by checking the following conditions:
 * the number of registered proposers is greater than 1
 * the time window reserved for the previous proposer is passed
 * if the two conditions are met, the changeCurrentProposer function is automatically called
 */
async function checkAndChangeProposer(nf3) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.info('Checking Proposer...');
    const proposerStartBlock = await nf3.proposerStartBlock();
    const rotateProposerBlocks = await nf3.getRotateProposerBlocks();
    const numproposers = await nf3.getNumProposers();
    const currentSprint = await nf3.currentSprint();
    const currentBlock = await nf3.web3.eth.getBlockNumber();

    if (currentBlock - proposerStartBlock >= rotateProposerBlocks && numproposers > 1) {
      const spanProposersList = await nf3.spanProposersList(currentSprint);
      logger.info(`Proposer address: ${spanProposersList} and sprint: ${currentSprint}`);
      try {
        if (spanProposersList[currentSprint] === nf3.ethereumAddress) {
          logger.info(`${nf3.ethereumAddress} is Calling changeCurrentProposer`);
          await nf3.changeCurrentProposer();
        } else if (currentBlock - proposerStartBlock >= rotateProposerBlocks * MAX_ROTATE_TIMES) {
          logger.info(`${nf3.ethereumAddress} is Calling changeCurrentProposer`);
          await nf3.changeCurrentProposer();
        }
      } catch (err) {
        logger.info(err);
      }
    } else {
      logger.info(`the proposer is not changed. sprint: ${currentSprint}`);
    }
    await new Promise(resolve => setTimeout(resolve, TIMER_CACP * 1000));
  }
}

/**
Does the preliminary setup and starts listening on the websocket
*/
export default async function startProposer(nf3, proposerBaseUrl) {
  logger.info('Starting Proposer...');
  // Mnemonic are only required for services connecting to a client that
  // can generate a compressed PKD.

  await nf3.init(undefined, 'optimist');
  if (await nf3.healthcheck('optimist')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');
  logger.info('Attempting to register proposer');

  const blockStake = await nf3.getBlockStake();
  const minimumStake = await nf3.getMinimumStake();

  console.log(`blockStake: ${blockStake}, minimumStake: ${minimumStake}`);

  try {
    await nf3.registerProposer(proposerBaseUrl, minimumStake);
  } catch (err) {
    logger.info(err);
  }
  logger.debug('Proposer healthcheck up');

  // If the emitter is not defined it causes the process to exit
  const blockProposeEmitter = await nf3.startProposer();
  checkAndChangeProposer(nf3);
  blockProposeEmitter
    .on('receipt', (receipt, block) => {
      logger.debug(
        `L2 Block with L2 block number ${block.blockNumberL2} was proposed. The L1 transaction hash is ${receipt.transactionHash}`,
      );
    })
    .on('error', async (error, block) => {
      logger.error(error);
      logger.error(
        `ERROR!!!! Proposing L2 Block with L2 block number ${block.blockNumberL2} failed due to error: ${error.message} `,
      );
      if (error.message.includes('Transaction has been reverted by the EVM')) {
        const stakeAccount = await nf3.getProposerStake();
        console.log('CURRENT STAKE: ', stakeAccount);
        if (stakeAccount.amount <= blockStake) {
          logger.info('Updating the stake...');
          await nf3.updateProposer(proposerBaseUrl, minimumStake, 0);
          logger.info('Stake updated!!!!!');
        }
      }
    });
  logger.info('Listening for incoming events');
}
