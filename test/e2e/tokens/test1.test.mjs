/* eslint-disable no-await-in-loop */
import chai from 'chai';
import gen from 'general-number';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';
// import { randValueLT } from '@polygon-nightfall/common-files/utils/crypto/crypto-random.mjs';
import Nf3 from '../../../cli/lib/nf3.mjs';
import {
  //   depositNTransactions,
  getLayer2Balances,
  expectTransaction,
  //   waitForSufficientBalance,
  //   waitForSufficientTransactionsMempool,
  Web3Client,
  getUserCommitments,
} from '../../utils.mjs';
// import { approve } from '../../../cli/lib/tokens.mjs';
// import constants from '../../../common-files/constants/index.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { generalise } = gen;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  fee,
  transferValue,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
  //   restrictions: { erc20default },
} = config.TEST_OPTIONS;
// const {
//   RESTRICTIONS: {
//     tokens: { blockchain: maxWithdrawValue },
//   },
// } = config;

// const { BN128_GROUP_ORDER } = constants;

const web3Client = new Web3Client();
// const web3 = web3Client.getWeb3();
const eventLogs = [];
// const logs = {
//   instantWithdraw: 0,
// };
let rollbackCount = 0;

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3User2 = new Nf3(signingKeys.user2, environment);
const nf3UserSanctioned = new Nf3(signingKeys.sanctionedUser, environment);

const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

