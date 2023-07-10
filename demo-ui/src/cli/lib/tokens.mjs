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
async function approve(
  ercAddress,
  ownerAddress,
  spenderAddress,
  tokenType,
  value,
  provider,
  encodeABI,
) {
  const abi = getAbi(tokenType);
  const ercContract = new provider.eth.Contract(abi, ercAddress);
  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const allowance = await ercContract.methods.allowance(ownerAddress, spenderAddress).call();
      const allowanceBN = new Web3.utils.BN(allowance);
      const valueBN = new Web3.utils.BN(value);
      if (allowanceBN.lt(valueBN)) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY || encodeABI)
          return ercContract.methods.approve(spenderAddress, APPROVE_AMOUNT).encodeABI();
        await ercContract.methods
          .approve(spenderAddress, APPROVE_AMOUNT)
          .send({ from: ownerAddress });
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.methods.isApprovedForAll(ownerAddress, spenderAddress).call())) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY || encodeABI)
          return ercContract.methods.setApprovalForAll(spenderAddress, true).encodeABI();
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
* @returns {Object} {balance, decimals, tokenType, details}
*/
async function getERCInfo(ercAddress, ethereumAddress, provider, options) {
  let toEth;
  let tokenId;
  let details;
  let tokenTypeFilter;

  if (typeof options !== 'undefined') {
    toEth = options.toEth;
    tokenId = options.tokenId;
    details = options.details;
    tokenTypeFilter = options.tokenType;
  }

  let tokenType;
  let balance;
  let decimals = 0;
  const tokenIds = [];

  if (tokenTypeFilter) {
    switch (tokenTypeFilter.toUpperCase()) {
      case 'ERC721':
        tokenType = TOKEN_TYPE.ERC721;
        break;
      case 'ERC1155':
        tokenType = TOKEN_TYPE.ERC1155;
        break;
      case 'ERC20':
        tokenType = TOKEN_TYPE.ERC20;
        break;
      default:
        throw new Error(`Unknown ERC token ${tokenTypeFilter}`);
    }
  } else {
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
  }

  if (tokenType === TOKEN_TYPE.ERC721) {
    // ERC721
    const abi = getAbi(TOKEN_TYPE.ERC721);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    balance = await ercContract.methods.balanceOf(ethereumAddress).call();

    if (details) {
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
        tokenIdsEvents.map(async tkId => {
          const ownerTokenId = await ercContract.methods.ownerOf(tkId).call();
          if (ownerTokenId === ethereumAddress) tokenIds.push({ tokenId: tkId, amount: '1' });
        }),
      );
    }
  } else if (tokenType === TOKEN_TYPE.ERC1155) {
    // ERC1155
    const abi = getAbi(TOKEN_TYPE.ERC1155);
    const ercContract = new provider.eth.Contract(abi, ercAddress);
    if (!tokenId) tokenId = 0;
    balance = await ercContract.methods.balanceOf(ethereumAddress, tokenId).call();
    if (details) {
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
          let amount = await ercContract.methods.balanceOf(ethereumAddress, Id).call();
          if (toEth) {
            decimals = await getDecimals(ercAddress, TOKEN_TYPE.ERC1155, provider);
            amount = fromBaseUnit(amount, decimals);
          }
          tokenIds.push({ tokenId: Id, amount });
        }),
      );

      balance = tokenIds
        .reduce((partialSum, tokenIdInfo) => partialSum + BigInt(tokenIdInfo.amount), BigInt(0))
        .toString();
    }
  } else {
    // expected ERC20
    try {
      const abi = getAbi(TOKEN_TYPE.ERC20);
      const ercContract = new provider.eth.Contract(abi, ercAddress);
      balance = await ercContract.methods.balanceOf(ethereumAddress).call();
      decimals = await getDecimals(ercAddress, TOKEN_TYPE.ERC20, provider);
      if (toEth) balance = fromBaseUnit(balance, decimals);
      if (details) tokenIds.push({ tokenId: 0, amount: balance });
    } catch {
      throw new Error('Unknown token type', ercAddress);
    }
  }

  let result = { balance, tokenType, details: tokenIds };
  if (tokenType === TOKEN_TYPE.ERC20) result = { ...result, decimals };
  else result = { ...result, decimals: 0 };
  return result;
}

export { approve, getDecimals, getERCInfo };
