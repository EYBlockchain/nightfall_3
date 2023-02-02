/* This adversary test relies on the bad block and bad tranasction types as defined in
 * test/adversary/adversary-code/database.mjs and test/adversary/adversary-code/block.mjs
 * files. Later this test will work against random selection of bad block and bad
 * tranasction types
 */

/* eslint-disable no-await-in-loop */
import axios from 'axios';
import chai, { expect } from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import gen from 'general-number';
import logger from '@polygon-nightfall/common-files/utils/logger.mjs';

// instead of our usual cli we need to import
// adversary transpiled version of cli.
// please do not forget to run `npm run build-adversary`
// eslint-disable-next-line import/no-unresolved
import Nf3 from './adversary/adversary-cli/lib/nf3.mjs';

import {
  clearMempool,
  getLayer2Balances,
  registerProposerOnNoProposer,
  waitForSufficientTransactionsMempool,
  Web3Client,
} from './utils.mjs';
import { getERCInfo } from '../cli/lib/tokens.mjs';

chai.use(chaiHttp);
chai.use(chaiAsPromised);

const { generalise } = gen;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  signingKeys,
  mnemonics,
  tokenConfigs: { tokenTypeERC1155, tokenType, tokenId },
  transferValue,
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const web3 = web3Client.getWeb3();
const eventLogs = [];

const challengeSelectors = {
  challengeRoot: '0x25009307',
  challengeCommitment: '0x1c80a5a5',
  challengeHistoricRoot: '0xf0b86f27',
  challengeLeafCount: '0xb8424d42',
  challengeFrontier: '0x60f611d5',
  challengeNullifier: '0xda5370ca',
  challengeProofVerification: '0xa72b8d98',
};

const {
  optimistApiUrl,
  optimistWsUrl,
  adversarialOptimistApiUrl,
  adversarialOptimistWsUrl,
  adversarialClientApiUrl,
  adversarialClientWsUrl,
  ...others
} = environment;

const nf3User = new Nf3(signingKeys.user1, {
  ...others,
  clientApiUrl: adversarialClientApiUrl,
  clientWsUrl: adversarialClientWsUrl,
});
const nf3User2 = new Nf3(signingKeys.user2, environment);

const nf3AdversarialProposer = new Nf3(signingKeys.proposer1, {
  ...others,
  optimistApiUrl: adversarialOptimistApiUrl,
  optimistWsUrl: adversarialOptimistWsUrl,
});

const nf3Challenger = new Nf3(signingKeys.challenger, environment);

async function makeBlock(badBlockType) {
  logger.debug(`Make block...`);
  if (badBlockType) {
    await axios.post(`${adversarialOptimistApiUrl}/block/make-now/${badBlockType}`);
  } else {
    await axios.post(`${adversarialOptimistApiUrl}/block/make-now`);
  }
  await web3Client.waitForEvent(eventLogs, ['blockProposed']);
}

async function getLayer2BalancesBadClient(ercAddress) {
  const res = await axios.get(`${adversarialClientApiUrl}/commitment/balance`, {
    params: {
      compressedZkpPublicKey: nf3User.zkpKeys.compressedZkpPublicKey,
    },
  });
  return res.data.balance[ercAddress]?.[0].balance || 0;
}

async function enableChallenger(enable) {
  await axios.post(`${optimistApiUrl}/challenger/enable`, { enable });
}

async function getLayer2Erc1155Balance(_nf3User, erc1155Address, _tokenId) {
  return (
    (await _nf3User.getLayer2Balances())[erc1155Address]?.find(
      e => e.tokenId === generalise(_tokenId).hex(32),
    )?.balance || 0
  );
}

