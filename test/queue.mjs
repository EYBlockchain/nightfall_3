import chai from 'chai';
import config from 'config';
import chaiHttp from 'chai-http';
import gen from 'general-number';
import sha256 from '../src/utils/crypto/sha256.mjs';
import { dropCommitments } from '../src/services/commitment-storage.mjs';
import mongo from '../src/utils/mongo.mjs';
import rabbitmq from '../src/utils/rabbitmq.mjs';
import {closeWeb3Connection, gasStats, submitTransaction, connectWeb3 } from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
const { GN } = gen;

function queue(queueName, message) {
  const replyTo = `${queueName}-reply`; // replyTo queue
  const correlationId = `${Math.random().toString()}
    ${Math.random().toString()}
    ${Math.random().toString()}`;

  return new Promise((resolve, reject) => {
    try {
      rabbitmq.listenToReplyQueue(replyTo, correlationId, resolve);
      rabbitmq.sendMessage(queueName, message, {
        correlationId,
        replyTo,
      });
    } catch (err) {
      reject(err);
    }
  });
}

process.env = {
  RABBITMQ_HOST: 'amqp://localhost',
  RABBITMQ_PORT: 5672
};

describe('Testing the queue implementation', () => {
  let shieldAddress;
  let txToSign;
  let ercAddress;
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

  before(async () => {
    connectWeb3();
    await rabbitmq.connect();
    await dropCommitments()
      .catch(err => console.log("Couldn't drop the Mongo db - that's fine there probably wasn't one set up if this is the first test run"));

    await chai.request(url).get('/generate-zkp-key');
    shieldAddress = (await chai.request(url).get('/contract-address/Shield')).body.address;
    ercAddress = (await chai.request(url).get('/contract-address/ERCStub')).body.address;
  });

  describe('Deposit tests', () => {
    it('should deposit some crypto into a ZKP commitment and get a raw blockchain transaction back', async () => {
      ({ txToSign } = await queue('deposit', {
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
      }));
      expect(txToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and store the commitment in the Merkle tree, and update the commitment db', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      gasStats(receipt);
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
  });

  describe('Single transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async () => {
      ({ txToSign } = await queue('transfer', {
        ercAddress,
        tokenId,
        recipientData: { values: [value], recipientZkpPublicKeys: [zkpPublicKey] },
        senderZkpPrivateKey: zkpPrivateKey,
      }));
      expect(txToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      gasStats(receipt);
    });
  });

  describe('Double transfer tests', () => {
    it('should deposit some more crypto (we need a second token) into a ZKP commitment and get a raw blockchain transaction back', async () => {
      ({ txToSign } = await queue('deposit', {
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
      }));
      expect(txToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and store the commitment in the Merkle tree, and update the commitment db', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

    it('should transfer some crypto (back to us) using ZKP', async () => {
      ({ txToSign } = await queue('transfer', {
        ercAddress,
        tokenId,
        recipientData: { values: [value2], recipientZkpPublicKeys: [zkpPublicKey] },
        senderZkpPrivateKey: zkpPrivateKey,
      }));
      expect(txToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and update the Merkle tree', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      gasStats(receipt);
    });
  });

  describe('Withdraw tests', () => {
    it('should deposit some more crypto (we need another token to test withdraw) into a ZKP commitment and get a raw blockchain transaction back', async () => {
      ({ txToSign } = await queue('deposit', {
        ercAddress,
        tokenId,
        value,
        zkpPublicKey,
      }));
      expect(txToSign).to.be.a('string');
    });

    it('should should send the raw transaction to the shield contract to verify the proof and store the commitment in the Merkle tree, and update the commitment db', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      // give Timber time to respond to the blockchain event
      await new Promise(resolve => setTimeout(resolve, 5000));
    });
    it('should withdraw some crypto from a ZKP commitment', async () => {
      ({ txToSign } = await queue('withdraw', {
        ercAddress,
        tokenId,
        value,
        senderZkpPrivateKey: zkpPrivateKey,
        recipientAddress,
      }));
      expect(txToSign).to.be.a('string');
    });
    it('should should send the raw transaction to the shield contract to verify the proof and pay the recipient', async () => {
      // now we need to sign the transaction and send it to the blockchain
      const receipt = await submitTransaction(txToSign, privateKey, shieldAddress, gas);
      expect(receipt).to.have.property('transactionHash');
      expect(receipt).to.have.property('blockHash');
      gasStats(receipt);
    });
  });
  after(async () => {
    mongo.disconnect(config.MONGO_URL);
    closeWeb3Connection();
    await rabbitmq.close();
  });
});
