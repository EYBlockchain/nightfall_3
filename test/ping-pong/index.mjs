/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance, Web3Client } from '../utils.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, zkpPublicKeys, ROTATE_PROPOSER_BLOCKS } = config.TEST_OPTIONS;

const txPerBlock =
  process.env.DEPLOYER_ETH_NETWORK === 'mainnet'
    ? process.env.TEST_LENGTH
    : config.TEST_OPTIONS.txPerBlock;

const { TX_WAIT = 1000, TEST_ERC20_ADDRESS } = process.env;

const TEST_LENGTH = 4;
/**
Does the preliminary setup and starts listening on the websocket
*/
export async function userTest(IS_TEST_RUNNER) {
  logger.info('Starting local test...');
  const tokenType = 'ERC20';
  const value = 1;
  const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const nf3 = new Nf3(IS_TEST_RUNNER ? signingKeys.user1 : signingKeys.user2, environment);

  await nf3.init(IS_TEST_RUNNER ? mnemonics.user1 : mnemonics.user2);
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = TEST_ERC20_ADDRESS || (await nf3.getContractAddress('ERC20Mock'));

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log('start balance', startBalance);

  let offchainTx = !!IS_TEST_RUNNER;
  // Create a block of deposits
  for (let i = 0; i < txPerBlock; i++) {
    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId, 0);
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${err}`);
    }
  }

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    await waitForSufficientBalance(nf3, startBalance + value, ercAddress);
    for (let j = 0; j < txPerBlock - 1; j++) {
      try {
        await nf3.transfer(
          offchainTx,
          ercAddress,
          tokenType,
          value,
          tokenId,
          IS_TEST_RUNNER ? zkpPublicKeys.user2 : zkpPublicKeys.user1,
          0,
        );
      } catch (err) {
        if (err.message.includes('No suitable commitments')) {
          // if we get here, it's possible that a block we are waiting for has not been proposed yet
          // let's wait 10x normal and then try again
          logger.warn(
            `No suitable commitments were found for transfer. I will wait ${
              0.01 * TX_WAIT
            } seconds and try one last time`,
          );
          await new Promise(resolve => setTimeout(resolve, 10 * TX_WAIT));
          await nf3.transfer(
            offchainTx,
            ercAddress,
            tokenType,
            value,
            tokenId,
            IS_TEST_RUNNER ? zkpPublicKeys.user2 : zkpPublicKeys.user1,
            0,
          );
        }
      }
      offchainTx = !offchainTx;
    }
    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId);
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
      console.log(`Completed ${i + 1} pings`);
    } catch (err) {
      console.warn('Error deposit', err);
    }
  }

  // Wait for sometime at the end to retrieve balance to include any transactions sent by the other use
  // This needs to be much longer than we may have waited for a transfer
  let loop = 0;
  let loopMax = 10000;
  if (IS_TEST_RUNNER) loopMax = 100; // the TEST_RUNNER must finish first so that its exit status is returned to the tester
  do {
    const endBalance = await retrieveL2Balance(nf3, ercAddress);
    if (endBalance - startBalance === txPerBlock * value + value * TEST_LENGTH && IS_TEST_RUNNER) {
      logger.info('Test passed');
      logger.info(
        `Balance of User (txPerBlock*value (txPerBlock*1) + value received) :
        ${endBalance - startBalance}`,
      );
      logger.info(`Amount sent to other User: ${value * TEST_LENGTH}`);
      nf3.close();
      return 0;
    }

    logger.info(
      `The test has not yet passed because the L2 balance has not increased, or I am not the test runner - waiting:
        Current Transacted Balance is: ${endBalance - startBalance} - Expecting: ${
        txPerBlock * value + value * TEST_LENGTH
      }`,
    );
    await new Promise(resolving => setTimeout(resolving, 20 * TX_WAIT)); // TODO get balance waiting working well
    loop++;
  } while (loop < loopMax);
  return 1;
}

export async function proposerTest() {
  // we must set the URL from the point of view of the client container
  const nf3Proposer = new Nf3(signingKeys.proposer3, environment);
  await nf3Proposer.init(mnemonics.proposer3);

  const stateAddress = await nf3Proposer.getContractAddress('State');
  const stateABI = await nf3Proposer.getContractAbi('State');
  let eventLogs = [];

  const web3Client = new Web3Client();
  web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

  const getCurrentProposer = async () => {
    const stateContractInstance = new nf3Proposer.web3.eth.Contract(stateABI, stateAddress);
    const currentProposer = await stateContractInstance.methods.getCurrentProposer().call();
    return currentProposer;
  };

  const getCurrentSprint = async () => {
    const stateContractInstance = new nf3Proposer.web3.eth.Contract(stateABI, stateAddress);
    const currentSprint = await stateContractInstance.methods.currentSprint().call();
    return currentSprint;
  };

  const proposersBlocks = [];
  let currentProposer = await getCurrentProposer();

  while (currentProposer.thisAddress === '0x0000000000000000000000000000000000000000') {
    await new Promise(resolve => setTimeout(resolve, 10000));
    currentProposer = await getCurrentProposer();
  }

  proposersBlocks.push({ proposer: currentProposer.thisAddress.toUpperCase(), blocks: 0 });

  for (let i = 0; i < 8; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const currentSprint = await getCurrentSprint();
      // eslint-disable-next-line no-await-in-loop
      currentProposer = await getCurrentProposer();
      console.log(
        `     [ Current sprint: ${currentSprint}, Current proposer: ${currentProposer.thisAddress} ]`,
      );

      console.log('     Waiting blocks to rotate current proposer...');
      const initBlock = await nf3Proposer.web3.eth.getBlockNumber();
      let currentBlock = initBlock;
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      let proposerBlock = proposersBlocks.find(
        // eslint-disable-next-line no-loop-func
        p => p.proposer.toUpperCase() === currentProposer.thisAddress.toUpperCase(),
      );
      if (!proposerBlock) {
        proposerBlock = { proposer: currentProposer.thisAddress.toUpperCase(), blocks: 0 };
        proposersBlocks.push(proposerBlock);
      } else {
        proposerBlock.blocks++;
      }

      while (currentBlock - initBlock < ROTATE_PROPOSER_BLOCKS) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentBlock = await nf3Proposer.web3.eth.getBlockNumber();
      }

      for (const pb of proposersBlocks) {
        console.log(`${pb.proposer} : ${pb.blocks}`);
      }
      console.log('     Change current proposer...');
      await nf3Proposer.changeCurrentProposer();
      eventLogs = [];
    } catch (err) {
      console.log(err);
      if (err.message.toLowerCase.includes('timeout')) {
        console.log('     Change current proposer...');
        await nf3Proposer.changeCurrentProposer();
        eventLogs = [];
      }
    }
  }
  await nf3Proposer.close();
  await web3Client.closeWeb3();
}
