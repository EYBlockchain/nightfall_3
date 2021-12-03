import Web3 from 'web3';
import getAbi from './abi.mjs';
import { TOKEN_TYPE, APPROVE_AMOUNT } from './constants.mjs';
import { fromBaseUnit } from './units.mjs';

/**
Sends an approve transaction to an ERC20/ERC721/ERC1155 contract for a certain amount of tokens
* @param {string} ercAddress - ERC contract address
* @param {string} ownerAddress - The Ethereum address of the transaction sender
* @param {string} spenderAddress - The Ethereum address of the approved entity
* @param {string} tokenType  - Type of token
* @param {string} value  - Amount of tokens to be approved (in Wei)
* @param {object} provider  - web3 provider
* @returns {Promise} transaction
*/
async function approve(ercAddress, ownerAddress, spenderAddress, tokenType, value, provider) {
  const abi = getAbi(tokenType);
  const ercContract = new provider.eth.Contract(abi, ercAddress);

  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const allowance = await ercContract.methods.allowance(ownerAddress, spenderAddress).call();
      const allowanceBN = new Web3.utils.BN(allowance);
      const valueBN = new Web3.utils.BN(value);
      if (allowanceBN.lt(valueBN)) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY)
          return ercContract.methods.approve(spenderAddress, APPROVE_AMOUNT).encodeABI();
        return ercContract.methods.approve(spenderAddress, APPROVE_AMOUNT).send();
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(ownerAddress, spenderAddress).call())) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY)
          return ercContract.methods.setApprovalForAll(spenderAddress, true).encodeABI();
        return ercContract.methods.setApprovalForAll(spenderAddress, true).send();
      }
      break;
    }

    default:
      throw new Error('Unknown token type', tokenType);
  }
  return Promise.resolve(false);
}

/**
Get decimals configured  in ERC token
* @param {string} ercAddress - ERC contract address
* @param {string} tokenType  - Type of token
* @param {object} provider  - web3 provider
* @returns {Number} decimals
*/
async function getDecimals(ercAddress, tokenType, provider) {
  const abi = getAbi(tokenType);
  const ercContract = new provider.eth.Contract(abi, ercAddress);
  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const decimals = await ercContract.methods.decimals().call();
      return Number(decimals);
    }
    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      return 0;
    }

    default:
      throw new Error('Unknown token type', tokenType);
  }
}

/**
Get Information of ERC token in ethereum address. Default is in Wei
* @param {string} ercAddress - ERC contract address
* @param {string} ethereumAddress - The Ethereum address token owner
* @param {object} provider  - web3 provider
* @param {object} options  - different options for tokens. For ERC20, toEth is boolean
*    to return the balance as Ether. For ERC1155, tokenId is required to get balance
*    of specific token Id
* @returns {Object} {balance, decimals}
*/
async function getERCInfo(ercAddress, ethereumAddress, provider, options) {
  let toEth;
  let tokenId;
  if (typeof options !== 'undefined') {
    toEth = options.toEth;
    tokenId = options.tokenId;
  }

  try {
    const abi = getAbi(TOKEN_TYPE.ERC20);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    let balance = await ercContract.methods.balanceOf(ethereumAddress).call();
    const decimals = await getDecimals(ercAddress, TOKEN_TYPE.ERC20, provider);
    if (toEth) {
      balance = fromBaseUnit(balance, decimals);
    }
    return { balance, decimals, tokenType: TOKEN_TYPE.ERC20 };
  } catch {
    try {
      const abi = getAbi(TOKEN_TYPE.ERC1155);
      const ercContract = new provider.eth.Contract(abi, ercAddress);
      const balance = await ercContract.methods.balanceOf(ethereumAddress, tokenId).call();
      return { balance, tokenType: TOKEN_TYPE.ERC1155 };
    } catch {
      try {
        const abi = getAbi(TOKEN_TYPE.ERC721);
        const ercContract = new provider.eth.Contract(abi, ercAddress);
        const balance = await ercContract.methods.balanceOf(ethereumAddress).call();
        return { balance, tokenType: TOKEN_TYPE.ERC721 };
      } catch {
        // TODO
        throw new Error('Unknown token type', ercAddress);
      }
    }
  }
}

export { approve, getDecimals, getERCInfo };
