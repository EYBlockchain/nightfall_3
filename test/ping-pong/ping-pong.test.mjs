import config from 'config';
import { expect } from 'chai';
import { retrieveL2Balance } from '../utils.mjs';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  proposerTest,
  setParametersConfig,
  getStakeAccount,
  getCurrentProposer,
  simpleUserTest,
} from './index.mjs';

const { mnemonics, signingKeys, clientApiUrls, optimistApiUrls, optimistWsUrls, fee } =
  config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;
const { TEST_ERC20_ADDRESS } = process.env;

const nf3Users = [];
let blockStake;
const listAddresses = [];
const listTransfersTotal = [];
const TEST_LENGTH = 4;
const value = 10;
let ercAddress;

let nf3User;

const getOptimistUrls = async () => {
  // const optimistUrls = [];
  // TODO: Replace when the nightfall node is available with the prop.url
  /* const resultProposers = await nf3User.getProposers();
  for (const prop of resultProposers.proposers) {
    optimistUrls.push({
      proposer: prop.thisAddress,
      optimistUrl: prop.url,
    });
  } */

  const optimistUrls = [
    {
      proposer: nf3User.web3.eth.accounts.privateKeyToAccount(signingKeys.proposer2).address,
      optimistUrl: optimistApiUrls.optimist2,
    },
    {
      proposer: nf3User.web3.eth.accounts.privateKeyToAccount(signingKeys.proposer1).address,
      optimistUrl: optimistApiUrls.optimist1,
    },
  ];
  return optimistUrls;
};

const getInitialProposerStats = async optimistUrls => {
  const proposersStats = {
    proposersBlocks: {},
    sprints: 0,
    proposersInitialStakes: [],
    proposersFinalStakes: [],
  }; // initialize stats for the test

  for (const prop of optimistUrls) {
    // eslint-disable-next-line no-await-in-loop
    const stakeAccount = await getStakeAccount(prop.proposer);
    proposersStats.proposersInitialStakes.push({
      proposer: prop.proposer.toUpperCase(),
      stake: stakeAccount,
    });
  }
  return proposersStats;
};

const getInitialUserStats = async () => {
  const usersStats = {
    usersInitialBalance: [],
    usersFinalBalance: [],
    usersTotalTransferred: [],
  }; // initialize stats for the test

  for (const nf3 of nf3Users) {
    // eslint-disable-next-line no-await-in-loop
    const balanceAccount = await retrieveL2Balance(nf3, ercAddress);
    usersStats.usersInitialBalance.push({
      address: nf3.zkpKeys.compressedZkpPublicKey,
      balance: balanceAccount,
    });
  }
  return usersStats;
};

const waitForCurrentProposer = async () => {
  let currentProposer = await getCurrentProposer();
  // let proposers boot and wait until we have the current proposer registered from the services
  while (currentProposer.thisAddress === '0x0000000000000000000000000000000000000000') {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 10000));
    // eslint-disable-next-line no-await-in-loop
    currentProposer = await getCurrentProposer();
  }
  console.log('CURRENT PROPOSER: ', currentProposer);
};

