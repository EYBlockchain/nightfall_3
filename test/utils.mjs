/* eslint-disable no-await-in-loop */
/* ignore unused exports */
import Web3 from 'web3';
import chai from 'chai';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
import { rand } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';

const { expect } = chai;
const { WEB3_PROVIDER_OPTIONS } = config;

const ENVIRONMENT = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const USE_EXTERNAL_NODE = config.USE_EXTERNAL_NODE === 'true';

export const waitForTimeout = async timeoutInMs => {
  await new Promise(resolve => setTimeout(resolve, timeoutInMs));
};

export const topicEventMapping = {
  BlockProposed: '0x566d835e602d4aa5802ee07d3e452e755bc77623507825de7bc163a295d76c0b',
  Rollback: '0xea34b0bc565cb5f2ac54eaa86422ae05651f84522ef100e16b54a422f2053852',
  CommittedToChallenge: '0d5ea452ac7e354069d902d41e41e24f605467acd037b8f5c1c6fee5e27fb5e2',
  TransactionSubmitted: '0xd9364d1faedd45a064f9090dd61ade3de8d1c1fd83caaa8ebdc4b9808f4eb989',
  NewCurrentProposer: '0xeaa94fa30970548bf8b78ce068ba600b923a4a62ce3c523d09bf308102ff1bab',
};
export class Web3Client {
  constructor(url) {
    this.url = url || ENVIRONMENT.web3WsUrl;
    this.provider = new Web3.providers.WebsocketProvider(this.url, WEB3_PROVIDER_OPTIONS);
    this.web3 = new Web3(this.provider);
    this.isSubmitTxLocked = false;
    this.nonceDict = [];
  }

  getWeb3() {
    return this.web3;
  }

  getInfo() {
    return this.web3.eth.getNodeInfo();
  }

  // eslint-disable-next-line consistent-return
  connectWeb3(useState = true) {
    if (useState) {
      return new Promise(resolve => {
        console.log('Blockchain Connecting ...');

        this.provider.on('error', err => console.error(`web3 error: ${JSON.stringify(err)}`));
        this.provider.on('connect', () => {
          console.log('Blockchain Connected ...');
          resolve(this.web3);
        });
        this.provider.on('end', () => console.log('Blockchain disconnected'));
      });
    }
  }

  subscribeTo(event, queue, options) {
    if (event === 'newBlockHeaders') {
      this.web3.eth.subscribe('newBlockHeaders').on('data', () => {
        queue.push('newBlockHeaders');
      });
    } else {
      this.web3.eth.subscribe(event, options).on('data', log => {
        for (const topic of log.topics) {
          switch (topic) {
            case topicEventMapping.BlockProposed:
              queue.push({ eventName: 'blockProposed', log });
              break;
            case topicEventMapping.TransactionSubmitted:
              queue.push({ eventName: 'TransactionSubmitted', log });
              break;
            case topicEventMapping.NewCurrentProposer:
              queue.push({ eventName: 'NewCurrentProposer', log });
              break;
            default:
              queue.push({ eventName: 'Challenge', log });
              break;
          }
        }
      });
    }
  }

  closeWeb3() {
    this.web3.currentProvider.connection.close();
  }

  setNonce(privateKey, _nonce) {
    // This will be a mapping of privateKeys to nonces;
    this.nonceDict[privateKey] = _nonce;
  }

  getAccounts() {
    if (process.env.FROM_ADDRESS) return [process.env.FROM_ADDRESS];
    const accounts = this.web3.eth.getAccounts();
    return accounts;
  }

  getBalance(account) {
    return this.web3.eth.getBalance(account);
  }

  getIsSubmitTxLocked() {
    return this.isSubmitTxLocked;
  }

