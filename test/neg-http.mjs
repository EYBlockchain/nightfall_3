import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import gen from 'general-number';
import Queue from 'queue';
import WebSocket from 'ws';
import sha256 from '../src/utils/crypto/sha256.mjs';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  createBadBlock,
} from './utils.mjs';

const { expect } = chai;
const { GN } = gen;
const txQueue = new Queue({ autostart: true, concurrency: 1 });

chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the challenge http API', () => {
  let web3;
  let shieldAddress;
  let challengeAddress;
  let ercAddress;
  let connection; // WS connection
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
  // const recipientAddress = '0x00a329c0648769a73afac7f9381e08fb43dbea72';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether

  let topicsBlockHashesIncorrectRootInBlock;
  let topicsRootIncorrectRootInBlock;
  let topicsBlockHashesDuplicateTransaction;
  let topicsRootDuplicateTransaction;
  let topicsBlockHashesInvalidTransaction;
  let topicsRootInvalidTransaction;
  let topicsBlockHashesIncorrectPublicInputHash;
  let topicsRootIncorrectPublicInputHash;
  let topicsBlockHashesIncorrectProof;
  let topicsRootIncorrectProof;

  before(async () => {
    let res;
    let txToSign;
    web3 = connectWeb3();
    let counter = 0; // to edit a block to a different bad block type each time a block proposed transaction is received
    let duplicateTransaction;

    res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Challenges');
    challengeAddress = res.body.address;

    // should get the address of the test ERC contract stub
    res = await chai.request(url).get('/contract-address/ERCStub');
    ercAddress = res.body.address;

    // should register a proposer
    const myAddress = (await getAccounts())[0];
    const bond = 10000000000000000000;
    res = await chai
      .request(optimistUrl)
      .post('/proposer/register')
      .send({ address: myAddress });
    txToSign = res.body.txDataToSign;
    await submitTransaction(txToSign, privateKey, challengeAddress, gas, bond);

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      // let txReceipt;
      txQueue.push(async () => {
        const msg = JSON.parse(message.data);
        const { type } = msg;
        let { txDataToSign } = msg;
        if (type === 'block') {
          const { block, transactions } = msg;
          if (counter === 0) {
            duplicateTransaction = transactions[0];
          } else if (counter === 1) {
            res = await createBadBlock('IncorrectRoot', block, transactions, {
              leafIndex: 1,
            });
            topicsBlockHashesIncorrectRootInBlock = res.block.blockHash;
            topicsRootIncorrectRootInBlock = res.block.root;
            txDataToSign = res.txDataToSign;
          } else if (counter === 2) {
            // txDataToSign = msg.txDataToSign;
            res = await createBadBlock('DuplicateTransaction', block, transactions, {
              duplicateTransaction,
            });
            topicsBlockHashesDuplicateTransaction = res.block.blockHash;
            topicsRootDuplicateTransaction = res.block.root;
            txDataToSign = res.txDataToSign;
          } else if (counter === 3) {
            // txDataToSign = msg.txDataToSign;
            res = await createBadBlock('InvalidDepositTransaction', block, transactions, {
              duplicateTransaction,
            });
            topicsBlockHashesDuplicateTransaction = res.block.blockHash;
            topicsRootDuplicateTransaction = res.block.root;
            txDataToSign = res.txDataToSign;
          } else if (counter === 4) {
            // txDataToSign = msg.txDataToSign;
            res = await createBadBlock('IncorrectPublicInputHash', block, transactions, {
              duplicateTransaction,
            });
            topicsBlockHashesIncorrectPublicInputHash = res.block.blockHash;
            topicsRootIncorrectPublicInputHash = res.block.root;
            txDataToSign = res.txDataToSign;
            // } else if (counter === 5) {
            // txDataToSign = msg.txDataToSign;
            // res = await createBadBlock('IncorrectProof', block, transactions, {
            //   proof: duplicateTransaction.proof,
            // });
            // topicsBlockHashesIncorrectProof = res.block.blockHash;
            // topicsRootIncorrectProof = res.block.root;
            // txDataToSign = res.txDataToSign;
            // txDataToSign = msg.txDataToSign;
          } else {
            txDataToSign = msg.txDataToSign;
          }
          await submitTransaction(txDataToSign, privateKey, challengeAddress, gas, BLOCK_STAKE);
          counter++;
          // console.log('tx hash of propose block is', txReceipt.transactionHash);
          // (msg.type === 'challenge')
        } else if (type === 'commit') {
          await submitTransaction(txDataToSign, privateKey, challengeAddress, gas);
        } else if (type === 'challenge') {
          await submitTransaction(txDataToSign, privateKey, challengeAddress, gas);
          // When a challenge succeeds, the challenger is removed. We are adding them back for subsequent for challenges
          const result = await chai
            .request(optimistUrl)
            .post('/proposer/register')
            .send({ address: myAddress });
          txToSign = result.body.txDataToSign;
          await submitTransaction(txToSign, privateKey, challengeAddress, gas, bond);
          // console.log('tx hash of challenge block is', txReceipt.transactionHash);
        } else throw new Error(`Unhandled transaction type: ${type}`);
      });
    };
  });

  describe('Basic Challenger tests', () => {
    it('should add a Challenger address', async () => {
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/challenger/add')
        .send({ challenger: myAddress });
      expect(res.body.ok).to.equal(1);
    });
  });

  describe('Creating correct transactions to get proper root history in timber', () => {
    let txDataToSign;
    it('should deposit some crypto into a ZKP commitment', async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
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
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should deposit some more crypto (we need a second transaction for proposing block) into a ZKP commitment and get a raw blockchain transaction back', async () => {
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
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Creating transactions for challenges', () => {
    let txDataToSign;
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
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should deposit some more crypto (we need a second transaction for proposing block) into a ZKP commitment and get a raw blockchain transaction back', async () => {
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
      expect(txDataToSign).to.be.a('string');
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      console.log(`Gas used was ${Number(receipt.gasUsed)}`);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Challenge 1: Incorrect root challenge', () => {
    it('Should delete the wrong block', async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('BlockDeleted(bytes32)'), topicsBlockHashesIncorrectRootInBlock],
      });
      expect(events.length).not.to.equal(0);
      expect(events[0]).to.have.property('transactionHash');
    });
    it('Should rollback the wrong leaves', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('Rollback(bytes32,uint256)'), topicsRootIncorrectRootInBlock],
      });
      expect(events[0]).to.have.property('transactionHash');
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Challenge 2: Duplicate transaction submitted', () => {
    it('Should delete the wrong block', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('BlockDeleted(bytes32)'), topicsBlockHashesDuplicateTransaction],
      });
      expect(events[0]).to.have.property('transactionHash');
    });
    it('Should rollback the wrong leaves', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('Rollback(bytes32,uint256)'), topicsRootDuplicateTransaction],
      });
      expect(events[0]).to.have.property('transactionHash');
    });
  });

  describe('Challenge 3: Invalid transaction submitted', () => {
    it('Should delete the wrong block', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('BlockDeleted(bytes32)'), topicsBlockHashesInvalidTransaction],
      });
      expect(events[0]).to.have.property('transactionHash');
    });
    it('Should rollback the wrong leaves', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('Rollback(bytes32,uint256)'), topicsRootInvalidTransaction],
      });
      expect(events[0]).to.have.property('transactionHash');
    });
  });

  describe('Challenge 4: Incorrect public input hash', async () => {
    it('Should delete the wrong block', async () => {
      // create another transaction to trigger NO's block assembly
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
      const { txDataToSign } = res.body;
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);

      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [
          web3.utils.sha3('BlockDeleted(bytes32)'),
          topicsBlockHashesIncorrectPublicInputHash,
        ],
      });
      expect(events[0]).to.have.property('transactionHash');
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
    it('Should rollback the wrong leaves', async () => {
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('Rollback(bytes32,uint256)'), topicsRootIncorrectPublicInputHash],
      });
      expect(events[0]).to.have.property('transactionHash');
    });
  });

  describe.skip('Challenge 5: Proof verification failure', async () => {
    it('Should delete the wrong block', async () => {
      // create another transaction to trigger NO's block assembly
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
      const { txDataToSign } = res.body;
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);

      await new Promise(resolve => setTimeout(resolve, 15000));
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('BlockDeleted(bytes32)'), topicsBlockHashesIncorrectProof],
      });
      expect(events[0]).to.have.property('transactionHash');
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
    it('Should rollback the wrong leaves', async () => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const events = await web3.eth.getPastLogs({
        fromBlock: web3.utils.toHex(0),
        address: challengeAddress,
        topics: [web3.utils.sha3('Rollback(bytes32,uint256)'), topicsRootIncorrectProof],
      });
      expect(events[0]).to.have.property('transactionHash');
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  after(() => {
    // if the queue is still running, let's close down after it ends
    txQueue.on('end', () => {
      // closeWeb3Connection();
      connection.close();
    });
    // if it's empty, close down immediately
    if (txQueue.length === 0) {
      // closeWeb3Connection();
      connection.close();
    }
  });
});
