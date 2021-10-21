/* ignore unused exports */
const DEFAULT_PRIVATE_KEY = '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e';
const DEFAULT_ENVIRONMENT = 'Localhost';
const NF3_GITHUB_ISSUES_URL = 'https://github.com/EYBlockchain/nightfall_3/issues';
const DEFAULT_TOKEN_TYPE = 'ERC20';
const TOKEN_TYPE = {
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
};
const DEFAULT_TOKEN_ADDRESS = {
  ERC20: '0xe1b7B854F19A2CEBF96B433ba30050D8890618ab'.toLowerCase(),
  ERC721: '2',
  ERC1155: '3',
};

const DEFAULT_DEPOSIT_AMOUNT = 0;
const DEFAULT_DEPOSIT_FEE = 10;
const DEFAULT_INSTANT_WITHDRAW_FEE = 100;
const DEFAULT_TOKEN_ID = {
  ERC20: 0,
  ERC721: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ERC1155: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

const TX_TYPES = {
  DEPOSIT: 'deposit',
  TRANSFER: 'transfer',
  WITHDRAW: 'withdraw',
  INSTANT_WITHDRAW: 'instant-withdraw',
};

const METAMASK_MESSAGE = 'Sign this message only if you are in a trusted application.';

const TRANSACTION_MAX_RETRIES = 10;
const TRANSACTION_RETRY_PERIOD = 10000; // 10s

export {
  DEFAULT_PRIVATE_KEY,
  DEFAULT_ENVIRONMENT,
  NF3_GITHUB_ISSUES_URL,
  DEFAULT_TOKEN_TYPE,
  DEFAULT_TOKEN_ADDRESS,
  DEFAULT_DEPOSIT_FEE,
  DEFAULT_INSTANT_WITHDRAW_FEE,
  DEFAULT_DEPOSIT_AMOUNT,
  DEFAULT_TOKEN_ID,
  TOKEN_TYPE,
  TX_TYPES,
  METAMASK_MESSAGE,
  TRANSACTION_MAX_RETRIES,
  TRANSACTION_RETRY_PERIOD,
};
