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

describe('Client transactions API tests', () => {
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
    shieldAddress = nf3User.shieldContractAddress;
    stateAddress = nf3User.stateContractAddress;

    web3Client.subscribeTo('logs', eventLogs, { address: shieldAddress });
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  describe('Status', () => {
    const NO_FEE = 0;
    const STATUS_MINED = 'mined';
    const STATUS_MEMPOOL = 'mempool';
    const BLOCK_NO_L2_MEMPOOL = -1;
    const BLOCK_NO_L2_GENESIS = 0;
    let l2TxHash = 'pepe';

    it('Should fail for any string sent as L2 tx hash since the hash cannot be found', async function () {
      try {
        await nf3User.getL2TransactionStatus(l2TxHash);
        expect.fail('Filter mempool did not fail');
      } catch (err) {
        expect(err.response).to.have.property('status', 404);
      }
    });

    it(`Should return status ${STATUS_MEMPOOL} for a deposit tx still in the proposers mempool`, async function () {
      // Arrange: make deposit, then
      // wait for the blockchain event...
      await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, NO_FEE);
      await web3Client.waitForEvent(eventLogs, ['TransactionSubmitted']);

      // ...so that the optimist can sync, finally
      // query proposer to find the l2TxHash
      const depositTx = (await nf3Proposer.getMempoolTransactions())[0];
      l2TxHash = depositTx._id;

      // Act
      const { data } = await nf3User.getL2TransactionStatus(l2TxHash);

      // Assert
      expect(data).to.have.property('status', STATUS_MEMPOOL);
      expect(data).to.have.property('blockNumberL2', BLOCK_NO_L2_MEMPOOL);
    });

    it(`Should return status ${STATUS_MINED} for previous deposit after mining L2 block`, async function () {
      // Arrange: make block
      await nf3Proposer.makeBlockNow();
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);

      // Act, assert
      const { data } = await nf3User.getL2TransactionStatus(l2TxHash);
      expect(data).to.have.property('status', STATUS_MINED);
      expect(data).to.have.property('blockNumberL2', BLOCK_NO_L2_GENESIS);
    });
  });

  after(async () => {
    await nf3Proposer.deregisterProposer();
    await nf3Proposer.close();
    await nf3User.close();
    web3Client.closeWeb3();
  });
});
