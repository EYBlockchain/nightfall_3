import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../../cli/lib/nf3.mjs';
import { getTokensInfo } from '../../cli/lib/tokens.mjs';
import {
  connectWeb3,
  closeWeb3Connection,
  topicEventMapping,
  getCurrentEnvironment,
  expectTransaction,
  submitTransaction,
} from '../utils.mjs';
import {
  ethereumAddressUser1,
  ethereumSigningKeyUser1,
  walletTestAddress,
  walletTestSigningkey,
} from '../constants.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const environment = getCurrentEnvironment();
const { web3WsUrl } = process.env;

describe('Testing the Nightfall ERCMocks', () => {
  console.log('ENVIRONMENT: ', environment);
  const nf3 = new Nf3(web3WsUrl, ethereumSigningKeyUser1, environment);

  let web3;
  let erc20Address;
  let erc721Address;
  let erc1155Address;
  let stateAddress;
  const eventLogs = [];

  before(async () => {
    // to enable getBalance with web3 we should connect first
    web3 = await connectWeb3();
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

    it('should get the address of the test ERC20 contract mock', async function () {
      erc20Address = await nf3.getContractAddress('ERC20Mock');
      console.log('        ERC20Mock contract address: ', erc20Address);
      expect(erc20Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of wallet address of the ERC20 contract mock', async function () {
      const erc20Token = new web3.eth.Contract(nf3.contracts.ERC20, erc20Address);
      const balance = await erc20Token.methods.balanceOf(ethereumAddressUser1).call();
      expect(Number(balance)).to.be.greaterThan(0);
    });

    it('should transfer some token of the ERC20 contract mock', async function () {
      const erc20Token = new web3.eth.Contract(nf3.contracts.ERC20, erc20Address);
      const amount = 3000;
      const balanceBefore = await erc20Token.methods.balanceOf(nf3.ethereumAddress).call();
      const decimals = await erc20Token.methods.decimals().call();
      expect(Number(decimals)).to.be.equal(9);

      const gas = (await web3.eth.getBlock('latest')).gasLimit;
      const txDataToSign = await erc20Token.methods.transfer(walletTestAddress, amount).encodeABI();
      const res = await submitTransaction(txDataToSign, nf3.ethereumSigningKey, erc20Address, gas);
      expectTransaction(res);

      const balanceAfter = await erc20Token.methods.balanceOf(nf3.ethereumAddress).call();
      expect(balanceBefore - balanceAfter).to.be.equal(amount);
    });

    it('should get the address of the test ERC721 contract mock', async function () {
      erc721Address = await nf3.getContractAddress('ERC721Mock');
      console.log('        ERC721Mock contract address: ', erc721Address);
      expect(erc721Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of the ERC721 contract mock', async function () {
      const erc721Token = new web3.eth.Contract(nf3.contracts.ERC721, erc721Address);
      const balanceBefore = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      expect(Number(balanceBefore)).to.be.greaterThan(0);
    });

    it('should transfer one token of the ERC721 contract mock', async function () {
      const erc721Token = new web3.eth.Contract(nf3.contracts.ERC721, erc721Address);
      const balanceBefore = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      const tokenId = 1;
      console.log(`        Balance ERC721Mock [${nf3.ethereumAddress}]: ${balanceBefore}`);
      const gas = (await web3.eth.getBlock('latest')).gasLimit;
      let txDataToSign = await erc721Token.methods
        .safeTransferFrom(nf3.ethereumAddress, walletTestAddress, 1)
        .encodeABI();
      let res = await submitTransaction(txDataToSign, nf3.ethereumSigningKey, erc721Address, gas);
      expectTransaction(res);

      const balanceAfter = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      console.log(
        `        Balance ERC721Mock after transfer tokenId ${tokenId} [${nf3.ethereumAddress}]: ${balanceAfter}`,
      );
      expect(Number(balanceAfter)).to.be.equal(Number(balanceBefore) - 1);
      const tokensInfo = await getTokensInfo(erc721Address, nf3.ethereumAddress, web3);
      expect(Number(tokensInfo.balance)).to.be.equal(Number(balanceAfter));
      expect(Number(tokensInfo.tokenIds.length)).to.be.equal(Number(balanceAfter));
      console.log(`TOKENS INFO ${nf3.ethereumAddress} (${erc721Address}): `, tokensInfo);

      await nf3.setEthereumSigningKey(walletTestSigningkey);
      txDataToSign = await erc721Token.methods
        .safeTransferFrom(nf3.ethereumAddress, ethereumAddressUser1, 1)
        .encodeABI();
      res = await submitTransaction(txDataToSign, nf3.ethereumSigningKey, erc721Address, gas);
      expectTransaction(res);
      await nf3.setEthereumSigningKey(ethereumSigningKeyUser1);

      const balanceAfter2 = await erc721Token.methods.balanceOf(nf3.ethereumAddress).call();
      console.log(
        `        Balance ERC721Mock after transfer back tokenId ${tokenId} [${nf3.ethereumAddress}]: ${balanceAfter2}`,
      );
      expect(Number(balanceAfter2)).to.be.equal(Number(balanceAfter) + 1);
    });

    it('should get the address of the test ERC1155 contract mock', async function () {
      erc1155Address = await nf3.getContractAddress('ERC1155Mock');
      console.log('        ERC1155Mock contract address: ', erc1155Address);
      expect(erc1155Address).to.be.a('string').and.to.include('0x');
    });

    it('should get the balance of the ERC1155 contract mock', async function () {
      const Id = 1; // Index Id from ERC1155 to check
      const erc1155Token = new web3.eth.Contract(nf3.contracts.ERC1155, erc1155Address);
      const balance = await erc1155Token.methods.balanceOf(nf3.ethereumAddress, Id).call();
      expect(Number(balance)).to.be.greaterThan(0);
      const tokensInfo = await getTokensInfo(erc1155Address, nf3.ethereumAddress, web3);
      expect(Number(balance)).to.be.equal(
        Number(tokensInfo.tokenIds.find(tokenId => tokenId.Id === Id.toString()).amount),
      );
      console.log(`TOKENS INFO ${nf3.ethereumAddress} (${erc1155Address}): `, tokensInfo);
    });

    it('should get the balance of wallet address of the ERC1155 contract mock', async function () {
      const erc1155Token = new web3.eth.Contract(nf3.contracts.ERC1155, erc1155Address);
      const balance = await erc1155Token.methods.balanceOf(walletTestAddress, 1).call();
      expect(Number(balance)).to.be.greaterThan(0);
    });
  });

  after(() => {
    nf3.close();
    closeWeb3Connection();
  });
});
