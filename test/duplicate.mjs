import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Queue from 'queue';
import WebSocket from 'ws';
import { generateMnemonic } from 'bip39';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
  timeJump,
  topicEventMapping,
  setNonce,
} from './utils.mjs';

const { expect } = chai;
const txQueue = new Queue({ autostart: true, concurrency: 1 });
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the http API', () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let connection; // WS connection
  let blockSubmissionFunction;
  let nodeInfo;
  let web3;
  let ask1;
  let nsk1;
  let nsk2;
  let ivk1;
  let ivk2;
  let pkd1;

  const USE_INFURA = process.env.USE_INFURA === 'true';
  const { ETH_PRIVATE_KEY, BLOCKCHAIN_URL } = process.env;

  const senderUrl = 'http://localhost:8080';
  const recipientUrl = 'http://localhost:8084';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws://localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 1000;
  const value2 = 5;
  // this is the etherum private key for accounts[0]
  let privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const gas = 10000000;
  // this is also accounts[0]
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1; // 1 wei
  const txPerBlock = 2;
  const eventLogs = [];
  const logCounts = {
    deposit: 0,
    registerProposer: 0,
  };

  const holdupTxQueue = async (txType, waitTillCount) => {
    while (logCounts[txType] < waitTillCount) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  const waitForTxExecution = async (count, txType) => {
    while (count === logCounts[txType]) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };
  const gasCostsTx = 5000000000000000;

  before(async function () {
    web3 = await connectWeb3(BLOCKCHAIN_URL);

    if (USE_INFURA) {
      if (!ETH_PRIVATE_KEY) {
        throw Error(
          'Cannot use default private key, please set environment variable ETH_PRIVATE_KEY',
        );
      }
      privateKey = ETH_PRIVATE_KEY;
    }

    shieldAddress = (await chai.request(senderUrl).get('/contract-address/Shield')).body.address;
    web3.eth.subscribe('logs', { address: shieldAddress }).on('data', log => {
      if (log.topics[0] === web3.eth.abi.encodeEventSignature('TransactionSubmitted()')) {
        logCounts.deposit += 1;
      }
    });

    stateAddress = (await chai.request(senderUrl).get('/contract-address/State')).body.address;
    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });

    proposersAddress = (await chai.request(senderUrl).get('/contract-address/Proposers')).body
      .address;
    web3.eth.subscribe('logs', { address: proposersAddress }).on('data', log => {
      if (log.topics[0] === web3.eth.abi.encodeEventSignature('NewCurrentProposer(address)')) {
        logCounts.registerProposer += 1;
      }
    });

    challengesAddress = (await chai.request(senderUrl).get('/contract-address/Challenges')).body
      .address;

    nodeInfo = await web3.eth.getNodeInfo();
    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    // For entropy, crypto.randomBytes uses /dev/urandom (unix, MacOS) or CryptoGenRandom (windows)
    // Crypto.getRandomValues() is suitable for browser needs
    const mnemonic = generateMnemonic();

    ({
      ask: ask1,
      nsk: nsk1,
      ivk: ivk1,
      pkd: pkd1,
    } = (
      await chai
        .request(senderUrl)
        .post('/generate-keys')
        .send({ mnemonic, path: `m/44'/60'/0'/0` })
    ).body);

    ({ nsk: nsk2, ivk: ivk2 } = (
      await chai
        .request(senderUrl)
        .post('/generate-keys')
        .send({ mnemonic, path: `m/44'/60'/1'/0` })
    ).body);

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      txQueue.push(async () => {
        const msg = JSON.parse(message.data);
        const { type, txDataToSign } = msg;
        try {
          if (type === 'block') {
            await blockSubmissionFunction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
          } else {
            await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
          }
        } catch (err) {
          console.error('http.mjs onmessage: ', err);
        }
      });
    };
  });

  describe('Miscellaneous tests', () => {
    it('should respond with status 200 to the health check', async function () {
      const res = await chai.request(senderUrl).get('/healthcheck');
      expect(res.status).to.equal(200);
    });

    it('should get the address of the shield contract', async function () {
      const res = await chai.request(senderUrl).get('/contract-address/Shield');
      expect(res.body.address).to.be.a('string');
      // subscribeToGasUsed(shieldAddress);
    });

    it('should get the address of the test ERC contract stub', async function () {
      const res = await chai.request(senderUrl).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key for optimist1', async function () {
      const res = await chai
        .request(senderUrl)
        .post('/incoming-viewing-key')
        .send({
          ivks: [ivk1, ivk2],
          nsks: [nsk1, nsk2],
        });
      expect(res.body.status).to.be.a('string');
      expect(res.body.status).to.equal('success');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key for optimist2', async function () {
      const res = await chai
        .request(recipientUrl)
        .post('/incoming-viewing-key')
        .send({
          ivks: [ivk2],
          nsks: [nsk2],
        });
      expect(res.body.status).to.be.a('string');
      expect(res.body.status).to.equal('success');
    });
  });

  describe('Basic Proposer tests', () => {
    after(async () => {
      // After the proposer tests, re-register proposers
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      const bond = 10;
      const count = logCounts.registerProposer;
      await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
      await waitForTxExecution(count, 'registerProposer');
    });

    it('should register a proposer', async () => {
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      // we have to pay 10 ETH to be registered
      const bond = 10;
      const startBalance = await getBalance(myAddress);
      const count = logCounts.registerProposer;
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        proposersAddress,
        gas,
        bond,
      );
      await waitForTxExecution(count, 'registerProposer');
      const endBalance = await getBalance(myAddress);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCostsTx);
      await chai.request(senderUrl).post('/peers/addPeers').send({
        address: myAddress,
        enode: 'http://optimist1:80',
      });
    });

    it('should de-register a proposer', async () => {
      const myAddress = (await getAccounts())[0];
      const res = await chai.request(optimistUrl).post('/proposer/de-register');
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      const receipt = await submitTransaction(txDataToSign, privateKey, proposersAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      const { proposers } = (await chai.request(optimistUrl).get('/proposer/proposers')).body;
      const thisProposer = proposers.filter(p => p.thisAddresss === myAddress);
      expect(thisProposer.length).to.be.equal(0);
    });
    it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
      const res = await chai.request(optimistUrl).post('/proposer/withdrawBond');
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      await expect(
        submitTransaction(txDataToSign, privateKey, proposersAddress, gas),
      ).to.be.rejectedWith(
        /Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond|Transaction has been reverted by the EVM/,
      );
    });
    it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 7 days
      const res = await chai.request(optimistUrl).post('/proposer/withdrawBond');
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      if (nodeInfo.includes('TestRPC')) {
        const receipt = await submitTransaction(txDataToSign, privateKey, proposersAddress, gas);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      } else {
        await expect(
          submitTransaction(txDataToSign, privateKey, proposersAddress, gas),
        ).to.be.rejectedWith('Transaction has been reverted by the EVM');
      }
    });
  });

  describe('Deposit tests', () => {
    // blocks should be directly submitted to the blockchain, not queued
    blockSubmissionFunction = (a, b, c, d, e, f) => submitTransaction(a, b, c, d, e, f);
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = 2;
    it('should deposit some crypto into a ZKP commitment', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * numDeposits }, () =>
            chai
              .request(senderUrl)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, pkd: pkd1, nsk: nsk1, fee }),
          ),
        )
      ).map(res => res.body);

      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      const receiptArrays = [];
      txQueue.push(async () => {
        await holdupTxQueue('deposit', logCounts.deposit + depositTransactions.length);
      });
      for (let i = 0; i < depositTransactions.length; i++) {
        const count = logCounts.deposit;
        const { txDataToSign } = depositTransactions[i];
        receiptArrays.push(
          // eslint-disable-next-line no-await-in-loop
          await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee),
          // we need to await here as we need transactions to be submitted sequentially or we run into nonce issues.
        );
        // eslint-disable-next-line no-await-in-loop
        await waitForTxExecution(count, 'deposit');
      }
      receiptArrays.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });

      const totalGas = receiptArrays.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);

      console.log(`     Average Gas used was ${Math.ceil(totalGas / (txPerBlock * numDeposits))}`);

      // Wait until we see the right number of blocks appear
      while (eventLogs.length !== numDeposits) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // Now we can empty the event queue
      for (let i = 0; i < numDeposits; i++) {
        eventLogs.shift();
      }
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    it('transfer 1', async function () {
      const res = await chai
        .request(senderUrl)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value2],
            recipientPkds: [pkd1],
          },
          nsk: nsk1,
          ask: ask1,
        });
      // now we need to sign the transaction and send it to the blockchain
      expect(res.body.txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        res.body.txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        fee,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(receipt.gasUsed)}`);
    });

    it('transfer 2', async function () {
      const res = await chai
        .request(senderUrl)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value2],
            recipientPkds: [pkd1],
          },
          nsk: nsk1,
          ask: ask1,
        });
      // now we need to sign the transaction and send it to the blockchain
      expect(res.body.txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        res.body.txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        fee,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  after(() => {
    // if the queue is still running, let's close down after it ends
    // if it's empty, close down immediately
    if (txQueue.length === 0) {
      closeWeb3Connection();
      connection.close();
    } else {
      // TODO work out what's still running and close it properly
      txQueue.on('end', () => {
        closeWeb3Connection();
        connection.close();
      });
      txQueue.end();
    }
  });
});