async function makeBlock() {
  logger.debug(`Make block...`);
  await nf3Proposer.makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

describe('ERC20 tests', () => {
  let erc20Address;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);
    await nf3UserSanctioned.init(mnemonics.sanctionedUser);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer('http://optimist', await nf3Proposer.getMinimumStake());

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer.startProposer();
    newGasBlockEmitter.on('rollback', () => {
      rollbackCount += 1;
      logger.debug(
        `Proposer received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
      );
    });

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Deposits', () => {
    it('Should increment user L2 balance after depositing some ERC20', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const res = await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue - fee);
    });

    // it('Should fail to deposit if the user is sanctioned', async function () {
    //   try {
    //     await nf3UserSanctioned.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    //     expect.fail('Throw error, deposit did not fail');
    //   } catch (err) {
    //     expect(err.message).to.include('Transaction has been reverted by the EVM');
    //   }
    // });

    // it('Should fail to send a deposit if commitment is already on chain', async function () {
    //   const salt = (await randValueLT(BN128_GROUP_ORDER)).hex();
    //   await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee, [], salt);
    //   await makeBlock();
    //   try {
    //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee, [], salt);
    //     expect.fail('Throw error, deposit did not fail');
    //   } catch (err) {
    //     expect(err.message).to.include('You can not re-send a commitment that is already on-chain');
    //   }
    // });

    // it('Should fail to send a deposit if fee is higher or equal than the value', async function () {
    //   try {
    //     await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, transferValue);
    //     expect.fail('Throw error, deposit did not fail');
    //   } catch (err) {
    //     expect(err.message).to.include('Value deposited needs to be greater than the fee');
    //   }
    // });
  });

  describe('Transfers', () => {
    // beforeEach(async () => {
    //   await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
    //   await makeBlock();
    // });

    it('Should decrement user L2 balance after transferring some ERC20 to other wallet, and increment the other wallet balance', async function () {
      // const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
      // const user2L2BalanceBefore = await getLayer2Balances(nf3User2, erc20Address);

      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      await makeBlock();
      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      logger.info(`---userCommitments- 1-- ${JSON.stringify(userCommitments)}`);

      const res = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        fee,
      );
      expectTransaction(res);
      logger.debug(`Gas used was ${Number(res.gasUsed)}`);
      await makeBlock();

      // const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      // const user2L2BalanceAfter = await getLayer2Balances(nf3User2, erc20Address);
      // expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-(transferValue + fee));
      // expect(user2L2BalanceAfter - user2L2BalanceBefore).to.be.equal(transferValue);
    });

    // it('Should be able to self-transfer some ERC20, and final balance stay the same minus the fee', async function () {
    //   const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

    //   const res = await nf3User.transfer(
    //     false,
    //     erc20Address,
    //     tokenType,
    //     transferValue,
    //     tokenId,
    //     nf3User.zkpKeys.compressedZkpPublicKey,
    //     fee,
    //   );
    //   expectTransaction(res);
    //   logger.debug(`Gas used was ${Number(res.gasUsed)}`);
    //   await makeBlock();

    //   const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
    //   expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-fee);
    // });

    // it('should perform a transfer by specifying the commitment that provides enough value to cover value + fee', async function () {
    //   const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

    //   const userCommitments = await getUserCommitments(
    //     environment.clientApiUrl,
    //     nf3User.zkpKeys.compressedZkpPublicKey,
    //   );

    //   const erc20Commitments = userCommitments
    //     .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
    //     .sort((a, b) => Number(generalise(a.value).bigInt - generalise(b.value).bigInt));

    //   const usedCommitments = [];
    //   let totalValue = 0;
    //   let i = 0;

    //   while (totalValue < transferValue + fee && i < erc20Commitments.length) {
    //     usedCommitments.push(erc20Commitments[i].commitmentHash);
    //     totalValue += Number(generalise(erc20Commitments[i].value).bigInt);
    //     ++i;
    //   }

    //   const res = await nf3User.transfer(
    //     false,
    //     erc20Address,
    //     tokenType,
    //     transferValue,
    //     tokenId,
    //     nf3User.zkpKeys.compressedZkpPublicKey,
    //     fee,
    //     usedCommitments,
    //   );
    //   expectTransaction(res);
    //   await makeBlock();

    //   const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
    //   expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-fee);
    // });

    it('should perform a transfer by specifying the commitment that provides enough value to cover value', async function () {
      const userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);

      const userCommitments = await getUserCommitments(
        environment.clientApiUrl,
        nf3User.zkpKeys.compressedZkpPublicKey,
      );

      logger.info(`---userCommitments- 2-- ${JSON.stringify(userCommitments)}`);

      const erc20Commitments = userCommitments
        .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
        .sort((a, b) => Number(generalise(a.value).bigInt - generalise(b.value).bigInt));

      logger.info(`---erc20Commitments--- ${JSON.stringify(erc20Commitments)}`);

      const usedCommitments = [];
      let totalValue = 0;
      let i = 0;

      while (totalValue < transferValue && i < erc20Commitments.length) {
        usedCommitments.push(erc20Commitments[i].commitmentHash);
        totalValue += Number(generalise(erc20Commitments[i].value).bigInt);
        ++i;
      }

      logger.info(`---usedCommitments--- ${JSON.stringify(usedCommitments)}`);

      const res = await nf3User.transfer(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3User.zkpKeys.compressedZkpPublicKey,
        fee,
        usedCommitments,
      );
      expectTransaction(res);
      await makeBlock();

      const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-fee);
    });

    // it('should perform a transfer by specifying the commitment that provides enough value to cover value + fee', async function () {
    //   const userCommitments = await getUserCommitments(
    //     environment.clientApiUrl,
    //     nf3User.zkpKeys.compressedZkpPublicKey,
    //   );

    //   const erc20Commitments = userCommitments
    //     .filter(c => c.ercAddress === generalise(erc20Address).hex(32))
    //     .sort((a, b) => Number(generalise(a.value).bigInt - generalise(b.value).bigInt));

    //   const usedCommitments = [];
    //   let totalValue = 0;
    //   let i = 0;

    //   while (totalValue < transferValue && i < erc20Commitments.length) {
    //     usedCommitments.push(erc20Commitments[i].commitmentHash);
    //     totalValue += Number(generalise(erc20Commitments[i].value).bigInt);
    //     ++i;
    //   }

    //   try {
    //     await nf3User.transfer(
    //       false,
    //       erc20Address,
    //       tokenType,
    //       totalValue + 1,
    //       tokenId,
    //       nf3User.zkpKeys.compressedZkpPublicKey,
    //       fee,
    //       usedCommitments,
    //     );
    //   } catch (err) {
    //     expect(err.message).to.be.equal('provided commitments do not cover the value');
    //   }
    // });
  });

  //   describe('Withdrawals', () => {
  //     let userL2BalanceBefore;
  //     let withdrawalTx;
  //     let withdrawalTxHash;

  //     before(async function () {
  //       await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //       await makeBlock();

  //       userL2BalanceBefore = await getLayer2Balances(nf3User, erc20Address);
  //       withdrawalTx = await nf3User.withdraw(
  //         false,
  //         erc20Address,
  //         tokenType,
  //         transferValue / 2,
  //         tokenId,
  //         nf3User.ethereumAddress,
  //         fee,
  //       );
  //       withdrawalTxHash = nf3User.getLatestWithdrawHash();
  //     });

  //     it('Should withdraw from L2', async function () {
  //       expectTransaction(withdrawalTx);
  //       logger.debug(`Gas used was ${Number(withdrawalTx.gasUsed)}`);
  //       await makeBlock();

  //       const userL2BalanceAfter = await getLayer2Balances(nf3User, erc20Address);
  //       expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(-(transferValue / 2 + fee));
  //     });

  //     it('Should fail at finalising previous withdrawal because it is too soon', async function () {
  //       try {
  //         await nf3User.finaliseWithdrawal(withdrawalTxHash);
  //         expect.fail('Throw error, finalising withdrawal did not fail');
  //       } catch (err) {
  //         expect(err.message).to.include('Transaction has been reverted by the EVM');
  //       }
  //     });

  //     it('Should finalise previous withdrawal from L2 to L1 (only with time-jump client)', async function () {
  //       const nodeInfo = await web3Client.getInfo();
  //       if (!nodeInfo.includes('TestRPC')) {
  //         logger.info('Not using a time-jump capable test client so this test is skipped');
  //         this.skip();
  //       }

  //       const userL1BalanceBefore = await web3Client.getBalance(nf3User.ethereumAddress);

  //       await web3Client.timeJump(3600 * 24 * 10);
  //       const commitments = await nf3User.getPendingWithdraws();
  //       expect(
  //         commitments[nf3User.zkpKeys.compressedZkpPublicKey][erc20Address].length,
  //       ).to.be.greaterThan(0);
  //       expect(
  //         commitments[nf3User.zkpKeys.compressedZkpPublicKey][erc20Address].filter(
  //           c => c.valid === true,
  //         ).length,
  //       ).to.be.greaterThan(0);
  //       const res = await nf3User.finaliseWithdrawal(withdrawalTxHash);
  //       expectTransaction(res);
  //       logger.debug(`Gas used was ${Number(res.gasUsed)}`);

  //       const userL1BalanceAfter = await web3Client.getBalance(nf3User.ethereumAddress);
  //       // Final L1 balance to be lesser than initial balance because of fees
  //       expect(parseInt(userL1BalanceAfter, 10)).to.be.lessThan(parseInt(userL1BalanceBefore, 10));
  //     });
  //   });

  //   describe('Instant withdrawals', () => {
  //     const nf3LiquidityProvider = new Nf3(signingKeys.liquidityProvider, environment);
  //     let withdrawalTxHash;

  //     before(async () => {
  //       await nf3LiquidityProvider.init(mnemonics.liquidityProvider);

  //       const txDataToSign = await approve(
  //         erc20Address,
  //         nf3LiquidityProvider.ethereumAddress,
  //         nf3LiquidityProvider.shieldContractAddress,
  //         tokenType,
  //         Math.floor(transferValue / 2),
  //         web3,
  //         !!nf3LiquidityProvider.ethereumSigningKey,
  //       );
  //       if (txDataToSign) {
  //         await nf3LiquidityProvider.submitTransaction(txDataToSign, erc20Address, 0);
  //       }

  //       await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
  //       await makeBlock();

  //       await nf3User.withdraw(
  //         false,
  //         erc20Address,
  //         tokenType,
  //         Math.floor(transferValue / 2),
  //         tokenId,
  //         nf3User.ethereumAddress,
  //         fee,
  //       );
  //       withdrawalTxHash = nf3User.getLatestWithdrawHash();

  //       // Liquidity provider for instant withdraws
  //       const emitter = await nf3User.getInstantWithdrawalRequestedEmitter();
  //       emitter.on('data', async withdrawTransactionHash => {
  //         // approve tokens to be advanced by liquidity provider in the instant withdraw
  //         try {
  //           await nf3LiquidityProvider.advanceInstantWithdrawal(withdrawTransactionHash);
  //         } catch (e) {
  //           console.log('ERROR Liquidity Provider');
  //         }

  //         logs.instantWithdraw += 1;
  //       });

  //       web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  //     });

  //     it('Should not allow instant withdrawal because withdrawal is not in block yet', async function () {
  //       const res = await nf3User.requestInstantWithdrawal(withdrawalTxHash, fee);
  //       expect(res).to.be.equal(null);
  //     });

  //     it('Should allow instant withdraw of existing withdraw', async function () {
  //       const userL1BalanceBefore = await web3Client.getBalance(nf3User.ethereumAddress);

  //       await makeBlock();

  //       const res = await nf3User.requestInstantWithdrawal(withdrawalTxHash, fee);
  //       expectTransaction(res);
  //       logger.debug(`Gas used was ${Number(res.gasUsed)}`);

  //       const userL1BalanceAfter = await web3Client.getBalance(nf3User.ethereumAddress);
  //       // Final L1 balance to be lesser than initial balance because of fees
  //       expect(parseInt(userL1BalanceAfter, 10)).to.be.lessThan(parseInt(userL1BalanceBefore, 10));
  //     });

  //     after(async () => {
  //       nf3LiquidityProvider.close();
  //     });
  //   });

  /*
    What is this, you wonder? We're just testing restrictions, since for an initial release phase
    we want to restrict the amount of deposits/withdraws. Take a look at #516 if you want to know more
    */
  //   describe('Deposit and withdrawal restrictions', () => {
  //     const maxERC20WithdrawValue =
  //       maxWithdrawValue.find(e => e.address.toLowerCase() === erc20Address)?.amount || erc20default;
  //     console.log('************************maxERC20WithdrawValue', maxERC20WithdrawValue);
  //     const maxERC20DepositValue = Math.floor(maxERC20WithdrawValue / 4);
  //     console.log('************************maxERC20DepositValue', maxERC20DepositValue);

  //     it('Should restrict deposits', async () => {
  //       // Anything equal or above the restricted amount should fail
  //       try {
  //         await nf3User.deposit(erc20Address, tokenType, maxERC20DepositValue + 1, tokenId, fee);
  //         expect.fail('Throw error, deposit not restricted');
  //       } catch (err) {
  //         expect(err.message).to.include('Transaction has been reverted by the EVM');
  //       }
  //     });

  //     // We need to withdraw more than the max withdraw limit, but we can't deposit
  //     // more than the max withdraw limit because deposit's limit is 1/4 that of withdraw
  //     // limit (floor of 1/4th). So we perform 6 deposits of the max deposit value, accumulate them into
  //     // one commitment with multiple transfers. Then perform withdraw with this huge commitment which
  //     // will be bigger than withdraw limit. Transfers to accumulate are done in such that they can
  //     // accumulate this final value

  //     // Transfer which gives a change of 0 is not possible because these commitments won't be picked
  //     // and transfer errors with no suitable commitments. Example, this is not possible
  //     //                                                                          Commitment List Before [250, 250, 250, 250, 250, 250]
  //     // Transfer 500 to self             Input [250, 250]   Output [500, 0]      Commitment List after [0, 250, 250, 250, 250, 500]

  //     // Example for accumulating withdraw
  //     // Max Withdraw Limit : 1000                                                 Max Deposit Limit 1000/4 = 250
  //     // Need a commitment with value greater than 1000
  //     // Deposit 250 6 times                                                      Commitment List [250, 250, 250, 250, 250, 250]
  //     // Transfer 400 to self             Input [250, 250]   Output [400, 100]    Commitment List after [100, 250, 250, 250, 250, 400]
  //     // Transfer 400 + 200 to self       Input [400, 250]   Output [600, 50]     Commitment List after [50, 100, 250, 250, 250, 600]
  //     // Transfer 600 + 200 to self       Input [600, 250]   Output [800, 50]     Commitment List after [50, 50, 100, 250, 250, 800]
  //     // Transfer 800 + 200 to self       Input [800, 250]   Output [800, 50]     Commitment List after [50, 50, 50, 100, 250, 1000]
  //     // Transfer 1000 + 200 to self      Input [1000, 250]  Output [1200, 50]    Commitment List after [50, 50, 50, 50, 100, 1200]
  //     it('Should restrict withdrawals', async function () {
  //       const nodeInfo = await web3Client.getInfo();
  //       if (!nodeInfo.includes('TestRPC')) {
  //         logger.info('Not using a time-jump capable test client so this test is skipped');
  //         this.skip();
  //       }

  //       try {
  //         const trnsferValue = Math.floor(maxERC20WithdrawValue / 5); // maxERC20DepositValue < trnsferValue < maxERC20WithdrawValue
  //         const withdrawValue = trnsferValue * 6; // trnsferValue = ( maxERC20WithdrawValue / 5 ) * 6 > maxERC20WithdrawValue

  //         await depositNTransactions(
  //           nf3User,
  //           6, // at least 6 deposits of max deposit value, put together it is bigger than max withdraw value
  //           erc20Address,
  //           tokenType,
  //           maxERC20DepositValue,
  //           tokenId,
  //           0,
  //         );

  //         await waitForSufficientTransactionsMempool({
  //           optimistBaseUrl: environment.optimistApiUrl,
  //           nTransactions: 6,
  //         });

  //         await nf3Proposer.makeBlockNow();
  //         await waitForSufficientBalance({
  //           nf3User,
  //           value: 6 * maxERC20DepositValue,
  //           ercAddress: erc20Address,
  //         });

  //         await nf3User.transfer(
  //           false,
  //           erc20Address,
  //           tokenType,
  //           trnsferValue * 4,
  //           tokenId,
  //           nf3User.zkpKeys.compressedZkpPublicKey,
  //           0,
  //         );

  //         await nf3Proposer.makeBlockNow();

  //         await waitForSufficientBalance({
  //           nf3User,
  //           value: 6 * maxERC20DepositValue,
  //           ercAddress: erc20Address,
  //         });

  //         const rec = await nf3User.withdraw(
  //           false,
  //           erc20Address,
  //           tokenType,
  //           withdrawValue,
  //           tokenId,
  //           nf3User.ethereumAddress,
  //           0,
  //         );

  //         await nf3Proposer.makeBlockNow();
  //         await web3Client.waitForEvent(eventLogs, ['blockProposed']);

  //         await new Promise(resolve => setTimeout(resolve, 30000));

  //         expectTransaction(rec);

  //         const withdrawalTxHash = nf3User.getLatestWithdrawHash();
  //         await web3Client.timeJump(3600 * 24 * 10);
  //         // anything equal or above the restricted amount should fail
  //         await nf3User.finaliseWithdrawal(withdrawalTxHash);

  //         expect.fail('Throw error, withdrawal not restricted');
  //       } catch (err) {
  //         expect(err.message).to.include('Transaction has been reverted by the EVM');
  //       }
  //     });
  //   });

  describe('Rollback checks', () => {
    it('test should encounter zero rollbacks', function () {
      expect(rollbackCount).to.be.equal(0);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    await nf3User2.close();
    await nf3UserSanctioned.close();
    web3Client.closeWeb3();
  });
});
