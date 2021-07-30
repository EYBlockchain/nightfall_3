import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import WebSocket from 'ws';
import { GN } from 'general-number';
import config from 'config';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  getBalance,
  topicEventMapping,
} from './utils.mjs';
import { generateKeys } from '../nightfall-client/src/services/keys.mjs';

const { ZKP_KEY_LENGTH } = config;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the http API', async () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let connection; // WS connection
  let web3;

  const { ask: ask1, nsk: nsk1, ivk: ivk1, pkd: pkd1 } = await generateKeys(ZKP_KEY_LENGTH);
  const { nsk: nsk2, ivk: ivk2, pkd: pkd2 } = await generateKeys(ZKP_KEY_LENGTH);
  const senderUrl = 'http://localhost:8080';
  const recipientUrl = 'http://localhost:8084';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x01';
  const value = 10;
  const value2 = 12;
  // this is the etherum private key for the test account in openethereum
  const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  // const recipientAddress = '0x00a329c0648769a73afac7f9381e08fb43dbea72';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether
  const txPerBlock = 2;
  const eventLogs = [];

  before(async () => {
    web3 = await connectWeb3();

    shieldAddress = (await chai.request(senderUrl).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(senderUrl).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(senderUrl).get('/contract-address/Proposers')).body
      .address;

    challengesAddress = (await chai.request(senderUrl).get('/contract-address/Challenges')).body
      .address;

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
        console.log('HERE block');
        await submitTransaction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
      } else {
        console.log('HERE not block');
        await submitTransaction(txDataToSign, privateKey, challengesAddress, gas);
      }
    };
  });

  describe('Miscellaneous tests', () => {
    it('should respond with status 200 to the health check', async () => {
      const res = await chai.request(senderUrl).get('/healthcheck');
      expect(res.status).to.equal(200);
    });

    it('should get the address of the test ERC contract stub', async () => {
      const res = await chai.request(senderUrl).get('/contract-address/ERCStub');
      ercAddress = res.body.address;
      expect(ercAddress).to.be.a('string');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key', async () => {
      const res = await chai.request(senderUrl).post('/incoming-viewing-key').send({
        ivk: ivk1,
        nsk: nsk1,
      });
      expect(res.body.status).to.be.a('string');
      expect(res.body.status).to.equal('success');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key', async () => {
      const res = await chai.request(recipientUrl).post('/incoming-viewing-key').send({
        ivk: ivk2,
        nsk: nsk2,
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
    });
  });

  describe('Deposit tests', () => {
    it('should deposit some crypto into a ZKP commitment', async () => {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * 2 - 1 }, () =>
            chai
              .request(senderUrl)
              .post('/deposit')
              .send({ ercAddress, tokenId, value, pkd: pkd1, nsk: nsk1, fee }),
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

      console.log(`     Average Gas used was ${Math.ceil(totalGas / (txPerBlock * 2 - 1))}`);

      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    it('should successfully receive a transfer from a sender that is not self and decrypt the secrets', async () => {
      const res = await chai
        .request(senderUrl)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: { values: [value], recipientPkds: [pkd2] },
          nsk: nsk1,
          ask: ask1,
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

      // wait for the block proposed event with transfer function to be recognised by nightfall client of recipient
      while (eventLogs.length !== 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();

      const newCommitmentSalts = res.body.salts;
      const result = await chai.request(recipientUrl).get('/commitment/salt').query({
        salt: newCommitmentSalts[0],
      });
      const commitment = result.body.commitment[0];
      expect(
        web3.utils.toChecksumAddress(`0x${commitment.preimage.ercAddress.substring(26, 66)}`),
      ).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(new GN(commitment.preimage.value).decimal, 10)).to.equal(value);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 1 }, () =>
            chai
              .request(senderUrl)
              .post('/deposit')
              .send({ ercAddress, tokenId, value, pkd: pkd1, nsk: nsk1, fee }),
          ),
        )
      ).map(dRes => dRes.body);
      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      }
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    it('should successfully receive a transfer from a send that is not self and decrypt the secrets', async () => {
      const res = await chai
        .request(senderUrl)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: { values: [value2], recipientPkds: [pkd2] },
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

      // wait for the block proposed event with transfer function to be recognised by nightfall client of recipient
      while (eventLogs.length !== 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();

      const newCommitmentSalts = res.body.salts;
      const result = await chai.request(recipientUrl).get('/commitment/salt').query({
        salt: newCommitmentSalts[0],
      });
      const commitment = result.body.commitment[0];
      expect(
        web3.utils.toChecksumAddress(`0x${commitment.preimage.ercAddress.substring(26, 66)}`),
      ).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(new GN(commitment.preimage.value).decimal, 10)).to.equal(value2);
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
