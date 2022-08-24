import { ethers } from 'ethers';
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
  const ercContract = new ethers.Contract(ercAddress, abi, provider);

  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const allowance = await ercContract.allowance(ownerAddress, spenderAddress);
      const allowanceBN = ethers.BigNumber.from(allowance);
      const valueBN = ethers.BigNumber.from(value);
      if (allowanceBN.lt(valueBN)) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY || encodeABI)
          return ercContract.interface.encodeFunctionData('approve', [
            spenderAddress,
            APPROVE_AMOUNT,
          ]);
        await ercContract.approve(spenderAddress, APPROVE_AMOUNT);
      }
      return Promise.resolve(false);
    }

    case TOKEN_TYPE.ERC721:
    case TOKEN_TYPE.ERC1155: {
      if (!(await ercContract.isApprovedForAll(ownerAddress, spenderAddress))) {
        if (process.env.USER_ETHEREUM_SIGNING_KEY || encodeABI)
          return ercContract.interface.encodeFunctionData('setApprovalForAll', [
            spenderAddress,
            true,
          ]);
        await ercContract.setApprovalForAll(spenderAddress, true);
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
  const ercContract = ethers.Contract(ercAddress, abi, provider);
  switch (tokenType) {
    case TOKEN_TYPE.ERC20: {
      const decimals = await ercContract.decimals();
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
      const ercContract = new ethers.Contract(ercAddress, abi, provider);
      const interface721 = await ercContract.supportsInterface('0x80ac58cd'); // ERC721 interface
      if (interface721) {
        tokenType = TOKEN_TYPE.ERC721;
      } else {
        const interface1155 = await ercContract.supportsInterface('0xd9b67a26'); // ERC1155 interface
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
    const ercContract = new ethers.Contract(ercAddress, abi, provider);
    balance = await ercContract.balanceOf(ethereumAddress);

    if (details) {
      // Transfer(from, to, tokenId)
      const filter = ercContract.filters.Transfer(null, ethereumAddress);
      const incomingTokenTransferEvents = await ercContract.queryFilter(filter, 0, 'latest');
      const tokenIdsEvents = [];
      incomingTokenTransferEvents.forEach(event => {
        if (!tokenIdsEvents.includes(event.args.tokenId)) tokenIdsEvents.push(event.args.tokenId);
      });

      await Promise.all(
        tokenIdsEvents.map(async tkId => {
          const ownerTokenId = await ercContract.ownerOf(tkId);
          if (ownerTokenId === ethereumAddress)
            tokenIds.push({ tokenId: ethers.utils.hexlify(tkId), amount: '1' });
        }),
      );
    }
  } else if (tokenType === TOKEN_TYPE.ERC1155) {
    // ERC1155
    const abi = getAbi(TOKEN_TYPE.ERC1155);
    const ercContract = new ethers.Contract(ercAddress, abi, provider);
    if (!tokenId) tokenId = 0;
    balance = await ercContract.balanceOf(ethereumAddress, tokenId);
    if (details) {
      // TransferBatch(operator, from, to, ids, values)
      let filter = ercContract.filters.TransferBatch();
      const incomingTokenTransferBatchEvents = await ercContract.queryFilter(filter, 0, 'latest');
      const tokenIdsEvents = [];
      incomingTokenTransferBatchEvents.forEach(event => {
        event.args.ids.forEach(id => {
          if (!tokenIdsEvents.includes(id)) tokenIdsEvents.push(id);
        });
      });
      // TransferSingle(operator, from, to, id, value)
      filter = ercContract.filters.TransferSingle();
      const incomingTokenTransferSingleEvents = await ercContract.queryFilter(filter, 0, 'latest');
      incomingTokenTransferSingleEvents.forEach(event => {
        if (!tokenIdsEvents.includes(event.args.id)) tokenIdsEvents.push(event.args.id);
      });

      await Promise.all(
        tokenIdsEvents.map(async Id => {
          let amount = await ercContract.balanceOf(ethereumAddress, Id);
          if (toEth) {
            decimals = await getDecimals(ercAddress, TOKEN_TYPE.ERC1155, provider);
            amount = fromBaseUnit(amount, decimals);
          }
          tokenIds.push({ tokenId: ethers.utils.hexlify(Id), amount });
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
      const ercContract = new ethers.Contract(ercAddress, abi, provider);
      balance = await ercContract.balanceOf(ethereumAddress);
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