  async submitTransaction(unsignedTransaction, privateKey, shieldAddress, gasCount, value = 0) {
    while (this.isSubmitTxLocked) {
      await waitForTimeout(1000);
    }
    this.isSubmitTxLocked = true;
    let gas = gasCount;
    let gasPrice = 10000000000;
    let receipt;
    let nonce = this.nonceDict[privateKey];
    // if the nonce hasn't been set, then use the transaction count
    try {
      if (nonce === undefined) {
        const accountAddress = await this.web3.eth.accounts.privateKeyToAccount(privateKey);
        nonce = await this.web3.eth.getTransactionCount(accountAddress.address);
      }
      if (USE_EXTERNAL_NODE) {
        // get gaslimt from latest block as gaslimt may vary
        gas = (await this.web3.eth.getBlock('latest')).gasLimit;
        const blockGasPrice = Number(await this.web3.eth.getGasPrice());
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
      const signed = await this.web3.eth.accounts.signTransaction(tx, privateKey);
      nonce++;
      this.nonceDict[privateKey] = nonce;
      // receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
      receipt = await this.web3.eth.sendSignedTransaction(signed.rawTransaction);
      // the confirmations Promivent doesn't seem to terminate in Ganache, so we'll
      // just count 12 blocks before returning. TODO this won't handle a chain reorg.
      // console.log('waiting for twelve confirmations of transaction');
      const startBlock = await this.web3.eth.getBlock('latest');
      await new Promise(resolve => {
        const id = setInterval(async () => {
          const block = await this.web3.eth.getBlock('latest');
          if (block.number - startBlock.number > 12) {
            clearInterval(id);
            resolve();
          }
        }, 1000);
      });
      // console.log('transaction confirmed');
    } finally {
      this.isSubmitTxLocked = false;
    }
    return receipt;
  }

  // This only works with Ganache but it can move block time forwards
  async timeJump(secs) {
    await this.web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [secs],
      id: 0,
    });

    await this.web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: 0,
    });
  }

  // This function polls for a particular event to be emitted by the blockchain
  // from a specified contract.  After retries, it will give up and error.
  // TODO could we make a neater job with setInterval()?
  async testForEvents(contractAddress, topics, retries) {
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
      events = await this.web3.eth.getPastLogs({
        fromBlock: this.web3.utils.toHex(0),
        address: contractAddress,
        topics,
      });
      // console.log('EVENTS WERE', events);

      await waitForTimeout(WAIT);
      counter--;
    }
    if (counter < 0) {
      throw new Error(
        `No events found with in ${
          retries || Number(process.env.EVENT_RETRIEVE_RETRIES) || 3
        }retries of ${WAIT}ms wait`,
      );
    }
    return events;
  }

  async waitForEvent(eventLogs, expectedEvents, count = 1) {
    const length = count !== 1 ? count : expectedEvents.length;
    let timeout = 100;
    let eventLogsExpectedEvents = eventLogs.filter(e => e.eventName === expectedEvents[0]);
    while (eventLogsExpectedEvents.length < length) {
      await waitForTimeout(3000);
      eventLogsExpectedEvents = eventLogs.filter(e => e.eventName === expectedEvents[0]);
      timeout--;
      if (timeout === 0) throw new Error('Timeout in waitForEvent');
    }

    const eventsSeen = [];
    for (let i = 0; i < length; i++) {
      const index = eventLogs.findIndex(e => e.eventName === expectedEvents[0]);
      const removed = index !== -1 && eventLogs.splice(index, 1);
      eventsSeen.push(removed);
    }

    const blockHeaders = [];

    await this.subscribeTo('newBlockHeaders', blockHeaders);

    while (blockHeaders.length < 12) {
      await waitForTimeout(3000);
    }

    // Have to wait here as client block proposal takes longer now
    await waitForTimeout(3000);
    return { eventLogs, eventsSeen };
  }
}

