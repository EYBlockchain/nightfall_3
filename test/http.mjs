import chai from 'chai';
// import config from 'config';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
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

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { GN } = gen;

describe('Testing the http API', () => {
  let shieldAddress;
  let txDataToSign;
  let ercAddress;
  let transactions = [];
  let connection; // WS connection
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

  before(() => {
    connectWeb3();
    // set up a websocket connection to listen for assembled blocks
    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('blocks');
    };
    connection.onmessage = m => {
      submitTransaction(m.data, privateKey, shieldAddress, gas, BLOCK_STAKE).then(receipt =>
        console.log('tx hash was', receipt.transactionHash),
      );
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
      shieldAddress = res.body.address;
      expect(shieldAddress).to.be.a('string');
      // subscribeToGasUsed(shieldAddress);
    });

    it('should get the address of the test ERC contract stub', async () => {
      const res = await chai.request(url).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
    });
  });

  describe('Basic Proposer tests', () => {
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
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, bond);
      const endBalance = await getBalance(myAddress);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    });

    it.skip('should de-register a proposer', async () => {
      const res = await chai.request(optimistUrl).post('/proposer/de-register');
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
    });

    it.skip("should withdraw the proposer's bond", async () => {
      const myAddress = (await getAccounts())[0];
      const startBalance = await getBalance(myAddress);
      const res = await chai.request(optimistUrl).get('/proposer/withdraw');
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      const endBalance = await getBalance(myAddress);
      const bond = 10000000000000000000;
      const gasCosts = 5000000000000000;
      expect(endBalance - startBalance).to.closeTo(bond, gasCosts);
    });
    it('Should change the current proposer (to the just-registered proposer as that is the only one)', async () => {
      const res = await chai.request(optimistUrl).get('/proposer/change');
      expect(res.status).to.equal(200);
      txDataToSign = res.body.txDataToSign;
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
    });
  });

  describe('Deposit tests', () => {
    it('should deposit some crypto into a ZKP commitment and get an unsigned blockchain transaction back', async () => {
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
      transactions.push(res.body.transaction);
      expect(txDataToSign).to.be.a('string');
    });

    it('should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should deposit some more crypto (we need a second token for the double transfer test) into a ZKP commitment and get a raw blockchain transaction back', async () => {
      const res = await chai
        .request(url)
        .post('/deposit')
        .send({
          ercAddress,
          tokenId,
          value,
          zkpPublicKey,
        });
      txDataToSign = res.body.txDataToSign;
      transactions.push(res.body.transaction);
      expect(txDataToSign).to.be.a('string');
    });

    it('should should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should deposit yet more crypto (we need another token to test withdraw) into a ZKP commitment and get a raw blockchain transaction back', async () => {
      const res = await chai
        .request(url)
        .post('/deposit')
        .send({
          ercAddress,
          tokenId,
          value,
          zkpPublicKey,
        });
      txDataToSign = res.body.txDataToSign;
      transactions.push(res.body.transaction);
      expect(txDataToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and store the commitment in the Merkle tree, and update the commitment db', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async () => {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: { values: [value], recipientZkpPublicKeys: [zkpPublicKey] },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        });
      txDataToSign = res.body.txDataToSign;
      transactions = [res.body.transaction]; // a new block of transactions
      expect(txDataToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
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
          recipientData: { values: [value2], recipientZkpPublicKeys: [zkpPublicKey] },
          senderZkpPrivateKey: zkpPrivateKey,
        });
      txDataToSign = res.body.txDataToSign;
      transactions = [res.body.transaction]; // a transaction
      expect(txDataToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  describe('Withdraw tests', () => {
    it('should withdraw some crypto from a ZKP commitment', async () => {
      const res = await chai
        .request(url)
        .post('/withdraw')
        .send({
          ercAddress,
          tokenId,
          value,
          senderZkpPrivateKey: zkpPrivateKey,
          recipientAddress,
        });
      txDataToSign = res.body.txDataToSign;
      transactions = [res.body.transaction]; // a new transaction
      expect(txDataToSign).to.be.a('string');
    });
    it('should should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1', () => {
    let block;
    it('Should find the block containing the withdraw transaction', async () => {
      // give the last block time to be submitted, or we won't have added the
      // withdraw transaction to the blockchain at all.
      await new Promise(resolve => setTimeout(resolve, 5000));
      // next look for the block that contains the withdraw tx
      const res = await chai.request(optimistUrl).get(`/block/${transactions[0].transactionHash}`);
      block = res.body;
      expect(block).not.to.be.null; // eslint-disable-line
      console.log('BLOCK', block);
    });
    let startBalance;
    let endBalance;
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async () => {
      const res = await chai
        .request(url)
        .post('/finalise-withdrawal')
        .send({
          block,
          transaction: transactions[0],
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
      const res = await chai
        .request(url)
        .post('/finalise-withdrawal')
        .send({
          block,
          transaction: transactions[0],
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

  after(() => {
    // closeWeb3Connection();
  });
});
