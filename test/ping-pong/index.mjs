/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import config from 'config';
import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForSufficientBalance, retrieveL2Balance, topicEventMapping } from '../utils.mjs';
import { NightfallMultiSig } from '../multisig/nightfall-multisig.mjs';

const { signingKeys, addresses, fee } = config.TEST_OPTIONS;

const { TX_WAIT = 1000 } = process.env;

const { WEB3_OPTIONS } = config;

const amountBlockStake = 25;
const amountMinimumStake = 100;
let nfMultiSig;
let multisigContract;
let shieldContract;
let rotateProposerBlocks;
let stateContract;
const tokenType = 'ERC20';
const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000000';

export const getCurrentProposer = async () => {
  const currentProposer = await stateContract.methods.getCurrentProposer().call();
  return currentProposer;
};

const getCurrentSprint = async () => {
  const currentSprint = await stateContract.methods.currentSprint().call();
  return currentSprint;
};

export const getStakeAccount = async proposer => {
  const stakeAccount = await stateContract.methods.getStakeAccount(proposer).call();
  return stakeAccount;
};

const makeBlockAndWaitForEmptyMempool = async optimistUrls => {
  const currentProposer = await getCurrentProposer();
  console.log('CURRENT PROPOSER', currentProposer);
  const url = optimistUrls.find(
    // eslint-disable-next-line no-loop-func
    o => o.proposer.toUpperCase() === currentProposer.thisAddress.toUpperCase(),
  )?.optimistUrl;

  if (url) {
    let res = await axios.get(`${url}/proposer/mempool`);
    while (res.data.result.length > 0) {
      console.log(
        ` *** ${
          res.data.result.length
        } transactions in the mempool (${currentProposer.thisAddress.toUpperCase()} - ${url})`,
      );
      if (res.data.result.length > 0) {
        console.log('     Make block...');
        await axios.get(`${url}/block/make-now`);
        console.log('     Waiting for block to be created');
        await new Promise(resolve => setTimeout(resolve, 20000));
        res = await axios.get(`${url}/proposer/mempool`);
      }
    }
  } else {
    console.log('This current proposer does not have optimist url defined in the compose yml file');
  }
};

