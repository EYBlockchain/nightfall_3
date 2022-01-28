/* ignore unused exports */
import { getAbi, Constants } from 'nf3';

import Web3 from './web3';
import logger from './logger';
import Shield from '../../contracts/Shield.json';

const contractAbi = { Shield };

const web3 = Web3.connection();

const options = global.config.WEB3_OPTIONS;
const { TOKEN_TYPE, APPROVE_AMOUNT } = Constants;

export async function getContractInterface(contractName) {
  const contractInterface = contractAbi[contractName];
  return contractInterface;
}

export async function getContractAddress(contractName) {
  let deployedAddress;
  const contractInterface = await getContractInterface(contractName);

  const networkId = await web3.eth.net.getId();
  logger.silly('networkId:', networkId);

  if (contractInterface && contractInterface.networks && contractInterface.networks[networkId]) {
    deployedAddress = contractInterface.networks[networkId].address;
  }
  logger.silly('deployed address:', deployedAddress);
  return deployedAddress;
}

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  // grab a 'from' account if one isn't set
  if (!options.from) {
    const accounts = await web3.eth.getAccounts();
    logger.debug('blockchain accounts are: ', accounts);
    [options.from] = accounts;
  }
  const contractInterface = await getContractInterface(contractName);
  if (!deployedAddress) {
    // eslint-disable-next-line no-param-reassign
    deployedAddress = await getContractAddress(contractName);
  }

  const contractInstance = deployedAddress
    ? new web3.eth.Contract(contractInterface.abi, deployedAddress, options)
    : new web3.eth.Contract(contractInterface.abi, options);
  // logger.silly('\ncontractInstance:', contractInstance);

  return contractInstance;
}

export async function getContractBytecode(contractName) {
  const contractInterface = await getContractInterface(contractName);
  return contractInterface.evm.bytecode.object;
}

export async function deploy(contractName, constructorParams, { from, gas, password }) {
  logger.info(`\nUnlocking account ${from}...`);
  await web3.eth.personal.unlockAccount(from, password, 1);

  const contractInstance = await getContractInstance(contractName); // get a web3 contract instance of the contract
  const bytecode = await getContractBytecode(contractName);

  const deployedContractAddress = await contractInstance
    .deploy({ data: `0x${bytecode}`, arguments: constructorParams })
    .send({
      from,
      gas,
    })
    .on('error', err => {
      throw new Error(err);
    })
    .then(deployedContractInstance => {
      // logger.silly('deployed contract instance:', deployedContractInstance);
      logger.info(
        `${contractName} contract deployed at address ${deployedContractInstance.options.address}`,
      ); // instance with the new contract address

      return deployedContractInstance.options.address;
    });
  return deployedContractAddress;
}

/**
 * Function that tries to get a (named) contract instance and, if it fails, will
 * retry after 3 seconds.  After RETRIES attempts, it will give up and throw.
 * This is useful in case nightfall-optimist comes up before the contract
 * is fully deployed.
 */
export async function waitForContract(contractName) {
  let errorCount = 0;
  let error;
  let instance;
  while (errorCount < 50) {
    try {
      error = undefined;
      const address = await getContractAddress(contractName); // eslint-disable-line no-await-in-loop
      logger.debug(`${contractName} contract address is ${address}`);
      if (address === undefined) throw new Error(`${contractName} contract address was undefined`);
      instance = getContractInstance(contractName, address);
      return instance;
    } catch (err) {
      error = err;
      errorCount++;
      logger.warn(`Unable to get a ${contractName} contract instance will try again in 3 seconds`);
      await new Promise(resolve => setTimeout(() => resolve(), 3000)); // eslint-disable-line no-await-in-loop
    }
  }
  if (error) throw error;
  return instance;
}

/**
 * Method for signing and submitting an Ethereum transaction to the blockchain.
 * @param {string} unsignedTransaction - An unsigned web3js transaction object.
 * @param {string} contractAddress - contract Address to which tx is to be submitted.
 * @param {string} from - The Ethereum address of the transaction sender
 * @param {string} fromAddressSigningKey - The Ethereum siging key to be used for transactions (hex string).
 * @param {number} fee - the value of the transaction.
 * @returns {Promise} This will resolve into a transaction receipt
 */
export async function submitTransaction(
  unsignedTransaction,
  contractAddress,
  from,
  fromAddressSigningKey,
  fee,
) {
  let gasPrice = 20000000000;
  const gas = (await web3.eth.getBlock('latest')).gasLimit;
  const blockGasPrice = 2 * Number(await web3.eth.getGasPrice());
  if (blockGasPrice > gasPrice) gasPrice = blockGasPrice;

  const tx = {
    from,
    to: contractAddress,
    data: unsignedTransaction,
    gas,
    gasPrice,
  };

  if (fee) tx.value = fee;

  if (fromAddressSigningKey) {
    const signed = await this.web3.eth.accounts.signTransaction(tx, fromAddressSigningKey);
    return web3.eth.sendSignedTransaction(signed.rawTransaction);
  }
  return web3.eth.sendTransaction(tx);
}

/**
 * Sends an approve transaction to an ERC20/ERC721/ERC1155 contract for a certain amount of tokens
 * @param {string} ercAddress - ERC contract address
 * @param {string} ownerAddress - The Ethereum address of the transaction sender
 * @param {string} ownerSigningKey - The Ethereum siging key to be used for transactions (hex string).
 * @param {string} spenderAddress - The Ethereum address of the approved entity
 * @param {string} tokenType  - Type of token
 * @param {string} value  - Amount of tokens to be approved (in Wei)
 * @returns {Promise} transaction
 */
export async function approve(
  ercAddress,
  spenderAddress,
  ownerAddress,
  ownerSigningKey,
  tokenType,
  value,
) {
  const abi = getAbi(tokenType);
  const ercContract = new web3.eth.Contract(abi, ercAddress);
  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const allowance = await ercContract.methods.allowance(ownerAddress, spenderAddress).call();
      const allowanceBN = new web3.utils.BN(allowance);
      const valueBN = new web3.utils.BN(value);
      if (allowanceBN.lt(valueBN)) {
        if (ownerSigningKey) {
          const rawTransaction = await ercContract.methods
            .approve(spenderAddress, APPROVE_AMOUNT)
            .encodeABI();
          return submitTransaction(rawTransaction, ercAddress, ownerAddress, ownerSigningKey);
        }
        await ercContract.methods
          .approve(spenderAddress, APPROVE_AMOUNT)
          .send({ from: ownerAddress });
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(ownerAddress, spenderAddress).call())) {
        if (ownerSigningKey) {
          const rawTransaction = await ercContract.methods
            .setApprovalForAll(spenderAddress, true)
            .encodeABI();
          return submitTransaction(rawTransaction, ercAddress, ownerAddress, ownerSigningKey);
        }
        await ercContract.methods
          .setApprovalForAll(spenderAddress, true)
          .send({ from: ownerAddress });
      }
      break;
    }

    default:
      throw new Error('Unknown token type', tokenType);
  }
  return Promise.resolve(false);
}
