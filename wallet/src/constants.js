/* ignore unused exports */
const DEFAULT_NF_ADDRESS_INDEX = 0;
const NF3_GITHUB_ISSUES_URL = 'https://github.com/EYBlockchain/nightfall_3/issues';
const DEFAULT_TOKEN_TYPE = 'ERC20';
const DEFAULT_TOKEN_ADDRESS = {
  ERC20: '0xb5acbe9a0f1f8b98f3fc04471f7fe5d2c222cb44'.toLowerCase(),
  ERC721: '0x103ac4b398bca487df8b27fd484549e33c234b0d'.toLowerCase(),
  ERC1155: '0x9635c600697587dd8e603120ed0e76cc3a9efe4c'.toLowerCase(),
};

const DEFAULT_DEPOSIT_AMOUNT = 0;
const DEFAULT_DEPOSIT_FEE = 10;
const DEFAULT_INSTANT_WITHDRAW_FEE = 100;
const DEFAULT_TOKEN_ID = {
  ERC20: [0],
  ERC721: ['1', '2', '3'],
  ERC1155: ['1', '2', '3', '4'],
};

const METAMASK_MESSAGE =
  'This signature is required to unlock your Nightfall account. Sign this message only if you are in a trusted application.';

const TRANSACTION_MAX_RETRIES = 10;
const TRANSACTION_RETRY_PERIOD = 10000; // 10s
// TODO - verify balance refres rate
const BALANCE_INTERVAL = 5000;

export {
  DEFAULT_NF_ADDRESS_INDEX,
  NF3_GITHUB_ISSUES_URL,
  DEFAULT_TOKEN_TYPE,
  DEFAULT_TOKEN_ADDRESS,
  DEFAULT_DEPOSIT_FEE,
  DEFAULT_INSTANT_WITHDRAW_FEE,
  DEFAULT_DEPOSIT_AMOUNT,
  DEFAULT_TOKEN_ID,
  METAMASK_MESSAGE,
  TRANSACTION_MAX_RETRIES,
  TRANSACTION_RETRY_PERIOD,
  BALANCE_INTERVAL,
};