/**
  Does deposits and transfer opertations
*/
export async function simpleUserTest(
  TEST_LENGTH,
  value,
  ercAddress,
  nf3,
  listUserAddresses,
  listTransfersSent,
) {
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log('start balance', startBalance);
  let offchainTx = true;

  // Create a block of deposits to have enough funds
  for (let i = 0; i < TEST_LENGTH; i++) {
    listTransfersSent.push({
      from: nf3.zkpKeys.compressedZkpPublicKey,
      to: nf3.zkpKeys.compressedZkpPublicKey,
      value,
    });
    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId, 0);
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${err}`);
    }
  }
  // we should have the deposits in a block before doing transfers
  await waitForSufficientBalance(nf3, startBalance + TEST_LENGTH * value, ercAddress);

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    const userAdressTo = listUserAddresses[Math.floor(Math.random() * listUserAddresses.length)];
    const valueToTransfer = Math.floor(Math.random() * 10) + 1; // Returns a random integer from 1 to 10

    listTransfersSent.push({
      from: nf3.zkpKeys.compressedZkpPublicKey,
      to: userAdressTo,
      value: valueToTransfer,
    });

    try {
      await nf3.transfer(
        offchainTx,
        ercAddress,
        tokenType,
        valueToTransfer,
        tokenId,
        userAdressTo,
        fee,
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
        await nf3.transfer(offchainTx, ercAddress, tokenType, value, tokenId, userAdressTo, 0);
      }
    }
    offchainTx = !offchainTx;

    listTransfersSent.push({
      from: nf3.zkpKeys.compressedZkpPublicKey,
      to: nf3.zkpKeys.compressedZkpPublicKey,
      value: valueToTransfer,
    });

    try {
      await nf3.deposit(ercAddress, tokenType, valueToTransfer, tokenId);
    } catch (err) {
      console.warn('Error deposit', err);
    }

    // await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
  }
}

/**
<<<<<<< HEAD
Does the preliminary setup and starts listening on the websocket
*/
/* export async function userTest(TEST_LENGTH, value, IS_TEST_RUNNER) {
  logger.info('Starting local test...');
  const eventLogs = [];
  const web3Client = new Web3Client();

  environment.clientApiUrl =
    (IS_TEST_RUNNER ? clientApiUrls.client1 : clientApiUrls.client2) || environment.clientApiUrl;
  environment.optimistApiUrl =
    (IS_TEST_RUNNER ? optimistApiUrls.optimist1 : optimistApiUrls.optimist2) ||
    environment.optimistApiUrl;
  environment.optimistWsUrl =
    (IS_TEST_RUNNER ? optimistWsUrls.optimist1 : optimistWsUrls.optimist2) ||
    environment.optimistWsUrl;

  console.log('ENVIRONMENT USER:', environment);
  const nf3 = new Nf3(IS_TEST_RUNNER ? signingKeys.user1 : signingKeys.user2, environment);

  await nf3.init(IS_TEST_RUNNER ? mnemonics.user1 : mnemonics.user2);
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = TEST_ERC20_ADDRESS || (await nf3.getContractAddress('ERC20Mock'));

  rotateProposerBlocks = await nf3.getRotateProposerBlocks();
  stateContract = await nf3.getContractInstance('State');
  const stateAddress = stateContract.options.address;
  web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log('start balance', startBalance);

  let offchainTx = !!IS_TEST_RUNNER;
  // Create a block of deposits
  for (let i = 0; i < TEST_LENGTH; i++) {
    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId, 0);
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${err}`);
    }
  }
  await waitForSufficientBalance(nf3, startBalance + TEST_LENGTH * value, ercAddress);

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    // await waitForSufficientBalance(nf3, startBalance + value, ercAddress);
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

    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId);
    } catch (err) {
      console.warn('Error deposit', err);
    }

    // await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
  }

  // Wait for sometime at the end to retrieve balance to include any transactions sent by the other use
  // This needs to be much longer than we may have waited for a transfer
  let loop = 0;
  let loopMax = 10000;
  if (IS_TEST_RUNNER) loopMax = 100; // the TEST_RUNNER must finish first so that its exit status is returned to the tester
  do {
    const endBalance = await retrieveL2Balance(nf3, ercAddress);
    if (endBalance - startBalance === value * TEST_LENGTH + value * TEST_LENGTH && IS_TEST_RUNNER) {
      logger.info('Test passed');
      logger.info(
        `Balance of User value + value received) :
        ${endBalance - startBalance}`,
      );
      logger.info(`Amount sent to other User: ${value * TEST_LENGTH + value * TEST_LENGTH}`);
      nf3.close();
      return 0;
    }

    logger.info(
      `The test has not yet passed because the L2 balance has not increased, or I am not the test runner - waiting:
        Current Transacted Balance is: ${endBalance - startBalance} - Expecting: ${
        value * TEST_LENGTH + value * TEST_LENGTH
      } (IS_TEST_RUNNER: ${IS_TEST_RUNNER})`,
    );
    await new Promise(resolving => setTimeout(resolving, 20 * TX_WAIT)); // TODO get balance waiting working well
    loop++;
  } while (loop < loopMax);
  return 1;
} */

