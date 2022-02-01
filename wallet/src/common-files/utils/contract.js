/* ignore unused exports */
import { Constants } from 'nf3';

import Web3 from './web3';
import logger from './logger';
import contractABIs from '../../contract-abis';

const { ethereum } = global;
const web3 = Web3.connection();

const options = global.config.WEB3_OPTIONS;
const { TOKEN_TYPE, APPROVE_AMOUNT } = Constants;

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  // grab a 'from' account if one isn't set
  if (!options.from) {
    const accounts = await web3.eth.getAccounts();
    logger.debug('blockchain accounts are: ', accounts);
    [options.from] = accounts;
  }
  if (!deployedAddress) throw Error('deployedAddress not passed');

  const abi = contractABIs[contractName];
  return new web3.eth.Contract(abi, deployedAddress, options);
}

// TODO: temporary function create to avoid eslint issue for now
export function getContractAddress() {}

/**
 * Method for signing and submitting an Ethereum transaction to the blockchain.
 * @param {string} unsignedTransaction - An unsigned web3js transaction object.
 * @param {string} contractAddress - contract Address to which tx is to be submitted.
 * @param {number} fee - the value of the transaction.
 * @returns {Promise} This will resolve into a transaction receipt
 */
export async function submitTransaction(
  unsignedTransaction,
  contractAddress,
  fee,
) {
  let gasPrice = 20000000000;
  const gas = (await web3.eth.getBlock('latest')).gasLimit;
  const blockGasPrice = 2 * Number(await web3.eth.getGasPrice());
  if (blockGasPrice > gasPrice) gasPrice = blockGasPrice;
  const from = await Web3.getAccount();
  const tx = {
    from,
    to: contractAddress,
    data: unsignedTransaction,
    gas: web3.utils.toHex(gas),
    gasPrice: web3.utils.toHex(gasPrice),
  };

  if (fee) tx.value = web3.utils.toHex(fee);

  return ethereum.request({
    method: 'eth_sendTransaction',
    params: [tx],
  });
}

/**
 * Sends an approve transaction to an ERC20/ERC721/ERC1155 contract for a certain amount of tokens
 * @param {string} ercAddress - ERC contract address
 * @param {string} spenderAddress - The Ethereum address of the approved entity
 * @param {string} tokenType  - Type of token
 * @param {string} value  - Amount of tokens to be approved (in Wei)
 * @returns {Promise} transaction
 */
export async function approve(
  ercAddress,
  spenderAddress,
  tokenType,
  value,
) {
  const abi = contractABIs[tokenType];
  const ercContract = new web3.eth.Contract(abi, ercAddress);
  const from = await Web3.getAccount();
  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const allowance = await ercContract.methods.allowance(from, spenderAddress).call();
      const allowanceBN = new web3.utils.BN(allowance);
      const valueBN = new web3.utils.BN(value);
      if (allowanceBN.lt(valueBN)) {
        const rawTransaction = await ercContract.methods
          .approve(spenderAddress, APPROVE_AMOUNT)
          .encodeABI();
        return submitTransaction(rawTransaction, ercAddress, from);
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(from, spenderAddress).call())) {
        const rawTransaction = await ercContract.methods
          .setApprovalForAll(spenderAddress, true)
          .encodeABI();
        return submitTransaction(rawTransaction, ercAddress, from);
      }
      break;
    }

    default:
      throw new Error('Unknown token type', tokenType);
  }
  return Promise.resolve(false);
}