const initializeUsersParameters = async () => {
  const signingKeysUsers = [signingKeys.user1, signingKeys.user2];
  const mnemonicsUsers = [mnemonics.user1, mnemonics.user2];
  console.log('SIGNING KEYS: ', signingKeysUsers);
  console.log('MNEMONICS USERS: ', mnemonicsUsers);

  const environmentUser1 = { ...environment };
  environmentUser1.clientApiUrl = clientApiUrls.client1 || environmentUser1.clientApiUrl;
  environmentUser1.optimistApiUrl = optimistApiUrls.optimist1 || environmentUser1.optimistApiUrl;
  environmentUser1.optimistWsUrl = optimistWsUrls.optimist1 || environmentUser1.optimistWsUrl;
  nf3Users.push(new Nf3(signingKeys.user1, environmentUser1));

  const environmentUser2 = { ...environment };
  environmentUser2.clientApiUrl = clientApiUrls.client2 || environmentUser2.clientApiUrl;
  environmentUser2.optimistApiUrl = optimistApiUrls.optimist2 || environmentUser2.optimistApiUrl;
  environmentUser2.optimistWsUrl = optimistWsUrls.optimist2 || environmentUser2.optimistWsUrl;
  nf3Users.push(new Nf3(signingKeys.user2, environmentUser2));

  console.log('ENVIRONMENT FOR USER1: ', environmentUser1);
  console.log('ENVIRONMENT FOR USER2: ', environmentUser2);
  for (let i = 0; i < signingKeysUsers.length; i++) {
    console.log(`Initializing user with menmonic ${mnemonicsUsers[i]}`);
    // eslint-disable-next-line no-await-in-loop
    await nf3Users[i].init(mnemonicsUsers[i]);
    console.log(`USER ETH ADDRESS: ${nf3Users[i].ethereumAddress}`);
    // eslint-disable-next-line no-await-in-loop
    const balance = await nf3Users[i].getL1Balance(nf3Users[i].ethereumAddress);
    console.log(`BALANCE user ${nf3Users[i].ethereumAddress}: ${balance}`);
  }

  // add addresses of the users
  for (let i = 0; i < nf3Users.length; i++) {
    listAddresses.push(nf3Users[i].zkpKeys.compressedZkpPublicKey);
  }
};

const waitForTransfersCompleted = async () => {
  let nTotalTransfers = 0;

  do {
    nTotalTransfers = 0;
    for (let i = 0; i < listTransfersTotal.length; i++) {
      nTotalTransfers += listTransfersTotal[i].length;
    }
    console.log(
      `Waiting for total transfers to be ${TEST_LENGTH * 3 * nf3Users.length}...`,
      nTotalTransfers,
    );
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolving => setTimeout(resolving, 20000));
  } while (nTotalTransfers < TEST_LENGTH * 3 * nf3Users.length);
  console.log('TRANSERS: ', listTransfersTotal);
};

const waitForBalanceUpdate = async usersStats => {
  for (let i = 0; i < nf3Users.length; i++) {
    let totalTransferred = 0;
    // eslint-disable-next-line no-loop-func
    for (let j = 0; j < listTransfersTotal.length; j++) {
      // eslint-disable-next-line no-loop-func
      listTransfersTotal[j].forEach(t => {
        if (t.to === nf3Users[i].zkpKeys.compressedZkpPublicKey) {
          totalTransferred += t.value;
        }
        if (
          t.to !== nf3Users[i].zkpKeys.compressedZkpPublicKey &&
          t.from === nf3Users[i].zkpKeys.compressedZkpPublicKey
        ) {
          totalTransferred -= t.value + t.fee;
        }
      });
    }

    const userInitialBalance = usersStats.usersInitialBalance.filter(
      // eslint-disable-next-line no-loop-func
      u => u.address === nf3Users[i].zkpKeys.compressedZkpPublicKey,
    )[0]?.balance;

    usersStats.usersTotalTransferred.push({
      address: nf3Users[i].zkpKeys.compressedZkpPublicKey,
      value: totalTransferred,
    });

    // eslint-disable-next-line no-await-in-loop
    let userFinalBalance = await retrieveL2Balance(nf3Users[i], ercAddress);

    while (userFinalBalance !== userInitialBalance + totalTransferred) {
      // eslint-disable-next-line no-await-in-loop
      console.log(
        `Waiting for user ${nf3Users[i].zkpKeys.compressedZkpPublicKey} balance to be ${
          userInitialBalance + totalTransferred
        }...`,
        userFinalBalance,
      );
      // eslint-disable-next-line no-await-in-loop
      userFinalBalance = await retrieveL2Balance(nf3Users[i], ercAddress);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolving => setTimeout(resolving, 20000));
    }

    console.log(
      `Final user balance for user ${nf3Users[i].zkpKeys.compressedZkpPublicKey} = ${
        userInitialBalance + totalTransferred
      }`,
    );

    usersStats.usersFinalBalance.push({
      address: nf3Users[i].zkpKeys.compressedZkpPublicKey,
      // eslint-disable-next-line no-await-in-loop
      balance: await retrieveL2Balance(nf3Users[i], ercAddress),
    });
  }
};

