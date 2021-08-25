import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import WebSocket from 'ws';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  getAccounts,
  topicEventMapping,
  setNonce,
  getBalance,
  timeJump,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Test instant withdrawals', () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let ercAddress;
  let withdrawTransaction;
  let connection; // WS connection
  let nodeInfo;
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  // this is the etherum private key for accounts[0]
  const privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const privateKey2 = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
  const gas = 10000000;
  // this is also accounts[0]
  const recipientAddress = '0x9c8b2276d490141ae1440da660e470e7c0349c63';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether
  const txPerBlock = 2;
  const eventLogs = [];

  before(async function () {
    const web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    ercAddress = (await chai.request(url).get('/contract-address/ERCStub')).body.address;

    nodeInfo = await web3.eth.getNodeInfo();

    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });
    const myAddress = (await getAccounts())[0];
    // register a proposer d
    const res = await chai
      .request(optimistUrl)
      .post('/proposer/register')
      .send({ address: myAddress });
    const propRegTxDataToSign = res.body.txDataToSign;
    const bond = 10000000000000000000;
    await submitTransaction(propRegTxDataToSign, privateKey, proposersAddress, gas, bond);

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { txDataToSign } = msg;
      await submitTransaction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
    };
  });

  describe('', () => {
    let block;
    let transactions;
    let index;
    before(async () => {
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock * 2 - 1 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, zkpPrivateKey, fee }),
          ),
        )
      ).map(res => res.body);
      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      }
      while (eventLogs.length !== 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });

    it('should trigger a withdraw', async () => {
      const res = await chai.request(url).post('/withdraw').send({
        ercAddress,
        tokenId,
        tokenType,
        value,
        senderZkpPrivateKey: zkpPrivateKey,
        recipientAddress,
      });
      withdrawTransaction = res.body.transaction;
      const receipt = await submitTransaction(
        res.body.txDataToSign,
        privateKey,
        shieldAddress,
        gas,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      while (eventLogs.length !== 2) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });

    it('Should find the block containing the withdraw transaction', async () => {
      do {
        // eslint-disable-next-line no-await-in-loop
        const res = await chai
          .request(optimistUrl)
          .get(`/block/transaction-hash/${withdrawTransaction.transactionHash}`);
        ({ block, transactions, index } = res.body);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      } while (block === null);
      expect(block).not.to.be.undefined; // eslint-disable-line
      expect(Object.entries(block).length).not.to.equal(0); // empty object {}
    });

    it('should setAdvanceWithdrawalFee', async () => {
      const startAccount1Balance = await getBalance((await getAccounts())[0]);
      // const account2Balance = await getBalance((await getAccounts())[1]);

      const res = await chai
        .request(url)
        .post('/set-instant-withdrawal')
        .send({ block, transactions, index });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      const receipt = await submitTransaction(
        txDataToSign,
        privateKey,
        shieldAddress,
        gas,
        10000000000000000000,
      );
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      const endAccount1Balance = await getBalance((await getAccounts())[0]);
      expect(endAccount1Balance - startAccount1Balance).to.closeTo(
        -10000000000000000000,
        5000000000000000,
      );
    });

    it('should advance the withdrawal', async () => {
      const withdrawTransactionHash = withdrawTransaction.transactionHash;
      const res = await chai
        .request(optimistUrl)
        .post('/transaction/advanceWithdrawal')
        .send({ transactionHash: withdrawTransactionHash });
      const { txDataToSign } = res.body;
      const receipt = await submitTransaction(txDataToSign, privateKey2, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
    });

    it('Should create a passing finalise-withdrawal that is withdrawn to the advancer addresss', async function () {
      // jump in time by 10 days
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10);
      else this.skip();
      const res = await chai.request(url).post('/finalise-withdrawal').send({
        block,
        transactions,
        index,
      });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');

      if (nodeInfo.includes('TestRPC')) {
        const receipt = await submitTransaction(txDataToSign, privateKey2, shieldAddress, gas);
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      } else {
        await expect(
          submitTransaction(txDataToSign, privateKey2, shieldAddress, gas),
        ).to.be.rejectedWith('Transaction has been reverted by the EVM');
      }
    });
  });
  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
