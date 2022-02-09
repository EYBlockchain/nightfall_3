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
  tokenType,
  value,
  tokenId,
  fee,
  BLOCK_STAKE,
} from './constants.mjs';
import Nf3 from '../cli/lib/nf3.mjs';
import {
  closeWeb3Connection,
  connectWeb3,
  getCurrentEnvironment,
  expectTransaction,
} from './utils.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = getCurrentEnvironment();
const { web3WsUrl } = process.env;

const TRANSACTIONS_PER_BLOCK = 2;
const MINIMUM_STAKE = 10;
let currentGasCostPerTx = 0;
let web3;
let stateAddress;

const miniStateABI = [
  {
    inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
    name: 'getStakeAccount',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'challengeLocked',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'time',
            type: 'uint256',
          },
        ],
        internalType: 'struct Structures.TimeLockedStake',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

describe('Testing the http API', () => {
  let ercAddress;

  console.log('ENVIRONMENT: ', environment);
  const nf3User1 = new Nf3(web3WsUrl, ethereumSigningKeyUser1, environment);
  const nf3Proposer1 = new Nf3(web3WsUrl, ethereumSigningKeyProposer1, environment);

  const getStakeAccount = async ethAccount => {
    const stateContractInstance = new web3.eth.Contract(miniStateABI, stateAddress);
    const stakeAccount = await stateContractInstance.methods.getStakeAccount(ethAccount).call();
    return stakeAccount;
  };

  before(async () => {
    web3 = await connectWeb3();

    stateAddress = await nf3User1.getContractAddress('State');
    ercAddress = await nf3User1.getContractAddress('ERC20Mock');

    await nf3User1.init(mnemonicUser1);
    await nf3Proposer1.init(mnemonicProposer);
    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      currentGasCostPerTx = gasUsed / TRANSACTIONS_PER_BLOCK;
      console.log(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${currentGasCostPerTx}`,
      );
    });
  });

  describe('Basic Proposer staking tests', () => {
    it('should accept stake as a proposer', async () => {
      let proposers;
      ({ proposers } = await nf3Proposer1.getProposers());
      const currentProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      // In order to begin from 0 producing L2 blocks
      if (currentProposer.length === 1) {
        console.log('Unstaking proposer...');
        nf3Proposer1.unstakeProposer();
      }

      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      const res = await nf3Proposer1.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      ({ proposers } = await nf3Proposer1.getProposers());
      const thisProposer = proposers.filter(p => p.thisAddress === nf3Proposer1.ethereumAddress);
      expect(thisProposer.length).to.be.equal(1);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('should increase stake for the same proposer', async () => {
      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      const res = await nf3Proposer1.stakeProposer(MINIMUM_STAKE);
      expectTransaction(res);
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      expect(Number(stakeAccount2.amount)).equal(
        Number(stakeAccount1.amount) + Number(MINIMUM_STAKE),
      );
    });

    it('should increase stake locked for challenge period and decrease the stake amount', async () => {
      const stakeAccount1 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      for (let i = 0; i < TRANSACTIONS_PER_BLOCK * 2; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.deposit(ercAddress, tokenType, value, tokenId, fee);
        expectTransaction(res);
      }
      const stakeAccount2 = await getStakeAccount(nf3Proposer1.ethereumAddress);
      expect(Number(stakeAccount2.amount)).equal(Number(stakeAccount1.amount) - 2 * BLOCK_STAKE);
      expect(Number(stakeAccount2.challengeLocked)).equal(
        Number(stakeAccount1.challengeLocked) + 2 * BLOCK_STAKE,
      );
    });
  });

  after(() => {
    closeWeb3Connection();
    nf3User1.close();
    nf3Proposer1.close();
  });
});
