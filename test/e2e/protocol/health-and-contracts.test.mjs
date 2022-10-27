/* eslint-disable no-await-in-loop */
import chai from 'chai';
import config from 'config';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { UserFactory } from 'nightfall-sdk';
import Nf3 from '../../../cli/lib/nf3.mjs';

// so we can use require with mjs file
const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const { mnemonics, signingKeys } = config.TEST_OPTIONS;

const nf3User1 = new Nf3(signingKeys.user1, environment);

let user;
before(async () => {
  await nf3User1.init(mnemonics.user1);
  user = await UserFactory.create({
    blockchainWsUrl: environment.web3WsUrl,
    clientApiUrl: environment.clientApiUrl,
    ethereumPrivateKey: signingKeys.user1,
  });
});

describe('Health and Contract Checks', () => {
  it('new sdk should respond with "true" the health check', async function () {
    const status = await user.isClientAlive();
    expect(status).to.be.equal(true);
  });

  it('new sdk should get the address of the shield contract', async function () {
    const contractAddress = user.shieldContractAddress;
    expect(contractAddress).to.be.a('string').and.to.include('0x');
  });

  // Original tests using `nf3`
  it('should respond with "true" the health check', async function () {
    const res = await nf3User1.healthcheck('client');
    expect(res).to.be.equal(true);
  });

  it('should get the address of the shield contract', async function () {
    const res = await nf3User1.getContractAddress('Shield');
    expect(res).to.be.a('string').and.to.include('0x');
  });

  it('should get the address of the test ERC20 mock contract', async function () {
    const res = await nf3User1.getContractAddress('ERC20Mock');
    expect(res).to.be.a('string').and.to.include('0x');
  });

  it('should get the address of the test ERC721 mock contract', async function () {
    if (process.env.ENVIRONMENT === 'aws') this.skip();
    const res = await nf3User1.getContractAddress('ERC721Mock');
    expect(res).to.be.a('string').and.to.include('0x');
  });

  it('should get the address of the test ERC1155 mock contract', async function () {
    if (process.env.ENVIRONMENT === 'aws') this.skip();
    const res = await nf3User1.getContractAddress('ERC1155Mock');
    expect(res).to.be.a('string').and.to.include('0x');
  });

  it('should subscribe to block proposed event with the provided incoming viewing key for client', async function () {
    const res = await nf3User1.subscribeToIncomingViewingKeys();
    expect(res.data.status).to.be.a('string');
    expect(res.data.status).to.be.equal('success');
  });
});

after(async () => {
  await nf3User1.close();
  user.close();
});