export async function createBadBlock(badBlockType, block, transactions, args) {
  const badBlock = block;
  const badTransactions = transactions;
  switch (badBlockType) {
    case 'IncorrectRoot': {
      badBlock.root = (await rand(32)).hex();
      break;
    }
    case 'DuplicateTransaction': {
      delete badBlock.root; // we delete root, so that /proposer/encode below can recalculate the root.
      // We don't want the check-block in NO catch wrong root error. Hence this statement
      badTransactions[badTransactions.length - 1] = args.duplicateTransaction;
      break;
    }
    case 'InvalidDepositTransaction': {
      // if both tokenID and value are 0 for deposit, then this is an invalid deposit transaction
      badTransactions[0].tokenId =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      badTransactions[0].value =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      break;
    }
    case 'IncorrectHistoricRoot': {
      // Replace the historic root with a wrong historic root
      badTransactions[1].historicRootBlockNumberL2[0] = (await rand(8)).hex();
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

export const sendTransactions = async (transactions, submitArgs, web3) => {
  const receiptArr = [];
  for (let i = 0; i < transactions.length; i++) {
    const { txDataToSign } = transactions[i];

    const receipt = await web3.submitTransaction(txDataToSign, ...submitArgs);
    receiptArr.push(receipt);
  }
  return receiptArr;
};

export const expectTransaction = res => {
  expect(res).to.have.property('transactionHash');
  expect(res).to.have.property('blockHash');
};

export const depositNTransactions = async (nf3, N, ercAddress, tokenType, value, tokenId, fee) => {
  const depositTransactions = [];
  for (let i = 0; i < N; i++) {
    let res;
    let count = 3; // sometimes in testnet we have issues about nonce and replacement transactions so we try again

    while (count > 0) {
      try {
        res = await nf3.deposit(ercAddress, tokenType, value, tokenId, fee);
        count = 0;
      } catch (e) {
        if (
          e.message.includes('nonce too low') ||
          e.message.includes('replacement transaction underpriced')
        ) {
          count -= 1;
          logger.debug(`Transaction failed. Trying again...${count} tries left`);
          await waitForTimeout(10000);
        } else {
          throw e;
        }
      }
    }
    expectTransaction(res);
    depositTransactions.push(res);
    await waitForTimeout(1000);
  }
  await new Promise(resolve => setTimeout(resolve, 6000));

  return depositTransactions;
};

export const transferNTransactions = async (
  nf3,
  N,
  ercAddress,
  tokenType,
  value,
  tokenId,
  compressedZkpPublicKey,
  fee,
) => {
  const transferTransactions = [];
  for (let i = 0; i < N; i++) {
    const res = await nf3.transfer(
      false,
      ercAddress,
      tokenType,
      value,
      tokenId,
      compressedZkpPublicKey,
      fee,
    );
    expectTransaction(res);
    transferTransactions.push(res);
  }
  await new Promise(resolve => setTimeout(resolve, 6000));

  return transferTransactions;
};

export const withdrawNTransactions = async (
  nf3,
  N,
  ercAddress,
  tokenType,
  value,
  tokenId,
  recipientAddress,
  fee,
) => {
  const withdrawTransactions = [];
  for (let i = 0; i < N; i++) {
    const res = await nf3.withdraw(
      false,
      ercAddress,
      tokenType,
      value,
      tokenId,
      recipientAddress,
      fee,
    );
    expectTransaction(res);
    withdrawTransactions.push(res);
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
  return withdrawTransactions;
};

/**
  function to retrieve balance of user because getLayer2Balances returns
  balances of all users
*/
export const retrieveL2Balance = async (client, ercAddress) => {
  const balances = await client.getLayer2Balances();
  // if there are no balances
  if (Object.values(balances).length === 0) {
    return 0;
  }
  const { balance } = ercAddress
    ? Object.values(balances[ercAddress])[0]
    : Object.values(balances)[0][0];
  return balance;
};

/**
  function to register a proposer if there is no proposer
*/
export const registerProposerOnNoProposer = async proposer => {
  if ((await proposer.getCurrentProposer()) === '0x0000000000000000000000000000000000000000') {
    await proposer.registerProposer('http://optimist', await proposer.getMinimumStake());
  }
};

/**
  function to wait for sufficient balance by waiting for pending transaction
  to be proposed
*/
export const waitForSufficientBalance = (client, value, ercAddress) => {
  return new Promise(resolve => {
    async function isSufficientBalance() {
      const balance = await retrieveL2Balance(client, ercAddress);
      logger.debug(` Balance needed ${value}. Current balance ${balance}.`);
      if (balance < value) {
        await waitForTimeout(10000);
        isSufficientBalance();
      } else resolve();
    }
    isSufficientBalance();
  });
};

/**
  function to wait for no pending commitments
*/
export const waitForNoPendingCommitments = client => {
  return new Promise(resolve => {
    async function pendingCommitments() {
      const pendingDeposit = await client.getLayer2PendingDepositBalances(undefined, true);
      const pendingSpent = await client.getLayer2PendingSpentBalances(undefined, true);
      if (Object.keys(pendingDeposit).length !== 0 || Object.keys(pendingSpent).length !== 0) {
        logger.debug(`Nonzero Pending commitments.`);
        await waitForTimeout(10000);
        pendingCommitments();
      } else resolve();
    }
    pendingCommitments();
  });
};

/**
  function to count pending commitments
*/
export const pendingCommitmentCount = async client => {
  const pendingDeposit = await client.getLayer2PendingDepositBalances(undefined, true);
  const pendingSpent = await client.getLayer2PendingSpentBalances(undefined, true);
  const pendingCommitments = Object.keys(pendingDeposit).length + Object.keys(pendingSpent).length;

  return pendingCommitments;
};

export const emptyL2 = async ({ nf3User, web3, logs }) => {
  await new Promise(resolve => setTimeout(resolve, 6000));
  let count = await pendingCommitmentCount(nf3User);
  while (count !== 0) {
    await nf3User.makeBlockNow();
    try {
      await web3.waitForEvent(logs, ['blockProposed']);
      count = await pendingCommitmentCount(nf3User);
    } catch (err) {
      break;
    }
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
};
