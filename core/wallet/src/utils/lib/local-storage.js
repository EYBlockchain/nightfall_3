/* ignore unused exports */

import getPrice from '../pricingAPI';

const STORAGE_VERSION_KEY = 'nightfallStorageVersion';
const STORAGE_VERSION = 1;
const TOKEN_POOL_KEY = 'nightfallTokensPool';

const storage = window.localStorage;

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

export { tokensSet, tokensGet, clear, pkdArrayGet, pkdArraySet, setPricing, getPricing };
