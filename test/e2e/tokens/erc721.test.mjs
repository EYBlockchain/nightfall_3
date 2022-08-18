/* eslint-disable no-await-in-loop */

import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import config from 'config';
import Nf3 from '../../../cli/lib/nf3.mjs';
import { expectTransaction, Web3Client } from '../../utils.mjs';
import logger from '../../../common-files/utils/logger.mjs';
import { getERCInfo } from '../../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  txPerBlock,
  transferValue,
  tokenConfigs: { tokenTypeERC721, tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3Users = [new Nf3(signingKeys.user1, environment), new Nf3(signingKeys.user2, environment)];
const nf3Proposer1 = new Nf3(signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc721Address;
// why do we need an ERC20 token in an ERC721 test, you ask?
// let me tell you I also don't know, but I guess we just want to fill some blocks?
let erc20Address;
let stateAddress;
const eventLogs = [];
let availableTokenIds;

/*
  This function tries to zero the number of unprocessed transactions in the optimist node
  that nf3 is connected to. We call it extensively on the tests, as we want to query stuff from the
  L2 layer, which is dependent on a block being made. We also need 0 unprocessed transactions by the end
  of the tests, otherwise the optimist will become out of sync with the L2 block count on-chain.
*/
const emptyL2 = async () => {
  let count = await nf3Users[0].unprocessedTransactionCount();

  while (count !== 0) {
    await nf3Users[0].makeBlockNow();
    await web3Client.waitForEvent(eventLogs, ['blockProposed']);
    count = await nf3Users[0].unprocessedTransactionCount();
  }

  await nf3Users[0].makeBlockNow();
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
};

describe('ERC721 tests', function () {
  before(async function () {
    if (process.env.ENVIRONMENT === 'aws') this.skip();
  });

  describe('', async function () {
    before(async function () {
      if (process.env.ENVIRONMENT === 'aws') this.skip();
      await nf3Proposer1.init(mnemonics.proposer);
      await nf3Proposer1.registerProposer();

      // Proposer listening for incoming events
      const newGasBlockEmitter = await nf3Proposer1.startProposer();
      newGasBlockEmitter.on('gascost', async gasUsed => {
        logger.debug(
          `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
            gasUsed / txPerBlock
          }`,
        );
      });

      await nf3Users[0].init(mnemonics.user1);
      await nf3Users[1].init(mnemonics.user2);
      erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
      erc721Address = await nf3Users[0].getContractAddress('ERC721Mock');

      stateAddress = await nf3Users[0].stateContractAddress;
      web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

      availableTokenIds = (
        await getERCInfo(erc721Address, nf3Users[0].ethereumAddress, web3Client.getWeb3(), {
          details: true,
        })
      ).details.map(t => t.tokenId);

      for (let i = 0; i < txPerBlock * 2; i++) {
        await nf3Users[0].deposit(
          erc721Address,
          tokenTypeERC721,
          0,
          availableTokenIds.shift(),
          fee,
        );
      }
      eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      await emptyL2(nf3Users[0]);
    });

    afterEach(async () => {
      await emptyL2(nf3Users[0]);
    });

    describe('Deposit', () => {
      it('should deposit some ERC721 crypto into a ZKP commitment', async function () {
        let balances = await nf3Users[0].getLayer2Balances();
        const balanceBefore = balances[erc721Address]?.length || 0;
        // We create enough transactions to fill blocks full of deposits.
        let res = await nf3Users[0].deposit(
          erc721Address,
          tokenTypeERC721,
          0,
          availableTokenIds.shift(),
          fee,
        );
        expectTransaction(res);
        res = await nf3Users[0].deposit(
          erc721Address,
          tokenTypeERC721,
          0,
          availableTokenIds.shift(),
          fee,
        );
        expectTransaction(res);
        // Wait until we see the right number of blocks appear
        eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
        await emptyL2(nf3Users[0]);
        balances = await nf3Users[0].getLayer2Balances();
        const balanceAfter = balances[erc721Address].length;
        expect(balanceAfter - balanceBefore).to.be.equal(2);
      });
    });

    describe('Transfer', () => {
      it('should decrement the balance after transfer ERC721 to other wallet and increment the other wallet', async function () {
        let balances;
        async function getBalances() {
          balances = [
            (await nf3Users[0].getLayer2Balances())[erc721Address],
            (await nf3Users[1].getLayer2Balances())[erc721Address],
          ];
        }

        await getBalances();
        // weird way to clone an array, but we need a deep clone as it's a multidimensional array
        const beforeBalances = JSON.parse(JSON.stringify(balances));

        for (let i = 0; i < txPerBlock; i++) {
          const res = await nf3Users[0].transfer(
            false,
            erc721Address,
            tokenTypeERC721,
            0,
            balances[0].shift().tokenId,
            nf3Users[1].zkpKeys.compressedZkpPublicKey,
            fee,
          );
          expectTransaction(res);
        }
        eventLogs = await web3Client.waitForEvent(eventLogs, ['blockProposed']);
        // await new Promise(resolve => setTimeout(resolve, 3000));

        // depositing some ERC20 transactions to fill the block
        await emptyL2(nf3Users[0]);

        await getBalances();
        expect((balances[0]?.length || 0) - (beforeBalances[0]?.length || 0)).to.be.equal(-2);
        expect((balances[1]?.length || 0) - (beforeBalances[1]?.length || 0)).to.be.equal(2);
      });
    });

    describe('Withdraw', () => {
      it('should withdraw from L2, checking for missing commitment', async function () {
        const erc721balances = (await nf3Users[0].getLayer2Balances())[erc721Address];
        const beforeBalance = erc721balances.length;
        const tokenToWithdraw = erc721balances.shift().tokenId;

        const rec = await nf3Users[0].withdraw(
          false,
          erc721Address,
          tokenTypeERC721,
          0,
          tokenToWithdraw,
          nf3Users[0].ethereumAddress,
          fee,
        );
        expectTransaction(rec);
<<<<<<< HEAD
        await emptyL2();
=======
        logger.debug(`     Gas used was ${Number(rec.gasUsed)}`);
>>>>>>> 936600ff (wip)

        const withdrawal = nf3Users[0].getLatestWithdrawHash();

        const balancesAfter = await nf3Users[0].getLayer2Balances();

        const balanceAfter = (await nf3Users[0].getLayer2Balances())[erc721Address].length;
        expect(balanceAfter).to.be.lessThan(beforeBalance);
      });

      it('should withdraw from L2, checking for L1 balance (only with time-jump client)', async function () {
        const nodeInfo = await web3Client.getInfo();
        if (nodeInfo.includes('TestRPC')) {
          let erc721balances = (await nf3Users[0].getLayer2Balances())[erc721Address];
          const beforeBalance = erc721balances.length;
          const tokenToWithdraw = erc721balances.shift().tokenId;

<<<<<<< HEAD
        const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
        expectTransaction(res);

        expect(
          (balancesAfter[erc721Address]?.length || 0) -
            (balancesBefore[erc721Address]?.length || 0),
        ).to.be.equal(-1);
        expect(
          (balancesAfter[erc20Address]?.[0].balance || 0) -
            (balancesBefore[erc20Address]?.[0].balance || 0),
        ).to.be.equal(-fee);
      } else {
        console.log('Not using a time-jump capable test client so this test is skipped');
        this.skip();
      }
=======
          const rec = await nf3Users[0].withdraw(
            false,
            erc721Address,
            tokenTypeERC721,
            0,
            tokenToWithdraw,
            nf3Users[0].ethereumAddress,
          );
          expectTransaction(rec);
          const withdrawal = await nf3Users[0].getLatestWithdrawHash();

          await emptyL2(nf3Users[0]);

          await web3Client.timeJump(3600 * 24 * 10); // jump in time by 10 days

          const commitments = await nf3Users[0].getPendingWithdraws();
          expect(
            commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc721Address].length,
          ).to.be.greaterThan(0);
          expect(
            commitments[nf3Users[0].zkpKeys.compressedZkpPublicKey][erc721Address].filter(
              c => c.valid === true,
            ).length,
          ).to.be.greaterThan(0);

          await new Promise(resolve => setTimeout(resolve, 15000));

          const res = await nf3Users[0].finaliseWithdrawal(withdrawal);
          expectTransaction(res);

          erc721balances = (await nf3Users[0].getLayer2Balances())[erc721Address];
          const endBalance = erc721balances.length;
          expect(parseInt(endBalance, 10)).to.be.lessThan(parseInt(beforeBalance, 10));
        } else {
          console.log('     Not using a time-jump capable test client so this test is skipped');
          this.skip();
        }
      });
    });

    after(async function () {
      await nf3Proposer1.deregisterProposer();
      await nf3Proposer1.close();
      await nf3Users[0].close();
      await nf3Users[1].close();
      await web3Client.closeWeb3();
>>>>>>> 936600ff (wip)
    });
  });
});
