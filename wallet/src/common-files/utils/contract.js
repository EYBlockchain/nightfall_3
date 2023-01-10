/* ignore unused exports */
import axios from 'axios';
import Web3 from './web3';
import logger from './logger';
import contractABIs from '../../contract-abis';
import { TOKEN_TYPE, APPROVE_AMOUNT, GAS_ESTIMATE_ENDPOINT } from '../../constants';

const { ethereum } = global;
const { proposerUrl } = global.config;

const options = global.config.WEB3_OPTIONS;

// This is hardcoded because we just use it for all estimation.
const gasEstimateEndpoint = GAS_ESTIMATE_ENDPOINT;

// returns a web3 contract instance
export async function getContractInstance(contractName, deployedAddress) {
  const web3 = Web3.connection();
  // grab a 'from' account if one isn't set
  if (!options.from) {
    const accounts = await web3.eth.getAccounts();
    logger.debug('blockchain accounts are: ', accounts);
    [options.from] = accounts;
  }
  if (!deployedAddress) throw Error('deployedAddress not passed');

  const abi = contractABIs[contractName];
  return new web3.eth.Contract(abi, deployedAddress, {
    from: options.from,
  });
}

// TODO: temporary function create to avoid eslint issue for now
export function getContractAddress(contractName) {
  return axios.get(`${proposerUrl}/contract-address/${contractName}`);
}

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
  gasLimitOverride = 0,
  fee,
) {
  const web3 = Web3.connection();
  const blockGasPrice = Number(await web3.eth.getGasPrice());
  const from = await Web3.getAccount();
  let proposedGasPrice = blockGasPrice; // This is the backup value if external estimation fails;
  try {
    // Call the endpoint to estimate the gas fee.
    const res = (await axios.get(gasEstimateEndpoint)).data.result;
    proposedGasPrice = Number(res?.ProposeGasPrice) * 10 ** 9 || blockGasPrice;
  } catch (error) {
    console.log('Gas Estimation Failed: ', error);
  }

  let gasLimit = 0;
  try {
    gasLimit = await web3.eth.estimateGas({
      from,
      to: contractAddress,
      data: unsignedTransaction,
    });
  } catch (error) {
    console.log('Gas Estimate Failed');
    gasLimit = gasLimitOverride;
  }

  const gasLimitWithBuffer = Math.ceil(Number(gasLimit) * 1.5); // 50% seems a more than reasonable buffer.
  // When submitTransaction is called is sets a state in the Shield contract.
  // This setting costs extra gas and is not captured by the estimateGas cost.
  // A smarter way is to change the buffer based on what the operation will be.

  const tx = {
    from,
    to: contractAddress,
    data: unsignedTransaction,
    gas: web3.utils.toHex(gasLimitWithBuffer),
    gasPrice: web3.utils.toHex(proposedGasPrice * 1.2),
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
export async function approve(ercAddress, spenderAddress, tokenType, value) {
  const web3 = Web3.connection();
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
        return submitTransaction(rawTransaction, ercAddress);
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(from, spenderAddress).call())) {
        const rawTransaction = await ercContract.methods
          .setApprovalForAll(spenderAddress, true)
          .encodeABI();
        return submitTransaction(rawTransaction, ercAddress);
      }
      break;
    }

    default:
      throw new Error('Unknown token type', tokenType);
  }
  return Promise.resolve(false);
}
