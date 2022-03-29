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

export const DEFAULT_FEE = 10;
export const DEFAULT_PROPOSER_BOND = 10;
export const DEFAULT_BLOCK_STAKE = 1;

export const WEB3_PROVIDER_OPTIONS = {
  clientConfig: {
    // Useful to keep a connection alive
    keepalive: true,
    keepaliveInterval: 60000,
  },
  timeout: 3600000,
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 120,
    onTimeout: false,
  },
};
