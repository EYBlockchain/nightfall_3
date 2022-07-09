const axios = require('axios');
const Web3 = require('web3');

const { TEST_OPTIONS, ENVIRONMENTS, RESTRICTIONS, WEB3_PROVIDER_OPTIONS } = require('config');
const Config = require('./contracts/abis/Config.json');
const ERC20Mock = require('./contracts/abis/ERC20Mock.json');
const getAddress = require('../utils/getAddress');

const { privateKey, gas } = TEST_OPTIONS;
const environment = ENVIRONMENTS[process.env.ENVIRONMENT] || ENVIRONMENTS.localhost;

module.exports = async function setRestriction() {
  console.log('environment', environment);
  const { address } = (await axios.get(`${environment.clientApiUrl}/contract-address/Shield`)).data;
  const web3 = new Web3(environment.web3WsUrl, WEB3_PROVIDER_OPTIONS);
  web3.eth.accounts.wallet.add(privateKey);

  const shieldContract = await new web3.eth.Contract(Config, address);
  const erc20MockRestriction = RESTRICTIONS.tokens.blockchain1.find(
    el => el.name === 'ERC20Mock',
  ).amount;

  const networkId = await web3.eth.net.getId();

  const ERC20MockAddr = getAddress('ERC20Mock', networkId);
  console.log(ERC20MockAddr);
  const mockContract = await new web3.eth.Contract(ERC20Mock, ERC20MockAddr);
  console.log(web3.eth.accounts.wallet[0].address);

  await mockContract.methods
    .transfer(ERC20MockAddr, 1000000000000)
    .send({ from: web3.eth.accounts.wallet[0].address, gas });

  await shieldContract.methods
    .setRestriction(
      ERC20MockAddr,
      (BigInt(erc20MockRestriction) / BigInt(4)).toString(),
      erc20MockRestriction,
    )
    .send({ from: web3.eth.accounts.wallet[0].address, gas });

  return { shieldAddress: address };
};
