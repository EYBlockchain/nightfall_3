/* eslint-disable no-await-in-loop */

import Web3 from 'web3';
import axios from 'axios';
import chai from 'chai';
import compose from 'docker-compose';
import path from 'path';
import config from 'config';
import { fileURLToPath } from 'url';
import rand from '../common-files/utils/crypto/crypto-random.mjs';

const { dirname } = path;
const __dirname = dirname(fileURLToPath(import.meta.url));
const { expect } = chai;

let web3;
// This will be a mapping of privateKeys to nonces;
const nonceDict = {};
const USE_INFURA = process.env.USE_INFURA === 'true';
const { INFURA_PROJECT_SECRET, INFURA_PROJECT_ID } = process.env;
let isSubmitTxLocked = false;

export function connectWeb3(url = 'ws://localhost:8546') {
  return new Promise(resolve => {
    console.log('Blockchain Connecting ...');

    let provider;
    if (USE_INFURA) {
      if (!INFURA_PROJECT_SECRET) throw Error('env INFURA_PROJECT_SECRET not set');
      if (!INFURA_PROJECT_ID) throw Error('env INFURA_PROJECT_ID not set');

      const infuraUrl = url.replace('INFURA_PROJECT_ID', INFURA_PROJECT_ID);

      provider = new Web3.providers.WebsocketProvider(infuraUrl, {
        ...config.WEB3_PROVIDER_OPTIONS,
        headers: {
          authorization: `Basic ${Buffer.from(`:${INFURA_PROJECT_SECRET}`).toString('base64')}`,
        },
      });
    } else {
      provider = new Web3.providers.WebsocketProvider(url, config.WEB3_PROVIDER_OPTIONS);
    }

    web3 = new Web3(provider);
    provider.on('error', err => console.error(`web3 error: ${JSON.stringify(err)}`));
    provider.on('connect', () => {
      console.log('Blockchain Connected ...');
      resolve(web3);
    });
    provider.on('end', () => console.log('Blockchain disconnected'));
  });
}

export function connectWeb3NoState(url = 'ws://localhost:8546') {
  return new Web3(new Web3.providers.WebsocketProvider(url));
}

export function closeWeb3Connection(w = web3) {
  w.currentProvider.connection.close();
}

export function setNonce(privateKey, _nonce) {
  nonceDict[privateKey] = _nonce;
}

export async function getAccounts() {
  if (process.env.FROM_ADDRESS) return [process.env.FROM_ADDRESS];
  const accounts = web3.eth.getAccounts();
  return accounts;
}
export async function getBalance(account) {
  return web3.eth.getBalance(account);
}

export function getIsSubmitTxLocked() {
  return isSubmitTxLocked;
}

export async function submitTransaction(
  unsignedTransaction,
  privateKey,
  shieldAddress,
  gasCount,
  value = 0,
) {
  while (isSubmitTxLocked) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  isSubmitTxLocked = true;
  let gas = gasCount;
  let gasPrice = 10000000000;
  let receipt;
  let nonce = nonceDict[privateKey];
  // if the nonce hasn't been set, then use the transaction count
  try {
    if (nonce === undefined) {
      const accountAddress = await web3.eth.accounts.privateKeyToAccount(privateKey);
      nonce = await web3.eth.getTransactionCount(accountAddress.address);
    }
    if (USE_INFURA) {
      // get gaslimt from latest block as gaslimt may vary
      gas = (await web3.eth.getBlock('latest')).gasLimit;
      const blockGasPrice = Number(await web3.eth.getGasPrice());
      if (blockGasPrice > gasPrice) gasPrice = blockGasPrice;
    }
    const tx = {
      to: shieldAddress,
      data: unsignedTransaction,
      value,
      gas,
      gasPrice,
      nonce,
    };
    const signed = await web3.eth.accounts.signTransaction(tx, privateKey);
    nonce++;
    nonceDict[privateKey] = nonce;
    receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
  } finally {
    isSubmitTxLocked = false;
  }
  return receipt;
}

// This only works with Ganache but it can move block time forwards
export async function timeJump(secs) {
  axios.post('http://localhost:8546', {
    id: 1337,
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [secs],
  });
}

