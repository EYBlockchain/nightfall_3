import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Queue from 'queue';
import gen from 'general-number';
import WebSocket from 'ws';
// import sha256 from '../nightfall-client/src/utils/crypto/sha256.mjs';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
  timeJump,
  topicEventMapping,
} from './utils.mjs';
import { generalise, GN } from 'general-number';

const { expect, assert } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { GN } = gen;
const blockSubmissionQueue = new Queue({ concurrency: 1 });

describe('Testing the http API', () => {
  let ask1;
  let nsk1;
  let ivk1;
  let pkd1;
  let ask2;
  let nsk2;
  let ivk2;
  let pkd2;
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let transactions = [];
  let connection; // WS connection
  let blockSubmissionFunction;
  // const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  // const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
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
  const txPerBlock = 2;
  const eventLogs = [];

  before(async () => {
    const web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    challengesAddress = (await chai.request(url).get('/contract-address/Challenges')).body.address;

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
    it('should respond with status 200 to the health check', async () => {
      const res = await chai.request(url).get('/healthcheck');
      expect(res.status).to.equal(200);
    });

    it('should generate sk, ask, nsk, ivk, pkd, compressed pkd for a user', async () => {
      const res = await chai.request(url).get('/generate-keys');
      expect(res.body.sk).to.be.a('string');
      expect(res.body.ask).to.be.a('string');
      expect(res.body.nsk).to.be.a('string');
      expect(res.body.ivk).to.be.a('string');
      expect(res.body.pkd).to.be.a('array');
      expect(res.body.compressedPkd).to.be.a('string');
      ask1 = res.body.ask;
      nsk1 = res.body.nsk;
      ivk1 = res.body.ivk;
      pkd1 = res.body.pkd;
    });

    it('should generate sk, ask, nsk, ivk, pkd, compressed pkd for a user', async () => {
      const res = await chai.request(url).get('/generate-keys');
      expect(res.body.sk).to.be.a('string');
      expect(res.body.ask).to.be.a('string');
      expect(res.body.nsk).to.be.a('string');
      expect(res.body.ivk).to.be.a('string');
      expect(res.body.pkd).to.be.a('array');
      expect(res.body.compressedPkd).to.be.a('string');
      ask2 = res.body.ask;
      nsk2 = res.body.nsk;
      ivk2 = res.body.ivk;
      pkd2 = res.body.pkd;
    });

    it('should get the address of the test ERC contract stub', async () => {
      const res = await chai.request(url).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
    });

    it('should start listening secret being sent as part of transfer to recipients', async () => {
      const res = await chai.request(url).post('/secret-listener').send({
        ivk1,
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
    // blocks should be directly submitted to the blockchain, not queued
    blockSubmissionFunction = (a, b, c, d, e) => submitTransaction(a, b, c, d, e);
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);
    it('should deposit some crypto into a ZKP commitment', async () => {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * numDeposits }, () =>
            chai.request(url).post('/deposit').send({ ercAddress, tokenId, value, ivk1, fee }),
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
      }
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
          // recipientData: {
          //   values: [value],
          //   recipientZkpPublicKeys: [zkpPublicKey],
          // },
          // senderZkpPrivateKey: zkpPrivateKey,
          recipientData: { values: [value], recipientPkds: [pkd1] },
          nsk1,
          ask1,
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

    it('should send a single transfer directly to a proposer - offchain', async () => {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          offchain: true,
          ercAddress,
          tokenId,
          // recipientData: {
          //   values: [value],
          //   recipientZkpPublicKeys: [zkpPublicKey],
          // },
          // senderZkpPrivateKey: zkpPrivateKey,
          recipientData: { values: [value], recipientPkds: [pkd2] },
          nsk1,
          ask1,
          fee,
        });
      expect(res.status).to.be.equal(200);
      newCommitments = res.body.transaction.commitments;
      newCommitmentSalt = newCommitments[0].preimage.salt;
      const result = await chai.request(url).get('/secret-listener').query({
        salt: newCommitmentSalt,
      });
      commitment = generalise(result.body.commitment[0]);
      expect(`0x${commitment.preimage.ercAddress.hex().substring(26, 66)}`).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(commitment.preimage.value.decimal, 10)).to.equal(value);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 2 }, () =>
            chai.request(url).post('/deposit').send({ ercAddress, tokenId, value, ivk1, fee }),
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
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async () => {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          // recipientData: {
          //   values: [value2],
          //   recipientZkpPublicKeys: [zkpPublicKey],
          // },
          // senderZkpPrivateKey: zkpPrivateKey,
          recipientData: { values: [value2], recipientPkds: [pkd1] },
          nsk1,
          ask1,
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

    it('should send a double transfer directly to a proposer - offchain', async () => {
      // give the last block time to be submitted, or we won't have enough
      // commitments in the Merkle tree to use for the double transfer.

      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          offchain: true,
          ercAddress,
          tokenId,
          // recipientData: {
          //   // Add one here so we dont use the output of the previous double transfer as a single transfer input
          //   values: [value2 + 1],
          //   recipientZkpPublicKeys: [zkpPublicKey],
          // },
          // senderZkpPrivateKey: zkpPrivateKey,
          recipientData: { values: [value2 + 1], recipientPkds: [pkd2] },
          nsk1,
          ask1,
        });
      expect(res.status).to.be.equal(200);
      newCommitments = res.body.transaction.commitments;
      newCommitmentSalt = newCommitments[0].preimage.salt;
      const result = await chai.request(url).get('/secret-listener').query({
        salt: newCommitmentSalt,
      });
      commitment = generalise(result.body.commitment[0]);
      expect(`0x${commitment.preimage.ercAddress.hex().substring(26, 66)}`).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(commitment.preimage.value.decimal, 10)).to.equal(value2 + 1);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 2 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, value, zkpPrivateKey, fee }),
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
    });
  });

  describe.skip('Withdraw tests', () => {
    it('should withdraw some crypto from a ZKP commitment', async () => {
      const res = await chai.request(url).post('/withdraw').send({
        ercAddress,
        tokenId,
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
              .send({ ercAddress, tokenId, value, zkpPrivateKey, fee }),
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
    });
  });
  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe.skip('Withdraw funds to layer 1', () => {
    let block;
    let txDataToSign;
    let index;
    it('Should find the block containing the withdraw transaction', async () => {
      const withdrawTransactionHash = transactions[0].transactionHash;
      const res = await chai
        .request(optimistUrl)
        .get(`/block/transaction-hash/${withdrawTransactionHash}`);
      ({ block, transactions, index } = res.body);
      // } while (block === null);
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
        'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw funds from this block',
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
    });
    it('Should have increased our balance', async () => {
      const gasCosts = 5000000000000000;
      expect(endBalance - startBalance).to.closeTo(Number(value), gasCosts);
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
