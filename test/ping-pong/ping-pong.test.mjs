import config from 'config';
import { expect } from 'chai';
import Nf3 from '../../cli/lib/nf3.mjs';
import {
  userTest,
  proposerTest,
  setParametersConfig,
  getStakeAccount,
  getCurrentProposer,
} from './index.mjs';

const { mnemonics, signingKeys, clientApiUrls, optimistApiUrls, optimistWsUrls } =
  config.TEST_OPTIONS;
const environment = config.ENVIRONMENTS[process.env.ENVIRONMENT] || config.ENVIRONMENTS.localhost;

let result;
// let initialCurrentProposer = false;

environment.clientApiUrl = clientApiUrls.client1 || environment.clientApiUrl;
environment.optimistApiUrl = optimistApiUrls.optimist1 || environment.optimistApiUrl;
environment.optimistWsUrl = optimistWsUrls.optimist1 || environment.optimistWsUrl;

console.log(environment);
const nf3User = new Nf3(signingKeys.liquidityProvider, environment);

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
      proposer: '0xdb080dC48961bC1D67a0A4151572eCb824cC76E8',
      optimistUrl: optimistApiUrls.optimist2,
    },
    {
      proposer: '0xa12D5C4921518980c57Ce3fFe275593e4BAB9211',
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

const waitForCurrentProposer = async () => {
  let currentProposer = await getCurrentProposer();
  // let proposers boot and wait until we have the current proposer registered from the services
  while (currentProposer.thisAddress === '0x0000000000000000000000000000000000000000') {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, 10000));
    // eslint-disable-next-line no-await-in-loop
    currentProposer = await getCurrentProposer();
  }
};

describe('Ping-pong tests', () => {
  before(async () => {
    await nf3User.init(mnemonics.liquidityProvider);
    await setParametersConfig(nf3User); // initialize parameters and contracts
  });

  it('Runs ping-pong tests', async () => {
    const optimistUrls = await getOptimistUrls(); // get optimist urls for the different proposers from docker files
    console.log(optimistUrls);
    const proposersStats = await getInitialProposerStats(optimistUrls);
    await waitForCurrentProposer();

    const blockStake = await nf3User.getBlockStake();
    console.log('BLOCKSTAKE: ', blockStake);

    userTest(false, optimistUrls); // user 1 sending deposit & transfer operations
    proposerTest(optimistUrls, proposersStats, nf3User); // user to rotate proposers and get block statistics
    result = await userTest(true, optimistUrls); // user 2 sending deposit & transfer operations
    expect(result).to.be.equal(0); // expect 0 success, 1 error

    for (const prop of optimistUrls) {
      // eslint-disable-next-line no-await-in-loop
      const stakeAccount = await getStakeAccount(prop.proposer);
      proposersStats.proposersFinalStakes.push({
        proposer: prop.proposer.toUpperCase(),
        stake: stakeAccount,
      });
    }

    if (proposersStats.proposersBlocks) {
      console.log('FINAL STATS:');
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
        const pInitial = proposersStats.proposersInitialStakes.find(
          pi => pi.proposer === p.proposer,
        );
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
    nf3User.close();
  });

  /* after(async () => {
     if (!initialCurrentProposer) {
      console.log('Stopping containers...');
      try {
        await compose.down(dockerComposeOptions);
      } catch (e) {
        // while removing network: network nightfall_3_nightfall_network has active endpoints
      }
      console.log('Removing volumes...');
      const data = await docker.command('volume ls -q');
      const volumes = data.raw.split('\n').filter(c => c.includes('nightfall_3_optimist_mongodb'));
      for (const v of volumes) {
        console.log(`Removing volume ${v}...`);
        // eslint-disable-next-line no-await-in-loop
        await docker.command(`volume rm ${v}`);
      }
    }
  }); */
});
