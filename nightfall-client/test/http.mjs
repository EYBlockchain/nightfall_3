/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Queue from 'queue';
import gen from 'general-number';
import WebSocket from 'ws';
import sha256 from '../src/utils/crypto/sha256.mjs';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
  timeJump,
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
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x01';
  const value = 10;
  const value2 = 12;
  // this is the etherum private key for the test account in openethereum
  const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  const recipientAddress = '0x00a329c0648769a73afac7f9381e08fb43dbea72';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether

  before(async () => {
    connectWeb3();

    let res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/State');
    stateAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Proposers');
    proposersAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Challenges');
    challengesAddress = res.body.address;

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
        // console.log('tx hash is', txReceipt.transactionHash);
      }
    };
  });

  describe('Miscellaneous tests', () => {
    it('should respond with status 200 to the health check', async () => {
      const res = await chai.request(url).get('/healthcheck');
      expect(res.status).to.equal(200);
    });

    it('should generate a new 256 bit zkp private key for a user', async () => {
      const res = await chai.request(url).get('/generate-zkp-key');
      expect(res.body.keyId).to.be.a('string');
      // normally this value would be the private key for subsequent transactions
      // however we use a fixed one (zkpPrivateKey) to make the tests more independent.
    });

    it('should get the address of the shield contract', async () => {
      const res = await chai.request(url).get('/contract-address/Shield');
      expect(res.body.address).to.be.a('string');
      // subscribeToGasUsed(shieldAddress);
    });

    it('should get the address of the test ERC contract stub', async () => {
      const res = await chai.request(url).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
    });
  });

  describe('Basic Proposer tests', () => {
    let txDataToSign;
    it('should register a proposer', async () => {
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/proposer/register')
        .send({ address: myAddress });
      txDataToSign = res.body.txDataToSign;
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
  });

  describe('Deposit tests', () => {
    let txDataToSign;
    // blocks should be directly submitted to the blockchain, not queued
    blockSubmissionFunction = (a, b, c, d, e) => submitTransaction(a, b, c, d, e);
    it('should deposit some crypto into a ZKP commitment', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await chai.request(url).post('/deposit').send({
          ercAddress,
          tokenId,
          value,
          zkpPublicKey,
          fee,
        });
        txDataToSign = res.body.txDataToSign;
        expect(txDataToSign).to.be.a('string');
        // now we need to sign the transaction and send it to the blockchain
        const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
        console.log(`Gas used was ${Number(receipt.gasUsed)}`);
        // give Timber time to respond to the blockchain event
      }
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    let txDataToSign;
    it('should transfer some crypto (back to us) using ZKP', async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
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
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should send a single transfer directly to a proposer - offchain', async () => {
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
      console.log(`Offchain single transfer success`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    let txDataToSign;
    it('should transfer some crypto (back to us) using ZKP', async () => {
      // give the last block time to be submitted, or we won't have enough
      // commitments in the Merkle tree to use for the double transfer.
      await new Promise(resolve => setTimeout(resolve, 5000));
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
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should send a double transfer directly to a proposer - offchain', async () => {
      // give the last block time to be submitted, or we won't have enough
      // commitments in the Merkle tree to use for the double transfer.
      await new Promise(resolve => setTimeout(resolve, 5000));
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          offchain: true,
          ercAddress,
          tokenId,
          recipientData: {
            values: [value2],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
        });
      expect(res.status).to.be.equal(200);
      console.log(`Offchain Double transfer success`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Withdraw tests', () => {
    let txDataToSign;
    it('should withdraw some crypto from a ZKP commitment', async () => {
      const res = await chai.request(url).post('/withdraw').send({
        ercAddress,
        tokenId,
        value,
        senderZkpPrivateKey: zkpPrivateKey,
        recipientAddress,
      });
      txDataToSign = res.body.txDataToSign;
      transactions.push(res.body.transaction); // a new transaction
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1', () => {
    let block;
    let txDataToSign;
    let index;
    it('Should find the block containing the withdraw transaction', async () => {
      // give the last block time to be submitted, or we won't have added the
      // withdraw transaction to the blockchain at all.
      // it sometimes seems to take a while for this block to appear so loop
      // every five seconds.
      let i = 0;
      const withdrawTransactionHash = transactions[0].transactionHash;
      // const offchainTransactionHash = transactions[1].transactionHash;
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Waiting for withdraw block to appear', i++, 'seconds');
        // look for the block that contains the withdraw tx
        const res = await chai
          .request(optimistUrl)
          .get(`/block/transaction-hash/${withdrawTransactionHash}`);
        ({ block, transactions, index } = res.body);
      } while (block === null);
      expect(block).not.to.be.undefined; // eslint-disable-line
      expect(Object.entries(block).length).not.to.equal(0); // empty object {}
    });
    let startBalance;
    let endBalance;
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async () => {
      const res = await chai.request(url).post('/finalise-withdrawal').send({
        block, // block containing the withdraw transaction
        transactions, // transactions in the withdraw block
        index, // index of the withdraw transaction in the transactions
      });
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });
    it('should send the transaction to the shield contract, which should then revert', async () => {
      // now we need to sign the transaction and send it to the blockchain
      await expect(
        submitTransaction(txDataToSign, privateKey, shieldAddress, gas),
      ).to.be.rejectedWith(
        'Returned error: VM Exception while processing transaction: revert It is too soon withdraw funds from this block',
      );
    });
    it('Should create a passing finalise-withdrawal (because sufficient time has passed)', async () => {
      await timeJump(3600 * 24 * 10); // jump in time by 10 days
      const res = await chai.request(url).post('/finalise-withdrawal').send({
        block,
        transactions,
        index,
      });
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });
    it('should send the transaction to the shield contract', async () => {
      // we have to pay 10 ETH to be registered
      const myAddress = (await getAccounts())[0];
      startBalance = await getBalance(myAddress);
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      endBalance = await getBalance(myAddress);
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
    it('Should have increased our balance', async () => {
      const gasCosts = 5000000000000000;
      expect(endBalance - startBalance).to.closeTo(Number(value), gasCosts);
    });
  });

  describe('Make three blocks before submitting to the blockchain', () => {
    it('Should make six transactions with no block submission', async () => {
      // hold block submission
      blockSubmissionQueue.stop();
      // push subsequent block signing requests to the queue
      blockSubmissionFunction = (a, b, c, d, e) =>
        blockSubmissionQueue.push(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000)); // TODO fix /verify so we can remove this.
          return submitTransaction(a, b, c, d, e);
        });
      // to make three blocks, we need six transactions
      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await chai.request(url).post('/deposit').send({
          ercAddress,
          tokenId,
          value,
          zkpPublicKey,
        });
        const { txDataToSign } = res.body;
        transactions.push(res.body.transaction);
        expect(txDataToSign).to.be.a('string');
        // now we need to sign the transaction and send it to the blockchain
        // eslint-disable-next-line no-await-in-loop
        const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
        console.log(
          `      Gas used was ${Number(receipt.gasUsed)}, ${i + 1} transactions submitted`,
        );
      }
      // we need to wait for the block assembler to queue all three blocks, but
      // we won't wait forever!
      for (let i = 0; i < 10; i++) {
        if (blockSubmissionQueue.length === 3) break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      expect(blockSubmissionQueue.length).to.equal(3);
    });
    it('Should submit all queued blocks with no invalid blocks', done => {
      blockSubmissionQueue.start(err => {
        if (err) assert.fail(err);
        done();
      });
      // TODO currently hard to check this has run ok without looking at logs
    });
  });

  after(() => {
    // console.log('end');
    closeWeb3Connection();
    connection.close();
  });
});