const finalStatsCheck = async (optimistUrls, proposersStats) => {
  for (const prop of optimistUrls) {
    // eslint-disable-next-line no-await-in-loop
    const stakeAccount = await getStakeAccount(prop.proposer);
    proposersStats.proposersFinalStakes.push({
      proposer: prop.proposer.toUpperCase(),
      stake: stakeAccount,
    });
  }

  if (proposersStats.proposersBlocks) {
    console.log('FINAL PROPOSERS STATS:');
    console.log('  - BLOCKS:');
    for (const pb of proposersStats.proposersBlocks) {
      console.log(`     ${pb.proposer} : ${pb.blocks}`);
    }
    console.log('  - INITIAL STAKES:');
    for (const p of proposersStats.proposersInitialStakes) {
      console.log(`     ${p.proposer} : ${p.stake}`);
    }
    console.log('  - FINAL STAKES:');
    for (const p of proposersStats.proposersFinalStakes) {
      console.log(`     ${p.proposer} : ${p.stake}`);
      const pInitial = proposersStats.proposersInitialStakes.find(pi => pi.proposer === p.proposer);
      const pBlocks = proposersStats.proposersBlocks.find(pb => pb.proposer === p.proposer);
      if (pBlocks) {
        // only if this proposer has proposed blocks
        expect(Number(p.stake.challengeLocked)).to.be.equal(
          Number(pInitial.stake.challengeLocked) + Number(pBlocks.blocks) * Number(blockStake),
        );
      }
    }
    console.log(`  - SPRINTS: ${proposersStats.sprints}`);

    expect(proposersStats.sprints).to.be.greaterThan(0);
  }
};

// ************ Test ************
describe('Ping-pong tests', () => {
  before(async () => {
    environment.clientApiUrl = clientApiUrls.client1 || environment.clientApiUrl;
    environment.optimistApiUrl = optimistApiUrls.optimist1 || environment.optimistApiUrl;
    environment.optimistWsUrl = optimistWsUrls.optimist1 || environment.optimistWsUrl;

    console.log('ENVIRONMENT FOR USER STATS', environment);
    nf3User = new Nf3(signingKeys.liquidityProvider, environment);

    await nf3User.init(mnemonics.liquidityProvider);
    await setParametersConfig(nf3User); // initialize parameters and contracts
    ercAddress = TEST_ERC20_ADDRESS || (await nf3User.getContractAddress('ERC20Mock'));
  });

  it('Runs ping-pong tests', async () => {
    let proposersStats;
    let optimistUrls;
    if (environment.web3WsUrl.includes('localhost')) {
      optimistUrls = await getOptimistUrls(); // get optimist urls for the different proposers from docker files
      console.log(optimistUrls);
      proposersStats = await getInitialProposerStats(optimistUrls);
      blockStake = await nf3User.getBlockStake();
      console.log('BLOCKSTAKE: ', blockStake);
    }
    // wait for the current proposer to be ready
    await waitForCurrentProposer();

    // set user parameters
    await initializeUsersParameters();
    const usersStats = await getInitialUserStats();
    console.log('INITIAL BALANCES', usersStats);

    for (let i = 0; i < nf3Users.length; i++) {
      const listAddressesToSend = listAddresses.filter(
        // eslint-disable-next-line no-loop-func
        address => address !== nf3Users[i].zkpKeys.compressedZkpPublicKey,
      );
      const listTransfersUser = []; // transfers done in the simple user test for this user
      listTransfersTotal.push(listTransfersUser);
      simpleUserTest(
        TEST_LENGTH,
        value,
        fee,
        ercAddress,
        nf3Users[i],
        listAddressesToSend,
        listTransfersUser,
      );
    }

    // if (environment.web3WsUrl.includes('localhost')) {
    // user that will rotate proposers and get block statistics
    proposerTest(optimistUrls, proposersStats, nf3User);
    // }

    // wait for all the user transfers to be completed
    await waitForTransfersCompleted();

    // wait for balances update
    await waitForBalanceUpdate(usersStats);

    if (environment.web3WsUrl.includes('localhost')) {
      // check final stats are ok
      await finalStatsCheck(optimistUrls, proposersStats);
    }
  });

  after(async () => {
    nf3User.close();
  });
});
