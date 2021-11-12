import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import childProcess from 'child_process';
import WebSocket from 'ws';
import { generateMnemonic } from 'bip39';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  topicEventMapping,
  setNonce,
  createBadBlock,
  testForEvents,
  makeTransactions,
  sendTransactions,
  waitForEvent,
} from './utils.mjs';

import {
  url,
  optimistWsUrl,
  optimistUrl,
  privateKey,
  gas,
  BLOCK_STAKE,
  fee,
  tokenId,
  value,
  tokenType,
  bond,
} from './constants.mjs';

const { spawn } = childProcess;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

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
  let myAddress;
  let eventLogs = [];
  let commitTxDataToSign;
  let defaultDepositArgs;
  let defaultTransferArgs;
  let ask1;
  let nsk1;
  let ivk1;
  let pkd1;
  const txPerBlock = 2;
  const validTransactions = [];

  before(async function () {
    web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    challengesAddress = (await chai.request(url).get('/contract-address/Challenges')).body.address;

    ercAddress = (await chai.request(url).get('/contract-address/ERCStub')).body.address;

    [myAddress] = await getAccounts();

    setNonce(await web3.eth.getTransactionCount(myAddress));

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    const mnemonic = generateMnemonic();

    ({
      ask: ask1,
      nsk: nsk1,
      ivk: ivk1,
      pkd: pkd1,
    } = (
      await chai.request(url).post('/generate-keys').send({ mnemonic, path: `m/44'/60'/0'/0` })
    ).body);

    defaultDepositArgs = { ercAddress, tokenId, tokenType, value, pkd: pkd1, nsk: nsk1, fee };
    defaultTransferArgs = {
      ercAddress,
      tokenId,
      recipientData: {
        values: [value],
        recipientPkds: [pkd1],
      },
      nsk: nsk1,
      ask: ask1,
      fee,
    };

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
        // third last input is msg.value
        // eslint-disable-next-line prettier/prettier
        await blockSubmissionFunction(
          txDataToSign,
          privateKey,
          stateAddress,
          gas,
          BLOCK_STAKE,
          '0',
          block,
          transactions,
        );
      } else if (type === 'commit') {
        await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
      } else if (type === 'challenge') {
        commitTxDataToSign = txDataToSign;
        console.log('Challenge held');
      }
    };
    const res = await chai
      .request(optimistUrl)
      .post('/proposer/register')
      .send({ address: myAddress });
    const { txDataToSign } = res.body;
    await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);

    // Register keys
    await chai
      .request(url)
      .post('/incoming-viewing-key')
      .send({
        ivks: [ivk1],
        nsks: [nsk1],
      });

    // Register Challenger
    await chai.request(optimistUrl).post('/challenger/add').send({ address: myAddress });
  });

  describe('Prepare some boiler plate transactions', () => {
    blockSubmissionFunction = async (txDataToSign, b, c, d, e, f) =>
      submitTransaction(txDataToSign, b, c, d, e, f);
    it('should make a block of deposits to start us off', async function () {
      const depositTransactions = await makeTransactions(
        'deposit',
        txPerBlock,
        url,
        defaultDepositArgs,
      );

      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should make a block of transfers so we can make some bad blocks', async function () {
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        url,
        defaultTransferArgs,
      );
      // eslint-disable-next-line prefer-destructuring
      duplicateTransaction = transferTransactions[0];
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      // Have to wait here as client block proposal takes longer now
      await new Promise(resolve => setTimeout(resolve, 3000));
    });
  });

  describe('Make a bad block at the chain tip', () => {
    it('should make a bad block', async function () {
      blockSubmissionFunction = async (_txDataToSign, b, c, d, e, f, block, transactions) => {
        const newBlockRes = await createBadBlock('DuplicateTransaction', block, transactions, {
          duplicateTransaction: duplicateTransaction.transaction,
        });
        console.log(
          `Created flawed block with duplicate transactions and blockHash ${newBlockRes.block.blockHash}`,
        );
        topicsBlockHashDuplicateTransaction = newBlockRes.block.blockHash;
        return submitTransaction(newBlockRes.txDataToSign, b, c, d, e, f);
      };
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        url,
        defaultTransferArgs,
      );

      validTransactions.push(...transferTransactions);
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);

      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      // Have to wait here as client block proposal takes longer now
      await new Promise(resolve => setTimeout(resolve, 3000));
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
        spawn('docker', ['restart', 'nightfall_3_optimist1_1'], {
          stdio: 'ignore',
        });

        let healthCheck;
        while (healthCheck.status !== 200) {
          try {
            // eslint-disable-next-line no-await-in-loop
            healthCheck = (await chai.request(optimistUrl).get('/healthcheck')).status;
          } catch (error) {
            console.log(`Wait for Optimist to restart`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      });
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
          await blockSubmissionFunction(
            txDataToSign,
            privateKey,
            stateAddress,
            gas,
            BLOCK_STAKE,
            '0',
            block,
            transactions,
          );
        } else if (type === 'commit') {
          await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
        } else if (type === 'challenge') {
          commitTxDataToSign = txDataToSign;
          console.log('Challenge held');
        }
      };

      const res = await chai
        .request(optimistUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
      await chai
        .request(url)
        .post('/incoming-viewing-key')
        .send({
          ivks: [ivk1],
          nsks: [nsk1],
        });
      // Register Challenger
      await chai.request(optimistUrl).post('/challenger/add').send({ address: myAddress });
    });

    it('should automatically create a bad block, as the resync will re-populate our local db', async () => {
      // This block will be a bad block as it uses the blockSubmissionFunction from the first bad block.
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should make another good block on top of the bad block', async function () {
      blockSubmissionFunction = async (txDataToSign, b, c, d, e, f) =>
        submitTransaction(txDataToSign, b, c, d, e, f);
      const transferTransactions = await makeTransactions('transfer', 1, url, defaultTransferArgs);
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      // we do not add this transaction - as it should be dropped because it will become invalid on rollback

      const depositTransactions = await makeTransactions(
        'deposit',
        txPerBlock - 1,
        url,
        defaultDepositArgs,
      );
      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      validTransactions.push(...depositTransactions);
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
      await new Promise(resolve => setTimeout(resolve, 15000));
      const resetOptimistDB = spawn('./nightfall-client/dropAll.sh', [], {
        stdio: 'ignore',
      });
      resetOptimistDB.on('close', async () => {
        spawn('docker', ['restart', 'nightfall_3_optimist1_1'], {
          stdio: 'ignore',
        });
        let healthCheck;
        while (healthCheck.status !== 200) {
          try {
            // eslint-disable-next-line no-await-in-loop
            healthCheck = (await chai.request(optimistUrl).get('/healthcheck')).status;
          } catch (error) {
            console.log(`Wait for Optimist to restart`);
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      });
    });

    it('compare the mempools', async () => {
      await new Promise(resolve => setTimeout(resolve, 50000));
      const optimistMempool = (
        await chai.request(optimistUrl).get('/proposer/mempool')
      ).body.result.filter(m => m.mempool);
      expect(optimistMempool.map(o => o.transactionHash)).eql(
        validTransactions.map(v => v.transaction.transactionHash),
      );
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