export async function createBadBlock(badBlockType, block, transactions, args) {
  let res;
  const badBlock = block;
  const badTransactions = transactions;
  switch (badBlockType) {
    case 'IncorrectRoot': {
      res = await chai
        .request('http://localhost:8083')
        .get(`/path/${args.leafIndex}`)
        .send({ contractName: 'State' });
      badBlock.root = res.body.data[0].value;
      break;
    }
    case 'DuplicateTransaction': {
      delete badBlock.root; // we delete root, so that /proposer/encode below can recalculate the root.
      // We don't want the check-block in NO catch wrong root error. Hence this statement
      badTransactions[badTransactions.length - 1] = args.duplicateTransaction;
      break;
    }
    case 'InvalidDepositTransaction': {
      // if tokenID is not 0 for ERC@) deposit, then this is an invalid deposit transaction
      badTransactions[0].tokenId =
        '0x0000000000000000000000000000000000000000000000000000000000000001';
      break;
    }
    case 'IncorrectHistoricRoot': {
      // Replace the historic root with a wrong historic root
      badTransactions[1].historicRootBlockNumberL2[0] = (await rand(8)).hex();
      break;
    }
    case 'IncorrectPublicInputHash': {
      // if both tokenID and value are 0 for deposit, then this is an invalid deposit transaction
      badTransactions[0].publicInputHash = (await rand(32)).hex();
      break;
    }
    case 'IncorrectProof': {
      // use the proof of a prior transaction
      badTransactions[0].proof = args.proof;
      break;
    }
    case 'DuplicateNullifier': {
      // Find a transaction with a nullifier and replace one we have from earlier
      for (let i = 0; i < badTransactions.length; i++) {
        const nonZeroNullifier = badTransactions[i].nullifiers.findIndex(
          n => n !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        );
        if (nonZeroNullifier >= 0) {
          badTransactions[i].nullifiers[nonZeroNullifier] = args.duplicateNullifier;
          break;
        }
      }
      break;
    }
    case 'IncorrectLeafCount': {
      // leafCount is normally re-computed by the /encode endpoint, to ensure
      // that it is correct. Of course that's not much use for this test, so we
      // make the value negative (and wrong). A negative value will tell /encode
      // not to recompute but to use the value we've given it (after flipping
      // the sign back)
      badBlock.leafCount = -badBlock.leafCount - 100;
      break;
    }
    default:
      break;
  }
  const {
    body: { txDataToSign, block: newBlock, transactions: newTransactions },
  } = await chai
    .request('http://localhost:8081')
    .post('/proposer/encode')
    .send({ block: badBlock, transactions: badTransactions });
  return { txDataToSign, block: newBlock, transactions: newTransactions };
}

export async function sendBlockConfig(adversaryURL, blockConfig) {
  try {
    await chai.request(adversaryURL).post('/proposer/config').send(blockConfig);
  } catch (err) {
    console.log('Error in sending block config to adversary');
    console.log('Err', err);
  }
}

// This function polls for a particular event to be emitted by the blockchain
// from a specified contract.  After retries, it will give up and error.
// TODO could we make a neater job with setInterval()?
export async function testForEvents(contractAddress, topics, retries) {
  // console.log('Listening for events');
  const WAIT = 1000;
  let counter = retries || Number(process.env.EVENT_RETRIEVE_RETRIES) || 3;
  let events;
  while (
    counter < 0 ||
    events === undefined ||
    events[0] === undefined ||
    events[0].transactionHash === undefined
  ) {
    // eslint-disable-next-line no-await-in-loop
    events = await web3.eth.getPastLogs({
      fromBlock: web3.utils.toHex(0),
      address: contractAddress,
      topics,
    });
    // console.log('EVENTS WERE', events);
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, WAIT));
    counter--;
  }
  if (counter < 0) {
    throw new Error(
      `No events found with in ${
        retries || Number(process.env.EVENT_RETRIEVE_RETRIES) || 3
      }retries of ${WAIT}ms wait`,
    );
  }
  // console.log('Events found');
  return events;
}

export const topicEventMapping = {
  BlockProposed: '0x566d835e602d4aa5802ee07d3e452e755bc77623507825de7bc163a295d76c0b',
  Rollback: '0xea34b0bc565cb5f2ac54eaa86422ae05651f84522ef100e16b54a422f2053852',
  CommittedToChallenge: '0d5ea452ac7e354069d902d41e41e24f605467acd037b8f5c1c6fee5e27fb5e2',
};

