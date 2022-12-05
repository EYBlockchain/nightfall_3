/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import config from 'config';
import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForSufficientBalance, retrieveL2Balance, topicEventMapping } from '../utils.mjs';
import { NightfallMultiSig } from '../multisig/nightfall-multisig.mjs';

const { signingKeys, addresses } = config.TEST_OPTIONS;

const { TX_WAIT = 1000 } = process.env;

const { WEB3_OPTIONS } = config;

const amountBlockStake = 25;
const amountMinimumStake = 100;
let nfMultiSig;
let multisigContract;
let shieldContract;
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

const getRotateProposerBlocks = async () => {
  const rotateProposerBlocks = await stateContract.methods.getRotateProposerBlocks().call();
  return rotateProposerBlocks;
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
  fee,
  ercAddress,
  nf3,
  listUserAddresses,
  listTransfersSent,
) {
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log(`start balance ${nf3.zkpKeys.compressedZkpPublicKey}`, startBalance);
  let offchainTx = true;

  // Create a block of deposits to have enough funds
  for (let i = 0; i < TEST_LENGTH; i++) {
    try {
      const res = await nf3.deposit(ercAddress, tokenType, value, tokenId, fee);

      listTransfersSent.push({
        from: nf3.zkpKeys.compressedZkpPublicKey,
        to: nf3.zkpKeys.compressedZkpPublicKey,
        value: value - fee,
        fee,
        transactionHash: res.transactionHash,
        blockHash: res.blockHash,
        onchain: true,
      });
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${nf3.zkpKeys.compressedZkpPublicKey} ${err}`);
    }
  }
  // we should have the deposits in a block before doing transfers
  await waitForSufficientBalance({
    nf3User: nf3,
    value: startBalance + TEST_LENGTH * (value - fee),
    ercAddress,
  });

  // Create a block of transfer and deposit transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    const userAdressTo = listUserAddresses[Math.floor(Math.random() * listUserAddresses.length)];
    const valueToTransfer = Math.floor(Math.random() * (value - fee)) + 1; // Returns a random integer from 1 to value - fee

    try {
      const res = await nf3.transfer(
        offchainTx,
        ercAddress,
        tokenType,
        valueToTransfer,
        tokenId,
        userAdressTo,
        fee,
      );

      listTransfersSent.push({
        from: nf3.zkpKeys.compressedZkpPublicKey,
        to: userAdressTo,
        value: valueToTransfer,
        fee,
        transactionHash: res.transactionHash,
        blockHash: res.blockHash,
        onchain: !offchainTx,
      });
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
        const res = await nf3.transfer(
          offchainTx,
          ercAddress,
          tokenType,
          value,
          tokenId,
          userAdressTo,
          fee,
        );
        listTransfersSent.push({
          from: nf3.zkpKeys.compressedZkpPublicKey,
          to: userAdressTo,
          value: valueToTransfer,
          fee,
          transactionHash: res.transactionHash,
          blockHash: res.blockHash,
          onchain: !offchainTx,
        });
      } else {
        console.warn('Error transfer', err);
      }
    }
    offchainTx = !offchainTx;

    try {
      const res = await nf3.deposit(ercAddress, tokenType, valueToTransfer, tokenId, fee);
      listTransfersSent.push({
        from: nf3.zkpKeys.compressedZkpPublicKey,
        to: nf3.zkpKeys.compressedZkpPublicKey,
        value: valueToTransfer - fee,
        fee,
        transactionHash: res.transactionHash,
        blockHash: res.blockHash,
        onchain: true,
      });
    } catch (err) {
      console.warn('Error deposit', err);
    }

    // await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
  }
}

/**
Set the block stake parameter for the proposers
*/
const setBlockStake = async amount => {
  let blockStake = await shieldContract.methods.getBlockStake().call();
  console.log('BLOCK STAKE GET: ', blockStake);
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
  console.log('MINIMUM STAKE GET: ', minimumStake);
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
  console.log('Getting State contract instance...');
  stateContract = await nf3User.getContractInstance('State');
  console.log('Getting Shield contract instance...');
  shieldContract = await nf3User.getContractInstance('Shield');
  console.log('Getting Proposers contract instance...');
  const proposersContract = await nf3User.getContractInstance('Proposers');
  console.log('Getting Challenges contract instance...');
  const challengesContract = await nf3User.getContractInstance('Challenges');

  if (nf3User.web3WsUrl.includes('localhost')) {
    console.log('Getting Multisig contract instance...');
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
}

/**
Proposer test for checking different points for the PoS
*/
export async function proposerTest(optimistUrls, proposersStats, nf3Proposer) {
  console.log('OPTIMISTURLS', optimistUrls);

  try {
    const stateAddress = stateContract.options.address;
    const rotateProposerBlocks = await getRotateProposerBlocks();
    console.log('ROTATE PROPOSER BLOCKS: ', rotateProposerBlocks);
    const proposersBlocks = [];

    let currentProposer = await getCurrentProposer();
    if (nf3Proposer.web3WsUrl.includes('localhost')) {
      // eslint-disable-next-line no-param-reassign
      proposersStats.proposersBlocks = proposersBlocks;
      // eslint-disable-next-line no-param-reassign
      proposersStats.sprints = 0;
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
    }

    let previousSprint = await getCurrentSprint();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const currentSprint = await getCurrentSprint();
        if (previousSprint !== currentSprint && nf3Proposer.web3WsUrl.includes('localhost')) {
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

        if (nf3Proposer.web3WsUrl.includes('localhost')) {
          await makeBlockAndWaitForEmptyMempool(optimistUrls);
        }
      } catch (err) {
        // containers stopped
        if (err.message.includes('connection not open')) {
          console.log('Containers stopped!');
          return;
        }

        console.log(err);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  } catch (e) {
    console.log('ERROR!!!!', e);
  }
}
