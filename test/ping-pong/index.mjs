/**
Module that runs up as a user
*/

/* eslint-disable no-await-in-loop */

import axios from 'axios';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { waitForSufficientBalance, retrieveL2Balance, topicEventMapping } from '../utils.mjs';

const { TX_WAIT = 1000 } = process.env;

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

const makeBlock = async (optimistUrls, currentProposer) => {
  const url = optimistUrls.find(
    // eslint-disable-next-line no-loop-func
    o => o.proposer.toUpperCase() === currentProposer.thisAddress.toUpperCase(),
  )?.optimistUrl;

  if (url) {
    const res = await axios.get(`${url}/proposer/mempool`);
    if (res.data.result.length > 0) {
      console.log(
        ` *** ${
          res.data.result.length
        } transactions in the mempool (${currentProposer.thisAddress.toUpperCase()} - ${url})`,
      );
      if (res.data.result.length > 0) {
        console.log('     Make block...');
        await axios.post(`${url}/block/make-now`);
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
  listTransactionsSent,
) {
  if (await nf3.healthcheck('client')) logger.info('Healthcheck passed');
  else throw new Error('Healthcheck failed');

  const startBalance = await retrieveL2Balance(nf3, ercAddress);
  console.log(`start balance ${nf3.zkpKeys.compressedZkpPublicKey}`, startBalance);
  let offchainTx = true;

  const { txTypes } = nf3;

  // Create a block of deposits to have enough funds
  for (let i = 0; i < TEST_LENGTH * 2; i++) {
    try {
      const res = await nf3.deposit('ValidTransaction', ercAddress, tokenType, value, tokenId, fee);

      listTransactionsSent.push({
        to: nf3.zkpKeys.compressedZkpPublicKey,
        value,
        fee,
        transactionHash: res.transactionHash,
        blockHash: res.blockHash,
        onchain: true,
        type: 'deposit',
        typeSequence: 'ValidTransaction',
      });
      await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    } catch (err) {
      logger.warn(`Error in deposit ${nf3.zkpKeys.compressedZkpPublicKey} ${err}`);
    }
  }
  // we should have the deposits in a block before doing transfers
  await waitForSufficientBalance({
    nf3User: nf3,
    value: startBalance + TEST_LENGTH * 2 * (value - fee),
    ercAddress,
  });

  // Create transfer, deposit and withdraw transactions
  for (let i = 0; i < TEST_LENGTH; i++) {
    const userAdressTo = listUserAddresses[Math.floor(Math.random() * listUserAddresses.length)];
    const valueToTransfer = Math.floor(Math.random() * (value - fee)) + 2; // Returns a random integer from 2 to value - fee

    try {
      await waitForSufficientBalance({
        nf3User: nf3,
        value: valueToTransfer + fee,
        ercAddress,
        message: `Waiting balance for transfer ${nf3.zkpKeys.compressedZkpPublicKey}.`,
      });

      const res = await nf3.transfer(
        txTypes[i * 3],
        offchainTx,
        ercAddress,
        tokenType,
        valueToTransfer,
        tokenId,
        userAdressTo,
        fee,
      );

      listTransactionsSent.push({
        from: nf3.zkpKeys.compressedZkpPublicKey,
        to: userAdressTo,
        value: valueToTransfer,
        fee,
        transactionHashL1: res.transactionHash,
        blockHash: res.blockHash,
        onchain: !offchainTx,
        type: 'transfer',
        typeSequence: txTypes[i * 3],
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
          txTypes[i * 3],
          offchainTx,
          ercAddress,
          tokenType,
          value,
          tokenId,
          userAdressTo,
          fee,
        );
        listTransactionsSent.push({
          from: nf3.zkpKeys.compressedZkpPublicKey,
          to: userAdressTo,
          value: valueToTransfer,
          fee,
          transactionHashL1: res.transactionHash,
          blockHash: res.blockHash,
          onchain: !offchainTx,
          type: 'transfer',
          typeSequence: txTypes[i * 3],
        });
      } else {
        console.warn('Error transfer', err);
      }
    }
    offchainTx = !offchainTx;

    try {
      const res = await nf3.deposit(
        txTypes[i * 3 + 1],
        ercAddress,
        tokenType,
        valueToTransfer,
        tokenId,
        fee,
      );
      listTransactionsSent.push({
        to: nf3.zkpKeys.compressedZkpPublicKey,
        value: valueToTransfer,
        fee,
        transactionHashL1: res.transactionHash,
        blockHash: res.blockHash,
        onchain: true,
        type: 'deposit',
        typeSequence: txTypes[i * 3 + 1],
      });
    } catch (err) {
      console.warn('Error deposit', err);
    }

    await waitForSufficientBalance({
      nf3User: nf3,
      value: valueToTransfer + fee,
      ercAddress,
      message: `Waiting balance for withdraw ${nf3.zkpKeys.compressedZkpPublicKey}.`,
    });

    try {
      const res = await nf3.withdraw(
        txTypes[i * 3 + 2],
        offchainTx,
        ercAddress,
        tokenType,
        valueToTransfer,
        tokenId,
        nf3.ethereumAddress,
        fee,
      );
      listTransactionsSent.push({
        from: nf3.zkpKeys.compressedZkpPublicKey,
        value: valueToTransfer,
        fee,
        transactionHashL1: res.transactionHash,
        blockHash: res.blockHash,
        onchain: !offchainTx,
        type: 'withdraw',
        typeSequence: txTypes[i * 3 + 2],
      });
    } catch (err) {
      console.warn('Error withdraw', err);
    }

    // await new Promise(resolve => setTimeout(resolve, TX_WAIT)); // this may need to be longer on a real blockchain
    console.log(`Completed ${i + 1} pings`);
  }
}

/**
Set parameters config for the test
*/
export async function setParametersConfig(nf3User) {
  console.log('Getting State contract instance...');
  stateContract = await nf3User.getContractInstance('State');
}

/**
  Proposer test for rotation of the proposers and making blocks
*/
export async function proposerStats(optimistUrls, proposersStats, nf3Proposer) {
  console.log('OPTIMISTURLS', optimistUrls);

  try {
    const stateAddress = stateContract.options.address;
    const proposersBlocks = [];

    let currentProposer = await getCurrentProposer();
    let currentSprint;
    let stakeAccount;
    // eslint-disable-next-line no-param-reassign
    proposersStats.proposersBlocks = proposersBlocks;
    // eslint-disable-next-line no-param-reassign
    proposersStats.sprints = 0;
    nf3Proposer.web3.eth.subscribe('logs', { address: stateAddress }).on('data', async log => {
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
            currentSprint = await getCurrentSprint();
            // eslint-disable-next-line no-param-reassign
            proposersStats.sprints++;
            currentProposer = await getCurrentProposer();
            stakeAccount = await getStakeAccount(currentProposer.thisAddress);
            console.log(
              `     [ Current sprint: ${currentSprint}, Current proposer: ${currentProposer.thisAddress}, Stake account:  ]`,
              stakeAccount,
            );
            break;
          case topicEventMapping.Rollback:
            console.log('ROLLBACK!!!!!!!!!!!!!!!!!!!!!!!');
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

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (nf3Proposer.web3WsUrl.includes('localhost')) {
          await makeBlock(optimistUrls, currentProposer);
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
      console.log('     Waiting some time');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  } catch (e) {
    console.log('ERROR!!!!', e);
  }
}