/**
function to pause one client and one miner in the Geth blockchain for the
purposes of rollback testing.  This creates a sort of split-brain, that we can
use to force a change reorg when we reconnect the two halves.
It will only work with the standalone geth network!
*/
export async function pauseBlockchain(side) {
  const options = {
    cwd: path.join(__dirname),
    log: false,
    config: ['../docker-compose.standalone.geth.yml'],
    composeOptions: ['-p geth'],
  };
  const client = `blockchain${side}`;
  const miner = `blockchain-miner${side}`;
  try {
    await Promise.all([compose.pauseOne(client, options), compose.pauseOne(miner, options)]);
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
}
export async function unpauseBlockchain(side) {
  const options = {
    cwd: path.join(__dirname),
    log: false,
    config: ['../docker-compose.standalone.geth.yml'],
    composeOptions: ['-p geth'],
  };
  const client = `blockchain${side}`;
  const miner = `blockchain-miner${side}`;
  return Promise.all([compose.unpauseOne(client, options), compose.unpauseOne(miner, options)]);
}

/**
These are helper functions to reduce the repetitive code bloat in test files
 */

export const makeTransactions = async (txType, numTxs, url, txArgs) => {
  const transactions = (
    await Promise.all(
      Array.from({ length: numTxs }, () => chai.request(url).post(`/${txType}`).send(txArgs)),
    )
  ).map(res => res.body);

  return transactions;
};

export const sendTransactions = async (transactions, submitArgs) => {
  const receiptArr = [];
  for (let i = 0; i < transactions.length; i++) {
    const { txDataToSign } = transactions[i];
    // eslint-disable-next-line no-await-in-loop
    const receipt = await submitTransaction(txDataToSign, ...submitArgs);
    receiptArr.push(receipt);
  }
  return receiptArr;
};

export const waitForEvent = async (eventLogs, expectedEvents) => {
  while (eventLogs.length < expectedEvents.length) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  while (eventLogs[0] !== expectedEvents[0]) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  expect(eventLogs[0]).to.equal(expectedEvents[0]);

  for (let i = 0; i < expectedEvents.length; i++) {
    eventLogs.shift();
  }

  return eventLogs;
};

/**
  function to wait until a proposer is the current proposer
*/
const waitForProposerToBeCurrent = proposer => {
  return new Promise(resolve => {
    async function isCurrentProposer() {
      const currentProposer = await proposer.getCurrentProposer();
      if (currentProposer === proposer.ethereumAddress) {
        // console.log('condition met for currentProposer', currentProposer);
        resolve();
      } else {
        await new Promise(resolving => setTimeout(resolving, 1000));
      }
    }
    isCurrentProposer();
  });
};

/**
  function to register a proposer and wait until this proposer is the current proposer
*/
export const waitForProposer = async proposer => {
  if ((await proposer.getCurrentProposer()) !== proposer.ethereumAddress) {
    await proposer.registerProposer();
  }
  await waitForProposerToBeCurrent(proposer);
};

/**
  function to wait until sufficient balance is achieved from
  transactions
*/
export const waitForSufficientBalance = (client, value, depositFunction) => {
  let retries = 0;
  return new Promise(resolve => {
    // in case there are no pending deposit or transfer transactions to satisfy
    // sufficient balance, then we will send a deposit transaction after sometime
    async function isSufficientBalance() {
      if (retries > 20) {
        await depositFunction();
        await new Promise(resolving => setTimeout(resolving, 10000));
      }
      const balances = await client.getLayer2Balances();
      // if layer 2 balances don't exist, then wait a bit and look for balances again
      if (Object.keys(balances).length === 0) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        retries += 1;
        isSufficientBalance();
      }
      // if client does not have layer 2 balances, then wait a bit and look again
      const clientBalances = balances[client.zkpKeys.compressedPkd];
      if (clientBalances === undefined || Object.keys(clientBalances).length === 0) {
        await new Promise(resolving => setTimeout(resolving, 10000));
        retries += 1;
        isSufficientBalance();
      }
      const balance = clientBalances[Object.keys(clientBalances)[0]];
      // if client has layer 2 balances and if it is equal to value required
      if (balance > value) {
        // console.log('sufficient balance');
        resolve();
      } else {
        // console.log('insufficient balance', balance);
        await new Promise(resolving => setTimeout(resolving, 10000));
        retries += 1;
        isSufficientBalance();
      }
    }
    isSufficientBalance();
  });
};
