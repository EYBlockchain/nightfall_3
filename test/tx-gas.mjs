/**
Test suite for measuring the gas per transaction
*/
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import WebSocket from 'ws';
import { generateMnemonic } from 'bip39';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
  setNonce,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the http API', () => {
  let shieldAddress;
  let challengeAddress;
  let proposersAddress;
  let stateAddress;
  let ercAddress;
  let connection; // WS connection
  let blockSubmissionFunction;
  let web3;
  let nsk1;
  let ivk1;
  let pkd1;

  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  // this is the etherum private key for accounts[0]
  const privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1; // 1 wei
  const TRANSACTIONS_PER_BLOCK = 32;

  before(async () => {
    web3 = await connectWeb3();

    let res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Challenges');
    challengeAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Proposers');
    proposersAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/State');
    stateAddress = res.body.address;

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    const mnemonic = generateMnemonic();

    ({
      nsk: nsk1,
      ivk: ivk1,
      pkd: pkd1,
    } = (
      await chai.request(url).post('/generate-keys').send({ mnemonic, path: `m/44'/60'/0'/0` })
    ).body);

    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

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
          stateAddress,
          gas,
          BLOCK_STAKE,
        );
        console.log(
          `Block proposal gas cost was ${receipt.gasUsed}, cost per transaction was ${
            receipt.gasUsed / TRANSACTIONS_PER_BLOCK
          }`,
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

    it('should subscribe to block proposed event with the provided incoming viewing key for optimist1', async function () {
      const res = await chai
        .request(url)
        .post('/incoming-viewing-key')
        .send({
          ivks: [ivk1],
          nsks: [nsk1],
        });
      expect(res.body.status).to.be.a('string');
      expect(res.body.status).to.equal('success');
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
      const bond = 10;
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
        // eslint-disable-next-line no-await-in-loop
        const res = await chai.request(url).post('/deposit').send({
          ercAddress,
          tokenId,
          tokenType,
          value,
          pkd: pkd1,
          nsk: nsk1,
          fee,
        });
        txDataToSign = res.body.txDataToSign;
        expect(txDataToSign).to.be.a('string');
        // now we need to sign the transaction and send it to the blockchain
        // eslint-disable-next-line no-await-in-loop
        const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
        console.log(`Gas used was ${Number(receipt.gasUsed)}`);
        // give Timber time to respond to the blockchain event
        await new Promise(resolve => setTimeout(resolve, 3000)); // eslint-disable-line no-await-in-loop
      }
    });
  });

  after(() => {
    // console.log('end');
    closeWeb3Connection();
    connection.close();
  });
});
