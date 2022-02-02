import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { createRequire } from 'module';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForEvent, expectTransaction, Web3Client } from '../utils.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { web3WsUrl, network } = process.env;

// we need require here to import jsons
const environments = require('./environments.json');
const mnemonics = require('./mnemonics.json');
const signingKeys = require('./signingKeys.json');
const { fee, txPerBlock, transferValue } = require('./configs.json');
const { tokenTypeERC1155 } = require('./tokenConfigs.json');
const { tokenType, tokenId } = require('./tokenConfigs.json');

const environment = environments[network];
const nf3Users = [
  new Nf3(web3WsUrl, signingKeys.user1, environment),
  new Nf3(web3WsUrl, signingKeys.user2, environment),
];
const nf3Proposer1 = new Nf3(web3WsUrl, signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc1155Address;
// why do we need an ERC20 token in an ERC1155 test, you ask?
// let me tell you I also don't know, but I guess we just want to fill some blocks?
let erc20Address;
let stateAddress;
let eventLogs = [];

describe('ERC1155 tests', () => {
  before(async () => {
    await nf3Proposer1.init(mnemonics.proposer);
    await nf3Proposer1.registerProposer();
    await nf3Proposer1.addPeer(environment.optimistApiUrl);

    // Proposer listening for incoming events
    const newGasBlockEmitter = await nf3Proposer1.startProposer();
    newGasBlockEmitter.on('gascost', async gasUsed => {
      if (process.env.GAS_COSTS)
        console.log(
          `Block proposal gas cost was ${gasUsed}, cost per transaction was ${
            gasUsed / txPerBlock
          }`,
        );
    });

    const { proposers } = await nf3Proposer1.getProposers();
    console.log('ERC20: ', proposers);

    await nf3Users[0].init(mnemonics.user1);
    await nf3Users[1].init(mnemonics.user2);
    G;
    erc20Address = await nf3Users[0].getContractAddress('ERC20Mock');
    erc1155Address = await nf3Users[0].getContractAddress('ERC1155Mock');

    stateAddress = await nf3Users[0].stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });
  });

  // Skipping because of #437
  it.skip('should deposit some ERC1155 crypto into a ZKP commitment', async function () {
    const Id1 = 1;
    const Id2 = 4;

    let balances = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    let list = [];
    let balanceBefore = 0;
    let balanceBefore2 = 0;
    try {
      list = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];
      balanceBefore = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
      balanceBefore2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;
    } catch {
      list = [];
      balanceBefore = 0;
      balanceBefore2 = 0;
    }
    // We create enough transactions to fill numDeposits blocks full of deposits.
    let res = await nf3Users[0].deposit(erc1155Address, tokenTypeERC1155, transferValue, 1, fee);
    expectTransaction(res);
    res = await nf3Users[0].deposit(erc1155Address, tokenTypeERC1155, transferValue * 2, 4, fee);
    expectTransaction(res);
    // stateBalance += fee * 2 + BLOCK_STAKE;
    // Wait until we see the right number of blocks appear
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

    balances = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    list = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];

    const balanceAfter = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address].find(
      tkInfo => tkInfo.tokenId === Id1,
    ).balance;
    const balanceAfter2 = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address].find(
      tkInfo => tkInfo.tokenId === Id2,
    ).balance;
    expect(Number(BigInt(balanceAfter) - BigInt(balanceBefore))).to.be.equal(Number(transferValue));
    expect(Number(BigInt(balanceAfter2) - BigInt(balanceBefore2))).to.be.equal(
      Number(transferValue * 2),
    );
  });

  // Skipping because of #437
  it.skip('should increment the balance after deposit some ERC1155 crypto', async function () {
    const Id1 = 1;
    const Id2 = 4;
    let balances = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    let list = [];
    let beforePkdBalance1 = 0;
    let beforePkdBalance2 = 0;
    try {
      list = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];
      beforePkdBalance1 = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
      beforePkdBalance2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;
    } catch {
      list = [];
      beforePkdBalance1 = 0;
      beforePkdBalance2 = 0;
    }
    // We create enough transactions to fill numDeposits blocks full of deposits.
    let res = await nf3Users[0].deposit(erc1155Address, tokenTypeERC1155, transferValue, Id1, fee);
    expectTransaction(res);
    res = await nf3Users[0].deposit(erc1155Address, tokenTypeERC1155, transferValue * 2, Id2, fee);
    expectTransaction(res);
    // stateBalance += fee * 2 + BLOCK_STAKE;
    // Wait until we see the right number of blocks appear
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

    balances = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    list = balances[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];
    const afterPkdBalance1 = list.find(tkInfo => tkInfo.tokenId === Id1).balance;
    const afterPkdBalance2 = list.find(tkInfo => tkInfo.tokenId === Id2).balance;

    expect(Number(BigInt(afterPkdBalance1) - BigInt(beforePkdBalance1))).to.be.equal(transferValue);
    expect(Number(BigInt(afterPkdBalance2) - BigInt(beforePkdBalance2))).to.be.equal(
      transferValue * 2,
    );
  });

  // Skipping because of #437
  it.skip('should decrement the balance after transfer ERC1155 to other wallet and increment the other wallet', async function () {
    const Id1 = 1;

    // We create enough transactions to fill numDeposits blocks full of deposits.
    for (let i = 0; i < txPerBlock; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await nf3Users[0].deposit(
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        Id1,
        fee,
      );
      expectTransaction(res);
    }
    // stateBalance += fee * 2 + BLOCK_STAKE;
    // Wait until we see the right number of blocks appear
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

    let balancesUser1 = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    let balancesUser2 = await nf3Users[1].getLayer2BalancesDetails([erc1155Address]);
    let list1 = balancesUser1[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];
    const beforePkdBalance1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;
    let list2 = [];
    let beforePkdBalance2 = 0;
    try {
      list2 = balancesUser2[nf3Users[1].zkpKeys.compressedPkd][erc1155Address];
      beforePkdBalance2 = list2.find(tkInfo => tkInfo.tokenId === Id1).balance;
    } catch {
      list2 = [];
      beforePkdBalance2 = 0;
    }

    for (let i = 0; i < txPerBlock; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await nf3Users[0].transfer(
        false,
        erc1155Address,
        tokenTypeERC1155,
        transferValue,
        Id1,
        nf3Users[1].zkpKeys.compressedPkd,
        fee,
      );
      expectTransaction(res);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // stateBalance += fee * 2 + BLOCK_STAKE;
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);

    // transfer to self address to avoid race conditions issue
    for (let i = 0; i < txPerBlock; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await nf3Users[0].transfer(
        false,
        erc20Address,
        tokenType,
        transferValue,
        tokenId,
        nf3Users[0].zkpKeys.compressedPkd,
        fee,
      );
      expectTransaction(res);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    // stateBalance += fee * txPerBlock + BLOCK_STAKE;
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    await new Promise(resolve => setTimeout(resolve, 10000));
    balancesUser1 = await nf3Users[0].getLayer2BalancesDetails([erc1155Address]);
    balancesUser2 = await nf3Users[1].getLayer2BalancesDetails([erc1155Address]);
    list1 = balancesUser1[nf3Users[0].zkpKeys.compressedPkd][erc1155Address];
    list2 = balancesUser2[nf3Users[1].zkpKeys.compressedPkd][erc1155Address];
    const afterPkdBalancePkd1 = list1.find(tkInfo => tkInfo.tokenId === Id1).balance;
    const afterPkdBalancePkd2 = list2.find(tkInfo => tkInfo.tokenId === Id1).balance;

    expect(Number(BigInt(afterPkdBalancePkd1) - BigInt(beforePkdBalance1))).to.be.equal(
      -2 * transferValue,
    );
    expect(Number(BigInt(afterPkdBalancePkd2) - BigInt(beforePkdBalance2))).to.be.equal(
      2 * transferValue,
    );
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3Users[0].close();
    await nf3Users[1].close();
    await web3Client.closeWeb3();
  });
});
