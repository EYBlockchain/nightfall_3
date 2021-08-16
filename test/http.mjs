import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Queue from 'queue';
import gen from 'general-number';
import WebSocket from 'ws';
import sha256 from '../common-files/utils/crypto/sha256.mjs';
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

const { expect, assert } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { GN } = gen;
const blockSubmissionQueue = new Queue({ concurrency: 1 });

describe('Testing the http API', () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let transactions = [];
  let connection; // WS connection
  let blockSubmissionFunction;
  let nodeInfo;
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  const value2 = 12;
  // this is the etherum private key for accounts[0]
  const privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const gas = 10000000;
  // this is also accounts[0]
  const recipientAddress = '0x9c8b2276d490141ae1440da660e470e7c0349c63';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether
  const txPerBlock = 2;
  const eventLogs = [];
  let stateBalance = 0;

  before(async function () {
    const web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    challengesAddress = (await chai.request(url).get('/contract-address/Challenges')).body.address;

    nodeInfo = await web3.eth.getNodeInfo();
    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign } = msg;
      if (type === 'block') {
        await blockSubmissionFunction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
      } else {
        await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
      }
    };
  });

  describe('Miscellaneous tests', () => {
    it('should respond with status 200 to the health check', async function () {
      const res = await chai.request(url).get('/healthcheck');
      expect(res.status).to.equal(200);
    });

    it('should generate a new 256 bit zkp private key for a user', async function () {
      const res = await chai.request(url).get('/generate-zkp-key');
      expect(res.body.keyId).to.be.a('string');
      // normally this value would be the private key for subsequent transactions
      // however we use a fixed one (zkpPrivateKey) to make the tests more independent.
    });

    it('should get the address of the shield contract', async function () {
      const res = await chai.request(url).get('/contract-address/Shield');
      expect(res.body.address).to.be.a('string');
      // subscribeToGasUsed(shieldAddress);
    });

    it('should get the address of the test ERC contract stub', async function () {
      const res = await chai.request(url).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
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
      const bond = 10000000000000000000;
      await submitTransaction(txDataToSign, privateKey, proposersAddress, gas, bond);
      stateBalance += bond;
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
      const bond = 10000000000000000000;
      const gasCosts = 5000000000000000;
      const startBalance = await getBalance(myAddress);
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        proposersAddress,
        gas,
        bond,
      );
      const endBalance = await getBalance(myAddress);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
      await chai.request(url).post('/peers/addPeers').send({
        address: myAddress,
        enode: 'http://optimist:80',
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
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);
    it('should deposit some crypto into a ZKP commitment', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * numDeposits }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(res => res.body);

      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      const receiptArrays = [];
      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        receiptArrays.push(
          // eslint-disable-next-line no-await-in-loop
          await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee),
          // we need to await here as we need transactions to be submitted sequentially or we run into nonce issues.
        );
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
        stateBalance += fee * txPerBlock + BLOCK_STAKE;
      }
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async function () {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        });
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

    it('should send a single transfer directly to a proposer - offchain', async function () {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          offchain: true,
          ercAddress,
          tokenId,
          recipientData: {
            values: [value],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        });
      expect(res.status).to.be.equal(200);
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 2 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(dRes => dRes.body);
      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      }

      while (eventLogs.length !== 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async function () {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value2],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
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

    it('should send a double transfer directly to a proposer - offchain', async function () {
      // give the last block time to be submitted, or we won't have enough
      // commitments in the Merkle tree to use for the double transfer.

      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          offchain: true,
          ercAddress,
          tokenId,
          recipientData: {
            // Add one here so we dont use the output of the previous double transfer as a single transfer input
            values: [value2 + 1],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
        });
      expect(res.status).to.be.equal(200);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 2 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(dRes => dRes.body);

      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      }

      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs.shift();
    });
  });

  describe('Withdraw tests', () => {
    it('should withdraw some crypto from a ZKP commitment', async function () {
      const res = await chai.request(url).post('/withdraw').send({
        ercAddress,
        tokenId,
        tokenType,
        value,
        senderZkpPrivateKey: zkpPrivateKey,
        recipientAddress,
      });
      transactions.push(res.body.transaction); // a new transaction
      expect(res.body.txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        res.body.txDataToSign,
        privateKey,
        shieldAddress,
        gas,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(receipt.gasUsed)}`);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 1 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(dRes => dRes.body);

      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      }
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
    });
  });
  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1', () => {
    let block;
    let txDataToSign;
    let index;
    it('Should find the block containing the withdraw transaction', async function () {
      const withdrawTransactionHash = transactions[0].transactionHash;
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
        // eslint-disable-next-line no-await-in-loop
        const res = await chai
          .request(optimistUrl)
          .get(`/block/transaction-hash/${withdrawTransactionHash}`);
        ({ block, transactions, index } = res.body);
      } while (block === null);
      // Need this while wait when running geth as it runs slower than ganache
      expect(block).not.to.be.undefined; // eslint-disable-line
      expect(Object.entries(block).length).not.to.equal(0); // empty object {}
    });
    let startBalance;
    let endBalance;
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async function () {
      const res = await chai.request(url).post('/finalise-withdrawal').send({
        block, // block containing the withdraw transaction
        transactions, // transactions in the withdraw block
        index, // index of the withdraw transaction in the transactions
      });
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });
    it('should send the transaction to the shield contract, which should then revert', async function () {
      // now we need to sign the transaction and send it to the blockchain
      await expect(
        submitTransaction(txDataToSign, privateKey, shieldAddress, gas),
      ).to.be.rejectedWith(
        /Returned error: VM Exception while processing transaction: revert It is too soon to withdraw funds from this block|Transaction has been reverted by the EVM/,
      );
    });

    it('Should create a passing finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 10 days
      const res = await chai.request(url).post('/finalise-withdrawal').send({
        block,
        transactions,
        index,
      });
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });
    it('should send the transaction to the shield contract', async function () {
      const myAddress = (await getAccounts())[0];
      startBalance = await getBalance(myAddress);
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      if (nodeInfo.includes('TestRPC')) {
        const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      } else {
        await expect(
          submitTransaction(txDataToSign, privateKey, shieldAddress, gas),
        ).to.be.rejectedWith('Transaction has been reverted by the EVM');
      }
      endBalance = await getBalance(myAddress);
    });
    it('Should have increased our balance', async function () {
      if (nodeInfo.includes('TestRPC')) {
        const gasCosts = (5000000000000000 * txPerBlock) / 2;
        expect(endBalance - startBalance).to.closeTo(Number(value), gasCosts);
      } else {
        console.log('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  describe('Make three blocks before submitting to the blockchain', () => {
    it(`Should make ${txPerBlock * 3} transactions with no block submission`, async function () {
      // hold block submission
      blockSubmissionQueue.stop();
      // push subsequent block signing requests to the queue
      blockSubmissionFunction = (a, b, c, d, e, f) =>
        blockSubmissionQueue.push(async () => {
          return submitTransaction(a, b, c, d, e, f);
        });
      // to make three blocks, we need six transactions
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * 3 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(res => res.body);

      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      const receiptArrays = [];
      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        receiptArrays.push(
          // eslint-disable-next-line no-await-in-loop
          await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee),
          // we need to await here as we need transactions to be submitted sequentially or we run into nonce issues.
        );
      }
      receiptArrays.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });
      // we need to wait for the block assembler to queue all three blocks, but
      // we won't wait forever!
      for (let i = 0; i < 10; i++) {
        if (blockSubmissionQueue.length === 3) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      expect(blockSubmissionQueue.length).to.equal(3);
    });
    it('Should submit all queued blocks with no invalid blocks', done => {
      blockSubmissionQueue.start(err => {
        if (err) assert.fail(err);
        done();
      });
      it('should have one extra block on chain', async function () {
        while (eventLogs.length !== 3) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        eventLogs.shift();
        eventLogs.shift();
        eventLogs.shift();
      });
      // TODO currently hard to check this has run ok without looking at logs
    });
  });

  describe('Check all balances in contracts', () => {
    it('Should be zero for shield and proposer and non-zero for state', async () => {
      const shieldContractBalance = await getBalance(shieldAddress);
      const stateContractBalance = await getBalance(stateAddress);
      const proposerContractBalance = await getBalance(proposersAddress);
      expect(Number(shieldContractBalance)).to.be.eq(0);
      expect(Number(proposerContractBalance)).to.be.eq(0);
      expect(Number(stateContractBalance)).to.be.gte(stateBalance);
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
