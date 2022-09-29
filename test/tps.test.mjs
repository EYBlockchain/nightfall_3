/* eslint-disable no-await-in-loop */
import config from 'config';
import Nf3 from '../cli/lib/nf3.mjs';
import { pendingCommitmentCount, Web3Client } from './utils.mjs';
import logger from '../common-files/utils/logger.mjs';

const WEB3_WS_URL = 'wss://web3-ws.staging.polygon-nightfall.technology';

const environment = {
  clientApiUrl: 'http://localhost:8080',
  optimistApiUrl: 'https://optimist-api.staging.polygon-nightfall.technology',
  optimistWsUrl: 'wss://https://optimist-ws.staging.polygon-nightfall.technology:8080',
  web3WsUrl: WEB3_WS_URL,  
}; // config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

const {
  fee,
  transferValue,
  txPerBlock,
  tokenConfigs: { tokenType, tokenId },
  mnemonics,
  signingKeys,
} = config.TEST_OPTIONS;

const nf3User = new Nf3(signingKeys.user1, environment);

const web3Client = new Web3Client(WEB3_WS_URL);

let erc20Address;
let stateAddress;
const totalTx = txPerBlock * 10;

const eventLogs = [];

const emptyL2 = async () => {
  await new Promise(resolve => setTimeout(resolve, 6000));
  let count = await pendingCommitmentCount(nf3User);
  while (count !== 0) {
    await nf3User.makeBlockNow();
    try {
      await web3Client.waitForEvent(eventLogs, ['blockProposed']);
      count = await pendingCommitmentCount(nf3User);
    } catch (err) {
      break;
    }
  }
  await new Promise(resolve => setTimeout(resolve, 6000));
};


describe('TPS test', () => {
  before(async () => {

    await nf3User.init(mnemonics.user1);
    erc20Address = await nf3User.getContractAddress('ERC20Mock');

    stateAddress = await nf3User.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    logger.info({
      erc20Address,
      stateAddress
    });
  });

  describe('Deposits', () => {
    it(`should do ${totalTx} deposits`, async function () {
      emptyL2();
      for (let i = 0; i < totalTx; i++) {
        console.log(`deposit number ${i}`);
        await nf3User.deposit(erc20Address, tokenType, transferValue, tokenId, fee);
      }
    });
  });

  after(async () => {
    logger.info('Closing connections');
    await nf3User.close();
    await web3Client.closeWeb3();
  });
});