describe('Testing with an adversary', () => {
  let blockProposeEmitter;
  let challengeEmitter;
  let erc20Address;
  let erc1155Address;
  let stateAddress;
  let intervalId;
  let availableTokenIds;

  let rollbackCount = 0;
  let currentRollbacks = 0;
  let challengeSelector;

  const waitForRollback = async () => {
    console.log('Waiting for rollback...');
    while (rollbackCount !== currentRollbacks + 1) {
      console.log(
        'Rollback count: ',
        rollbackCount,
        ' - ',
        'Expected number of rollbacks: ',
        currentRollbacks + 1,
      );
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log('Rollback completed');
  };

  before(async () => {
    console.log('ENV:\n', environment);

    await nf3User.init(mnemonics.user1);
    await nf3User2.init(mnemonics.user2);
    await nf3AdversarialProposer.init(mnemonics.proposer);
    await nf3Challenger.init(mnemonics.challenger);

    if (!(await nf3User.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3User2.healthcheck('client'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');
    if (!(await nf3Challenger.healthcheck('optimist'))) throw new Error('Healthcheck failed');

    // Proposer registration
    await nf3AdversarialProposer.registerProposer(
      'http://optimist',
      await nf3AdversarialProposer.getMinimumStake(),
    );

    // Proposer listening for incoming events
    blockProposeEmitter = await nf3AdversarialProposer.startProposer();
    blockProposeEmitter
      .on('receipt', (receipt, block) => {
        logger.debug(
          `L2 Block with L2 block number ${block.blockNumberL2} was proposed. The L1 transaction hash is ${receipt.transactionHash}`,
        );
      })
      .on('submit-transaction-receipt', (receipt, transactions) => {
        logger.debug(
          `bad transaction submitted, transactionHash is ${transactions[0].transactionHash}`,
        );
      })
      .on('error', (error, block) => {
        logger.error(
          `Proposing L2 Block with L2 block number ${block.blockNumberL2} failed due to error: ${error} `,
        );
      });
    // Because rollbacks removes the only registered proposer,
    // the proposer is registered again after each removal
    intervalId = setInterval(() => {
      registerProposerOnNoProposer(nf3AdversarialProposer);
    }, 5000);

    // Chalenger listening for incoming events
    challengeEmitter = await nf3Challenger.startChallenger();
    challengeEmitter
      .on('receipt', (receipt, type, txSelector) => {
        logger.debug(
          `Challenge of type ${type} has been submitted to the blockchain. The L1 transaction hash is ${receipt.transactionHash}`,
        );
        challengeSelector = txSelector;
      })
      .on('error', (error, type, txSelector) => {
        logger.error(
          `Challenge transaction to the blochain of type ${type} failed due to error: ${error} `,
        );
        challengeSelector = txSelector;
      })
      .on('rollback', () => {
        rollbackCount += 1;
        logger.debug(
          `Challenger received a signalRollback complete, Now no. of rollbacks are ${rollbackCount}`,
        );
      });

    // retrieve initial balance
    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    erc1155Address = await nf3User.getContractAddress('ERC1155Mock');
    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    availableTokenIds = (
      await getERCInfo(erc1155Address, nf3User.ethereumAddress, web3, {
        details: true,
      })
    ).details.map(t => t.tokenId);
  });

  beforeEach(async () => {
    currentRollbacks = rollbackCount;
  });

  describe('Testing block zero challenges', async () => {
    before(async () => {
      await nf3User.deposit('ValidTransaction', erc20Address, tokenType, transferValue, tokenId, 0);
    });

    it('Challenging block zero for having an invalid leaf count', async () => {
      console.log('Testing incorrect leaf count in block zero...');
      await makeBlock('IncorrectLeafCount');
      await waitForRollback();
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeLeafCount);
    });

    it('Challenging block zero for having an invalid frontier hash', async () => {
      console.log('Testing incorrect frontier hash in block zero...');
      await makeBlock('IncorrectFrontierHash');
      await waitForRollback();
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeFrontier);
    });

    after(async () => {
      await clearMempool({
        optimistUrl: adversarialOptimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });
  });

  describe('Testing optimist deep rollbacks', () => {
    let userL2BalanceBefore;
    let user2L2BalanceBefore;
    let user2L2Erc1155BalanceBefore;

    before(async () => {
      await enableChallenger(false);
      userL2BalanceBefore = await getLayer2BalancesBadClient(erc20Address);
      user2L2BalanceBefore = await getLayer2Balances(nf3User2, erc20Address);
      user2L2Erc1155BalanceBefore = await getLayer2Erc1155Balance(
        nf3User2,
        erc1155Address,
        availableTokenIds[1],
      );
      await nf3User.deposit('ValidTransaction', erc20Address, tokenType, transferValue, tokenId, 0);
      await makeBlock();
    });
    it('Deep rollback', async () => {
      console.log('Testing deep rollback at distance 2...');

      await nf3User2.deposit(
        'ValidTransaction',
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        0,
      );
      await nf3User.transfer(
        'ValidTransaction',
        false,
        erc20Address,
        tokenType,
        transferValue / 2,
        tokenId,
        nf3User2.zkpKeys.compressedZkpPublicKey,
        0,
      );
      await nf3User.deposit('IncorrectInput', erc20Address, tokenType, transferValue, tokenId, 0);
      await waitForSufficientTransactionsMempool({
        optimistBaseUrl: environment.adversarialOptimistApiUrl,
        nTransactions: 3,
      });

      await makeBlock('IncorrectTreeRoot');
      await nf3User2.deposit(
        'ValidTransaction',
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        availableTokenIds[1],
        fee,
      );
      await makeBlock();
      await enableChallenger(true);
      await waitForRollback();

      const { result: mempool } = (
        await axios.get(`${environment.optimistApiUrl}/proposer/mempool`)
      ).data;
      const numberTxs = mempool.filter(e => e.mempool).length;
      expect(numberTxs).to.be.equal(2);

      const res = (
        await axios.get(`${environment.clientApiUrl}/commitment/commitmentsRollbacked`, {
          params: {
            compressedZkpPublicKey: nf3User2.zkpKeys.compressedZkpPublicKey,
          },
        })
      ).data;

      await nf3User2.deposit(
        'ValidTransaction',
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        availableTokenIds[1],
        0,
        [],
        res.commitmentsRollbacked[0].preimage.salt,
      );

      await waitForSufficientTransactionsMempool({
        optimistBaseUrl: environment.adversarialOptimistApiUrl,
        nTransactions: 3,
      });

      await makeBlock();

      const userL2BalanceAfter = await getLayer2BalancesBadClient(erc20Address);
      const user2L2BalanceAfter = await getLayer2Balances(nf3User2, erc20Address);
      const user2L2Erc1155BalanceAfter = await getLayer2Erc1155Balance(
        nf3User2,
        erc1155Address,
        availableTokenIds[1],
      );

      expect(userL2BalanceAfter - userL2BalanceBefore).to.be.equal(transferValue / 2);
      expect(user2L2BalanceAfter - user2L2BalanceBefore).to.be.equal(
        transferValue + transferValue / 2,
      );
      expect(user2L2Erc1155BalanceAfter - user2L2Erc1155BalanceBefore).to.be.equal(transferValue);
    });

    after(async () => {
      await clearMempool({
        optimistUrl: adversarialOptimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });
  });

  describe('Testing bad transactions', () => {
    describe('Deposits rollback', async () => {
      it('Test duplicate transaction deposit', async () => {
        console.log('Testing duplicate transaction deposit...');
        await nf3User.deposit(
          'ValidTransaction',
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          fee,
        );
        await makeBlock('DuplicateTransaction');
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeCommitment);
      });

      it('Test failing incorrect input deposit', async () => {
        console.log('Testing incorrect input deposit...');
        await nf3User.deposit('IncorrectInput', erc20Address, tokenType, transferValue, tokenId, 0);
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });

      it('Test failing incorrect proof deposit', async () => {
        console.log('Testing incorrect proof deposit...');
        await nf3User.deposit('IncorrectProof', erc20Address, tokenType, transferValue, tokenId, 0);
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });
    });

    describe('Transfers rollback', async () => {
      beforeEach(async () => {
        await nf3User.deposit(
          'ValidTransaction',
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          0,
        );
        await makeBlock();
      });

      it('Test duplicate transaction transfer', async () => {
        console.log('Testing duplicate transaction transfer...');
        await nf3User.transfer(
          'ValidTransaction',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          fee,
        );
        await makeBlock('DuplicateTransaction');
        await waitForRollback();
        expect(challengeSelector).to.be.oneOf([
          challengeSelectors.challengeCommitment,
          challengeSelectors.challengeNullifier,
        ]);
      });

      it('Test duplicate nullifier transfer', async () => {
        console.log('Testing duplicate nullifier transfer...');
        await nf3User.transfer(
          'DuplicateNullifier',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeNullifier);
      });

      it('Test incorrect input transfer', async () => {
        console.log('Testing incorrect input transfer...');
        await nf3User.transfer(
          'IncorrectInput',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });

      it('Test incorrect proof transfer', async () => {
        await nf3User.transfer(
          'IncorrectProof',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });

      it('Test incorrect historic root transfer', async () => {
        console.log('Testing incorrect root...');
        await nf3User.transfer(
          'IncorrectHistoricBlockNumber',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.zkpKeys.compressedZkpPublicKey,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeHistoricRoot);
      });
    });

    describe('Withdraw rollbacks', async () => {
      beforeEach(async () => {
        await nf3User.deposit(
          'ValidTransaction',
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          0,
        );
        await makeBlock();
      });

      it('Test duplicate transaction withdraw', async () => {
        console.log('Testing duplicate transaction withdraw...');
        await nf3User.withdraw(
          'ValidTransaction',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.ethereumAddress,
          fee,
        );
        await makeBlock('DuplicateTransaction');
        await waitForRollback();
        expect(challengeSelector).to.be.oneOf([
          challengeSelectors.challengeCommitment,
          challengeSelectors.challengeNullifier,
        ]);
      });

      it('Test duplicate nullifier withdraw', async () => {
        console.log('Testing duplicate nullifier withdraw...');
        await nf3User.withdraw(
          'DuplicateNullifier',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.ethereumAddress,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeNullifier);
      });

      it('Test incorrect input withdraw', async () => {
        console.log('Testing incorrect input withdraw...');
        await nf3User.withdraw(
          'IncorrectInput',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.ethereumAddress,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });

      it('Test incorrect proof withdraw', async () => {
        console.log('Testing incorrect proof withdraw...');
        await nf3User.withdraw(
          'IncorrectProof',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.ethereumAddress,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeProofVerification);
      });

      it('Test incorrect historic root withdraw', async () => {
        console.log('Testing incorrect root...');
        await nf3User.withdraw(
          'IncorrectHistoricBlockNumber',
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User.ethereumAddress,
          0,
        );
        await makeBlock();
        await waitForRollback();
        expect(challengeSelector).to.be.equal(challengeSelectors.challengeHistoricRoot);
      });
    });

    afterEach(async () => {
      await clearMempool({
        optimistUrl: adversarialOptimistApiUrl,
        web3: web3Client,
        logs: eventLogs,
      });
    });
  });

  describe('Testing bad blocks', async () => {
    before(async () => {
      await nf3User.deposit('ValidTransaction', erc20Address, tokenType, transferValue, tokenId, 0);
    });

    it('Test incorrect leaf count', async () => {
      console.log('Testing incorrect leaf count...');
      await makeBlock('IncorrectLeafCount');
      await waitForRollback();
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeLeafCount);
    });

    it('Test incorrect tree root', async () => {
      console.log('Testing incorrect tree root...');
      await makeBlock('IncorrectTreeRoot');
      await waitForRollback();
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeRoot);
    });

    it('Test incorrect frontier hash', async () => {
      console.log('Testing incorrect frontier hash...');
      await makeBlock('IncorrectFrontierHash');
      await waitForRollback();
      expect(challengeSelector).to.be.equal(challengeSelectors.challengeFrontier);
    });

    after(async () => {
      await makeBlock();
    });
  });

  after(async () => {
    // stopping registerProposerOnNoProposer
    clearInterval(intervalId);
    nf3User.close();
    nf3AdversarialProposer.close();
    nf3Challenger.close();
  });
});
