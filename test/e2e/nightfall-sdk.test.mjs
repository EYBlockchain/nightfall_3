import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import { getERCInfo } from '../../cli/lib/tokens.mjs';
import {
  getBalance,
  connectWeb3,
  closeWeb3Connection,
  topicEventMapping,
  timeJump,
  waitForEvent,
  expectTransaction,
  depositNTransactions,
  getCurrentEnvironment,
} from '../utils.mjs';
import {
  ethereumSigningKeyUser1,
  ethereumSigningKeyUser2,
  ethereumSigningKeyProposer1,
  ethereumSigningKeyProposer2,
  ethereumSigningKeyProposer3,
  ethereumSigningKeyLiquidityProvider,
  ethereumSigningKeyChallenger,
  txPerBlock,
  fee,
  value,
  bond,
  gasCosts,
  tokenId,
  tokenType,
  mnemonicUser1,
  mnemonicUser2,
  mnemonicProposer,
  mnemonicLiquidityProvider,
  mnemonicChallenger,
} from '../constants.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = getCurrentEnvironment();
const { web3WsUrl } = process.env;

describe('Testing the Nightfall SDK', () => {
  console.log('ENVIRONMENT: ', environment);
  const nf3User1 = new Nf3(web3WsUrl, ethereumSigningKeyUser1, environment);
  const nf3User2 = new Nf3(web3WsUrl, ethereumSigningKeyUser2, environment);
  const nf3Proposer1 = new Nf3(web3WsUrl, ethereumSigningKeyProposer1, environment);
  const nf3Proposer2 = new Nf3(web3WsUrl, ethereumSigningKeyProposer2, environment);
  const nf3Proposer3 = new Nf3(web3WsUrl, ethereumSigningKeyProposer3, environment);
  const nf3Challenger = new Nf3(web3WsUrl, ethereumSigningKeyChallenger, environment);
  const nf3LiquidityProvider = new Nf3(web3WsUrl, ethereumSigningKeyLiquidityProvider, environment);

  let web3;
  let ercAddress;
  let stateAddress;
  let eventLogs = [];
  let nodeInfo;
  const transactions = [];

  const miniStateABI = [
    {
      inputs: [],
      name: 'getNumberOfL2Blocks',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const getOnChainBlockCount = async () => {
    const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
    const onChainBlockCount = await stateContractInstance.methods.getNumberOfL2Blocks().call();
    return onChainBlockCount;
  };

  before(async () => {
    // to enable getBalance with web3 we should connect first
    web3 = await connectWeb3();

    await nf3User1.init(mnemonicUser1);
    await nf3User2.init(mnemonicUser2); // 2nd client to do transfer tests and checks
    await nf3Proposer1.init(mnemonicProposer);
    await nf3Proposer2.init(mnemonicProposer);
    await nf3Proposer3.init(mnemonicProposer);
    await nf3Challenger.init(mnemonicChallenger);
    await nf3LiquidityProvider.init(mnemonicLiquidityProvider);

    stateAddress = await nf3User1.stateContractAddress;

    console.log('     Last block on chain: ', await getOnChainBlockCount());
    console.log('     Shield address: ', nf3User1.shieldContractAddress);
    console.log('     State address: ', nf3User1.stateContractAddress);
    console.log('     Proposers address: ', nf3User1.proposersContractAddress);

    if (!(await nf3User1.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3User2.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3Proposer1.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3Proposer2.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3Proposer3.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3LiquidityProvider.healthcheck('optimist')))
      throw new Error('Healthcheck failed');

    console.log('     Proposer address: ', nf3Proposer1.ethereumAddress);
    console.log('        Proposer optimistBaseUrl: ', nf3Proposer1.optimistBaseUrl);
    console.log('        Proposer optimistWsUrl: ', nf3Proposer1.optimistWsUrl);
    console.log('     Challenger address: ', nf3Challenger.ethereumAddress);
    console.log('     LiquidityProvider address: ', nf3LiquidityProvider.ethereumAddress);
    console.log('     User1 address: ', nf3User1.ethereumAddress);
    console.log('     User2 address: ', nf3User2.ethereumAddress);

    // Proposer registration
    await nf3Proposer1.registerProposer();
    // Proposer listening for incoming events
    nf3Proposer1.startProposer();
    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Chalenger listening for incoming events
    nf3Challenger.startChallenger();
    const res = await nf3User1.getContractAddress('ERC20Mock');
    // Lowercase is useful here because BigInt(ercAddress).toString(16) applies a lowercase check
    // we will use this as a key in our dictionary so it's important they match.
    ercAddress = res.toLowerCase();

    const balances = await getERCInfo(ercAddress, nf3Proposer1.ethereumAddress, web3);
    console.log('BALANCES: ', balances);

    // Liquidity provider for instant withdraws
    const emitter = await nf3User1.getInstantWithdrawalRequestedEmitter();
    emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
      await nf3LiquidityProvider.advanceInstantWithdrawal(withdrawTransactionHash);
      console.log(`     Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);
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
      let proposers;
      ({ proposers } = await nf3Proposer2.getProposers());
      // we have to pay 10 ETH to be registered
      const startBalance = await getBalance(nf3Proposer2.ethereumAddress);
      const res = await nf3Proposer2.registerProposer();
      expectTransaction(res);
      ({ proposers } = await nf3Proposer2.getProposers());
      const endBalance = await getBalance(nf3Proposer2.ethereumAddress);
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
      const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer2.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
    });

    it('should register other proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer3.getProposers());
      // we have to pay 10 ETH to be registered
      const startBalance = await getBalance(nf3Proposer3.ethereumAddress);
      const res = await nf3Proposer3.registerProposer();
      expectTransaction(res);
      ({ proposers } = await nf3Proposer3.getProposers());
      const endBalance = await getBalance(nf3Proposer3.ethereumAddress);
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
      const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer3.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
    });

    it('should de-register a proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer1.getProposers());
      let thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      const res = await nf3Proposer1.deregisterProposer();
      expectTransaction(res);
      ({ proposers } = await nf3Proposer1.getProposers());
      thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      expect(thisProposer.length).to.be.equal(0);
    });

    it('Should create a failing withdrawBond (because insufficient time has passed)', async () => {
      let error = null;
      try {
        await nf3Proposer1.withdrawBond();
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(
        message =>
          message.includes(
            'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw your bond',
          ) || message.includes('Transaction has been reverted by the EVM'),
      );
    });

    it('Should create a passing withdrawBond (because sufficient time has passed)', async () => {
      if (nodeInfo.includes('TestRPC')) await timeJump(3600 * 24 * 10); // jump in time by 7 days
      if (nodeInfo.includes('TestRPC')) {
        const res = await nf3Proposer1.withdrawBond();
        expectTransaction(res);
      } else {
        let error = null;
        try {
          await nf3Proposer1.withdrawBond();
        } catch (err) {
          error = err;
        }
        expect(error.message).to.include('Transaction has been reverted by the EVM');
      }
    });

    after(async () => {
      // After the proposer tests, re-register proposers
      await nf3Proposer2.deregisterProposer();
      await nf3Proposer3.deregisterProposer();
      await nf3Proposer1.registerProposer();
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
      console.log(`      Sending ${txPerBlock * numDeposits} deposits...`);
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = await depositNTransactions(
        nf3User1,
        txPerBlock * numDeposits,
        ercAddress,
        tokenType,
        value,
        tokenId,
        fee,
      );
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed'], numDeposits);
      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);

      console.log(`     Average Gas used was ${Math.ceil(totalGas / (txPerBlock * numDeposits))}`);
    });
  });

  describe('Balance tests', () => {
    it('should increment the balance after deposit some crypto', async function () {
      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      // We do 2 deposits of 10 each
      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      expect(afterPkdBalance - currentPkdBalance).to.be.equal(txPerBlock * value);
    });

    it('should decrement the balance after transfer to other wallet and increment the other wallet', async function () {
      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][ercAddress];
      const currentPkdBalancePkd2 = 0; // balances[compressedPkd2][ercAddress];
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          ercAddress,
          tokenType,
          value,
          tokenId,
          nf3User2.zkpKeys.compressedPkd,
          fee,
        );
        expectTransaction(res);
      }
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
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
        nf3User1.zkpKeys.compressedPkd,
        fee,
      );
      expectTransaction(res);
      console.log(`     Gas used was ${Number(res.gasUsed)}`);
    });

    it('should send a single transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive that transfer', async function () {
      const res = await nf3User1.transfer(
        true,
        ercAddress,
        tokenType,
        value,
        tokenId,
        nf3User2.zkpKeys.compressedPkd,
        fee,
      );
      expect(res).to.be.equal(200);

      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);

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
      expectTransaction(rec);
      console.log(`     Gas used was ${Number(rec.gasUsed)}`);

      await depositNTransactions(
        nf3User1,
        txPerBlock - 1,
        ercAddress,
        tokenType,
        value,
        tokenId,
        fee,
      );
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should allow instant withdraw of existing withdraw', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

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

      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expectTransaction(res);
      console.log(`     Gas used was ${Number(res.gasUsed)}`);

      await depositNTransactions(nf3User1, txPerBlock, ercAddress, tokenType, value, tokenId, fee);
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
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

      const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      expect(res).to.be.equal(null);
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
        expectTransaction(res);
      } catch (err) {
        error = err;
      }
      expect(error.message).to.satisfy(
        message =>
          message.includes(
            'Returned error: VM Exception while processing transaction: revert It is too soon to withdraw funds from this block',
          ) || message.includes('Transaction has been reverted by the EVM'),
      );
    });
  });

  describe('Withdraw funds to layer 1 with a time-jump capable test client (because sufficient time has passed)', () => {
    let startBalance;
    let endBalance;

    it('should get a valid withdraw commitment with a time-jump capable test client (because sufficient time has passed)', async function () {
      if (nodeInfo.includes('TestRPC')) {
        await timeJump(3600 * 24 * 10); // jump in time by 50 days
        console.log(`timeJump`);
        await depositNTransactions(
          nf3User1,
          txPerBlock,
          ercAddress,
          tokenType,
          value,
          tokenId,
          fee,
        );

        const commitments = await nf3User1.getPendingWithdraws();
        expect(commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].length).to.be.greaterThan(0);
        expect(
          commitments[nf3User1.zkpKeys.compressedPkd][ercAddress].filter(c => c.valid === true)
            .length,
        ).to.be.greaterThan(0);
      } else {
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });

    it('should create a passing finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      startBalance = await getBalance(nf3User1.ethereumAddress);
      if (nodeInfo.includes('TestRPC')) {
        const res = await nf3User1.finaliseWithdrawal(transactions[0]);
        expectTransaction(res);
      } else {
        // geth
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
      endBalance = await getBalance(nf3User1.ethereumAddress);
    });

    it('Should have increased our balance', async function () {
      if (nodeInfo.includes('TestRPC')) {
        const gasCostsTotal = (gasCosts * txPerBlock) / 2;
        expect(endBalance - startBalance).to.closeTo(Number(value), gasCostsTotal);
      } else {
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });
  });

  after(async () => {
    nf3User1.close();
    nf3User2.close();
    nf3Proposer1.close();
    nf3Proposer2.close();
    nf3Proposer3.close();
    nf3Challenger.close();
    nf3LiquidityProvider.close();
    closeWeb3Connection();
  });
});
