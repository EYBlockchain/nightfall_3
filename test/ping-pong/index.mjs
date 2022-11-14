/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import config from 'config';
import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForSufficientBalance, retrieveL2Balance, topicEventMapping } from '../utils.mjs';
import { NightfallMultiSig } from '../multisig/nightfall-multisig.mjs';

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys, addresses, zkpPublicKeys, ROTATE_PROPOSER_BLOCKS } =
  config.TEST_OPTIONS;

const txPerBlock =
  process.env.DEPLOYER_ETH_NETWORK === 'mainnet'
    ? process.env.TEST_LENGTH
    : config.TEST_OPTIONS.txPerBlock;

const { TX_WAIT = 1000, TEST_ERC20_ADDRESS } = process.env;

const { WEB3_OPTIONS } = config;

const amountBlockStake = 25;
const amountMinimumStake = 100;
let nfMultiSig;
let multisigContract;
let shieldContract;

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
    console.log("Sleep 20 seconds to empty mempool")
    await new Promise(resolve => setTimeout(resolve, 20000)); // this may need to be longer on a real blockchain
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
      } (IS_TEST_RUNNER: ${IS_TEST_RUNNER})`,
    );
    await new Promise(resolving => setTimeout(resolving, 20 * TX_WAIT)); // TODO get balance waiting working well
    loop++;
  } while (loop < loopMax);
  return 1;
}

/**
Set the block stake parameter for the proposers
*/
const setBlockStake = async amount => {
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
  const blockStake = await shieldContract.methods.getBlockStake().call();
  console.log('BLOCK STAKE SET: ', blockStake);
};

const setMinimumStake = async amount => {
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
  const minimumStake = await shieldContract.methods.getMinimumStake().call();
  console.log('MINIMUM STAKE SET: ', minimumStake);
};

/**
Set the value per slot parameter for the proposers
*/
const setValuePerSlot = async amount => {
  const transactions = await nfMultiSig.setValuePerSlot(
    amount,
    signingKeys.user1,
    addresses.user1,
    await multisigContract.methods.nonce().call(),
    [],
  );
  const approved = await nfMultiSig.setValuePerSlot(
    amount,
    signingKeys.user2,
    addresses.user1,
    await multisigContract.methods.nonce().call(),
    transactions,
  );
  await nfMultiSig.multiSig.executeMultiSigTransactions(approved, signingKeys.user1);
  const valuePerSlot = await shieldContract.methods.getValuePerSlot().call();
  console.log('VALUE PER SLOT SET: ', valuePerSlot);
};

/**
Set parameters config for the test
*/
export async function setParametersConfig() {
  const nf3Proposer = new Nf3(signingKeys.proposer3, environment);
  await nf3Proposer.init(mnemonics.proposer3);

  const stateContract = await nf3Proposer.getContractInstance('State');
  const proposersContract = await nf3Proposer.getContractInstance('Proposers');
  const challengesContract = await nf3Proposer.getContractInstance('Challenges');
  shieldContract = await nf3Proposer.getContractInstance('Shield');
  multisigContract = await nf3Proposer.getContractInstance('SimpleMultiSig');

  nfMultiSig = new NightfallMultiSig(
    nf3Proposer.web3,
    {
      state: stateContract,
      proposers: proposersContract,
      shield: shieldContract,
      challenges: challengesContract,
      multisig: multisigContract,
    },
    2,
    await nf3Proposer.web3.eth.getChainId(),
    WEB3_OPTIONS.gas,
  );

  await setBlockStake(amountBlockStake);
  await setMinimumStake(amountMinimumStake);
  await setValuePerSlot(amountMinimumStake / 10);
}

/**
Proposer test for checking different points for the PoS
*/
export async function proposerTest(optimistUrls, proposersStats, nf3Proposer) {
  console.log('OPTIMISTURLS', optimistUrls);

  try {
    const stateContract = await nf3Proposer.getContractInstance('State');
    const stateAddress = stateContract.options.address;

    const getCurrentProposer = async () => {
      const currentProposer = await stateContract.methods.getCurrentProposer().call();
      return currentProposer;
    };

    const getCurrentSprint = async () => {
      const currentSprint = await stateContract.methods.currentSprint().call();
      return currentSprint;
    };

    const getStakeAccount = async proposer => {
      const stakeAccount = await stateContract.methods.getStakeAccount(proposer).call();
      return stakeAccount;
    };

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

    while (currentProposer.thisAddress === '0x0000000000000000000000000000000000000000') {
      await new Promise(resolve => setTimeout(resolve, 10000));
      currentProposer = await getCurrentProposer();
    }

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

        while (currentBlock - initBlock < ROTATE_PROPOSER_BLOCKS) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          currentBlock = await nf3Proposer.web3.eth.getBlockNumber();
        }

        const url = optimistUrls.find(
          // eslint-disable-next-line no-loop-func
          o => o.proposer.toUpperCase() === currentProposer.thisAddress.toUpperCase(),
        ).optimistUrl;

        let res = await axios.get(`${url}/proposer/mempool`);
        while (res.data.result.length > 0) {
          console.log(` *** ${res.data.result.length} transactions in the mempool`);
          if (res.data.result.length > 0) {
            console.log('     Make block...');
            await axios.get(`${url}/block/make-now`);
            console.log('     Waiting for block to be created');
            await new Promise(resolve => setTimeout(resolve, 20000));
            res = await axios.get(`${url}/proposer/mempool`);
          }
        }
        console.log('     Change current proposer...');
        await nf3Proposer.changeCurrentProposer();
      } catch (err) {
        console.log(err);
      }
    }
  } catch (e) {
    console.log('ERROR!!!!', e);
  }
}
