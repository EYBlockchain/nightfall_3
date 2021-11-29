/* This is an example script written to show how to send blockConfig which provides a configuration
 * for valid and invalid blocks to be built by adversary. This does not perform negative tests because testing
 * if the adversary is able to create successful bad blocks or not is not the objective of nightfall 3 tests
 * Any test written should verify the state of client's expected balance against the balance that blockchain says
 * the client should have
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
// import { waitForProposer, waitForSufficientBalance } from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

// Number of transfer filled transaction blocks required.
// This is equal to the number of blocks required for test that
// uses blockConfig - 1. We reduce by 1 because we want the first
// block to hold deposit big enough for the subsequent transfers
// and will create this ahead of the transfer blocks separately

describe('Testing the challenge http API', () => {
  let nf3User1;
  let nf3AdversarialProposer;
  let ercAddress;

  // this is the etherum private key for accounts[0] and so on
  const ethereumSigningKeyUser1 =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const ethereumSigningKeyProposer =
    '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d';
  const mnemonicUser1 =
    'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction';
  const mnemonicProposer =
    'high return hold whale promote payment hat panel reduce oyster ramp mouse';
  const tokenId = '0x00'; // has to be zero for ERC20
  const tokenType = 'ERC20'; // it can be 'ERC721' or 'ERC1155'
  const value = 10;

  // this is what we pay the proposer for incorporating a transaction
  const fee = 1;
  const txPerBlock = 2;

  before(async () => {
    nf3User1 = new Nf3(
      'http://localhost:8080',
      'http://localhost:8081',
      'ws://localhost:8082',
      'ws://localhost:8546',
      ethereumSigningKeyUser1,
    );
    nf3AdversarialProposer = new Nf3(
      'http://localhost:8080',
      'http://localhost:8088',
      'ws://localhost:8089',
      'ws://localhost:8546',
      ethereumSigningKeyProposer,
    );

    // Generate a random mnemonic (uses crypto.randomBytes under the hood), defaults to 128-bits of entropy
    await nf3User1.init(mnemonicUser1);
    await nf3AdversarialProposer.init(mnemonicProposer);

    if (!(await nf3User1.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    if (!(await nf3AdversarialProposer.healthcheck('optimist')))
      throw new Error('Healthcheck failed');

    // Proposer registration
    await nf3AdversarialProposer.registerProposer();
    // Proposer listening for incoming events
    nf3AdversarialProposer.startProposer();
    ercAddress = await nf3User1.getContractAddress('ERC20Mock');
  });

  describe('Deposit tests', () => {
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = 1;

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
    });
  });

  after(async () => {
    // wait for pending transactions before closing
    await new Promise(resolve => setTimeout(resolve, 20000));
    nf3User1.close();
    // nf3User2.close();
    nf3AdversarialProposer.close();
    // nf3Challenger.close();
  });
});
