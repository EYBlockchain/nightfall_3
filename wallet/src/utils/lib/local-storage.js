/* ignore unused exports */

import { getContractAddress } from '../../common-files/utils/contract';
import getPrice from '../pricingAPI';

const STORAGE_VERSION_KEY = 'nightfallStorageVersion';
const STORAGE_VERSION = 1;
const TOKEN_POOL_KEY = 'nightfallTokensPool';
const RAW_TXS = 'rawTransactions';
const TX_OBJS = 'transactionObject';

const { SHIELD_CONTRACT_NAME } = global.config;

const storage = window.localStorage;

if (storage.getItem(RAW_TXS) === null) {
  storage.setItem(RAW_TXS, JSON.stringify([]));
}
if (storage.getItem(TX_OBJS) === null) {
  storage.setItem(TX_OBJS, JSON.stringify([]));
}

function init() {
  if (!storage.getItem(STORAGE_VERSION_KEY)) {
    storage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  }
}

function tokensSet(userKey, tokens) {
  init();
  storage.setItem(TOKEN_POOL_KEY + userKey, JSON.stringify(tokens));
}

function tokensGet(userKey) {
  const tokenString = storage.getItem(TOKEN_POOL_KEY + userKey);
  return JSON.parse(tokenString);
}

function clear() {
  storage.clear();
}

function pkdArraySet(userKey, pkds) {
  init();
  storage.setItem(`${userKey}/pkds`, JSON.stringify(pkds));
}

function pkdArrayGet(userKey) {
  return JSON.parse(storage.getItem(`${userKey}/pkds`));
}

async function setPricing(tokenIDs) {
  init();
  const now = Date.now();
  const pricingArray = await Promise.all(
    tokenIDs.map(async t => {
      const price = await getPrice(t);
      return {
        id: t,
        price,
      };
    }),
  );
  const pricingObject = pricingArray.reduce((acc, curr) => {
    acc[curr.id] = curr.price;
    return acc;
  }, {});
  storage.setItem(
    'pricing',
    JSON.stringify({
      time: now,
      ...pricingObject,
    }),
  );
}

function getPricing() {
  const retrievedPrice = storage.getItem('pricing');
  return JSON.parse(retrievedPrice);
}

function storeRawTx(tx) {
  storage.setItem(RAW_TXS, JSON.stringify([...JSON.parse(storage.getItem(RAW_TXS)), tx]));
}

function storeTxObject(txObj) {
  storage.setItem(TX_OBJS, JSON.stringify([...JSON.parse(storage.getItem(TX_OBJS)), txObj]));
}

async function shieldAddressSet() {
  init();
  const now = Date.now();
  const storedAddress = storage.getItem('/shieldAddress');
  try {
    if (storedAddress === null || now - storedAddress.now > 1000 * 3600 * 24 * 1) {
      const { address } = (await getContractAddress(SHIELD_CONTRACT_NAME)).data;
      console.log('Address', address);
      storage.setItem('/shieldAddress', JSON.stringify({ address, now }));
    }
  } catch (error) {
    console.log('errr', error);
    throw new Error('Could not get Shield Address');
  }
}

function shieldAddressGet() {
  const addressObj = storage.getItem('/shieldAddress');
  console.log('AddressObj', addressObj);
  if (!addressObj)
    return shieldAddressSet().then(() => {
      return shieldAddressGet();
    });
  const { address } = JSON.parse(storage.getItem('/shieldAddress'));
  return address;
}

export {
  tokensSet,
  tokensGet,
  clear,
  pkdArrayGet,
  pkdArraySet,
  setPricing,
  getPricing,
  storeRawTx,
  storeTxObject,
  shieldAddressSet,
  shieldAddressGet,
};
