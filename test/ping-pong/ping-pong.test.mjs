import config from 'config';
import { expect } from 'chai';
import { retrieveL2Balance, Web3Client } from '../utils.mjs';
// instead of our usual cli we need to import
// adversary transpiled version of cli.
// please do not forget to run `npm run build-adversary`
// eslint-disable-next-line import/no-unresolved
import Nf3 from '../adversary/adversary-cli/lib/nf3.mjs';
import {
  proposerStats,
  setParametersConfig,
  getStakeAccount,
  getCurrentProposer,
  simpleUserTest,
} from './index.mjs';

const { mnemonics, signingKeys, clientApiUrls, optimistApiUrls, optimistWsUrls, fee } =
  config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[config.ENVIRONMENT];
const { TEST_ERC20_ADDRESS } = process.env;
const CLIENT2_TX_TYPES_SEQUENCE = process.env.CLIENT2_TX_TYPES_SEQUENCE || 'ValidTransaction';

const nf3Users = [];
let blockStake;
const listAddresses = [];
const listTransactionsTotal = [];
const TEST_LENGTH = 4;
const value = 10;
const web3Client = new Web3Client();
let ercAddress;

let nf3User;

/**
  Get the 2 proposers in local with the corresponding optimists url to call makeblock when they are current proposer.
  @method
  @async
  */
const getOptimistUrls = async () => {
  const optimistUrls = [];
  const resultProposers = await nf3User.getProposers();
  for (const prop of resultProposers.proposers) {
    optimistUrls.push({
      proposer: prop.thisAddress,
      optimistUrl: prop.url,
    });
  }

  // TODO: No need to do this when the nightfall node is available with the prop.url that is the same as optimist url
  if (environment.web3WsUrl.includes('localhost')) {
    let optimistUrlProposer1 = optimistUrls.find(
      o =>
        o.proposer === nf3User.web3.eth.accounts.privateKeyToAccount(signingKeys.proposer1).address,
    );
    // this is because we use proposer3 key by default in docker-compose to avoid collision with default proposer. If not defined in the file it will be proposer3 key
    if (!optimistUrlProposer1) {
      optimistUrlProposer1 = optimistUrls.find(
        o =>
          o.proposer ===
          nf3User.web3.eth.accounts.privateKeyToAccount(signingKeys.proposer3).address,
      );
    }
    optimistUrlProposer1.optimistUrl = optimistApiUrls.optimist1;

    const optimistUrlProposer2 = optimistUrls.find(
      o =>
        o.proposer === nf3User.web3.eth.accounts.privateKeyToAccount(signingKeys.proposer2).address,
    );
    optimistUrlProposer2.optimistUrl = optimistApiUrls.optimist2;
  }
  return optimistUrls;
};

/**
  Get initial proposer statistics for checking at the end the results after the test.
  @method
  @async
  @param {object} optimistUls - otimist urls for each proposer
  */
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

/**
  Get initial statistics for the users about balances.
  @method
  @async
  */
