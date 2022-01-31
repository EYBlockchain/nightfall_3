import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiAsPromised from 'chai-as-promised';
import { createRequire } from 'module';
import Nf3 from '../../cli/lib/nf3.mjs';
import { waitForEvent, expectTransaction, Web3Client } from '../utils.mjs';
import { getERCInfo } from '../../cli/lib/tokens.mjs';

// so we can use require with mjs file
const require = createRequire(import.meta.url);
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const { web3WsUrl, network } = process.env;

// we need require here to import jsons
const environments = require('./environments.json');
const mnemonics = require('./mnemonics.json');
const signingKeys = require('./signingKeys.json');
const { fee, txPerBlock } = require('./configs.json');
const { tokenTypeERC721 } = require('./tokenConfigs.json');

const environment = environments[network];
const nf3User1 = new Nf3(web3WsUrl, signingKeys.user1, environment);
const nf3Proposer1 = new Nf3(web3WsUrl, signingKeys.proposer1, environment);

const web3Client = new Web3Client();

let erc721Address;
let stateAddress;
let eventLogs = [];
let availableTokenIds;

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

    const { proposers } = await nf3Proposer1.getProposers();
    console.log('ERC20: ', proposers);

    await nf3User1.init(mnemonics.user1);
    erc721Address = await nf3User1.getContractAddress('ERC721Mock');

    stateAddress = await nf3User1.stateContractAddress;
    web3Client.subscribeTo('logs', eventLogs, { address: stateAddress });

    availableTokenIds = (
      await getERCInfo(erc721Address, nf3User1.ethereumAddress, web3Client.getWeb3(), {
        details: true,
      })
    ).details.map(t => t.tokenId);
  });

  // Skipping because of #437
  it.skip('should deposit some ERC721 crypto into a ZKP commitment', async function () {
    let balances = await nf3User1.getLayer2Balances();
    let balanceBefore = 0;
    try {
      // eslint-disable-next-line prefer-destructuring
      balanceBefore = balances[nf3User1.zkpKeys.compressedPkd][erc721Address][0];
      if (!balanceBefore) balanceBefore = 0;
    } catch {
      balanceBefore = 0;
    }
    // We create enough transactions to fill numDeposits blocks full of deposits.
    let res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 0, availableTokenIds[0], fee);
    expectTransaction(res);
    res = await nf3User1.deposit(erc721Address, tokenTypeERC721, 0, availableTokenIds[1], fee);
    expectTransaction(res);
    // stateBalance += fee * 2 + BLOCK_STAKE;
    // Wait until we see the right number of blocks appear
    eventLogs = await waitForEvent(eventLogs, ['blockProposed']);
    balances = await nf3User1.getLayer2Balances();

    const balanceAfter = balances[nf3User1.zkpKeys.compressedPkd][erc721Address][0];
    expect(balanceAfter - balanceBefore).to.be.equal(2);
  });

  after(async () => {
    await nf3Proposer1.deregisterProposer();
    await nf3Proposer1.close();
    await nf3User1.close();
    await web3Client.closeWeb3();
  });
});
