import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import { connectWeb3, closeWeb3Connection, topicEventMapping } from '../utils.mjs';

const { BLOCKCHAIN_TESTNET_URL } = process.env;

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

describe('Testing the Nightfall SDK', () => {
  const ethereumSigningKey = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
  const walletTestAddress = '0xDd369AF1Bd4D8fEBEf2cE1716AfEC592e00553AA';
  const nf3 = new Nf3(
    'http://localhost:8080',
    'http://localhost:8081',
    'ws://localhost:8082',
    'ws://localhost:8546',
    ethereumSigningKey,
  );

  // The minimum ABI to get ERC20, ERC721 and ERC1155 basic functions
  const minABI = [
    // balanceOf ERC20, ERC721
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    // balanceOf ERC1155
    {
      constant: true,
      inputs: [
        { name: '_owner', type: 'address' },
        { name: '_tokenId', type: 'uint256' },
      ],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
    // decimals ERC20
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function',
    },
    // transfer ERC20
    {
      constant: false,
      inputs: [
        {
          name: '_to',
          type: 'address',
        },
        {
          name: '_value',
          type: 'uint256',
        },
      ],
      name: 'transfer',
      outputs: [
        {
          name: '',
          type: 'bool',
        },
      ],
      type: 'function',
    },
    // safeTransferFrom ERC721
    {
      constant: false,
      inputs: [
        {
          name: '_from',
          type: 'address',
        },
        {
          name: '_to',
          type: 'address',
        },
        {
          name: '_tokenId',
          type: 'uint256',
        },
      ],
      name: 'safeTransferFrom',
      outputs: [],
      type: 'function',
    },
    // safeTransferFrom ERC1155
    {
      constant: false,
      inputs: [
        {
          name: '_from',
          type: 'address',
        },
        {
          name: '_to',
          type: 'address',
        },
        {
          name: '_id',
          type: 'uint256',
        },
        {
          name: '_amount',
          type: 'uint256',
        },
        {
          name: '_data',
          type: 'bytes',
        },
      ],
      name: 'safeTransferFrom',
      outputs: [],
      type: 'function',
    },
  ];

  let web3;
  let ercAddress;
  let erc20Address;
  let erc721Address;
  let erc1155Address;
  let stateAddress;
  const eventLogs = [];

  before(async () => {
    // to enable getBalance with web3 we should connect first
    web3 = await connectWeb3(BLOCKCHAIN_TESTNET_URL);
    stateAddress = await nf3.getContractAddress('State');

    await nf3.init();
    if (!(await nf3.healthcheck('optimist'))) throw new Error('Healthcheck failed');
    // Proposer registration
    await nf3.registerProposer();
    // Proposer listening for incoming events
    nf3.startProposer();
    // Challenger registration
    await nf3.registerChallenger();
    // Chalenger listening for incoming events
    nf3.startChallenger();
    // Liquidity provider for instant withdraws
    const emitter = await nf3.getInstantWithdrawalRequestedEmitter();
    emitter.on('data', async (withdrawTransactionHash, paidBy, amount) => {
      await nf3.advanceInstantWithdrawal(withdrawTransactionHash);
      console.log(`Serviced instant-withdrawal request from ${paidBy}, with fee ${amount}`);
    });

    web3.eth.subscribe('logs', { address: stateAddress }).on('data', log => {
      // For event tracking, we use only care about the logs related to 'blockProposed'
      if (log.topics[0] === topicEventMapping.BlockProposed) eventLogs.push('blockProposed');
    });
  });

  describe('Miscellaneous tests', () => {
    it('should respond with "true" the health check', async function () {
      const res = await nf3.healthcheck('optimist');
      expect(res).to.equal(true);
    });

    it('should get the address of the shield contract', async function () {
      const res = await nf3.getContractAddress('Shield');
      expect(res).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC contract stub', async function () {
      ercAddress = await nf3.getContractAddress('ERCStub');
      expect(ercAddress).to.be.a('string').and.to.include('0x');
    });

    it('should get the address of the test ERC20 contract mock', async function () {
      erc20Address = await nf3.getContractAddress('ERC20Mock');
      expect(erc20Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of wallet address of the ERC20 contract mock', async function () {
      const erc20Token = new web3.eth.Contract(minABI, erc20Address);
      const balance = await erc20Token.methods.balanceOf(walletTestAddress).call();
      expect(Number(balance)).to.be.greaterThan(0);
    });

    it('should get the balance of the ERC20 contract mock', async function () {
      const erc20Token = new web3.eth.Contract(minABI, erc20Address);
      const amount = 3000;
      const balanceBefore = await erc20Token.methods.balanceOf(nf3.ethereumAddress).call();
      const decimals = await erc20Token.methods.decimals().call();
      expect(Number(decimals)).to.be.equal(9);
      const res = await erc20Token.methods
        .transfer('0x0000000000000000000000000000000000000001', amount) //
        .send({ from: nf3.ethereumAddress });
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      const balanceAfter = await erc20Token.methods.balanceOf(nf3.ethereumAddress).call();
      expect(balanceBefore - balanceAfter).to.be.equal(amount);
    });

    it('should get the address of the test ERC721 contract mock', async function () {
      erc721Address = await nf3.getContractAddress('ERC721Mock');
      expect(erc721Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of the ERC721 contract mock', async function () {
      const erc721Token = new web3.eth.Contract(minABI, erc721Address);
      const balanceBefore = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      expect(Number(balanceBefore)).to.be.greaterThan(0);
    });

    it('should transfer one token of the ERC721 contract mock', async function () {
      const erc721Token = new web3.eth.Contract(minABI, erc721Address);
      const balanceBefore = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      const res = await erc721Token.methods
        .safeTransferFrom(nf3.ethereumAddress, walletTestAddress, 3)
        .send({ from: nf3.ethereumAddress });
      expect(res).to.have.property('transactionHash');
      expect(res).to.have.property('blockHash');
      const balanceAfter = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      expect(Number(balanceAfter)).to.be.equal(Number(balanceBefore) - 1);
    });

    it('should get the address of the test ERC1155 contract mock', async function () {
      erc1155Address = await nf3.getContractAddress('ERC1155Mock');
      expect(erc1155Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of the ERC1155 contract mock', async function () {
      const erc1155Token = new web3.eth.Contract(minABI, erc1155Address);
      const balance = await erc1155Token.methods.balanceOf(nf3.ethereumAddress, 1).call();
      expect(Number(balance)).to.be.greaterThan(0);
    });

    it('should get the balance of wallet address of the ERC1155 contract mock', async function () {
      const erc1155Token = new web3.eth.Contract(minABI, erc1155Address);
      const balance = await erc1155Token.methods.balanceOf(walletTestAddress, 1).call();
      expect(Number(balance)).to.be.greaterThan(0);
    });
  });

  after(() => {
    nf3.close();
    closeWeb3Connection();
  });
});
