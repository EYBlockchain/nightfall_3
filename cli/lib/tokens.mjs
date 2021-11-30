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
        return ercContract.methods
          .approve(spenderAddress, APPROVE_AMOUNT)
          .send({ from: ownerAddress });
      }
      return Promise.resolve();
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(ownerAddress, spenderAddress).call())) {
        return ercContract.methods
          .setApprovalForAll(spenderAddress, true)
          .send({ from: ownerAddress });
      }
      break;
    }

    default:
      throw new Error('Unknown token type');
  }
  return Promise.resolve();
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
      throw new Error('Unknown token type');
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

  let tokenType;
  let balance;
  let decimals = 0;

  try {
    // Check supportsInterface ERC165 that implements ERC721 and ERC1155
    const abi = getAbi(TOKEN_TYPE.ERC165);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    const interface721 = await ercContract.methods.supportsInterface('0x80ac58cd').call(); // ERC721 interface
    if (interface721) {
      tokenType = TOKEN_TYPE.ERC721;
    } else {
      const interface1155 = await ercContract.methods.supportsInterface('0xd9b67a26').call(); // ERC1155 interface
      if (interface1155) tokenType = TOKEN_TYPE.ERC1155;
    }
  } catch {
    // Expected ERC20
    tokenType = TOKEN_TYPE.ERC20;
  }

  if (tokenType === TOKEN_TYPE.ERC721) {
    // ERC721
    const abi = getAbi(TOKEN_TYPE.ERC721);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    balance = await ercContract.methods.balanceOf(ethereumAddress).call();
  } else if (tokenType === TOKEN_TYPE.ERC1155) {
    // ERC1155
    const abi = getAbi(TOKEN_TYPE.ERC1155);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    balance = await ercContract.methods.balanceOf(ethereumAddress, tokenId).call();
  } else {
    // expected ERC20
    try {
      const abi = getAbi(TOKEN_TYPE.ERC20);
      const ercContract = new provider.eth.Contract(abi, ercAddress);
      balance = await ercContract.methods.balanceOf(ethereumAddress).call();
      if (toEth) {
        decimals = await getDecimals(ercAddress, TOKEN_TYPE.ERC20, provider);
        balance = fromBaseUnit(balance, decimals);
      }
    } catch {
      throw new Error('Unknown token type', ercAddress);
    }
  }

  return { balance, decimals, tokenType };
}

/**
Get tokenIds in ethereum address for specific ERC721 or ERC1155 contract. 
* @param {string} ercAddress - ERC contract address
* @param {string} ethereumAddress - The Ethereum address token owner
* @param {object} provider  - web3 provider
* @returns  {Object} {tokenType, balance, tokenIds}  List of tokenId owned by the ethereum address in this ERC721 / ERC1155 contract
*/
async function getTokensInfo(ercAddress, ethereumAddress, provider) {
  let balance;
  let tokenType = TOKEN_TYPE.ERC20;
  const tokenIds = [];

  try {
    // Check supportsInterface ERC165 that implements ERC721 and ERC1155
    const abi = getAbi(TOKEN_TYPE.ERC165);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    const interface721 = await ercContract.methods.supportsInterface('0x80ac58cd').call(); // ERC721 interface
    if (interface721) {
      tokenType = TOKEN_TYPE.ERC721;
    } else {
      const interface1155 = await ercContract.methods.supportsInterface('0xd9b67a26').call(); // ERC1155 interface
      if (interface1155) tokenType = TOKEN_TYPE.ERC1155;
    }
  } catch {
    // TODO
    throw new Error('Unknown token type (not ERC721 nor ERC1155)', ercAddress);
  }

  if (tokenType === TOKEN_TYPE.ERC1155) {
    const abi = getAbi(TOKEN_TYPE.ERC1155);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    const tokenId = 1;

    balance = await ercContract.methods.balanceOf(ethereumAddress, tokenId).call();
    tokenType = TOKEN_TYPE.ERC1155;
    const incomingTokenTransferBatchEvents = await ercContract.getPastEvents('TransferBatch', {
      filter: {},
      fromBlock: 0,
      toBlock: 'latest',
    });
    const tokenIdsEvents = [];
    incomingTokenTransferBatchEvents.forEach(event => {
      event.returnValues.ids.forEach(id => {
        if (!tokenIdsEvents.includes(id)) tokenIdsEvents.push(id);
      });
    });

    const incomingTokenTransferSingleEvents = await ercContract.getPastEvents('TransferSingle', {
      filter: {},
      fromBlock: 0,
      toBlock: 'latest',
    });
    incomingTokenTransferSingleEvents.forEach(event => {
      if (!tokenIdsEvents.includes(event.returnValues.id))
        tokenIdsEvents.push(event.returnValues.id);
    });

    await Promise.all(
      tokenIdsEvents.map(async Id => {
        const amount = await ercContract.methods.balanceOf(ethereumAddress, Id).call();
        tokenIds.push({ Id, amount });
      }),
    );

    balance = tokenIds
      .reduce((partialSum, tokenIdInfo) => partialSum + BigInt(tokenIdInfo.amount), BigInt(0))
      .toString();
  } else if (tokenType === TOKEN_TYPE.ERC721) {
    const abi = getAbi(TOKEN_TYPE.ERC721);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    balance = await ercContract.methods.balanceOf(ethereumAddress).call();
    tokenType = TOKEN_TYPE.ERC721;

    const incomingTokenTransferEvents = await ercContract.getPastEvents('Transfer', {
      filter: { to: ethereumAddress },
      fromBlock: 0,
      toBlock: 'latest',
    });
    const tokenIdsEvents = [];
    incomingTokenTransferEvents.forEach(event => {
      if (!tokenIdsEvents.includes(event.returnValues.tokenId))
        tokenIdsEvents.push(event.returnValues.tokenId);
    });

    await Promise.all(
      tokenIdsEvents.map(async tokenId => {
        const ownerTokenId = await ercContract.methods.ownerOf(tokenId).call();
        if (ownerTokenId === ethereumAddress) tokenIds.push({ tokenId, amount: '1' });
      }),
    );
  }

  return { tokenType, balance, tokenIds };
}

export { approve, getDecimals, getERCInfo, getTokensInfo };
