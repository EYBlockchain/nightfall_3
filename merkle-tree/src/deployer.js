import config from 'config';
import Web3 from './web3';
import utilsWeb3 from './utils-web3';

const web3 = Web3.connect();
const { options } = config.web3;

async function deploy() {
  const coinbase = await web3.eth.getCoinbase();
  console.log(`\nUnlocking account ${coinbase}...`);
  await web3.eth.personal.unlockAccount(coinbase, 'password', 1);

  let contractInstance = await utilsWeb3.getContractInstance(config.contract.name); // get a web3 contract instance of the contract
  const bytecode = await utilsWeb3.getContractBytecode(config.contract.name);

  await contractInstance
    .deploy({ data: bytecode, arguments: [config.TREE_HEIGHT] }) // we pass constructor arguments here
    .send({ from: coinbase, gas: options.defaultGas, gasPrice: options.defaultGasPrice })
    .on('error', err => {
      throw new Error(err);
    })
    // .on('transactionHash', txHash => {
    //   console.log(`deployment txHash: ${txHash}`);
    // })
    .then(newContractInstance => {
      // console.log('NEW CONTRACT INSTANCE');
      // console.log(newContractInstance);
      contractInstance = newContractInstance; // instance with the new contract address added.
      console.log(`\nDeployer contract deployed at address ${newContractInstance._address}`); // eslint-disable-line no-underscore-dangle
    });
  console.log('\nAdding deployed contract address to db');
  // console.log(await JSON.stringify(contractInstance));

  return contractInstance;
}

export default {
  deploy,
};