const getInitialUserStats = async () => {
  const usersStats = {
    usersInitialBalance: [],
    usersFinalBalance: [],
    usersTotalValueL2: [],
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

/**
  Wait for current proposer to be assigned.
  @method
  @async
  */
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

const getTxTypesToSend = txTypesSequence => {
  // we will produce this types of tx after the first deposits with transfer, deposit, withdraw in the loop
  const TxTypes = Array(TEST_LENGTH * 3).fill('ValidTransaction');
  const replaceTxTypes = txTypesSequence;
  const length = replaceTxTypes.length < TxTypes.length ? replaceTxTypes.length : TxTypes.length;
  for (let i = 0; i < length; i++) {
    TxTypes[i] = replaceTxTypes[i];
  }

  return TxTypes;
};

/**
  Initialize users and list of adreces of the users.
  @method
  @async
  */
const initializeUsersParameters = async () => {
  const signingKeysUsers = [signingKeys.user1, signingKeys.user2];
  const mnemonicsUsers = [mnemonics.user1, mnemonics.user2];

  const environmentUser1 = { ...environment };
  environmentUser1.clientApiUrl = clientApiUrls.client1 || environmentUser1.clientApiUrl;
  environmentUser1.optimistApiUrl = optimistApiUrls.optimist1 || environmentUser1.optimistApiUrl;
  environmentUser1.optimistWsUrl = optimistWsUrls.optimist1 || environmentUser1.optimistWsUrl;
  const nf3User1 = new Nf3(signingKeys.user1, environmentUser1);
  nf3User1.txTypes = getTxTypesToSend([]);
  nf3Users.push(nf3User1);

  const environmentUser2 = { ...environment };
  environmentUser2.clientApiUrl = clientApiUrls.client2 || environmentUser2.clientApiUrl;
  environmentUser2.optimistApiUrl = optimistApiUrls.optimist2 || environmentUser2.optimistApiUrl;
  environmentUser2.optimistWsUrl = optimistWsUrls.optimist2 || environmentUser2.optimistWsUrl;
  const nf3User2 = new Nf3(signingKeys.user2, environmentUser2);
  nf3User2.txTypes = getTxTypesToSend(CLIENT2_TX_TYPES_SEQUENCE.split(','));
  nf3Users.push(nf3User2);

  for (let i = 0; i < signingKeysUsers.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    await nf3Users[i].init(mnemonicsUsers[i]);
    // eslint-disable-next-line no-await-in-loop
    const balance = await nf3Users[i].getL1Balance(nf3Users[i].ethereumAddress);
    // eslint-disable-next-line no-await-in-loop
    const tokenBalance = await retrieveL2Balance(nf3Users[i], ercAddress);
    console.log(`USER:`, {
      ethereumAddress: nf3Users[i].ethereumAddress,
      compressedZkpPublicKey: nf3Users[i].zkpKeys.compressedZkpPublicKey,
      l1_balance: balance,
      l2_balance: tokenBalance,
    });
  }

  // add addresses of the users
  for (let i = 0; i < nf3Users.length; i++) {
    listAddresses.push(nf3Users[i].zkpKeys.compressedZkpPublicKey);
  }
};

/**
  Wait for all the transactions of the users to be completed.
  @method
  @async
  */
const waitForTransactionsCompleted = async () => {
  let nTotalTransactions = 0;

  do {
    nTotalTransactions = 0;
    for (let i = 0; i < listTransactionsTotal.length; i++) {
      nTotalTransactions += listTransactionsTotal[i].length;
    }
    console.log(
      `Waiting for total transactions to be ${TEST_LENGTH * 5 * nf3Users.length}...`,
      nTotalTransactions,
    );
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolving => setTimeout(resolving, 20000));
  } while (nTotalTransactions < TEST_LENGTH * 5 * nf3Users.length);
  console.log('TRANSACTIONS: ', listTransactionsTotal);
};

/**
  Wait for the balance of all the users to be updated.
  @method
  @async
  @param {object} usersStats - Statistics for the user
  */
const waitForBalanceUpdate = async usersStats => {
  for (let i = 0; i < nf3Users.length; i++) {
    let totalValueUserL2 = 0;
    // eslint-disable-next-line no-loop-func
    for (let j = 0; j < listTransactionsTotal.length; j++) {
      // eslint-disable-next-line no-loop-func
      listTransactionsTotal[j].forEach(t => {
        if (t.typeSequence === 'ValidTransaction') {
          if (t.type === 'withdraw' && t.from === nf3Users[i].zkpKeys.compressedZkpPublicKey) {
            totalValueUserL2 -= t.value + t.fee;
          } else if (t.type === 'deposit' && t.to === nf3Users[i].zkpKeys.compressedZkpPublicKey) {
            totalValueUserL2 += t.value - t.fee;
          } else if (t.type === 'transfer') {
            if (t.to === nf3Users[i].zkpKeys.compressedZkpPublicKey) {
              totalValueUserL2 += t.value;
            }
            if (t.from === nf3Users[i].zkpKeys.compressedZkpPublicKey) {
              totalValueUserL2 -= t.value + t.fee;
            }
          }
        }
      });
    }

    const userInitialBalance = usersStats.usersInitialBalance.filter(
      // eslint-disable-next-line no-loop-func
      u => u.address === nf3Users[i].zkpKeys.compressedZkpPublicKey,
    )[0]?.balance;

    usersStats.usersTotalValueL2.push({
      address: nf3Users[i].zkpKeys.compressedZkpPublicKey,
      value: totalValueUserL2,
    });

    // eslint-disable-next-line no-await-in-loop
    let userFinalBalance = await retrieveL2Balance(nf3Users[i], ercAddress);

    while (userFinalBalance !== userInitialBalance + totalValueUserL2) {
      // eslint-disable-next-line no-await-in-loop
      console.log(
        `Waiting for user ${nf3Users[i].zkpKeys.compressedZkpPublicKey} balance to be ${
          userInitialBalance + totalValueUserL2
        }...`,
        userFinalBalance,
      );
      // eslint-disable-next-line no-await-in-loop
      userFinalBalance = await retrieveL2Balance(nf3Users[i], ercAddress);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolving => setTimeout(resolving, 20000));
    }

    console.log(
      `Final user balance for user ${
        nf3Users[i].zkpKeys.compressedZkpPublicKey
      } = ${userFinalBalance} (expected ${userInitialBalance + totalValueUserL2})`,
    );

    usersStats.usersFinalBalance.push({
      address: nf3Users[i].zkpKeys.compressedZkpPublicKey,
      // eslint-disable-next-line no-await-in-loop
      balance: await retrieveL2Balance(nf3Users[i], ercAddress),
    });
  }
};

