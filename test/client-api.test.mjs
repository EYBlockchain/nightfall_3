/* eslint-disable no-await-in-loop */
import config from 'config';
import Nf3 from '../cli/lib/nf3.mjs';
import { Web3Client } from './utils.mjs';

const environment = config.ENVIRONMENTS[config.ENVIRONMENT];

const {
  mnemonics,
  signingKeys,
  tokenConfigs: { tokenType, tokenId },
  transferValue,
} = config.TEST_OPTIONS;

const web3Client = new Web3Client();
const eventLogs = [];

const nf3User = new Nf3(signingKeys.user1, environment);
const nf3Proposer = new Nf3(signingKeys.proposer1, environment);

describe('Client API tests via Nf3', () => {
  let erc20Address;
  let shieldAddress;
  let stateAddress;

  before(async () => {
    await nf3User.init(mnemonics.user1);

    await nf3Proposer.init(mnemonics.proposer);
    await nf3Proposer.registerProposer(
      environment.optimistApiUrl,
      await nf3Proposer.getMinimumStake(),
    );
    await nf3Proposer.startProposer();

    erc20Address = await nf3User.getContractAddress('ERC20Mock');
    shieldAddress = await nf3User.shieldContractAddress;
    stateAddress = await nf3User.stateContractAddress;

    web3Client.subscribeTo('logs', eventLogs, { address: shieldAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('getTransactionStatus', () => {
    // At the moment, not found will not be signaled as such
    // We will only suggest that the tx is still in the mempool (ie blockNumberL2 -1)
    const NOT_FOUND = -1;
    const NO_FEE = 0;
    const L2_GENESIS_BLOCK_NO = 0;

    let l2TxHash = 'pepe';

    it('Should return -1 for any string sent as L2 tx hash', async function () {
      const result = await nf3User.getTransactionStatus(l2TxHash);
      expect(result).to.equal(NOT_FOUND);
    });

    it('Should return -1 for a deposit transaction still in the proposers mempool', async function () {
      // Arrange: make deposit, then
      // wait for the blockchain event...
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, NO_FEE);
      await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);

      // ...so that the optimist can sync, finally
      // query proposer to find the l2TxHash
      const depositTx = (await nf3Proposer.getMempoolTransactions())[0];
      l2TxHash = depositTx._id;

      // Act, assert
      const result = await nf3User.getTransactionStatus(l2TxHash);
      expect(result).to.equal(NOT_FOUND);
    });

    it('Should return l2 block number for mined transactions', async function () {
      // Arrange: make block
      await nf3Proposer.makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // Act, assert
      const result = await nf3User.getTransactionStatus(l2TxHash);
      expect(result).to.equal(L2_GENESIS_BLOCK_NO);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
