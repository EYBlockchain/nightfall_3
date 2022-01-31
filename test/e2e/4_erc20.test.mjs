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
const nf3Proposer1 = new Nf3(web3WsUrl, signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc20Address;
let stateAddress;
let eventLogs = [];

describe('ERC20 tests', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();
    await nf3Proposer1.addPeer(environment.optimistApiUrl);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      console.log(
        `Block proposal gas cost was ${gasUsed}, cost per transaction was ${gasUsed / txPerBlock}`,
      );
    });

    await nf3User1.init(mnemonics.user1);
    erc20Address = await nf3User1.getContractAddress('ERC20Mock');

    stateAddress = await nf3User1.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

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

  it('should deposit some ERC20 crypto into a ZKP commitment', async function () {
    // Need at least 5 deposits to perform all the necessary transfers
    // set the number of deposit transactions blocks to perform.
    const numDeposits = txPerBlock >= 5 ? 1 : Math.ceil(5 / txPerBlock);

    console.log(`      Sending ${txPerBlock * numDeposits} deposits...`);
    // We create enough transactions to fill numDeposits blocks full of deposits.
    const depositTransactions = await depositNTransactions(
      nf3User1,
      txPerBlock * numDeposits,
      erc20Address,
      tokenType,
      transferValue,
      tokenId,
      fee,
    );
    // stateBalance += (fee * txPerBlock + BLOCK_STAKE) * numDeposits;
    // Wait until we see the right number of blocks appear
    eventLogs = await waitForEvent(eventLogs, ['blockProposed'], numDeposits);
    const totalGas = depositTransactions.reduce((acc, { gasUsed }) => acc + Number(gasUsed), 0);
    console.log(`     Average Gas used was ${Math.ceil(totalGas / (txPerBlock * numDeposits))}`);
  });

  // Skipping because of #437
  it.skip('should increment the balance after deposit some ERC20 crypto', async function () {
    let balances = await nf3User1.getLayer2Balances();
    const currentPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address][0];
    // We do txPerBlock deposits of 10 each
    await depositNTransactions(
      nf3User1,
      txPerBlock,
      erc20Address,
      tokenType,
      transferValue,
      tokenId,
      fee,
    );
    // stateBalance += fee * txPerBlock + BLOCK_STAKE;
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    balances = await nf3User1.getLayer2Balances();
    const afterPkdBalance = balances[nf3User1.zkpKeys.compressedPkd][erc20Address][0];
    expect(afterPkdBalance - currentPkdBalance).to.be.equal(txPerBlock * transferValue);
  });
  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3User1.close();
    await web3Client.closeWeb3();
  });
});
