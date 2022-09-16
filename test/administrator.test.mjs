/* This test relies on nightfall_3/cli
 */

/* eslint-disable no-await-in-loop */
import chai from 'chai';
import chaiHttp from 'chai-http';
import config from 'config';
import chaiAsPromised from 'chai-as-promised';
import Nf3 from '../cli/lib/nf3.mjs';
import contractABIs from './contracts.mjs';

const { expect } = chai;
chai.use(chaiHttp);
chai.use(chaiAsPromised);

const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const { mnemonics, signingKeys } = config.TEST_OPTIONS;

const getContractInstance = async (contractName, nf3) => {
  const abi = contractABIs[contractName];
  const contractAddress = await nf3.getContractAddress(contractName);
  const contractInstance = new nf3.web3.eth.Contract(abi, contractAddress);
  return { contractAddress, contractInstance };
};

describe(`Testing Administrator`, () => {
  let nf3User;
  let stateContractInstance;

  before(async () => {
    nf3User = new Nf3(signingKeys.user1, environment);

    await nf3User.init(mnemonics.user1);

    if (!(await nf3User.healthcheck('client'))) throw new Error('Healthcheck failed');

    ({ contractInstance: stateContractInstance } = await getContractInstance('State', nf3User));
  });

  describe(`Basic tests`, () => {
    it('Be able to get owner of the State contract and check that is the multisig', async () => {
      const owner = await stateContractInstance.methods.owner().call();
      const multisigAddress = await nf3User.getContractAddress('SimpleMultiSig');
      console.log(owner, multisigAddress);
      expect(owner.toUpperCase()).to.be.equal(multisigAddress.toUpperCase());
    });

    /* it('Be able to transfer ownership of contracts from multisig to a specific one', async () => {
      // TODO: calls to multisig to change contracts ownership
      const owner = await stateContractInstance.methods.owner().call();
      expect(owner.toUpperCase()).to.be.equal(nf3User.ethereumAddress.toUpperCase());
    }); */
  });

  after(async () => {
    nf3User.close();
  });
});
