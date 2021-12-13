/**
Test suite for measuring the gas per transaction
*/
import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import {
  ethereumSigningKeyUser1,
  ethereumSigningKeyProposer1,
  mnemonicUser1,
  mnemonicProposer,
  bond,
  gasCosts,
  tokenType,
  value,
  tokenId,
  fee,
} from './constants.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  closeWeb3Connection,
  connectWeb3,
  getBalance,
  getCurrentEnvironment,
  expectTransaction,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = getCurrentEnvironment();
const { web3WsUrl } = process.env;

const TRANSACTIONS_PER_BLOCK = 32;

describe('Testing the http API', () => {
  let ercAddress;

  console.log('ENVIRONMENT: ', environment);
  const nf3User1 = new Nf3(web3WsUrl, ethereumSigningKeyUser1, environment);
  const nf3Proposer1 = new Nf3(web3WsUrl, ethereumSigningKeyProposer1, environment);

  before(async () => {
    await connectWeb3();

    await nf3User1.init(mnemonicUser1);
    await nf3Proposer1.init(mnemonicProposer);
    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      console.log(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
          gasUsed / TRANSACTIONS_PER_BLOCK
        }`,
      );
    });
  });

  describe('Miscellaneous tests', () => {
    it('should respond with "true" to the health check', async () => {
      const res = await nf3User1.healthcheck('client');
      expect(res).to.be.equal(true);
    });

    it('should get the address of the shield contract', async () => {
      const res = await nf3User1.getContractAddress('Shield');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC contract ERC20Mock', async () => {
      ercAddress = await nf3User1.getContractAddress('ERC20Mock');
      expect(ercAddress).to.be.a('string').and.to.include('0x');
    });

    it('should subscribe to block proposed event with the provided incoming viewing key for optimist1', async function () {
      const res = await nf3User1.subscribeToIncomingViewingKeys();
      expect(res.data.status).to.be.a('string');
      expect(res.data.status).to.be.equal('success');
    });
  });

  describe('Basic Proposer tests', () => {
    it('should register a proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer1.getProposers());
      // we have to pay 10 ETH to be registered
      const startBalance = await getBalance(nf3Proposer1.ethereumAddress);
      const res = await nf3Proposer1.registerProposer();
      expectTransaction(res);
      ({ proposers } = await nf3Proposer1.getProposers());
      const endBalance = await getBalance(nf3Proposer1.ethereumAddress);
      expect(endBalance - startBalance).to.closeTo(-bond, gasCosts);
      const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
    });
  });

  describe('Deposit tests', () => {
    console.warn(
      'WARNING, THE TRANSACTIONS_PER_BLOCK CONSTANT MUST HAVE THE SAME VALUE AS IN NIGHTFALL_OPTIMIST CONFIG OR THIS TEST WILL NOT REPORT CORRECTLY',
    );

    it('should deposit some crypto into a ZKP commitment', async () => {
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expectTransaction(res);
        console.log(`Gas used was ${Number(res.gasUsed)}`);

        // give Timber time to respond to the blockchain event
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    });
  });

  after(() => {
    closeWeb3Connection();
    nf3User1.close();
    nf3Proposer1.close();
  });
});