/**
  Check statistics at the end of the tests about proposers.
  @method
  @async
  @param {object} optimistUrls - optimist urls for each proposer
  @param {object} proposersStats - proposer statistics during the test
  */
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

/**
  Ping pong test for doing deposits, transfers and withdraws between users and check final balance
  */
describe('Ping-pong tests', () => {
  before(async () => {
    environment.clientApiUrl = clientApiUrls.client1 || environment.clientApiUrl;
    environment.optimistApiUrl = optimistApiUrls.optimist1 || environment.optimistApiUrl;
    environment.optimistWsUrl = optimistWsUrls.optimist1 || environment.optimistWsUrl;

    nf3User = new Nf3(signingKeys.liquidityProvider, environment);

    await nf3User.init(mnemonics.liquidityProvider);
    await setParametersConfig(nf3User); // initialize parameters and contracts for test
    ercAddress = TEST_ERC20_ADDRESS || (await nf3User.getContractAddress('ERC20Mock'));
  });

  it('Runs ping-pong tests', async () => {
    const optimistUrls = await getOptimistUrls(); // get optimist urls for the different proposers
    const proposersStats = await getInitialProposerStats(optimistUrls);
    const withdrawalTxHash = [];
    blockStake = await nf3User.getBlockStake();
    console.log('BLOCKSTAKE: ', blockStake);
    // wait for the current proposer to be ready
    await waitForCurrentProposer();

    // set user parameters
    await initializeUsersParameters();
    const usersStats = await getInitialUserStats();

    for (let i = 0; i < nf3Users.length; i++) {
      const listAddressesToSend = listAddresses.filter(
        // eslint-disable-next-line no-loop-func
        address => address !== nf3Users[i].zkpKeys.compressedZkpPublicKey,
      );
      const listTransactionsUser = []; // transfers done in the simple user test for this user
      listTransactionsTotal.push(listTransactionsUser);
      withdrawalTxHash.push(
        simpleUserTest(
          TEST_LENGTH,
          value,
          fee,
          ercAddress,
          nf3Users[i],
          listAddressesToSend,
          listTransactionsUser,
        ),
      );
    }

    // user that will rotate proposers and get block statistics
    proposerStats(optimistUrls, proposersStats, nf3User);

    // wait for all the user transactions to be completed
    await waitForTransactionsCompleted();

    // wait for balances update
    await waitForBalanceUpdate(usersStats);

    // check final stats are ok
    await finalStatsCheck(optimistUrls, proposersStats);

    const nodeInfo = await web3Client.getInfo();
    if (nodeInfo.includes('TestRPC')) {
      await web3Client.timeJump(3600 * 24 * 10);
      const availableWithdrawalTxHash = Promise.all(withdrawalTxHash[0]);
      const finalRes = [];
      for (let i = 0; i < availableWithdrawalTxHash.length; i++) {
        finalRes.push(nf3User[0].finaliseWithdrawal(availableWithdrawalTxHash[i]));
      }
      console.log('sdsdsd', Promise.all(finalRes));
    }
  });

  after(async () => {
    nf3User.close();
  });
});
