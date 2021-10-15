import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../cli/lib/nf3.mjs';
import { getBalance, connectWeb3, closeWeb3Connection, topicEventMapping } from '../utils.mjs';
import { generateKeys } from '../../nightfall-client/src/services/keys.mjs';

const { BLOCKCHAIN_TESTNET_URL } = process.env;

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the Nightfall SDK', () => {
  const ethereumSigningKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const nf3 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKey,
  );

  const { ZKP_KEY_LENGTH } = config;
  let web3;
  let ercAddress;
  let stateAddress;
  const txPerBlock = 2;
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  const value2 = 12;
  const fee = 1;
  const eventLogs = [];
  let pkd2;

  before(async () => {
    // to enable getBalance with web3 we should connect first
    web3 = await connectWeb3(BLOCKCHAIN_TESTNET_URL);
    stateAddress = await nf3.getContractAddress('State');

    await nf3.init();
    if (!(await nf3.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    // Proposer registration
    await nf3.registerProposer();
    // Proposer listening for incoming events
    nf3.startProposer();
    // Challenger registration
    await nf3.registerChallenger();
    // Chalenger listening for incoming events
    nf3.startChallenger();

    ({ pkd: pkd2 } = await generateKeys(ZKP_KEY_LENGTH));

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });
  });

  describe('Miscellaneous tests', () => {
    it('should respond with "true" the health check', async function () {
      const res = await nf3.healthcheck('optimist');
      expect(res).to.equal(true);
    });

    it('should get the address of the shield contract', async function () {
      const res = await nf3.getContractAddress('Shield');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC contract stub', async function () {
      const res = await nf3.getContractAddress('ERCStub');
      ercAddress = res;
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key for client', async function () {
      const res = await nf3.subscribeToIncomingViewingKeys();
      expect(res.data.status).to.be.a('string');
      expect(res.data.status).to.equal('success');
    });
  });

  describe('Basic Proposer tests', () => {
    it('should register a proposer', async () => {
      // we have to pay 10 ETH to be registered
      const bond = 10;
      const gasCosts = 5000000000000000;
      const startBalance = await getBalance(nf3.ethereumAddress);
      const res = await nf3.registerProposer();
      const endBalance = await getBalance(nf3.ethereumAddress);

      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    });

    it('should de-register a proposer', async () => {
      // TODO: nf3.deregisterProposer(), nf3.getProposers()
    });

    it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
      // TODO: nf3.withdrawBond()
    });
  });

  describe('Deposit tests', () => {
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);

    it('should deposit some crypto into a ZKP commitment', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const resArrays = [];
      for (let i = 0; i < txPerBlock * numDeposits; i++) {
        // eslint-disable-next-line no-await-in-loop
        resArrays.push(await nf3.deposit(ercAddress, tokenType, value, tokenId, fee));
      }

      resArrays.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });

      const totalGas = resArrays.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);

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
    it('should transfer some crypto (back to us) using ZKP', async function () {
      const res = await nf3.transfer(ercAddress, tokenType, value, tokenId, nf3.zkpKeys.pkd, fee);
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(res.gasUsed)}`);
    });

    it('should send a single transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive tha transfer and decrypt the secrets', async function () {
      // TODO: nf3.getCommitmentBySalt(salt)
      await nf3.transfer(ercAddress, tokenType, value, tokenId, pkd2, fee);

      const depositTransactions = [];
      for (let i = 0; i < txPerBlock - 2; i++) {
        // eslint-disable-next-line no-await-in-loop
        depositTransactions.push(await nf3.deposit(ercAddress, tokenType, value, tokenId, fee));
      }
      depositTransactions.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });

      // wait for the block proposed event with transfer function to be recognised by nightfall client of recipient
      while (eventLogs.length !== 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      /*
      const newCommitmentSalts = res.salts;
      let commitment;

      while (!commitment) {
        // eslint-disable-next-line no-await-in-loop
        const result = await nf3.getCommitmentBySalt(newCommitmentSalts[0]);
        [commitment] = result.commitment;
        if (commitment) break;
        console.log('commitment not found - waiting for 3s before re-try');
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      expect(
        web3.utils.toChecksumAddress(`0x${commitment.preimage.ercAddress.substring(26, 66)}`),
      ).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(new GN(commitment.preimage.value).decimal, 10)).to.equal(value);
      */
    });
  });

  // now we can do the double transfer
  describe('Double transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async function () {
      const res = await nf3.transfer(ercAddress, tokenType, value2, tokenId, nf3.zkpKeys.pkd, fee);
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(res.gasUsed)}`);
    });

    it('should send a double transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive tha transfer and decrypt the secrets', async function () {
      // give the last block time to be submitted, or we won't have enough
      // commitments in the Merkle tree to use for the double transfer.

      const res = await nf3.transfer(ercAddress, tokenType, value2 + 2, tokenId, pkd2, fee);
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');

      const depositTransactions = [];
      for (let i = 0; i < txPerBlock - 2; i++) {
        // eslint-disable-next-line no-await-in-loop
        depositTransactions.push(await nf3.deposit(ercAddress, tokenType, value, tokenId, fee));
      }

      depositTransactions.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });

      // wait for the block proposed event with transfer function to be recognised by nightfall client of recipient
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      /*
      const newCommitmentSalts = res.salts;
      let commitment;

      while (!commitment) {
        // eslint-disable-next-line no-await-in-loop
        const result = await chai.request(recipientUrl).get('/commitment/salt').query({
          salt: newCommitmentSalts[0],
        });
        [commitment] = result.body.commitment;
        if (commitment) break;
        console.log('commitment not found - waiting for 3s before re-try');
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      expect(
        web3.utils.toChecksumAddress(`0x${commitment.preimage.ercAddress.substring(26, 66)}`),
      ).to.equal(ercAddress); // .subString(22, 64)
      expect(parseInt(new GN(commitment.preimage.value).decimal, 10)).to.equal(value2 + 2);
      */
    });
  });

  describe('Withdraw tests', () => {
    it('should withdraw some crypto from a ZKP commitment', async function () {
      const res = await nf3.withdraw(ercAddress, tokenType, value, tokenId, nf3.ethereumAddress);
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(res.gasUsed)}`);

      const depositTransactions = [];
      for (let i = 0; i < txPerBlock - 2; i++) {
        // eslint-disable-next-line no-await-in-loop
        depositTransactions.push(await nf3.deposit(ercAddress, tokenType, value, tokenId, fee));
      }

      depositTransactions.forEach(receipt => {
        expect(receipt).to.have.property('transactionHash');
        expect(receipt).to.have.property('blockHash');
      });

      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
    });
  });

  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1', () => {
    it('Should find the block containing the withdraw transaction', async function () {
      // TODO: nf3.finaliseWithdrawal(block, transactions, index)
    });
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async function () {
      // TODO: nf3.finaliseWithdrawal(block, transactions, index)
    });
    it('Should create a passing finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // TODO: nf3.finaliseWithdrawal(block, transactions, index)
    });
    it('Should have increased our balance', async function () {
      // TODO
    });
  });

  after(() => {
    nf3.close();
    closeWeb3Connection();
  });
});
