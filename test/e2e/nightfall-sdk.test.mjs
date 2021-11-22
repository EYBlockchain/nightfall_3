import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  getBalance,
  connectWeb3,
  closeWeb3Connection,
  topicEventMapping,
  timeJump,
} from '../utils.mjs';

const { BLOCKCHAIN_TESTNET_URL } = process.env;

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the Nightfall SDK', () => {
  const ethereumSigningKeyUser1 =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyUser2 =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyProposer =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
  const ethereumSigningKeyChallenger =
    '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb';
  const ethereumSigningKeyLiquidityProvider =
    '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6';
  const mnemonicUser1 =
    'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction';
  const mnemonicUser2 =
    'control series album tribe category saddle prosper enforce moon eternal talk fame';
  const mnemonicProposer =
    'high return hold whale promote payment hat panel reduce oyster ramp mouse';
  const mnemonicChallenger =
    'crush power outer gadget enter maze advance rather divert monster indoor axis';
  const mnemonicLiquidityProvider =
    'smart base soup sister army address member poem point quick save penalty';

  const nf3User1 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKeyUser1,
  );

  const nf3User2 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKeyUser2,
  );

  const nf3Proposer = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKeyProposer,
  );

  const nf3Challenger = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKeyChallenger,
  );

  const nf3LiquidityProvider = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKeyLiquidityProvider,
  );

  let web3;
  let ercAddress;
  let stateAddress;
  const txPerBlock = 2;
  const tokenId = '0x00';
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;
  const fee = 1;
  const eventLogs = [];
  // let pkd2;
  // let compressedPkd2;
  let nodeInfo;
  const transactions = [];

  before(async () => {
    // to enable getBalance with web3 we should connect first
    web3 = await connectWeb3(BLOCKCHAIN_TESTNET_URL);
    stateAddress = await nf3User1.getContractAddress('State');

    await nf3User1.init(mnemonicUser1);
    await nf3User2.init(mnemonicUser2); // 2nd client to do transfer tests and checks
    await nf3Proposer.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);
    await nf3LiquidityProvider.init(mnemonicLiquidityProvider);

    if (!(await nf3User1.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3User2.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3Proposer.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3LiquidityProvider.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    // Proposer registration
    await nf3Proposer.registerProposer();
    // Proposer listening for incoming events
    nf3Proposer.startProposer();
    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Chalenger listening for incoming events
    nf3Challenger.startChallenger();
    // Liquidity provider for instant withdraws
    const emitter = await nf3User1.getInstantWithdrawalRequestedEmitter();
    emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
      await nf3LiquidityProvider.advanceInstantWithdrawal(withdrawTransactionHash);
      console.log(`Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);
    });

    nodeInfo = await web3.eth.getNodeInfo();

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });
  });

  describe('Miscellaneous tests', () => {
    it('should respond with "true" the health check', async function () {
      const res = await nf3User1.healthcheck('client');
      expect(res).to.be.equal(true);
    });

    it('should get the address of the shield contract', async function () {
      const res = await nf3User1.getContractAddress('Shield');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC contract stub', async function () {
      const res = await nf3User1.getContractAddress('ERCStub');
      // Lowercase is useful here because BigInt(ercAddress).toString(16) applies a lowercase check
      // we will use this as a key in our dictionary so it's important they match.
      ercAddress = res.toLowerCase();
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key for client', async function () {
      const res = await nf3User1.subscribeToIncomingViewingKeys();
      expect(res.data.status).to.be.a('string');
      expect(res.data.status).to.be.equal('success');
    });
  });

  describe('Basic Proposer tests', () => {
    it('should register a proposer', async () => {
      // we have to pay 10 ETH to be registered
      const bond = 10;
      const gasCosts = 5000000000000000;
      const startBalance = await getBalance(nf3Proposer.ethereumAddress);
      const res = await nf3Proposer.registerProposer();
      const endBalance = await getBalance(nf3Proposer.ethereumAddress);

      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
    });

    it('should de-register a proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer.getProposers());
      let thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      const res = await nf3Proposer.deregisterProposer();
      expect(res).to.have.property('transactionHash');
      ({ proposers } = await nf3Proposer.getProposers());
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer.ethereumAddress);
      expect(thisProposer.length).to.be.equal(0);
    });

    it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
      let error = null;
      try {
        await nf3Proposer.withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.be.equal(
        'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond',
      );
    });

    it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 7 days
      if (nodeInfo.includes('TestRPC')) {
        const res = await nf3Proposer.withdrawBond();
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      } else {
        let error = null;
        try {
          await nf3Proposer.withdrawBond();
        } catch (err) {
          error = err;
        }
        expect(error.message).to.be.equal('Transaction has been reverted by the EVM');
      }
    });

    after(async () => {
      // After the proposer tests, re-register proposers
      await nf3Proposer.registerProposer();
    });
  });

  describe('Basic Challenger tests', () => {
    it('should register a challenger', async () => {
      const res = await nf3Challenger.registerChallenger();
      expect(res.status).to.be.equal(200);
    });

    it('should de-register a challenger', async () => {
      const res = await nf3Challenger.deregisterChallenger();
      expect(res.status).to.be.equal(200);
    });

    after(async () => {
      // After the challenger tests, re-register challenger
      await nf3Challenger.registerChallenger();
    });
  });

  describe('Deposit tests', () => {
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);

    it('should deposit some crypto into a ZKP commitment', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = [];
      for (let i = 0; i < txPerBlock * numDeposits; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
        depositTransactions.push(res);
      }

      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);

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

  describe('Balance tests', () => {
    it('should increment the balance after deposit some crypto', async function () {
      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      // We do 2 deposits of 10 each
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      }
      // Wait until we see the right number of blocks appear
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      expect(afterPkdBalance - currentPkdBalance).to.be.equal(txPerBlock * value);
    });

    it('should decrement the balance after transfer to other wallet and increment the other wallet', async function () {
      let res;
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      }
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();

      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      const currentPkdBalancePkd2 = 0; // balances[compressedPkd2][ercAddress];
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        res = await nf3User1.transfer(
          false,
          ercAddress,
          tokenType,
          value,
          tokenId,
          nf3User2.zkpKeys.pkd,
          fee,
        );
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      }
      // Wait until we see the right number of blocks appear
      while (eventLogs[0] !== 'blockProposed') {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      eventLogs.shift();
      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      const afterPkdBalancePkd2 = balances[nf3User2.zkpKeys.compressedPkd][ercAddress];
      expect(afterPkdBalancePkd - currentPkdBalancePkd).to.be.equal(-txPerBlock * value);
      expect(afterPkdBalancePkd2 - currentPkdBalancePkd2).to.be.equal(txPerBlock * value);
    });
  });

  describe('Get commitments tests', () => {
    it('should get current commitments for the account', async function () {
      const commitments = await nf3User1.getLayer2Commitments();
      expect(commitments[nf3User1.zkpKeys.compressedPkd]).to.have.property(ercAddress);
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async function () {
      const res = await nf3User1.transfer(
        false,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User1.zkpKeys.pkd,
        fee,
      );
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(res.gasUsed)}`);
    });

    it('should send a single transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive that transfer', async function () {
      const res = await nf3User1.transfer(
        true,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User2.zkpKeys.pkd,
        fee,
      );
      expect(res).to.be.equal(200);

      const depositTransactions = [];
      for (let i = 0; i < txPerBlock; i++) {
        depositTransactions.push(
          // eslint-disable-next-line no-await-in-loop
          await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee),
        );
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
    });
  });

  describe('Withdraw tests', () => {
    it('should withdraw some crypto from a ZKP commitment', async function () {
      const rec = await nf3User1.withdraw(
        false,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
      );
      transactions.push(nf3User1.getLatestWithdrawHash()); // the new transaction
      expect(rec).to.have.property('transactionHash');
      expect(rec).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(rec.gasUsed)}`);

      const depositTransactions = [];
      for (let i = 0; i < txPerBlock - 1; i++) {
        depositTransactions.push(
          // eslint-disable-next-line no-await-in-loop
          await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee),
        );
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

    it('should allow instant withdraw of existing withdraw', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let depositTransactions = [];
      for (let i = 0; i < txPerBlock; i++) {
        depositTransactions.push(
          // eslint-disable-next-line no-await-in-loop
          await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee),
        );
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

      let latestWithdrawTransactionHash = ''; // for instant withdrawals
      console.log(`instant withdrawal call`);
      await nf3User1.withdraw(
        false,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
        fee,
      );
      latestWithdrawTransactionHash = nf3User1.getLatestWithdrawHash();
      console.log(`ilatestWithdrawTransactionHash: ${latestWithdrawTransactionHash}`);
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      if (eventLogs[0] !== 'blockProposed') {
        depositTransactions = [];
        for (let i = 0; i < txPerBlock; i++) {
          depositTransactions.push(
            // eslint-disable-next-line no-await-in-loop
            await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee),
          );
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
      } else {
        eventLogs.shift();
      }

      const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      console.log(`     Gas used was ${Number(res.gasUsed)}`);

      depositTransactions = [];
      for (let i = 0; i < txPerBlock; i++) {
        depositTransactions.push(
          // eslint-disable-next-line no-await-in-loop
          await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee),
        );
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

    it('should not allow instant withdraw of non existing withdraw or not in block yet', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let latestWithdrawTransactionHash = ''; // for instant withdrawals
      await nf3User1.withdraw(
        false,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
        fee,
      );
      latestWithdrawTransactionHash = nf3User1.getLatestWithdrawHash();
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      let error;
      try {
        const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      } catch (e) {
        error = e;
      }
      expect(error.response.status).to.be.equal(500);
    });
  });

  describe('Get pending withdraw commitments tests', () => {
    it('should get current pending withdraw commitments for the account (with 0 valid commitments)', async function () {
      const commitments = await nf3User1.getPendingWithdraws();
      console.log(`commitments: ${JSON.stringify(commitments)}`);
      expect(commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].length).to.be.greaterThan(0);
      expect(
        commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].filter(c => c.valid === true)
          .length,
      ).to.be.equal(0);
    });
  });

  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1 failing (because insufficient time has passed)', () => {
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async function () {
      let error = null;
      try {
        const res = await nf3User1.finaliseWithdrawal(transactions[0]);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      } catch (err) {
        error = err;
      }
      expect(error.message).to.be.equal(
        'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw funds from this block',
      );
    });
  });

  describe('Withdraw funds to layer 1 with a time-jump capable test client (because sufficient time has passed)', () => {
    let startBalance;
    let endBalance;

    it('should get a valid withdraw commitment with a time-jump capable test client (because sufficient time has passed)', async function () {
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 50 days
      console.log(`timeJump`);
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
      }
      const commitments = await nf3User1.getPendingWithdraws();
      expect(commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].length).to.be.greaterThan(0);
      expect(
        commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].filter(c => c.valid === true)
          .length,
      ).to.be.greaterThan(0);
    });

    it('should create a passing finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      startBalance = await getBalance(nf3User1.ethereumAddress);
      if (nodeInfo.includes('TestRPC')) {
        const res = await nf3User1.finaliseWithdrawal(transactions[0]);
        expect(res).to.have.property('transactionHash');
        expect(res).to.have.property('blockHash');
      } else {
        let error = null;
        try {
          const res = await nf3User1.finaliseWithdrawal(transactions[0]);
          expect(res).to.have.property('transactionHash');
          expect(res).to.have.property('blockHash');
        } catch (err) {
          error = err;
        }
        console.log(error.message);
        expect(error.message).to.be.equal('Transaction has been reverted by the EVM');
      }
      endBalance = await getBalance(nf3User1.ethereumAddress);
    });

    it('Should have increased our balance', async function () {
      if (nodeInfo.includes('TestRPC')) {
        const gasCosts = (5000000000000000 * txPerBlock) / 2;
        expect(endBalance - startBalance).to.closeTo(Number(value), gasCosts);
      } else {
        console.log('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  after(() => {
    nf3User1.close();
    nf3User2.close();
    nf3Proposer.close();
    nf3Challenger.close();
    nf3LiquidityProvider.close();
    closeWeb3Connection();
  });
});