/**
||||||| parent of f6286264 (fix: add fees)
Does the preliminary setup and starts listening on the websocket
*/
/* export async function userTest(TEST_LENGTH, value, IS_TEST_RUNNER) {
  logger.info('Starting local test...');
  const eventLogs = [];
  const web3Client = new Web3Client();

  environment.clientApiUrl =
    (IS_TEST_RUNNER ? clientApiUrls.client1 : clientApiUrls.client2) || environment.clientApiUrl;
  environment.optimistApiUrl =
    (IS_TEST_RUNNER ? optimistApiUrls.optimist1 : optimistApiUrls.optimist2) ||
    environment.optimistApiUrl;
  environment.optimistWsUrl =
    (IS_TEST_RUNNER ? optimistWsUrls.optimist1 : optimistWsUrls.optimist2) ||
    environment.optimistWsUrl;

  console.log('ENVIRONMENT USER:', environment);
  const nf3 = new Nf3(IS_TEST_RUNNER ? signingKeys.user1 : signingKeys.user2, environment);

  await nf3.init(IS_TEST_RUNNER ? mnemonics.user1 : mnemonics.user2);
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const ercAddress = TEST_ERC20_ADDRESS || (await nf3.getContractAddress('ERC20Mock'));

  stateContract = await nf3.getContractInstance('State');
  const stateAddress = stateContract.options.address;
  web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log('start balance', startBalance);

  let offchainTx = !!IS_TEST_RUNNER;
  // Create a block of deposits
  for (let i = 0; i < TEST_LENGTH; i++) {
    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId, 0);
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${err}`);
    }
  }
  await waitForSufficientBalance(nf3, startBalance + TEST_LENGTH * value, ercAddress);

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    // await waitForSufficientBalance(nf3, startBalance + value, ercAddress);
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

    try {
      await nf3.deposit(ercAddress, tokenType, value, tokenId);
    } catch (err) {
      console.warn('Error deposit', err);
    }

    // await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
  }

  // Wait for sometime at the end to retrieve balance to include any transactions sent by the other use
  // This needs to be much longer than we may have waited for a transfer
  let loop = 0;
  let loopMax = 10000;
  if (IS_TEST_RUNNER) loopMax = 100; // the TEST_RUNNER must finish first so that its exit status is returned to the tester
  do {
    const endBalance = await retrieveL2Balance(nf3, ercAddress);
    if (endBalance - startBalance === value * TEST_LENGTH + value * TEST_LENGTH && IS_TEST_RUNNER) {
      logger.info('Test passed');
      logger.info(
        `Balance of User value + value received) :
        ${endBalance - startBalance}`,
      );
      logger.info(`Amount sent to other User: ${value * TEST_LENGTH + value * TEST_LENGTH}`);
      nf3.close();
      return 0;
    }

    logger.info(
      `The test has not yet passed because the L2 balance has not increased, or I am not the test runner - waiting:
        Current Transacted Balance is: ${endBalance - startBalance} - Expecting: ${
        value * TEST_LENGTH + value * TEST_LENGTH
      } (IS_TEST_RUNNER: ${IS_TEST_RUNNER})`,
    );
    await new Promise(resolving => setTimeout(resolving, 20 * TX_WAIT)); // TODO get balance waiting working well
    loop++;
  } while (loop < loopMax);
  return 1;
} */

/**
=======
>>>>>>> f6286264 (fix: add fees)
Set the block stake parameter for the proposers
*/
const setBlockStake = async amount => {
  let blockStake = await shieldContract.methods.getBlockStake().call();
  if (Number(blockStake) !== amount) {
    const transactions = await nfMultiSig.setBlockStake(
      amount,
      signingKeys.user1,
      addresses.user1,
      await multisigContract.methods.nonce().call(),
      [],
    );
    const approved = await nfMultiSig.setBlockStake(
      amount,
      signingKeys.user2,
      addresses.user1,
      await multisigContract.methods.nonce().call(),
      transactions,
    );
    await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
    blockStake = await shieldContract.methods.getBlockStake().call();
  }
  console.log('BLOCK STAKE SET: ', blockStake);
};

const setMinimumStake = async amount => {
  let minimumStake = await shieldContract.methods.getMinimumStake().call();
  if (Number(minimumStake) !== amount) {
    const transactions = await nfMultiSig.setMinimumStake(
      amount,
      signingKeys.user1,
      addresses.user1,
      await multisigContract.methods.nonce().call(),
      [],
    );
    const approved = await nfMultiSig.setMinimumStake(
      amount,
      signingKeys.user2,
      addresses.user1,
      await multisigContract.methods.nonce().call(),
      transactions,
    );
    await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
    minimumStake = await shieldContract.methods.getMinimumStake().call();
  }
  console.log('MINIMUM STAKE SET: ', minimumStake);
};

