/* eslint-disable import/no-unresolved */
/**
Module that runs up as a proposer
*/
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

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

  await nf3.registerProposer(proposerBaseUrl, minimumStake);
  logger.debug('Proposer healthcheck up');

  // If the emitter is not defined it causes the process to exit
  const blockProposeEmitter = await nf3.startProposer();
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
