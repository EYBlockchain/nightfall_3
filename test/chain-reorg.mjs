import config from 'config';
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import WebSocket from 'ws';
import {
  closeWeb3Connection,
  submitTransaction,
  connectWeb3,
  connectWeb3NoState,
  getAccounts,
  getBalance,
  topicEventMapping,
  setNonce,
  pauseBlockchain,
  unpauseBlockchain,
} from './utils.mjs';
import { generateKeys } from '../nightfall-client/src/services/keys.mjs';

const { ZKP_KEY_LENGTH } = config;
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the http API', () => {
  let shieldAddress;
  let stateAddress;
  let proposersAddress;
  let challengesAddress;
  let ercAddress;
  let connection; // WS connection
  let web3;
  let ask1;
  let nsk1;
  let ivk1;
  let pkd1;

  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20';
  const value = 10;
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

  const doDeposits = async numDeposits => {
    // We create enough transactions to fill numDeposits blocks full of deposits.
    const depositTransactions = (
      await Promise.all(
        Array.from({ length: txPerBlock * numDeposits }, () =>
          chai
            .request(url)
            .post('/deposit')
            .send({ ercAddress, tokenId, tokenType, value, pkd: pkd1, nsk: nsk1, fee }),
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
  };

  const doWithdraws = async numWithdraws => {
    const withdrawTransactions = (
      await Promise.all(
        Array.from({ length: txPerBlock * numWithdraws }, () =>
          chai.request(url).post('/withdraw').send({
            ercAddress,
            tokenId,
            tokenType,
            value,
            recipientAddress,
            nsk: nsk1,
            ask: ask1,
          }),
        ),
      )
    ).map(wRes => wRes.body);
    withdrawTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));
    for (let i = 0; i < withdrawTransactions.length; i++) {
      const { txDataToSign } = withdrawTransactions[i];
      // eslint-disable-next-line no-await-in-loop
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
    }
    while (eventLogs.length !== numWithdraws) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // Now we can empty the event queue
    for (let i = 0; i < numWithdraws; i++) {
      eventLogs.shift();
    }
  };

  const doSingleTransferTwice = async () => {
    let res = await chai
      .request(url)
      .post('/transfer')
      .send({
        ercAddress,
        tokenId,
        recipientData: {
          values: [value],
          recipientPkds: [pkd1],
        },
        nsk: nsk1,
        ask: ask1,
        fee,
      });
    if (res.status !== 200) throw new Error(res.text);
    res = await chai
      .request(url)
      .post('/transfer')
      .send({
        ercAddress,
        tokenId,
        recipientData: {
          values: [value],
          recipientPkds: [pkd1],
        },
        nsk: nsk1,
        ask: ask1,
        fee,
      });
    if (res.status !== 200) throw new Error(res.text);
  };

  before(async () => {
    web3 = await connectWeb3();

    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;

    stateAddress = (await chai.request(url).get('/contract-address/State')).body.address;

    proposersAddress = (await chai.request(url).get('/contract-address/Proposers')).body.address;

    challengesAddress = (await chai.request(url).get('/contract-address/Challenges')).body.address;

    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });

    ({ ask: ask1, nsk: nsk1, ivk: ivk1, pkd: pkd1 } = await generateKeys(ZKP_KEY_LENGTH));

    connection = new WebSocket(optimistWsUrl);
    connection.onopen = () => {
      connection.send('challenge');
      connection.send('blocks');
    };
    connection.onmessage = async message => {
      const msg = JSON.parse(message.data);
      const { type, txDataToSign } = msg;
      if (type === 'block') {
        await submitTransaction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
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

    it('should subscribe to block proposed event with the provided incoming viewing key for optimist', async function () {
      const res = await chai.request(url).post('/incoming-viewing-key').send({
        ivk: ivk1,
        nsk: nsk1,
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

  describe('Show we have no suitable transactions', () => {
    // we start by just sending enough deposits to fill one block
    // set the number of deposit transactions blocks to perform.
    const numDeposits = 1;
    it('should deposit enough crypto into fork to fill one layer 2 block', async () => {
      await expect(doDeposits(numDeposits)).to.eventually.be.fulfilled;
    });
    // next we withdraw each of the deposits
    const numWithdraws = 1;
    it('should withdraw all of our ZKP commitments, taking another block to do so', async () => {
      await expect(doWithdraws(numWithdraws)).to.eventually.be.fulfilled;
    });
    // now we attempt a transfer.  This should fail because all of our deposited
    // commitments should have been nullified by the withdrawals.
    it('should fail to transfer some crypto because there are no available input commitments', async () => {
      await expect(doSingleTransferTwice()).to.be.rejectedWith(
        'No suitable commitments were found',
      );
    });
  });

  describe.skip('Create fork', () => {
    const numDeposits = 1;
    let blocks1;
    it('should deposit enough crypto into fork to fill a layer 2 block into half the chain', async () => {
      // at this point we have no suitable commitments. Let's hold half of the nodes
      // and add some commitments to the un-held half
      console.log('BLOCKNUMBER is:', await web3.eth.getBlockNumber());
      await pauseBlockchain(2); // hold one half of the nodes
      await new Promise(resolve => setTimeout(resolve, 30000));
      console.log('depositing');
      await expect(doDeposits(numDeposits)).to.eventually.be.fulfilled; // add transactions to the other half
      console.log('deposited');
      blocks1 = await web3.eth.getBlockNumber();
      console.log('BLOCKNUMBER is:', blocks1);
    });
    it('should still fail to withdraw from the other half', async () => {
      // now we have only one half of the chain with commitments
      // if we swap to the half without commitments, a transfer should still fail
      const web3b = await connectWeb3NoState('http://localhost:8547');
      await pauseBlockchain(1);
      await unpauseBlockchain(2);
      console.log('BLOCKNUMBER is:', await web3b.eth.getBlockNumber());
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 15000));
        console.log(
          'Waiting for blocks to be mined - current block is',
          // eslint-disable-next-line no-await-in-loop
          await web3b.eth.getBlockNumber(),
        );
        // eslint-disable-next-line no-await-in-loop
      } while ((await web3b.eth.getBlockNumber()) < blocks1 + 10);
      console.log('BLOCKNUMBER is:', await web3b.eth.getBlockNumber());
      // we need to connect to that half first
      // then attempt a transfer.
      await unpauseBlockchain(1);
      await expect(doSingleTransferTwice()).to.be.rejectedWith(
        'No suitable commitments were found',
      );
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