/**
Set parameters config for the test
*/
export async function setParametersConfig(nf3User) {
  stateContract = await nf3User.getContractInstance('State');
  const proposersContract = await nf3User.getContractInstance('Proposers');
  const challengesContract = await nf3User.getContractInstance('Challenges');
  shieldContract = await nf3User.getContractInstance('Shield');
  multisigContract = await nf3User.getContractInstance('SimpleMultiSig');

  nfMultiSig = new NightfallMultiSig(
    nf3User.web3,
    {
      state: stateContract,
      proposers: proposersContract,
      shield: shieldContract,
      challenges: challengesContract,
      multisig: multisigContract,
    },
    2,
    await nf3User.web3.eth.getChainId(),
    WEB3_OPTIONS.gas,
  );

  await setBlockStake(amountBlockStake);
  await setMinimumStake(amountMinimumStake);
}

/**
Proposer test for checking different points for the PoS
*/
export async function proposerTest(optimistUrls, proposersStats, nf3Proposer) {
  console.log('OPTIMISTURLS', optimistUrls);

  try {
    const stateAddress = stateContract.options.address;

    const proposersBlocks = [];
    // eslint-disable-next-line no-param-reassign
    proposersStats.proposersBlocks = proposersBlocks;
    // eslint-disable-next-line no-param-reassign
    proposersStats.sprints = 0;

    let currentProposer = await getCurrentProposer();

    nf3Proposer.web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      let proposerBlock = proposersBlocks.find(
        // eslint-disable-next-line no-loop-func
        p => p.proposer.toUpperCase() === currentProposer.thisAddress.toUpperCase(),
      );

      if (!proposerBlock) {
        proposerBlock = {
          proposer: currentProposer.thisAddress.toUpperCase(),
          blocks: 0,
        };
        proposersBlocks.push(proposerBlock);
      }

      for (const topic of log.topics) {
        switch (topic) {
          case topicEventMapping.BlockProposed:
            proposerBlock.blocks++;
            break;
          case topicEventMapping.TransactionSubmitted:
            break;
          case topicEventMapping.NewCurrentProposer:
            break;
          default:
            break;
        }
      }
      console.log('BLOCKS:');
      for (const pb of proposersBlocks) {
        console.log(`  ${pb.proposer} : ${pb.blocks}`);
      }
    });

    let previousSprint = await getCurrentSprint();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const currentSprint = await getCurrentSprint();
        if (previousSprint !== currentSprint) {
          // eslint-disable-next-line no-param-reassign
          proposersStats.sprints++;
          previousSprint = currentSprint;
        }
        // eslint-disable-next-line no-await-in-loop
        currentProposer = await getCurrentProposer();
        const stakeAccount = await getStakeAccount(currentProposer.thisAddress);
        console.log(
          `     [ Current sprint: ${currentSprint}, Current proposer: ${currentProposer.thisAddress}, Stake account:  ]`,
          stakeAccount,
        );

        console.log('     Waiting blocks to rotate current proposer...');
        const initBlock = await nf3Proposer.web3.eth.getBlockNumber();
        let currentBlock = initBlock;

        while (currentBlock - initBlock < rotateProposerBlocks) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          currentBlock = await nf3Proposer.web3.eth.getBlockNumber();
        }

        await makeBlockAndWaitForEmptyMempool(optimistUrls);

        console.log('     Change current proposer...');
        await nf3Proposer.changeCurrentProposer();
      } catch (err) {
        // containers stopped
        if (err.message.includes('connection not open')) {
          console.log('Containers stopped!');
          return;
        }

        console.log(err);
      }
    }
  } catch (e) {
    console.log('ERROR!!!!', e);
  }
}
