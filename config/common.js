const BLOCKCHAIN_URL = `ws://${process.env.BLOCKCHAIN_WS_HOST}:${process.env.BLOCKCHAIN_PORT}`;

const WEB3_OPTIONS = {
  gas: process.env.GAS || 8000000,
  gasPrice: process.env.GAS_PRICE || '20000000000',
  from: process.env.FROM_ADDRESS || process.env.ETH_ADDRESS,
};

const { ETH_PRIVATE_KEY } = process.env;

module.exports = {
  BLOCKCHAIN_URL,
  WEB3_OPTIONS,
  ETH_PRIVATE_KEY,
};
