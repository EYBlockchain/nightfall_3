/* eslint-disable no-await-in-loop */
import config from 'config';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import childProcess from 'child_process';
import WebSocket from 'ws';
import { generateMnemonic } from 'bip39';
import logger from 'common-files/utils/logger.mjs';
import {
  topicEventMapping,
  createBadBlock,
  makeTransactions,
  sendTransactions,
  Web3Client,
} from './utils.mjs';

const { privateKey, gas, BLOCK_STAKE, fee, tokenId, transferValue, tokenType, bond } =
  config.TEST_OPTIONS;

const { spawn } = childProcess;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const web3Client = new Web3Client();

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
  let rootKey1;
  let nullifierKey1;
  let zkpPrivateKey1;
  let zkpPublicKey1;
  const txPerBlock = 2;
  const validTransactions = [];
  const environment = web3Client.getCurrentEnvironment();

  before(async function () {
    web3 = await web3Client.connectWeb3();

    shieldAddress = (await chai.request(environment.clientApiUrl).get('/contract-address/Shield'))
      .body.address;

    stateAddress = (await chai.request(environment.clientApiUrl).get('/contract-address/State'))
      .body.address;

    proposersAddress = (
      await chai.request(environment.clientApiUrl).get('/contract-address/Proposers')
    ).body.address;

    challengesAddress = (
      await chai.request(environment.clientApiUrl).get('/contract-address/Challenges')
    ).body.address;

    ercAddress = (await chai.request(environment.clientApiUrl).get('/contract-address/ERCStub'))
      .body.address;

    [myAddress] = await web3Client.getAccounts();

    web3Client.setNonce(await web3.eth.getTransactionCount(myAddress));

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    const mnemonic = generateMnemonic();

    ({
      rootKey: rootKey1,
      nullifierKey: nullifierKey1,
      zkpPrivateKey: zkpPrivateKey1,
      zkPublicKey: zkpPublicKey1,
    } = (
      await chai
        .request(environment.clientApiUrl)
        .post('/generate-zkp-keys')
        .send({ mnemonic, path: `m/44'/60'/0'/0` })
    ).body);

    defaultDepositArgs = {
      ercAddress,
      tokenId,
      tokenType,
      transferValue,
      rootKey: rootKey1,
      fee,
    };
    defaultTransferArgs = {
      ercAddress,
      tokenId,
      recipientData: {
        transferValues: [transferValue],
        recipientZkpPublicKeys: [zkpPublicKey1],
      },
      rootKey: rootKey1,
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

    connection = new WebSocket(environment.optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign, block, transactions } = msg;
      if (type === 'block') {
        // third last input is msg.transferValue
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
        await web3Client.submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
      } else if (type === 'challenge') {
        commitTxDataToSign = txDataToSign;
        logger.debug('Challenge held');
      }
    };
    const res = await chai
      .request(environment.optimistApiUrl)
      .post('/proposer/register')
      .send({ address: myAddress });
    const { txDataToSign } = res.body;
    await web3Client.submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);

    // Register keys
    await chai
      .request(environment.clientApiUrl)
      .post('/incoming-viewing-key')
      .send({
        zkpPrivateKeys: [zkpPrivateKey1],
        nullifierKeys: [nullifierKey1],
      });

    // Register Challenger
    await chai
      .request(environment.optimistApiUrl)
      .post('/challenger/add')
      .send({ address: myAddress });
  });

  describe('Prepare some boiler plate transactions', () => {
    blockSubmissionFunction = async (txDataToSign, b, c, d, e, f) =>
      web3Client.submitTransaction(txDataToSign, b, c, d, e, f);
    it('should make a block of deposits to start us off', async function () {
      const depositTransactions = await makeTransactions(
        'deposit',
        txPerBlock,
        environment.clientApiUrl,
        defaultDepositArgs,
      );

      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });

    it('should make a block of transfers so we can make some bad blocks', async function () {
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        environment.clientApiUrl,
        defaultTransferArgs,
      );
      // eslint-disable-next-line prefer-destructuring
      duplicateTransaction = transferTransactions[0];
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });
  });

  describe('Make a bad block at the chain tip', () => {
    it('should make a bad block', async function () {
      blockSubmissionFunction = async (_txDataToSign, b, c, d, e, f, block, transactions) => {
        const newBlockRes = await createBadBlock('DuplicateTransaction', block, transactions, {
          duplicateTransaction: duplicateTransaction.transaction,
        });
        logger.debug(
          `Created flawed block with duplicate transactions and blockHash ${newBlockRes.block.blockHash}`,
        );
        topicsBlockHashDuplicateTransaction = newBlockRes.block.blockHash;
        return web3Client.submitTransaction(newBlockRes.txDataToSign, b, c, d, e, f);
      };
      const transferTransactions = await makeTransactions(
        'transfer',
        txPerBlock,
        environment.clientApiUrl,
        defaultTransferArgs,
      );

      validTransactions.push(...transferTransactions);
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);

      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });
    it('should send the commit-challenge', async function () {
      while (!commitTxDataToSign) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await web3Client.submitTransaction(commitTxDataToSign, privateKey, challengesAddress, gas);
      commitTxDataToSign = null;
    });
    it('Should delete the flawed block and rollback the leaves', async () => {
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['Rollback']));
      await web3Client.testForEvents(stateAddress, [
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

        let healthCheck;
        while (healthCheck !== 200) {
          try {
            healthCheck = (await chai.request(environment.optimistApiUrl).get('/healthcheck'))
              .status;
          } catch (error) {
            console.log(`Wait for Optimist to restart`);

            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      });
    });

    it('compare the mempools', async () => {
      await new Promise(resolve => setTimeout(resolve, 50000));
      const optimistMempool = (
        await chai.request(environment.optimistApiUrl).get('/proposer/mempool')
      ).body.result.filter(m => m.mempool);
      expect(optimistMempool.map(o => o.transactionHash)).eql(
        validTransactions.map(v => v.transaction.transactionHash),
      );
    });
  });

  describe.skip('Make a bad block that is not on the chain tip', () => {
    it('should re-register ourselves as a proposer and reopen the websocket', async function () {
      // Need to wait for the resync process to finish processing
      await new Promise(resolve => setTimeout(resolve, 25000));
      connection = new WebSocket(environment.optimistWsUrl);
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
          await web3Client.submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
        } else if (type === 'challenge') {
          commitTxDataToSign = txDataToSign;
          logger.debug('Challenge held');
        }
      };

      const res = await chai
        .request(environment.optimistApiUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      await web3Client.submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
      await chai
        .request(environment.clientApiUrl)
        .post('/incoming-viewing-key')
        .send({
          zkpPrivateKeys: [zkpPrivateKey1],
          nullifierKeys: [nullifierKey1],
        });
      // Register Challenger
      await chai
        .request(environment.optimistApiUrl)
        .post('/challenger/add')
        .send({ address: myAddress });
    });

    it('should automatically create a bad block, as the resync will re-populate our local db', async () => {
      // This block will be a bad block as it uses the blockSubmissionFunction from the first bad block.
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });

    it('should make another good block on top of the bad block', async function () {
      blockSubmissionFunction = async (txDataToSign, b, c, d, e, f) =>
        web3Client.submitTransaction(txDataToSign, b, c, d, e, f);
      const transferTransactions = await makeTransactions(
        'transfer',
        1,
        environment.clientApiUrl,
        defaultTransferArgs,
      );
      await sendTransactions(transferTransactions, [privateKey, shieldAddress, gas, fee]);
      // we do not add this transaction - as it should be dropped because it will become invalid on rollback

      const depositTransactions = await makeTransactions(
        'deposit',
        txPerBlock - 1,
        environment.clientApiUrl,
        defaultDepositArgs,
      );
      await sendTransactions(depositTransactions, [privateKey, shieldAddress, gas, fee]);
      validTransactions.push(...depositTransactions);
      ({ eventLogs } = await web3Client.waitForEvent(eventLogs, ['blockProposed']));
    });

    it('should fire off the commit-challenge', async function () {
      while (!commitTxDataToSign) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await web3Client.submitTransaction(commitTxDataToSign, privateKey, challengesAddress, gas);
      commitTxDataToSign = null;
    });

    it('Should delete the flawed block and rollback the leaves', async () => {
      await web3Client.testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateTransaction),
      ]);
    });
  });

  describe.skip('Perform a final full resync and compare the results', () => {
    it('should drop everything in the database', async () => {
      // We need to wait here so we do not drop tables before the rollback is finished
      await new Promise(resolve => setTimeout(resolve, 15000));
      const resetOptimistDB = spawn('./nightfall-client/dropAll.sh', [], {
        stdio: 'ignore',
      });
      resetOptimistDB.on('close', async () => {
        spawn('docker', ['restart', 'nightfall_3_optimist_1'], {
          stdio: 'ignore',
        });
        let healthCheck;
        while (healthCheck !== 200) {
          try {
            healthCheck = (await chai.request(environment.optimistApiUrl).get('/healthcheck'))
              .status;
          } catch (error) {
            console.log(`Wait for Optimist to restart`);

            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      });
    });

    it('compare the mempools', async () => {
      await new Promise(resolve => setTimeout(resolve, 50000));
      const optimistMempool = (
        await chai.request(environment.optimistApiUrl).get('/proposer/mempool')
      ).body.result.filter(m => m.mempool);
      expect(optimistMempool.map(o => o.transactionHash)).eql(
        validTransactions.map(v => v.transaction.transactionHash),
      );
    });
  });

  after(() => {
    web3Client.closeWeb3Connection();
    connection.close();
  });
});
