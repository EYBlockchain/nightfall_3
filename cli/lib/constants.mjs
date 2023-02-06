export const TOKEN_TYPE = {
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
};

export const TX_TYPES = {
  DEPOSIT: 'deposit',
  TRANSFER: 'transfer',
  WITHDRAW: 'withdraw',
  INSTANT_WITHDRAW: 'instant-withdraw',
};

export const APPROVE_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

export const DEFAULT_FEE_TOKEN_VALUE = 10;
export const WEBSOCKET_PING_TIME = 15000;

export const GAS_MULTIPLIER = Number(process.env.GAS_MULTIPLIER) || 2;
export const GAS_PRICE_MULTIPLIER = Number(process.env.GAS_PRICE_MULTIPLIER) || 2;
export const GAS = process.env.GAS || 4000000;
export const GAS_PRICE = process.env.GAS_PRICE || '10000000000';
export const { GAS_ESTIMATE_ENDPOINT } = process.env;
