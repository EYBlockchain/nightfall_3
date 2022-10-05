import Web3 from 'web3';
import config from 'config';
// eslint-disable-next-line import/no-unresolved
import logger from '../../common-files/utils/logger.mjs';

const { web3WsUrl, PROPOSER_KEY } =
  config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const {
  WEB3_PROVIDER_OPTIONS,
  WEB3_OPTIONS: { gas, gasPrice, fee },
} = config;

export class Web3Factory {
  constructor(privateKey) {
    this.web3Provider = new Web3.providers.WebsocketProvider(web3WsUrl, WEB3_PROVIDER_OPTIONS);

    this.web3 = new Web3(this.web3Provider);
    this.web3.eth.transactionBlockTimeout = 2000;
    this.web3.eth.transactionConfirmationBlocks = 12;

    this.web3Provider.on('error', err => logger.error(`web3 error: ${err}`));
    this.web3Provider.on('connect', () => logger.info('Blockchain Connected ...'));
    this.web3Provider.on('end', () => logger.info('Blockchain disconnected'));

    this.defaults = { gas, gasPrice, fee };

    this.privateKey = privateKey;
    this.address = this.web3.eth.accounts.privateKeyToAccount(privateKey).address;
  }
}

const { web3, defaults, address, privateKey } = new Web3Factory(PROPOSER_KEY);
export { web3, defaults, address, privateKey };
