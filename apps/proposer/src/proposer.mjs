/* eslint-disable import/no-unresolved */
/* eslint-disable no-await-in-loop */
/**
Module that runs up as a proposer
*/
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

/**
Does the preliminary setup and starts listening on the websocket
*/
export default async function startProposer(nf3, optimistApiUrl) {
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

  let nTimes = 0;
  while (nTimes < 10) {
    try {
      await nf3.registerProposer(optimistApiUrl, minimumStake);
    } catch (err) {
      logger.info(err);
    }

    const { proposers } = await nf3.getProposers();
    const proposerFound = proposers.filter(p => p.thisAddress === nf3.ethereumAddress);
    if (proposerFound.length > 0) break;

    nTimes++;
    logger.warn(`Unable to register will try again in 3 seconds`);
    await new Promise(resolve => setTimeout(() => resolve(), 10000));
  }

  logger.debug('Proposer healthcheck up');
  await nf3.close();
  process.exit(0);
}
