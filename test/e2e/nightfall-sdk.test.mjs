import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import { getERCInfo, approve } from '../../cli/lib/tokens.mjs';
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
  tokenTypeERC721,
  tokenTypeERC1155,
  mnemonicUser1,
  mnemonicUser2,
  mnemonicProposer,
  mnemonicLiquidityProvider,
  mnemonicChallenger,
  BLOCK_STAKE,
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
  let erc20Address;
  let erc721Address;
  let erc1155Address;
  let stateAddress;
  let eventLogs = [];
  let nodeInfo;
  let diffBalanceInstantWithdraw = 0;
  const withdrawTransactions = [];
  let initialValidCommitments = 0;
  let stateBalance = 0;
  const logCounts = {
    instantWithdaw: 0,
  };

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

  const waitForTxExecution = async (count, txType) => {
    while (count === logCounts[txType]) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
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
    stateBalance += bond;
    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      console.log(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });
    await nf3Proposer1.addPeer('http://optimist1:80');
    // Challenger registration
    await nf3Challenger.registerChallenger();
    // Chalenger listening for incoming events
    nf3Challenger.startChallenger();
    let res = await nf3User1.getContractAddress('ERC20Mock');
    // Lowercase is useful here because BigInt(erc20Address).toString(16) applies a lowercase check
    // we will use this as a key in our dictionary so it's important they match.
    erc20Address = res.toLowerCase();
    res = await nf3User1.getContractAddress('ERC721Mock');
    erc721Address = res.toLowerCase();
    res = await nf3User1.getContractAddress('ERC1155Mock');
    erc1155Address = res.toLowerCase();
    console.log('     ERC20Mock address: ', erc20Address);
    console.log('     ERC721Mock address: ', erc721Address);
    console.log('     ERC1155Mock address: ', erc1155Address);

    const balances = await getERCInfo(erc20Address, nf3LiquidityProvider.ethereumAddress, web3);
    console.log(`BALANCES LIQUIDITY PROVIDER FOR ERC20 (${erc20Address}): `, balances);

    // Liquidity provider for instant withdraws
    const emitter = await nf3User1.getInstantWithdrawalRequestedEmitter();
    emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
      const balancesBefore = await getERCInfo(
        erc20Address,
        nf3LiquidityProvider.ethereumAddress,
        web3,
      );
      // approve tokens to be advanced by liquidity provider in the instant withdraw
      let txDataToSign;
      try {
        txDataToSign = await approve(
          erc20Address,
          nf3LiquidityProvider.ethereumAddress,
          nf3LiquidityProvider.shieldContractAddress,
          tokenType,
          value,
          web3,
          !!nf3LiquidityProvider.ethereumSigningKey,
        );
        if (txDataToSign) {
          await nf3LiquidityProvider.submitTransaction(txDataToSign, erc20Address, 0);
        }
        await nf3LiquidityProvider.advanceInstantWithdrawal(withdrawTransactionHash);
      } catch (e) {
        console.log(e);
      }

      console.log(`     Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);

      await new Promise(resolve => setTimeout(resolve, 5000));
      const balancesAfter = await getERCInfo(
        erc20Address,
        nf3LiquidityProvider.ethereumAddress,
        web3,
      );

      while (eventLogs.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // difference in balance in L1 account to check instant withdraw is ok
      diffBalanceInstantWithdraw = Number(balancesBefore.balance) - Number(balancesAfter.balance);
      logCounts.instantWithdaw += 1;
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

    it('should get the address of the test ERC20 mock contract', async function () {
      const res = await nf3User1.getContractAddress('ERC20Mock');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC721 mock contract', async function () {
      const res = await nf3User1.getContractAddress('ERC721Mock');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC1155 mock contract', async function () {
      const res = await nf3User1.getContractAddress('ERC1155Mock');
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
      stateBalance += bond;
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
      stateBalance += bond;
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
      stateBalance += bond;
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

  describe('Synchronize with block proposed', () => {
    it('should get correct balance after deposit or synchronize with block proposed', async () => {
      let balances = await nf3User1.getLayer2Balances();
      let beforePkdBalance = 0;
      try {
        beforePkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
      } catch {
        beforePkdBalance = 0;
      }

      if (beforePkdBalance !== 0) {
        await depositNTransactions(
          nf3User1,
          txPerBlock,
          erc20Address,
          tokenType,
          value,
          tokenId,
          fee,
        );
        stateBalance += fee * txPerBlock + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
        for (let i = 0; i < txPerBlock; i++) {
          // eslint-disable-next-line no-await-in-loop
          const res = await nf3User1.transfer(
            false,
            erc20Address,
            tokenType,
            value,
            tokenId,
            nf3User1.zkpKeys.pkd,
            fee,
          );
          expectTransaction(res);
        }
        stateBalance += fee * txPerBlock + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
        balances = await nf3User1.getLayer2Balances();
        const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
        if (afterPkdBalance - beforePkdBalance < txPerBlock * value) {
          console.log(
            `      ${
              (txPerBlock * value - (afterPkdBalance - beforePkdBalance)) / value
            } tx missing for block`,
          );
          await depositNTransactions(
            nf3User1,
            (txPerBlock * value - (afterPkdBalance - beforePkdBalance)) / value,
            erc20Address,
            tokenType,
            value,
            tokenId,
            fee,
          );
          stateBalance +=
            fee * ((txPerBlock * value - (afterPkdBalance - beforePkdBalance)) / value) +
            BLOCK_STAKE;
          eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
        }
      }
    });
  });

  describe('Deposit tests', () => {
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);

    it('should deposit some ERC20 crypto into a ZKP commitment', async function () {
      console.log(`      Sending ${txPerBlock * numDeposits} deposits...`);
      // We create enough transactions to fill numDeposits blocks full of deposits.
      const depositTransactions = await depositNTransactions(
        nf3User1,
        txPerBlock * numDeposits,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += (fee * txPerBlock + BLOCK_STAKE) * numDeposits;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed'], numDeposits);
      const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);
      console.log(`     Average Gas used was ${Math.ceil(totalGas / (txPerBlock * numDeposits))}`);
    });

    it('should deposit some ERC721 crypto into a ZKP commitment', async function () {
      let balances = await nf3User1.getLayer2Balances();
      let balanceBefore = 0;
      try {
        balanceBefore = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
        if (!balanceBefore) balanceBefore = 0;
      } catch {
        balanceBefore = 0;
      }
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 1, fee);
      expectTransaction(res);
      res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 2, fee);
      expectTransaction(res);
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balances = await nf3User1.getLayer2Balances();
      const balanceAfter = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
      expect(balanceAfter - balanceBefore).to.be.equal(2);
    });

    it('should deposit some ERC1155 crypto into a ZKP commitment', async function () {
      const Id1 = 1;
      const Id2 = 4;

      let balances = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      let list = [];
      let balanceBefore = 0;
      let balanceBefore2 = 0;
      try {
        list = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address];
        balanceBefore = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
        balanceBefore2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;
      } catch {
        list = [];
        balanceBefore = 0;
        balanceBefore2 = 0;
      }
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let res = await nf3User1.deposit(erc1155Address, tokenTypeERC1155, value, 1, fee);
      expectTransaction(res);
      res = await nf3User1.deposit(erc1155Address, tokenTypeERC1155, value * 2, 4, fee);
      expectTransaction(res);
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      balances = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      list = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address];

      const balanceAfter = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address].find(
        tkInfo => tkInfo.tokenId === Id1,
      ).balance;
      const balanceAfter2 = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address].find(
        tkInfo => tkInfo.tokenId === Id2,
      ).balance;
      expect(Number(BigInt(balanceAfter) - BigInt(balanceBefore))).to.be.equal(Number(value));
      expect(Number(BigInt(balanceAfter2) - BigInt(balanceBefore2))).to.be.equal(Number(value * 2));
    });
  });

  describe('Balance tests', () => {
    it('should increment the balance after deposit some ERC20 crypto', async function () {
      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
      // We do txPerBlock deposits of 10 each
      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
      expect(afterPkdBalance - currentPkdBalance).to.be.equal(txPerBlock * value);
    });

    it('should increment the balance after deposit some ERC721 crypto', async function () {
      let balances = await nf3User1.getLayer2Balances();
      const currentPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];

      // We create enough transactions to fill numDeposits blocks full of deposits.
      let res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 3, fee);
      expectTransaction(res);
      res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 4, fee);
      expectTransaction(res);
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
      expect(afterPkdBalance - currentPkdBalance).to.be.equal(2);
    });

    it('should increment the balance after deposit some ERC1155 crypto', async function () {
      const Id1 = 1;
      const Id2 = 4;
      let balances = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      let list = [];
      let beforePkdBalance1 = 0;
      let beforePkdBalance2 = 0;
      try {
        list = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address];
        beforePkdBalance1 = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
        beforePkdBalance2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;
      } catch {
        list = [];
        beforePkdBalance1 = 0;
        beforePkdBalance2 = 0;
      }
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let res = await nf3User1.deposit(erc1155Address, tokenTypeERC1155, value, Id1, fee);
      expectTransaction(res);
      res = await nf3User1.deposit(erc1155Address, tokenTypeERC1155, value * 2, Id2, fee);
      expectTransaction(res);
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      balances = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      list = balances[nf3User1.zkpKeys.compressedPkd][erc1155Address];
      const afterPkdBalance1 = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
      const afterPkdBalance2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;

      expect(Number(BigInt(afterPkdBalance1) - BigInt(beforePkdBalance1))).to.be.equal(value);
      expect(Number(BigInt(afterPkdBalance2) - BigInt(beforePkdBalance2))).to.be.equal(value * 2);
    });

    it('should decrement the balance after transfer ERC20 to other wallet and increment the other wallet', async function () {
      let balances = await nf3User1.getLayer2Balances();
      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balances = await nf3User1.getLayer2Balances();
      const currentPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
      let currentPkdBalancePkd2 = 0;
      try {
        currentPkdBalancePkd2 = balances[nf3User2.zkpKeys.compressedPkd][erc20Address];
        if (!currentPkdBalancePkd2) currentPkdBalancePkd2 = 0;
      } catch {
        currentPkdBalancePkd2 = 0;
      }
      // console.log('balances before: ', balances);
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          value,
          tokenId,
          nf3User2.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      // transfer to self address to avoid race conditions issue
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          value,
          tokenId,
          nf3User1.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      await new Promise(resolve => setTimeout(resolve, 10000));
      balances = await nf3User1.getLayer2Balances();
      // console.log('balances after 2 transfers: ', balances);
      const afterPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][erc20Address];
      const afterPkdBalancePkd2 = balances[nf3User2.zkpKeys.compressedPkd][erc20Address];
      expect(afterPkdBalancePkd - currentPkdBalancePkd).to.be.equal(-txPerBlock * value);
      expect(afterPkdBalancePkd2 - currentPkdBalancePkd2).to.be.equal(txPerBlock * value);
    });

    it('should decrement the balance after transfer ERC721 to other wallet and increment the other wallet', async function () {
      let balances = await nf3User1.getLayer2Balances();
      // We create enough transactions to fill block full of deposits.
      let res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 5, fee);
      expectTransaction(res);
      res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 1, 6, fee);
      expectTransaction(res);
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      balances = await nf3User1.getLayer2Balances();
      const beforePkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
      let beforePkdBalance2;
      try {
        beforePkdBalance2 = balances[nf3User2.zkpKeys.compressedPkd][erc721Address];
        if (!beforePkdBalance2) beforePkdBalance2 = 0;
      } catch {
        beforePkdBalance2 = 0;
      }

      res = await nf3User1.transfer(
        false,
        erc721Address,
        tokenTypeERC721,
        1,
        5,
        nf3User2.zkpKeys.pkd,
        fee,
      );
      expectTransaction(res);
      await new Promise(resolve => setTimeout(resolve, 3000));
      res = await nf3User1.transfer(
        false,
        erc721Address,
        tokenTypeERC721,
        1,
        6,
        nf3User2.zkpKeys.pkd,
        fee,
      );
      expectTransaction(res);
      await new Promise(resolve => setTimeout(resolve, 3000));

      stateBalance += fee * 2 + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      // transfer to self address to avoid race conditions issue
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          value,
          tokenId,
          nf3User1.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      await new Promise(resolve => setTimeout(resolve, 10000));
      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalancePkd = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
      const afterPkdBalancePkd2 = balances[nf3User2.zkpKeys.compressedPkd][erc721Address];
      expect(afterPkdBalancePkd - beforePkdBalance).to.be.equal(-2);
      expect(afterPkdBalancePkd2 - beforePkdBalance2).to.be.equal(2);
    });

    it('should decrement the balance after transfer ERC1155 to other wallet and increment the other wallet', async function () {
      const Id1 = 1;

      // We create enough transactions to fill numDeposits blocks full of deposits.
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(erc1155Address, tokenTypeERC1155, value, Id1, fee);
        expectTransaction(res);
      }
      stateBalance += fee * 2 + BLOCK_STAKE;
      // Wait until we see the right number of blocks appear
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      let balancesUser1 = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      let balancesUser2 = await nf3User2.getLayer2BalancesDetails([erc1155Address]);
      let list1 = balancesUser1[nf3User1.zkpKeys.compressedPkd][erc1155Address];
      const beforePkdBalance1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;
      let list2 = [];
      let beforePkdBalance2 = 0;
      try {
        list2 = balancesUser2[nf3User2.zkpKeys.compressedPkd][erc1155Address];
        beforePkdBalance2 = list2.find(tkInfo => tkInfo.tokenId === Id1).balance;
      } catch {
        list2 = [];
        beforePkdBalance2 = 0;
      }

      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc1155Address,
          tokenTypeERC1155,
          value,
          Id1,
          nf3User2.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * 2 + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      // transfer to self address to avoid race conditions issue
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          value,
          tokenId,
          nf3User1.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      await new Promise(resolve => setTimeout(resolve, 10000));
      balancesUser1 = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      balancesUser2 = await nf3User2.getLayer2BalancesDetails([erc1155Address]);
      list1 = balancesUser1[nf3User1.zkpKeys.compressedPkd][erc1155Address];
      list2 = balancesUser2[nf3User2.zkpKeys.compressedPkd][erc1155Address];
      const afterPkdBalancePkd1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;
      const afterPkdBalancePkd2 = list2.find(tkInfo => tkInfo.tokenId === Id1).balance;

      expect(Number(BigInt(afterPkdBalancePkd1) - BigInt(beforePkdBalance1))).to.be.equal(
        -2 * value,
      );
      expect(Number(BigInt(afterPkdBalancePkd2) - BigInt(beforePkdBalance2))).to.be.equal(
        2 * value,
      );
    });
  });

  describe('Get commitments tests', () => {
    it('should get current commitments for the account', async function () {
      const commitments = await nf3User1.getLayer2Commitments();
      expect(commitments[nf3User1.zkpKeys.compressedPkd]).to.have.property(erc20Address);
    });
  });

  // now we have some deposited tokens, we can transfer one of them:
  describe('Single transfer tests', () => {
    it('should transfer some crypto (back to us) using ZKP', async function () {
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          value,
          tokenId,
          nf3User1.zkpKeys.pkd,
          fee,
        );
        expectTransaction(res);
        console.log(`     Gas used was ${Number(res.gasUsed)}`);
      }
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should send a single transfer directly to a proposer - offchain and a receiver different from the sender should successfully receive that transfer', async function () {
      const res = await nf3User1.transfer(
        true,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User2.zkpKeys.pkd,
        fee,
      );
      expect(res).to.be.equal(200);
      stateBalance += fee;
      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });
  });

  describe('Withdraw tests', () => {
    it('should withdraw some ERC20 crypto from a ZKP commitment', async function () {
      const rec = await nf3User1.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
      );
      stateBalance += fee;
      withdrawTransactions.push(nf3User1.getLatestWithdrawHash()); // the new transaction
      expectTransaction(rec);
      console.log(`     Gas used was ${Number(rec.gasUsed)}`);

      await depositNTransactions(
        nf3User1,
        txPerBlock - 1,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    });

    it('should withdraw some ERC721 crypto from a ZKP commitment', async function () {
      let balances = await nf3User1.getLayer2Balances();
      let balanceBefore = 0;
      try {
        balanceBefore = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
        if (!balanceBefore) balanceBefore = 0;
      } catch {
        balanceBefore = 0;
      }
      const rec = await nf3User1.withdraw(
        false,
        erc721Address,
        tokenTypeERC721,
        1,
        3,
        nf3User1.ethereumAddress,
      );
      stateBalance += fee;
      withdrawTransactions.push(nf3User1.getLatestWithdrawHash()); // the new transaction
      expectTransaction(rec);
      console.log(`     Gas used was ${Number(rec.gasUsed)}`);

      await depositNTransactions(
        nf3User1,
        txPerBlock - 1,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balances = await nf3User1.getLayer2Balances();
      const balanceAfter = balances[nf3User1.zkpKeys.compressedPkd][erc721Address];
      expect(balanceAfter - balanceBefore).to.be.equal(-1);
    });

    it('should withdraw some ERC1155 crypto from a ZKP commitment', async function () {
      const Id1 = 1;
      let balancesUser1 = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      let list1 = balancesUser1[nf3User1.zkpKeys.compressedPkd][erc1155Address];
      const beforePkdBalance1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;

      const rec = await nf3User1.withdraw(
        false,
        erc1155Address,
        tokenTypeERC1155,
        value,
        1,
        nf3User1.ethereumAddress,
      );
      stateBalance += fee;
      withdrawTransactions.push(nf3User1.getLatestWithdrawHash()); // the new transaction
      expectTransaction(rec);
      console.log(`     Gas used was ${Number(rec.gasUsed)}`);

      await depositNTransactions(
        nf3User1,
        txPerBlock - 1,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balancesUser1 = await nf3User1.getLayer2BalancesDetails([erc1155Address]);
      list1 = balancesUser1[nf3User1.zkpKeys.compressedPkd][erc1155Address];
      const afterPkdBalance1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;
      expect(afterPkdBalance1 - beforePkdBalance1).to.be.equal(-value);
    });

    it('should allow instant withdraw of existing withdraw', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      let latestWithdrawTransactionHash = ''; // for instant withdrawals
      console.log(`instant withdrawal call`);
      await nf3User1.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
        fee,
      );
      stateBalance += fee;
      latestWithdrawTransactionHash = nf3User1.getLatestWithdrawHash();
      console.log(`latestWithdrawTransactionHash: ${latestWithdrawTransactionHash}`);
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

      const count = logCounts.instantWithdaw;
      // We request the instant withdraw and should wait for the liquidity provider to send the instant withdraw
      const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      stateBalance += fee;
      expectTransaction(res);
      console.log(`     Gas used was ${Number(res.gasUsed)}`);

      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        value,
        tokenId,
        fee,
      );
      stateBalance += fee * txPerBlock + BLOCK_STAKE;
      console.log('     Waiting for blockProposed event...');
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      // we wait for the liquidity provider to send the instant withdraw
      console.log('     Waiting for instantWithdraw event...');
      await waitForTxExecution(count, 'instantWithdraw');
      expect(diffBalanceInstantWithdraw).to.be.equal(value);
    });

    it('should not allow instant withdraw of non existing withdraw or not in block yet', async function () {
      // We create enough transactions to fill numDeposits blocks full of deposits.
      let latestWithdrawTransactionHash = ''; // for instant withdrawals
      await nf3User1.withdraw(
        false,
        erc20Address,
        tokenType,
        value,
        tokenId,
        nf3User1.ethereumAddress,
        fee,
      );
      stateBalance += fee;
      latestWithdrawTransactionHash = nf3User1.getLatestWithdrawHash();
      expect(latestWithdrawTransactionHash).to.be.a('string').and.to.include('0x');

      const res = await nf3User1.requestInstantWithdrawal(latestWithdrawTransactionHash, fee);
      stateBalance += fee + BLOCK_STAKE;
      expect(res).to.be.equal(null);
    });
  });

  describe('Get pending withdraw commitments tests', () => {
    it('should get current pending withdraw commitments for the account', async function () {
      const commitments = await nf3User1.getPendingWithdraws();
      console.log(`commitments: ${JSON.stringify(commitments)}`);
      expect(commitments[nf3User1.zkpKeys.compressedPkd][erc20Address].length).to.be.greaterThan(0);
      initialValidCommitments = commitments[nf3User1.zkpKeys.compressedPkd][erc20Address].filter(
        c => c.valid === true,
      ).length;
    });
  });

  // when the widthdraw transaction is finalised, we want to be able to pull the
  // funds into layer1
  describe('Withdraw funds to layer 1 failing (because insufficient time has passed)', () => {
    it('Should create a failing finalise-withdrawal (because insufficient time has passed)', async function () {
      let error = null;
      try {
        const res = await nf3User1.finaliseWithdrawal(withdrawTransactions[0]);
        stateBalance += fee;
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
          erc20Address,
          tokenType,
          value,
          tokenId,
          fee,
        );
        stateBalance += fee * txPerBlock + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

        const commitments = await nf3User1.getPendingWithdraws();
        expect(commitments[nf3User1.zkpKeys.compressedPkd][erc20Address].length).to.be.greaterThan(
          0,
        );
        expect(
          commitments[nf3User1.zkpKeys.compressedPkd][erc20Address].filter(c => c.valid === true)
            .length,
        ).to.be.greaterThan(initialValidCommitments);
      } else {
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
    });

    it('should create a passing ERC20 finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      startBalance = await getBalance(nf3User1.ethereumAddress);
      if (nodeInfo.includes('TestRPC')) {
        const res = await nf3User1.finaliseWithdrawal(withdrawTransactions[0]);
        stateBalance += fee;
        expectTransaction(res);
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      } else {
        // geth
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
      endBalance = await getBalance(nf3User1.ethereumAddress);
    });

    it('should create a passing ERC721 finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      // startBalance = await getBalance(nf3User1.ethereumAddress);
      if (nodeInfo.includes('TestRPC')) {
        let res = await nf3User1.finaliseWithdrawal(withdrawTransactions[1]);
        stateBalance += fee;
        expectTransaction(res);
        for (let i = 0; i < txPerBlock; i++) {
          // eslint-disable-next-line no-await-in-loop
          res = await nf3User1.transfer(
            false,
            erc20Address,
            tokenType,
            value,
            tokenId,
            nf3User1.zkpKeys.pkd,
            fee,
          );
        }
        stateBalance += 2 * fee + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      } else {
        // geth
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
      // endBalance = await getBalance(nf3User1.ethereumAddress);
    });

    it('should create a passing ERC1155 finalise-withdrawal with a time-jump capable test client (because sufficient time has passed)', async function () {
      // now we need to sign the transaction and send it to the blockchain
      // this will only work if we're using Ganache, otherwiise expect failure
      // startBalance = await getBalance(nf3User1.ethereumAddress);
      if (nodeInfo.includes('TestRPC')) {
        let res = await nf3User1.finaliseWithdrawal(withdrawTransactions[2]);
        stateBalance += fee;
        expectTransaction(res);
        for (let i = 0; i < txPerBlock; i++) {
          // eslint-disable-next-line no-await-in-loop
          res = await nf3User1.transfer(
            false,
            erc20Address,
            tokenType,
            value,
            tokenId,
            nf3User1.zkpKeys.pkd,
            fee,
          );
        }
        stateBalance += 2 * fee + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      } else {
        // geth
        console.log('     Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
      // endBalance = await getBalance(nf3User1.ethereumAddress);
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

  describe('Check all balances in contracts', () => {
    it('Should be zero for shield and proposer and non-zero for state', async () => {
      const shieldContractBalance = await getBalance(nf3User1.shieldContractAddress);
      const stateContractBalance = await getBalance(nf3User1.stateContractAddress);
      const proposerContractBalance = await getBalance(nf3User1.proposersContractAddress);
      expect(Number(shieldContractBalance)).to.be.eq(0);
      expect(Number(proposerContractBalance)).to.be.eq(0);
      expect(Number(stateContractBalance)).to.be.gte(stateBalance);
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
