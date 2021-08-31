/* eslint-disable no-unused-vars */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import gen from 'general-number';
import childProcess from 'child_process';

import WebSocket from 'ws';
import sha256 from '../common-files/utils/crypto/sha256.mjs';

import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  topicEventMapping,
  setNonce,
  createBadBlock,
  testForEvents,
} from './utils.mjs';

const { spawn, spawnSync } = childProcess;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { GN } = gen;

const makeTransactions = async (txType, numTxs, url, txArgs) => {
  const transactions = (
    await Promise.all(
      Array.from({ length: numTxs }, () => chai.request(url).post(`/${txType}`).send(txArgs)),
    )
  ).map(res => res.body);

  return transactions;
};

const sendTransactions = async (transactions, submitArgs) => {
  const receiptArr = [];
  for (let i = 0; i < transactions.length; i++) {
    const { txDataToSign } = transactions[i];
    // eslint-disable-next-line no-await-in-loop
    const receipt = await submitTransaction(txDataToSign, ...submitArgs);
    receiptArr.push(receipt);
  }
  return receiptArr;
};

const waitForEvent = async (eventLogs, expectedEvents) => {
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

describe('Running rollback and resync test', () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let duplicateTransaction;
  let connection; // WS connection
  let blockSubmissionFunction;
  let topicsBlockHashDuplicateTransaction;
  let web3;
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  // this is the etherum private key for accounts[0]
  const privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const gas = 10000000;
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether
  const txPerBlock = 2;
  let eventLogs = [];
  const validTransactions = [];

  let commitTxDataToSign;

  before(async function () {
    web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    challengesAddress = (await chai.request(url).get('/contract-address/Challenges')).body.address;

    ercAddress = (await chai.request(url).get('/contract-address/ERCStub')).body.address;

    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      if (log.topics[0] === topicEventMapping.BlockProposed) {
        eventLogs.push('blockProposed');
      } else if (log.topics[0] === topicEventMapping.Rollback) {
        eventLogs.push('Rollback');
      } else if (log.topics[0] === topicEventMapping.CommittedToChallenge) {
        eventLogs.push('CommittedToChallenge');
      }
    });

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign, block, transactions } = msg;
      if (type === 'block') {
        // eslint-disable-next-line prettier/prettier
        await blockSubmissionFunction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE, '0', block, transactions);
      } else if (type === 'commit') {
        await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
      } else if (type === 'challenge') {
        commitTxDataToSign = txDataToSign;
        console.log('Challenge held');
      }
    };
    const myAddress = (await getAccounts())[0];
    const res = await chai
      .request(optimistUrl)
      .post('/proposer/register')
      .send({ address: myAddress });
    const { txDataToSign } = res.body;
    expect(txDataToSign).to.be.a('string');
    // we have to pay 10 ETH to be registered
    const bond = 10000000000000000000;
    // now we need to sign the transaction and send it to the blockchain
    await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
  });

  describe('Prepare some boiler plate transactions', () => {
    // eslint-disable-next-line no-unused-vars
    blockSubmissionFunction = async (txDataToSign, b, c, d, e, f, _block, _transactions) =>
      submitTransaction(txDataToSign, b, c, d, e, f);
    it('should make a block of deposits to start us off', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = await makeTransactions('deposit', txPerBlock, url, {
        ercAddress,
        tokenId,
        tokenType,
        value,
        zkpPrivateKey,
        fee,
      });

      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should make a block of transfers so we can make some bad blocks', async function () {
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        url,
        {
          ercAddress,
          tokenId,
          recipientData: { values: [value], recipientZkpPublicKeys: [zkpPublicKey] },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        },
        [privateKey, shieldAddress, gas, fee],
      );
      // eslint-disable-next-line prefer-destructuring
      duplicateTransaction = transferTransactions[0];
      console.log(`duplicateTransaction: ${duplicateTransaction.transaction.nullifiers[0]}`);
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });
  });

  describe('Make a bad block at the chain tip', () => {
    it('should make a bad block', async function () {
      blockSubmissionFunction = async (_txDataToSign, b, c, d, e, f, block, transactions) => {
        // const newBlockRes = await createBadBlock('DuplicateTransaction', block, transactions, {
        //   duplicateTransaction,
        // });
        const newBlockRes = await createBadBlock('DuplicateNullifier', block, transactions, {
          duplicateNullifier: duplicateTransaction.transaction.nullifiers[0],
        });
        console.log(
          `Created flawed block with duplicate nullifier and blockHash ${newBlockRes.block.blockHash}`,
        );
        topicsBlockHashDuplicateTransaction = newBlockRes.block.blockHash;
        return submitTransaction(newBlockRes.txDataToSign, b, c, d, e, f);
      };
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        url,
        {
          ercAddress,
          tokenId,
          recipientData: { values: [value], recipientZkpPublicKeys: [zkpPublicKey] },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        },
        [privateKey, shieldAddress, gas, fee],
      );

      validTransactions.push(...transferTransactions);
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);

      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });
    it('should send the commit-challenge', async function () {
      while (!commitTxDataToSign) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await submitTransaction(commitTxDataToSign, privateKey, challengesAddress, gas);
    });
    it('Should delete the flawed block and rollback the leaves', async () => {
      eventLogs = await waitForEvent(eventLogs, ['Rollback']);
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateTransaction),
      ]);
    });
  });

  describe('Perform a full resync which will clean up our local database', () => {
    it('should drop everything in the database', async () => {
      // We need to wait here so we do not drop tables before the rollback is finished
      await new Promise(resolve => setTimeout(resolve, 10000));
      const resetOptimistDB = spawn('./nightfall-client/dropAll.sh', [], {
        stdio: 'ignore',
      });
      resetOptimistDB.on('close', async () => {
        spawn('docker', ['restart', 'nightfall_3_optimist_1'], {
          stdio: 'ignore',
        });
      });
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
        // eslint-disable-next-line no-await-in-loop
      } while ((await chai.request(url).get('/healthcheck')).status !== 200);
    });
  });

  describe('Make a bad block that is not on the chain tip', () => {
    it('should re-register ourselves as a proposer and reopen the websocket', async function () {
      // Need to wait for the resync process to finish processing
      await new Promise(resolve => setTimeout(resolve, 25000));
      connection = new WebSocket(optimistWsUrl);
      connection.onopen = () => {
        connection.send('challenge');
        connection.send('blocks');
      };
      connection.onmessage = async message => {
        const msg = JSON.parse(message.data);
        const { type, txDataToSign, block, transactions } = msg;
        if (type === 'block') {
          // eslint-disable-next-line prettier/prettier
          await blockSubmissionFunction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE, '0', block, transactions);
        } else if (type === 'commit') {
          await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
        } else if (type === 'challenge') {
          commitTxDataToSign = txDataToSign;
          console.log('Challenge held');
        }
      };
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      const bond = 10000000000000000000;
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
    });

    it('should automatically create a block, as the resync will re-populate our local db', async () => {
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should make another good block on top of the bad block', async function () {
      blockSubmissionFunction = async (txDataToSign, b, c, d, e, f, _block, _transactions) =>
        submitTransaction(txDataToSign, b, c, d, e, f);
      const transferTransactions = await makeTransactions(
        'transfer',
        1,
        url,
        {
          ercAddress,
          tokenId,
          recipientData: { values: [value], recipientZkpPublicKeys: [zkpPublicKey] },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        },
        [privateKey, shieldAddress, gas, fee],
      );
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      // we do not add this transaction - as it should be dropped because it will become invalid on rollback

      const depositTransactions = await makeTransactions('deposit', txPerBlock - 1, url, {
        ercAddress,
        tokenId,
        tokenType,
        value,
        zkpPrivateKey,
        fee,
      });
      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      validTransactions.push(...depositTransactions);
      // eventLogs = await waitForEvent(eventLogs, ['blockProposed','Rollback']);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should fire off the commit-challenge', async function () {
      while (!commitTxDataToSign) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await submitTransaction(commitTxDataToSign, privateKey, challengesAddress, gas);
    });

    it('Should delete the flawed block and rollback the leaves', async () => {
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateTransaction),
      ]);
    });
  });

  describe('Perform a final full resync and compare the results', () => {
    it('should drop everything in the database', async () => {
      // We need to wait here so we do not drop tables before the rollback is finished
      await new Promise(resolve => setTimeout(resolve, 10000));
      const resetOptimistDB = spawn('./nightfall-client/dropAll.sh', [], {
        stdio: 'ignore',
      });
      resetOptimistDB.on('close', async () => {
        spawn('docker', ['restart', 'nightfall_3_optimist_1'], {
          stdio: 'ignore',
        });
      });
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
        // eslint-disable-next-line no-await-in-loop
      } while ((await chai.request(url).get('/healthcheck')).status !== 200);
    });

    it('compare the mempools', async () => {
      await new Promise(resolve => setTimeout(resolve, 25000));
      const optimistMempool = (
        await chai.request(optimistUrl).get('/proposer/mempool')
      ).body.result.filter(m => m.mempool);
      expect(optimistMempool.map(o => o.transactionHash)).eql(
        validTransactions.map(v => v.transaction.transactionHash),
      );
    });
  });

  after(async () => {
    closeWeb3Connection();
    connection.close();
  });
});
