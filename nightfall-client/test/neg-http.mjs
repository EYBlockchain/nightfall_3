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
  getAccounts,
  createBadBlock,
  testForEvents,
  connectWeb3,
} from './utils.mjs';

const { expect } = chai;
const { GN } = gen;
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
  const zkpPrivateKey = '0xc05b14fa15148330c6d008814b0bdd69bc4a08a1bd0b629c42fa7e2c61f16739'; // the zkp private key we're going to use in the tests.
  const zkpPublicKey = sha256([new GN(zkpPrivateKey)]).hex();
  const url = 'http://localhost:8080';
  const optimistUrl = 'http://localhost:8081';
  const optimistWsUrl = 'ws:localhost:8082';
  const tokenId = '0x01';
  const value = 10;
  // this is the etherum private key for accounts[0]
  const privateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  // this is the ethereum private key for accounts[1]
  const privateKey1 = '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1';
  const gas = 10000000;
  // this is the openethereum test account (but could be anything)
  // const recipientAddress = '0x00a329c0648769a73afac7f9381e08fb43dbea72';
  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const BLOCK_STAKE = 1000000000000000000; // 1 ether

  let topicsBlockHashIncorrectRootInBlock;
  let topicsBlockHashDuplicateTransaction;
  let topicsBlockHashInvalidTransaction;
  let topicsBlockHashesIncorrectHistoricRoot;
  let topicsBlockHashIncorrectPublicInputHash;
  let topicsBlockHashIncorrectProof;
  let topicsBlockHashDuplicateNullifier;
  let web3;

  before(async () => {
    web3 = await connectWeb3();

    let res;
    let txToSign;
    let counter = 0; // to edit a block to a different bad block type each time a block proposed transaction is received
    let duplicateTransaction;
    let duplicateNullifier;

    res = await chai.request(url).get('/contract-address/Shield');
    shieldAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Challenges');
    challengeAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/Proposers');
    proposersAddress = res.body.address;

    res = await chai.request(url).get('/contract-address/State');
    stateAddress = res.body.address;

    // should get the address of the test ERC contract stub
    res = await chai.request(url).get('/contract-address/ERCStub');
    ercAddress = res.body.address;

    // should register a proposer
    const myAddress = (await getAccounts())[0];
    const bond = 10000000000000000000;
    res = await chai.request(optimistUrl).post('/proposer/register').send({ address: myAddress });
    txToSign = res.body.txDataToSign;
    await submitTransaction(txToSign, privateKey, proposersAddress, gas, bond);

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
            [duplicateTransaction] = transactions;
            console.log(
              `Created good block to extract duplicate tx from with blockHash ${block.blockHash}`,
            );
          } else if (counter === 1) {
            [duplicateNullifier] = transactions
              .map(t => t.nullifiers.filter(n => n !== ZERO))
              .flat(Infinity);
            console.log(
              `Created good block to extract duplicate nullifier from with blockHash ${block.blockHash}`,
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
            res = await createBadBlock('IncorrectHistoricRoot', block, transactions, {
              ercAddress,
              zkpPrivateKey,
            });
            topicsBlockHashesIncorrectHistoricRoot = res.block.blockHash;
            txDataToSign = res.txDataToSign;
            console.log(`Created flawed block with invalid historic root ${res.block.blockHash}`);
          } else if (counter === 6) {
            res = await createBadBlock('IncorrectPublicInputHash', block, transactions);
            topicsBlockHashIncorrectPublicInputHash = res.block.blockHash;
            txDataToSign = res.txDataToSign;
            console.log(
              `Created flawed block with incorrect public input hash and blockHash ${res.block.blockHash}`,
            );
          } else if (counter === 7) {
            res = await createBadBlock('IncorrectProof', block, transactions, {
              proof: duplicateTransaction.proof,
            });
            topicsBlockHashIncorrectProof = res.block.blockHash;
            txDataToSign = res.txDataToSign;
            console.log(
              `Created flawed block with incorrect proof and blockHash ${res.block.blockHash}`,
            );
          } else if (counter === 8) {
            res = await createBadBlock('DuplicateNullifier', block, transactions, {
              duplicateNullifier,
            });
            // topicsBlockHashesDuplicateNullifier = res.block.blockHash;
            topicsBlockHashDuplicateNullifier = res.block.blockHash;
            txDataToSign = res.txDataToSign;
            console.log(
              `Created flawed block with duplicate nullifier and blockHash ${res.block.blockHash}`,
            );
          } else {
            txDataToSign = msg.txDataToSign;
            console.log(`Created good block with blockHash ${res.block.blockHash}`);
          }
          await submitTransaction(txDataToSign, privateKey, stateAddress, gas, BLOCK_STAKE);
          counter++;
          // console.log('tx hash of propose block is', txReceipt.transactionHash);
        } else if (type === 'commit') {
          await submitTransaction(txDataToSign, privateKey1, challengeAddress, gas);
        } else if (type === 'challenge') {
          await submitTransaction(txDataToSign, privateKey1, challengeAddress, gas);
          // When a challenge succeeds, the challenger is removed. We are adding them back for subsequent for challenges
          const result = await chai
            .request(optimistUrl)
            .post('/proposer/register')
            .send({ address: myAddress });
          txToSign = result.body.txDataToSign;
          await submitTransaction(txToSign, privateKey, proposersAddress, gas, bond);
          // console.log('tx hash of challenge block is', txReceipt.transactionHash);
        } else throw new Error(`Unhandled transaction type: ${type}`);
      });
    };
  });

  describe('Basic Challenger tests', () => {
    it('should add a Challenger address', async () => {
      const myAddress = (await getAccounts())[1];
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
      const res = await chai.request(url).post('/deposit').send({
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
      const res = await chai.request(url).post('/deposit').send({
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
  describe('Creating blocks with at least 1 transfer so there is a non-zero nullifier for later challenges', () => {
    let txDataToSign;
    it('should create a deposit', async () => {
      const res = await chai.request(url).post('/deposit').send({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
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

    it('should create a transfer', async () => {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
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

  describe('Create challenge block consisting of a deposit and transfer transaction ', () => {
    let txDataToSign;
    // it('should create a transfer', async () => {
    //   const res = await chai
    //     .request(url)
    //     .post('/transfer')
    //     .send({
    //       ercAddress,
    //       tokenId,
    //       recipientData: {
    //         values: [value],
    //         recipientZkpPublicKeys: [zkpPublicKey],
    //       },
    //       senderZkpPrivateKey: zkpPrivateKey,
    //       fee,
    //     });
    //   txDataToSign = res.body.txDataToSign;
    //   expect(txDataToSign).to.be.a('string');
    //   // now we need to sign the transaction and send it to the blockchain
    //   const receipt = await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);
    //   expect(receipt).to.have.property('transactionHash');
    //   expect(receipt).to.have.property('blockHash');
    //   console.log(`Gas used was ${Number(receipt.gasUsed)}`);
    //   // give Timber time to respond to the blockchain event
    //   await new Promise(resolve => setTimeout(resolve, 5000));
    // });

    it('should create a deposit', async () => {
      const res = await chai.request(url).post('/deposit').send({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
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

    it('should create a transfer', async () => {
      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
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
    it('Should delete the flawed block and rollback the leaves', async () => {
      // it's possible that we've arrived here before the block that sets
      // topicsBlockHashIncorrectRootInBlock has actually been proposed. If that
      // happens then topicsBlockHashIncorrectRootInBlock will be undefined and
      // everything will break.  More specifically, we can't await the event
      // of a topic that isn't defined yet so testForEvents will fail.
      // Thus, we await topicsBlockHashIncorrectRootInBlock to be defined
      // before proceeding, with this FrankenPromise.  This approach is used in // the next challenges too.
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashIncorrectRootInBlock || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectRootInBlock),
      ]);
    });
  });

  describe('Challenge 2: Duplicate transaction submitted', () => {
    it('Should delete the flawed block and rollback the leaves', async () => {
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashDuplicateTransaction || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateTransaction),
      ]);
    });
  });

  describe('Challenge 3: Invalid transaction submitted', () => {
    it('Should delete the flawed block and rollback the leaves', async () => {
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashInvalidTransaction || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashInvalidTransaction),
      ]);
    });
  });

  describe('Challenge 4: Challenge historic root used in a transaction', async () => {
    it('Should delete the wrong block', async () => {
      // // create another transaction to trigger NO's block assembly
      // const res = await chai.request(url).post('/deposit').send({
      //   ercAddress,
      //   tokenId,
      //   value,
      //   zkpPublicKey,
      //   fee,
      // });
      // const { txDataToSign } = res.body;
      // // now we need to sign the transaction and send it to the blockchain
      // await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);

      const res = await chai
        .request(url)
        .post('/transfer')
        .send({
          ercAddress,
          tokenId,
          recipientData: {
            values: [value],
            recipientZkpPublicKeys: [zkpPublicKey],
          },
          senderZkpPrivateKey: zkpPrivateKey,
          fee,
        });
      const { txDataToSign } = res.body;
      expect(txDataToSign).to.be.a('string');
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas);

      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashesIncorrectHistoricRoot || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashesIncorrectHistoricRoot),
      ]);
    });
  });

  describe('Challenge 5: Incorrect public input hash', async () => {
    it('Should delete the flawed block and rollback the leaves', async () => {
      // create another transaction to trigger NO's block assembly
      const res = await chai.request(url).post('/deposit').send({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
        fee,
      });
      const { txDataToSign } = res.body;
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      // await new Promise(resolve => setTimeout(resolve, 5000));
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashIncorrectPublicInputHash || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectPublicInputHash),
      ]);
    });
  });

  describe('Challenge 6: Proof verification failure', async () => {
    it('Should delete the flawed block and rollback the leaves', async () => {
      // create another transaction to trigger NO's block assembly
      const res = await chai.request(url).post('/deposit').send({
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
        fee,
      });
      const { txDataToSign } = res.body;
      // now we need to sign the transaction and send it to the blockchain
      await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
      // await new Promise(resolve => setTimeout(resolve, 5000));
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashIncorrectProof || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashIncorrectProof),
      ]);
    });
  });

  describe('Challenge 7: Duplicate Nullifier', async () => {
    it('Should delete the flawed block and rollback the leaves', async () => {
      // create two transfers - transfers are preferred here because we want to swap out a nullifier.
      for (let i = 0; i < 2; i++) {
        const res = await chai // eslint-disable-line no-await-in-loop
          .request(url)
          .post('/transfer')
          .send({
            ercAddress,
            tokenId,
            recipientData: {
              values: [value],
              recipientZkpPublicKeys: [zkpPublicKey],
            },
            senderZkpPrivateKey: zkpPrivateKey,
            fee,
          });
        const { txDataToSign } = res.body;
        // eslint-disable-next-line no-await-in-loop
        await submitTransaction(txDataToSign, privateKey, shieldAddress, gas, fee);
        // eslint-disable-next-line no-await-in-loop
        // await new Promise(resolve => setTimeout(resolve, 5000));
      }
      clearInterval(
        await new Promise(resolve => {
          const t = setInterval(() => !topicsBlockHashDuplicateNullifier || resolve(t), 1000);
        }),
      );
      await testForEvents(stateAddress, [
        web3.eth.abi.encodeEventSignature('Rollback(bytes32,uint256,uint256)'),
        web3.eth.abi.encodeParameter('bytes32', topicsBlockHashDuplicateNullifier),
      ]);
    });
  });

  after(() => {
    // if the queue is still running, let's close down after it ends
    // if it's empty, close down immediately
    if (txQueue.length === 0) {
      closeWeb3Connection();
      connection.close();
      // TODO work out what's still running and close it properly
    } else
      txQueue.on('end', () => {
        closeWeb3Connection();
        connection.close();
      });
  });
});
