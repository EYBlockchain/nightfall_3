import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Queue from 'queue';
import WebSocket from 'ws';
import { generateMnemonic } from 'bip39';
import {
  closeWeb3Connection,
  submitTransaction,
  getAccounts,
  createBadBlock,
  testForEvents,
  connectWeb3,
  topicEventMapping,
  setNonce,
} from './utils.mjs';

const { expect } = chai;
const txQueue = new Queue({ autostart: true, concurrency: 1 });
const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the challenge http API', () => {
  let shieldAddress;
  let challengeAddress;
  let proposersAddress;
  let stateAddress;
  let ercAddress;
  let connection; // WS connection
  let ask1;
  let nsk1;
  let ivk1;
  let pkd1;

  const USE_INFURA = process.env.USE_INFURA === 'true';
  const USE_HOSTED_GETH = process.env.USE_HOSTED_GETH === 'true';
  const { ETH_PRIVATE_KEY, BLOCKCHAIN_URL } = process.env;

  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws://localhost:8082';
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  // this is the etherum private key for accounts[0]
  let privateKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  // this is the ethereum private key used for challenging (for now it's the same)
  let privateKey1 = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  // const recipientAddress = '0x00a329c0648769a73afac7f9381e08fb43dbea72';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1; // 1 wei
  const eventLogs = [];
  const txPerBlock = 2;
  let topicsBlockHashIncorrectRootInBlock;
  let topicsBlockHashDuplicateTransaction;
  let topicsBlockHashInvalidTransaction;
  let topicsBlockHashesIncorrectHistoricRoot;
  let topicsBlockHashIncorrectProof;
  let topicsBlockHashDuplicateNullifier;
  let topicsBlockHashIncorrectLeafCount;
  let web3;
  const logCounts = {
    txSubmitted: 0,
    registerProposer: 0,
    challenge: 0,
  };

  const holdupTxQueue = async (txType, waitTillCount) => {
    while (logCounts[txType] < waitTillCount) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  const waitForTxExecution = async (count, txType) => {
    while (count === logCounts[txType]) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  before(async () => {
    web3 = await connectWeb3(BLOCKCHAIN_URL);

    if (USE_INFURA || USE_HOSTED_GETH) {
      if (!ETH_PRIVATE_KEY) {
        throw Error(
          'Cannot use default private key, please set environment variable ETH_PRIVATE_KEY',
        );
      }
      privateKey = ETH_PRIVATE_KEY;
      privateKey1 = ETH_PRIVATE_KEY;
    }

    let res;
    let txToSign;
    let counter = 0; // to edit a block to a different bad block type each time a block proposed transaction is received
    let duplicateTransaction;
    let duplicateNullifier;

    res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;
    web3.eth.subscribe('logs', { address: shieldAddress }).on('data', log => {
      if (log.topics[0] === web3.eth.abi.encodeEventSignature('TransactionSubmitted()')) {
        logCounts.txSubmitted += 1;
      }
    });

    res = await chai.request(url).get('/contract-address/Challenges');
    challengeAddress = res.body.address;
    web3.eth.subscribe('logs', { address: challengeAddress }).on('data', () => {
      logCounts.challenge += 1;
    });

    res = await chai.request(url).get('/contract-address/Proposers');
    proposersAddress = res.body.address;
    web3.eth.subscribe('logs', { address: proposersAddress }).on('data', log => {
      if (log.topics[0] === web3.eth.abi.encodeEventSignature('NewCurrentProposer(address)')) {
        logCounts.registerProposer += 1;
      }
    });

    res = await chai.request(url).get('/contract-address/State');
    stateAddress = res.body.address;

    // should get the address of the test ERC contract stub
    res = await chai.request(url).get('/contract-address/ERCStub');
    ercAddress = res.body.address;
    // set the current nonce before we start the test
    setNonce(await web3.eth.getTransactionCount((await getAccounts())[0]));

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    const mnemonic = generateMnemonic();

    ({
      ask: ask1,
      nsk: nsk1,
      ivk: ivk1,
      pkd: pkd1,
    } = (
      await chai.request(url).post('/generate-keys').send({ mnemonic, path: `m/44'/60'/0'/0` })
    ).body);

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      if (log.topics[0] === topicEventMapping.BlockProposed) {
        eventLogs.push('blockProposed');
      } else if (log.topics[0] === topicEventMapping.Rollback) {
        eventLogs.push('Rollback');
      }
    });

    // should register a proposer
    const myAddress = (await getAccounts())[0];
    const bond = 10;
    res = await chai.request(optimistUrl).post('/proposer/register').send({ address: myAddress });
    txToSign = res.body.txDataToSign;
    await submitTransaction(txToSign, privateKey, proposersAddress, gas, bond);

    // should subscribe to block proposed event with the provided incoming viewing key
    await chai
      .request(url)
      .post('/incoming-viewing-key')
      .send({
        ivks: [ivk1],
        nsks: [nsk1],
      });

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
        try {
          if (type === 'block') {
            const { block, transactions } = msg;
            if (counter === 0) {
              [duplicateTransaction] = transactions;
              console.log(
                `Created good block to extract duplicate tx from with blockHash ${block.blockHash}`,
              );
            } else if (counter === 1) {
              [duplicateNullifier] = transactions
                .map(t => t.nullifiers.filter(n => n !== ZERO))
                .flat(Infinity);
              console.log(
                `Created good block to extract duplicate nullifier ${duplicateNullifier} from with blockHash ${block.blockHash}`,
              );
            } else if (counter === 2) {
              res = await createBadBlock('IncorrectRoot', block, transactions, {
                leafIndex: 1,
              });
              topicsBlockHashIncorrectRootInBlock = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block with incorrect root and blockHash ${res.block.blockHash}`,
              );
            } else if (counter === 3) {
              res = await createBadBlock('DuplicateTransaction', block, transactions, {
                duplicateTransaction,
              });
              topicsBlockHashDuplicateTransaction = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block containing duplicate transaction and blockHash ${res.block.blockHash}`,
              );
            } else if (counter === 4) {
              res = await createBadBlock('InvalidDepositTransaction', block, transactions);
              topicsBlockHashInvalidTransaction = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block with invalid deposit transaction and blockHash ${res.block.blockHash}`,
              );
            } else if (counter === 5) {
              res = await createBadBlock('IncorrectHistoricRoot', block, transactions);
              topicsBlockHashesIncorrectHistoricRoot = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(`Created flawed block with invalid historic root ${res.block.blockHash}`);
            } else if (counter === 6) {
              res = await createBadBlock('IncorrectProof', block, transactions, {
                proof: duplicateTransaction.proof,
              });
              topicsBlockHashIncorrectProof = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block with incorrect proof and blockHash ${res.block.blockHash}`,
              );
            } else if (counter === 7) {
              res = await createBadBlock('DuplicateNullifier', block, transactions, {
                duplicateNullifier,
              });
              topicsBlockHashDuplicateNullifier = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block with duplicate nullifier and blockHash ${res.block.blockHash}`,
              );
            } else if (counter === 8) {
              res = await createBadBlock('IncorrectLeafCount', block, transactions);
              topicsBlockHashIncorrectLeafCount = res.block.blockHash;
              txDataToSign = res.txDataToSign;
              console.log(
                `Created flawed block with incorrect leaf count and blockHash ${res.block.blockHash}`,
              );
            } else {
              txDataToSign = msg.txDataToSign;
              console.log(`Created good block with blockHash ${block.blockHash}`);
            }
            await submitTransaction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
            counter++;
            // console.log('tx hash of propose block is', txReceipt.transactionHash);
          } else if (type === 'commit') {
            const count = logCounts.challenge;
            await submitTransaction(txDataToSign, privateKey1, challengeAddress, gas);
            await waitForTxExecution(count, 'challenge');
          } else if (type === 'challenge') {
            await submitTransaction(txDataToSign, privateKey1, challengeAddress, gas);
            // When a challenge succeeds, the challenger is removed. We are adding them back for subsequent for challenges
            const result = await chai
              .request(optimistUrl)
              .post('/proposer/register')
              .send({ address: myAddress });
            txToSign = result.body.txDataToSign;
            const count = logCounts.registerProposer;
            await submitTransaction(txToSign, privateKey, proposersAddress, gas, bond);
            await waitForTxExecution(count, 'registerProposer');
            // console.log('tx hash of challenge block is', txReceipt.transactionHash);
          } else throw new Error(`Unhandled transaction type: ${type}`);
        } catch (err) {
          console.error(`neg-http.mjs onmessage error: ${err}`);
        }
      });
    };
  });

  describe('Basic Challenger tests', () => {
    it('should add a Challenger address', async () => {
      const myAddress = (await getAccounts())[0];
      const res = await chai
        .request(optimistUrl)
        .post('/challenger/add')
        .send({ address: myAddress });
      expect(res.body.ok).to.equal(1);
    });
  });

  describe('Pre-populate L2 state with valid blocks and transactions', () => {
    afterEach(async () => {
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      eventLogs.shift();
    });

    it('should create an initial block of deposits', async () => {
      // eslint-disable-next-line no-await-in-loop
      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, pkd: pkd1, nsk: nsk1, fee }),
          ),
        )
      ).map(res => res.body);

      depositTransactions.forEach(({ txDataToSign }) => expect(txDataToSign).to.be.a('string'));

      const receiptArrays = [];
      txQueue.push(async () => {
        await holdupTxQueue('txSubmitted', logCounts.txSubmitted + depositTransactions.length);
      });
      for (let i = 0; i < depositTransactions.length; i++) {
        const { txDataToSign } = depositTransactions[i];
        const count = logCounts.txSubmitted;
        receiptArrays.push(
          // eslint-disable-next-line no-await-in-loop
          await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee),
        );
        // eslint-disable-next-line no-await-in-loop
        await waitForTxExecution(count, 'txSubmitted');
      }
      receiptArrays.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });
      // await new Promise(resolve => setTimeout(resolve, 3000));
    });

    it('should create a block with a single transfer', async () => {
      const res = await chai
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
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(res.body.txDataToSign, privateKey, shieldAddress, gas);

      const depositTransactions = (
        await Promise.all(
          Array.from({ length: txPerBlock - 1 }, () =>
            chai
              .request(url)
              .post('/deposit')
              .send({ ercAddress, tokenId, tokenType, value, pkd: pkd1, nsk: nsk1, fee }),
          ),
        )
      ).map(depRes => depRes.body);

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
    });
  });

  describe('Create challenge block consisting of a deposit and transfer transaction ', () => {
    it('should create a block consisting a deposit and transfer', async () => {
      const depositTransactions = (
        await Promise.all(
          // txPerBlock - 1 so that we can fit in a single transfer
          Array.from({ length: txPerBlock - 1 }, () =>
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
        const count = logCounts.txSubmitted;
        const { txDataToSign } = depositTransactions[i];
        receiptArrays.push(
          // eslint-disable-next-line no-await-in-loop
          await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee),
        );
        // eslint-disable-next-line no-await-in-loop
        await waitForTxExecution(count, 'txSubmitted');
      }
      receiptArrays.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });
      const res = await chai
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
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      const count = logCounts.txSubmitted;
      const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      await waitForTxExecution(count, 'txSubmitted');
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
    });
  });

  describe('Rollback Challenge Test', () => {
    beforeEach(async () => {
      while (eventLogs.length < 2) {
        // Wait for us to have ['blockProposed', 'Rollback'] in the eventLogs
        // Safer to wait as the 2nd while loop may pass when eventLogs[1] is undefined
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      while (eventLogs[0] !== 'blockProposed' && eventLogs[1] !== 'Rollback') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // Double shift to take off from our queue
      eventLogs.shift();
      eventLogs.shift();
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    after(async () => {
      // At the very end make sure we wait for any good blocks before dropping out of the test.
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      eventLogs.shift();
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    describe('Challenge 1: Incorrect root challenge', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectRootInBlock),
        ]);
      });
    });

    describe('Challenge 2: Duplicate transaction submitted', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        txQueue.push(async () => {
          await holdupTxQueue('txSubmitted', logCounts.txSubmitted + 1);
        });
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateTransaction),
        ]);
        const res = await chai
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
        const { txDataToSign } = res.body;
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      });
    });
    describe('Challenge 3: Invalid transaction submitted', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashInvalidTransaction),
        ]);
      });
    });

    describe('Challenge 4: Challenge historic root used in a transaction', () => {
      it('Should delete the wrong block', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashesIncorrectHistoricRoot),
        ]);
      });
    });

    describe('Challenge 5: Proof verification failure', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectProof),
        ]);
      });
    });

    describe('Challenge 6: Duplicate Nullifier', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateNullifier),
        ]);
        const res = await chai
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
        const { txDataToSign } = res.body;
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
      });
    });

    describe('Challenge 7: Incorrect Leaf Count', () => {
      it('Should delete the flawed block and rollback the leaves', async () => {
        await testForEvents(stateAddress, [
          web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
          web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectLeafCount),
        ]);
      });
    });
  });

  after(() => {
    // if the queue is still running, let's close down after it ends
    // if it's empty, close down immediately
    if (txQueue.length === 0) {
      closeWeb3Connection();
      connection.close();
    } else {
      // TODO work out what's still running and close it properly
      txQueue.on('end', () => {
        closeWeb3Connection();
        connection.close();
      });
      txQueue.end();
    }
  });
});
