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
  // let ask1;
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
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1; // 1 wei
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
    // Wait until we see the right number of blocks appear
    while (eventLogs.length !== numDeposits) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // Now we can empty the event queue
    for (let i = 0; i < numDeposits; i++) {
      eventLogs.shift();
    }
    return receiptArrays;
  };
  /*
  const createDepositTransactions = async numDeposits => {
    // We create enough transactions to fill numDeposits blocks full of deposits.
    const depositTransactions = (
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
    ).map(res => res.body.txDataToSign);
    depositTransactions.forEach(txDataToSign => expect(txDataToSign).to.be.a('string'));
    return depositTransactions;
  };

  const submitDepositTransactions = async depositTransactions => {
    const receiptArrays = [];
    for (let i = 0; i < depositTransactions.length; i++) {
      const txDataToSign = depositTransactions[i];
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
    // Wait until we see the right number of blocks appear
    while (eventLogs.length !== numDeposits) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // Now we can empty the event queue
    for (let i = 0; i < numDeposits; i++) {
      eventLogs.shift();
    }
    return receiptArrays;
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
*/
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

    ({
      nsk: nsk1,
      ivk: ivk1,
      pkd: pkd1,
    } = (await chai.request(url).post('/generate-keys').send()).body);

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
      await chai.request(url).post('/peers/addPeers').send({
        address: myAddress,
        enode: 'http://optimist:80',
      });
    });
  });

  describe('Start a normal chain', () => {
    // we start by just sending enough deposits to fill one block
    // set the number of deposit transactions blocks to perform.
    const numDeposits = 1;
    it('should deposit enough crypto into fork to fill one layer 2 block', async () => {
      await expect(doDeposits(numDeposits)).to.eventually.be.fulfilled;
      console.log('     BlockNumber is:', await web3.eth.getBlockNumber());
    });
  });

  describe('Create fork and test chain reorganisation', () => {
    const numDeposits = 1;
    let blocks1;
    let receipts;
    /*
    it('should create a chain fork with both branches containing NF_3 transactions', async () => {
      // at this point we have no suitable commitments. Let's hold half of the nodes
      // and add some commitments to the un-held half
      console.log(
        '     *Nightfall_3 is connected to node set 1, nothing is connected to node set 2*',
      );
      console.log(
        '     Pausing node set 2 and waiting one minute for all L1 transactions to complete',
      );
      await pauseBlockchain(2); // hold one half of the nodes
      await new Promise(resolve => setTimeout(resolve, 60000));
      console.log('     Creating one block of deposit transactions with node set 1');
      receipts = await doDeposits(numDeposits); // add transactions to the other half
      console.log('     Block created');
      // test the receipts are good.
      const recs = await Promise.all(
        receipts.map(receipt => web3.eth.getTransactionReceipt(receipt.transactionHash)),
      );
      expect(recs).to.not.include(null);
      blocks1 = await web3.eth.getBlockNumber();
      console.log(
        '     BlockNumber for node set 1 is:',
        blocks1,
        '. Pausing node set 1 and unpausing node set 2',
      );
      await pauseBlockchain(1);
      await unpauseBlockchain(2);
    });
    */
    it('should create a chain fork containing transactions', async () => {
      // at this point we have no suitable commitments. Let's hold half of the nodes
      // and add some commitments to the un-held half
      console.log(
        '     *Nightfall_3 is connected to node set 1, nothing is connected to node set 2*',
      );
      console.log(
        '     Pausing node set 2 and waiting one minute for all L1 transactions to complete',
      );
      await pauseBlockchain(2); // hold one half of the nodes
      await new Promise(resolve => setTimeout(resolve, 60000));
      console.log('     Creating one block of deposit transactions with node set 1');
      receipts = await doDeposits(numDeposits); // add transactions to the other half
      console.log('     Block created');
      // test the receipts are good.
      const recs = await Promise.all(
        receipts.map(receipt => web3.eth.getTransactionReceipt(receipt.transactionHash)),
      );
      expect(recs).to.not.include(null);
      blocks1 = await web3.eth.getBlockNumber();
      console.log(
        '     BlockNumber for node set 1 is:',
        blocks1,
        '. Pausing node set 1 and unpausing node set 2',
      );
      await pauseBlockchain(1);
      await unpauseBlockchain(2);
    });

    it('should create a chain reorg', async () => {
      // now we have only one half of the chain with commitments
      const web3b = await connectWeb3NoState('http://localhost:8547');
      console.log('     Node set 2 is active.  Blocknumber is:', await web3b.eth.getBlockNumber());
      // let's wait until the half without any commitments is longer than the
      // one with commitments.  That should make it the new canonical chain
      do {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 15000));
        console.log(
          '     Mining blocks on node set 2 - current block is',
          // eslint-disable-next-line no-await-in-loop
          await web3b.eth.getBlockNumber(),
        );
        // eslint-disable-next-line no-await-in-loop
      } while ((await web3b.eth.getBlockNumber()) < blocks1 + 5);
      console.log(
        '     Blocknumber for node set 2 is:',
        await web3b.eth.getBlockNumber(),
        '. Unpausing node set 1 to force chain reorg',
      );
      // we need to connect to that half first
      // then attempt a transfer.
      await pauseBlockchain(2);
      await unpauseBlockchain(1);
      console.log('     BlockNumber for node set 1 is:', await web3.eth.getBlockNumber());
      await unpauseBlockchain(2);
      // a chain reorg should now occur - wait a minute for it to happen
      console.log('     Blocknumber for node set 2 is:', await web3b.eth.getBlockNumber());
      console.log('     BlockNumber for node set 1 is:', await web3.eth.getBlockNumber());
      console.log('     Waiting 10 s to check that the reorg occurs');
      await new Promise(resolve => setTimeout(resolve, 60000));
      console.log('     Blocknumber for node set 2 is:', await web3b.eth.getBlockNumber());
      console.log('     BlockNumber for node set 1 is:', await web3.eth.getBlockNumber());
      closeWeb3Connection(web3b);
    });
    it('Chain re-org should have replaced original transactions', async function () {
      // the transactionHashes should point to transactions that no longer exist. The
      // re-mined transactions will have different block numbers.
      await Promise.all(
        receipts.map(async receipt => {
          const rec = await web3.eth.getTransactionReceipt(receipt.transactionHash);
          expect(rec.blockHash).to.not.equal(receipt.blockHash);
          expect(rec.blockNumber).to.not.equal(receipt.blockNumber);
          expect(rec.transactionHash).to.equal(receipt.transactionHash);
        }),
      );
    });
  });

  after(() => {
    closeWeb3Connection();
    connection.close();
  });
});
