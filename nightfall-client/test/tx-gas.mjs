/**
Test suite for measuring the gas per transaction
*/
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import gen from 'general-number';
import WebSocket from 'ws';
import sha256 from '../src/utils/crypto/sha256.mjs';
import {
  // closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { GN } = gen;

describe('Testing the http API', () => {
  let shieldAddress;
  let challengeAddress;
  let ercAddress;
  let connection; // WS connection
  let blockSubmissionFunction;
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x01';
  const value = 10;
  // this is the etherum private key for the test account in openethereum
  const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether
  const TRANSACTIONS_PER_BLOCK = 2;

  before(async () => {
    connectWeb3();

    let res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Challenges');
    challengeAddress = res.body.address;

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign } = msg;
      if (type === 'block') {
        const receipt = await blockSubmissionFunction(
          txDataToSign,
          privateKey,
          challengeAddress,
          gas,
          BLOCK_STAKE,
        );
        console.log(
          `Block proposal gas cost was ${
            receipt.gasUsed
          }, cost per transaction was ${receipt.gasUsed / TRANSACTIONS_PER_BLOCK}`,
        );
      } else {
        await submitTransaction(txDataToSign, privateKey, challengeAddress, gas);
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
        challengeAddress,
        gas,
        bond,
      );
      const endBalance = await getBalance(myAddress);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    });
  });

  describe('Deposit tests', () => {
    console.warn(
      'WARNING, THE TRANSACTIONS_PER_BLOCK CONSTANT MUST HAVE THE SAME VALUE AS IN NIGHTFALL_OPTIMIST CONFIG OR THIS TEST WILL NOT REPORT CORRECTLY',
    );
    let txDataToSign;
    // blocks should be directly submitted to the blockchain, not queued
    blockSubmissionFunction = (a, b, c, d, e) => submitTransaction(a, b, c, d, e);
    it('should deposit some crypto into a ZKP commitment', async () => {
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
        const res = await chai
          .request(url)
          .post('/deposit')
          .send({
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
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });
  });

  after(() => {
    // console.log('end');
    // closeWeb3Connection();
    // connection.close();
  });
});
