import chai from 'chai';
// import config from 'config';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import gen from 'general-number';
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
  let block = {};
  let currentLeafCount = 0;
  let newLeaves = 0;
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
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
      const res = await chai.request(url).post('/proposer/register');
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // we have to pay 10 ETH to be registered
      const bond = 10000000000000000000;
      const gasCosts = 5000000000000000;
      const myAddress = (await getAccounts())[0];
      const startBalance = await getBalance(myAddress);
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, bond);
      const endBalance = await getBalance(myAddress);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    });

    it('should de-register a proposer', async () => {
      const res = await chai.request(url).post('/proposer/de-register');
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
    });

    it("should withdraw the proposer's bond", async () => {
      const myAddress = (await getAccounts())[0];
      const startBalance = await getBalance(myAddress);
      const res = await chai.request(url).get('/proposer/withdraw');
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
      newLeaves++; // remember how many leaves we're adding for when we propose a block
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

    it.skip('should deposit some more crypto (we need a second token for the double transfer test) into a ZKP commitment and get a raw blockchain transaction back', async () => {
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
      newLeaves++;
    });

    it.skip('should should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
    it.skip('should deposit yet more crypto (we need another token to test withdraw) into a ZKP commitment and get a raw blockchain transaction back', async () => {
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
      newLeaves++;
    });

    it.skip('should should send the raw transaction to the shield contract to verify the proof and store the commitment in the Merkle tree, and update the commitment db', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  // Before we attempt another transaction, we need to post a block containing
  // the deposit transactions so that Timber gets to hear about them.  Otherwise
  // we won't be able to find an input commitment for the next transaction

  describe('Block proposal test', () => {
    it('should create a block proposal transaction', async () => {
      const res = await chai
        .request(url)
        .post('/proposer/propose')
        .send({
          proposer: (await getAccounts())[0],
          transactions: transactions,
          currentLeafCount,
        });
      currentLeafCount += newLeaves; // remember we added a leaf
      newLeaves = 0;
      ({ txDataToSign, block, transactions } = res.body);
      expect(txDataToSign).to.be.a('string');
    });

    it('should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        BLOCK_STAKE,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Block check tests', () => {
    it('Should check that the proposed block is valid', async () => {
      await chai
        .request(url)
        .post('/check-block')
        .send({ block, transactions });
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe.skip('Single transfer tests', () => {
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
      newLeaves++;
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  // the double transfer test is dependent on the single transfer completing,
  // so the single transfer needs to go into a block before we run the double
  // transfer tests.
  describe.skip('Block proposal test', () => {
    it('should create a block proposal transaction', async () => {
      const res = await chai
        .request(url)
        .post('/proposer/propose')
        .send({
          proposer: (await getAccounts())[0],
          transactions: transactions,
          currentLeafCount,
        });
      currentLeafCount += newLeaves; // remember we added a leaf
      newLeaves = 0;
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });

    it('should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        BLOCK_STAKE,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  // now we can do the double transfer
  describe.skip('Double transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async () => {
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
      transactions = [res.body.transaction]; // a new block of transactions
      expect(txDataToSign).to.be.a('string');
      newLeaves++;
      newLeaves++;
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });

  // The withdraw test is dependent on the double transfer completing,
  // so the double transfer needs to go into a block before we run the withdraw
  // tests.
  describe.skip('Block proposal test', () => {
    it('should create a block proposal transaction', async () => {
      const res = await chai
        .request(url)
        .post('/proposer/propose')
        .send({
          proposer: (await getAccounts())[0],
          transactions: transactions,
          currentLeafCount,
        });
      currentLeafCount += newLeaves; // remember we added a leaf
      newLeaves = 0;
      txDataToSign = res.body.txDataToSign;
      expect(txDataToSign).to.be.a('string');
    });

    it('should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        BLOCK_STAKE,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe.skip('Withdraw tests', () => {
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
      transactions = [res.body.transaction]; // a new block of transactions
      expect(txDataToSign).to.be.a('string');
    });
    it('should should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    });
  });
  // propose the withdraw test so that we can try withdrawing actual money!
  // The withdraw test is dependent on the double transfer completing,
  // so the double transfer needs to go into a block before we run the withdraw
  // tests.
  describe.skip('Block proposal test', () => {
    it('should create a block proposal transaction', async () => {
      const res = await chai
        .request(url)
        .post('/proposer/propose')
        .send({
          proposer: (await getAccounts())[0],
          transactions: transactions,
          currentLeafCount,
        });
      currentLeafCount += newLeaves; // remember we added a leaf
      newLeaves = 0;
      txDataToSign = res.body.txDataToSign;
      block = res.body.block;
      expect(txDataToSign).to.be.a('string');
    });

    it('should send the transaction to the shield contract', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        BLOCK_STAKE,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });
  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe.skip('Withdraw funds to layer 1', () => {
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

  after(async () => {
    closeWeb3Connection();
  });
});
