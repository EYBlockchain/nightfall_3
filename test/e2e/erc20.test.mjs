import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { createRequire } from 'module';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForEvent, expectTransaction, depositNTransactions, Web3Client } from '../utils.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { web3WsUrl, network } = process.env;

// we need require here to import jsons
const environments = require('./environments.json');
const mnemonics = require('./mnemonics.json');
const signingKeys = require('./signingKeys.json');
const { fee, transferValue, txPerBlock } = require('./configs.json');
const { tokenType, tokenId } = require('./tokenConfigs.json');

const environment = environments[network];
const nf3User1 = new Nf3(web3WsUrl, signingKeys.user1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];

before(async () => {
  await nf3User1.init(mnemonics.user1);
  erc20Address = await nf3User1.getContractAddress('ERC20Mock');

  stateAddress = await nf3User1.stateContractAddress;
  web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
});

describe('Synchronize with block proposed', () => {
  it('should get correct balance after deposit or synchronize with block proposed', async () => {
    let balances = await nf3User1.getLayer2Balances();
    let beforePkdBalance = 0;
    try {
      // eslint-disable-next-line prefer-destructuring
      beforePkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address][0];
    } catch {
      beforePkdBalance = 0;
    }

    if (beforePkdBalance !== 0) {
      await depositNTransactions(
        nf3User1,
        txPerBlock,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        fee,
      );
      //   stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      for (let i = 0; i < txPerBlock; i++) {
        // eslint-disable-next-line no-await-in-loop
        const res = await nf3User1.transfer(
          false,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          nf3User1.zkpKeys.compressedPkd,
          fee,
        );
        expectTransaction(res);
      }
      //   stateBalance += fee * txPerBlock + BLOCK_STAKE;
      eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      balances = await nf3User1.getLayer2Balances();
      const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address][0];
      if (afterPkdBalance - beforePkdBalance < txPerBlock * transferValue) {
        console.log(
          `      ${
            (txPerBlock * transferValue - (afterPkdBalance - beforePkdBalance)) / transferValue
          } tx missing for block`,
        );
        await depositNTransactions(
          nf3User1,
          (txPerBlock * transferValue - (afterPkdBalance - beforePkdBalance)) / transferValue,
          erc20Address,
          tokenType,
          transferValue,
          tokenId,
          fee,
        );
        // stateBalance +=
        //   fee * ((txPerBlock * value - (afterPkdBalance - beforePkdBalance)) / value) + BLOCK_STAKE;
        eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
      }
    }
  });
});

after(async () => {
  await nf3User1.close();
  await web3Client.closeWeb3();
});
